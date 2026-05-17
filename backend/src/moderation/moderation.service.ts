import { Injectable, Logger } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { moderateLight } from "./moderation-light";
import { ModerationAction, ModerationResult } from "./moderation.types";

interface WarnTokenEntry {
  socketId: string;
  text: string;
  expiresAt: number;
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private readonly warnTokens = new Map<string, WarnTokenEntry>();
  private readonly resultCache = new Map<string, { result: ModerationResult; expiresAt: number }>();

  private readonly serviceUrl =
    process.env.MODERATION_SERVICE_URL || "http://localhost:8000";
  private readonly timeoutMs = Number(process.env.MODERATION_TIMEOUT_MS || 300);
  private readonly fallbackOnDown: ModerationAction =
    (process.env.MODERATION_FALLBACK_ON_DOWN as ModerationAction) || "allow";
  private readonly cacheTtlMs = Number(process.env.MODERATION_CACHE_TTL_MS || 60_000);

  async moderateText(text: string): Promise<ModerationResult> {
    const cacheKey = this.hashText(text);
    const cached = this.resultCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.result, cached: true };
    }

    try {
      const result = await this.callDetoxify(text);
      this.resultCache.set(cacheKey, {
        result,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
      return result;
    } catch (error) {
      this.logger.warn(
        `Detoxify unavailable (${error instanceof Error ? error.message : "error"}), using light fallback`,
      );
      const fallback = moderateLight(text);
      if (this.fallbackOnDown === "allow" && fallback.action !== "block") {
        return {
          ...fallback,
          action: "allow",
          is_toxic: false,
          reason: "Modération indisponible — message autorisé (fallback)",
          source: "fallback",
        };
      }
      if (this.fallbackOnDown === "warn" && fallback.action === "allow") {
        return {
          ...fallback,
          action: "warn",
          is_toxic: true,
          reason: "Modération indisponible — vérifiez votre formulation",
          source: "fallback",
        };
      }
      return { ...fallback, source: "fallback" };
    }
  }

  issueWarnToken(socketId: string, text: string): string {
    const token = randomBytes(16).toString("hex");
    this.warnTokens.set(token, {
      socketId,
      text: text.trim(),
      expiresAt: Date.now() + 120_000,
    });
    this.pruneWarnTokens();
    return token;
  }

  consumeWarnToken(token: string, socketId: string, text: string): boolean {
    const entry = this.warnTokens.get(token);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.warnTokens.delete(token);
      return false;
    }
    if (entry.socketId !== socketId || entry.text !== text.trim()) {
      return false;
    }
    this.warnTokens.delete(token);
    return true;
  }

  getBlockMessage(): string {
    return "Ton message ne respecte pas les règles, reformule-le.";
  }

  getWarnMessage(): string {
    return "Ce message pourrait être perçu comme agressif, veux-tu le modifier ?";
  }

  private async callDetoxify(text: string): Promise<ModerationResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.serviceUrl}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as ModerationResult;
      return { ...data, source: "detoxify" };
    } finally {
      clearTimeout(timer);
    }
  }

  private hashText(text: string): string {
    return createHash("sha256").update(text.trim().toLowerCase()).digest("hex");
  }

  private pruneWarnTokens(): void {
    const now = Date.now();
    for (const [key, entry] of this.warnTokens) {
      if (entry.expiresAt < now) this.warnTokens.delete(key);
    }
  }
}
