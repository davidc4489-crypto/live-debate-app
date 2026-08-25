import { Injectable, Logger } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { moderateLight } from "./moderation-light";
import {
  MessageAnalysis,
  ModerationAction,
  ModerationResult,
  ModerationStats,
} from "./moderation.types";

interface WarnTokenEntry {
  socketId: string;
  text: string;
  expiresAt: number;
  /** Verdict qui a déclenché l'avertissement, réutilisé à la confirmation. */
  result: ModerationResult;
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private readonly warnTokens = new Map<string, WarnTokenEntry>();
  private readonly resultCache = new Map<string, { result: ModerationResult; expiresAt: number }>();

  private readonly serviceUrl =
    process.env.MODERATION_SERVICE_URL || "http://localhost:8000";
  private readonly timeoutMs = Number(process.env.MODERATION_TIMEOUT_MS || 300);
  private readonly analyzeTimeoutMs = Number(process.env.MODERATION_ANALYZE_TIMEOUT_MS || 500);
  // Zero-shot sur CPU : ~3 s. Appelé une fois par débat, jamais par message.
  private readonly classifyTimeoutMs = Number(process.env.MODERATION_CLASSIFY_TIMEOUT_MS || 8_000);
  private readonly fallbackOnDown: ModerationAction =
    (process.env.MODERATION_FALLBACK_ON_DOWN as ModerationAction) || "allow";
  private readonly cacheTtlMs = Number(process.env.MODERATION_CACHE_TTL_MS || 60_000);

  // --- Circuit breaker -----------------------------------------------------
  // Sans lui, chaque message paie `timeoutMs` tant que le service est down.
  private readonly failureThreshold = Number(process.env.MODERATION_CIRCUIT_FAILURES || 3);
  private readonly circuitResetMs = Number(process.env.MODERATION_CIRCUIT_RESET_MS || 15_000);
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  // --- Statistiques --------------------------------------------------------
  private stats = {
    requests: 0,
    allowed: 0,
    warned: 0,
    blocked: 0,
    fallbacks: 0,
    cacheHits: 0,
    latencySum: 0,
    latencyCount: 0,
    byCategory: {} as Record<string, number>,
  };

  async moderateText(text: string): Promise<ModerationResult> {
    const cacheKey = this.hashText(text);
    const cached = this.resultCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.stats.cacheHits += 1;
      return this.record({ ...cached.result, cached: true });
    }

    if (this.circuitIsOpen()) {
      return this.record(this.applyFallback(text, "circuit ouvert"));
    }

    const startedAt = Date.now();
    try {
      const [result] = await this.callService([text]);
      this.onSuccess(Date.now() - startedAt);
      this.resultCache.set(cacheKey, {
        result,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
      this.pruneCache();
      return this.record(result);
    } catch (error) {
      this.onFailure(error);
      return this.record(this.applyFallback(text, this.errorMessage(error)));
    }
  }

  /**
   * Modère plusieurs textes en un seul appel (une passe de batch côté modèle).
   * Utilisé pour re-scorer l'historique d'un débat ou les messages persistés.
   */
  async moderateBatch(texts: string[]): Promise<ModerationResult[]> {
    const cleaned = texts.map((text) => text.trim()).filter(Boolean);
    if (cleaned.length === 0) return [];
    if (this.circuitIsOpen()) {
      return cleaned.map((text) => this.record(this.applyFallback(text, "circuit ouvert")));
    }

    const startedAt = Date.now();
    try {
      const results = await this.callService(cleaned);
      this.onSuccess(Date.now() - startedAt);
      results.forEach((result, index) => {
        this.resultCache.set(this.hashText(cleaned[index]), {
          result,
          expiresAt: Date.now() + this.cacheTtlMs,
        });
      });
      this.pruneCache();
      return results.map((result) => this.record(result));
    } catch (error) {
      this.onFailure(error);
      return cleaned.map((text) =>
        this.record(this.applyFallback(text, this.errorMessage(error))),
      );
    }
  }

  /** Analyse qualitative (score d'argumentation, ton). `null` si indisponible. */
  async analyzeText(text: string): Promise<MessageAnalysis | null> {
    if (this.circuitIsOpen()) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.analyzeTimeoutMs);
    try {
      const response = await fetch(`${this.serviceUrl}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, with_sentiment: true }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as MessageAnalysis;
    } catch (error) {
      this.logger.debug(`analyze indisponible: ${this.errorMessage(error)}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Classification thématique zero-shot d'un sujet de débat. */
  async classifyTopic(
    text: string,
    candidates?: string[],
  ): Promise<{ topic: string | null; confidence: number } | null> {
    if (this.circuitIsOpen()) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.classifyTimeoutMs);
    try {
      const response = await fetch(`${this.serviceUrl}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, candidates }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as {
        topic: string | null;
        confidence: number;
        available?: boolean;
      };
      return data.available === false ? null : data;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  getStats(): ModerationStats {
    return {
      requests: this.stats.requests,
      allowed: this.stats.allowed,
      warned: this.stats.warned,
      blocked: this.stats.blocked,
      fallbacks: this.stats.fallbacks,
      cacheHits: this.stats.cacheHits,
      avgLatencyMs: this.stats.latencyCount
        ? Math.round(this.stats.latencySum / this.stats.latencyCount)
        : 0,
      circuitOpen: this.circuitIsOpen(),
      byCategory: { ...this.stats.byCategory },
      // L'URL interne du service n'est exposée qu'en debug explicite.
      serviceUrl: process.env.MODERATION_EXPOSE_URL === "true" ? this.serviceUrl : "masquée",
    };
  }

  async getServiceHealth(): Promise<{ reachable: boolean; details?: unknown }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1_500);
    try {
      const response = await fetch(`${this.serviceUrl}/health`, { signal: controller.signal });
      if (!response.ok) return { reachable: false };
      return { reachable: true, details: await response.json() };
    } catch (error) {
      return { reachable: false, details: this.errorMessage(error) };
    } finally {
      clearTimeout(timer);
    }
  }

  issueWarnToken(socketId: string, text: string, result: ModerationResult): string {
    const token = randomBytes(16).toString("hex");
    this.warnTokens.set(token, {
      socketId,
      text: text.trim(),
      expiresAt: Date.now() + 120_000,
      result,
    });
    this.pruneWarnTokens();
    return token;
  }

  /**
   * Valide un jeton d'avertissement et rend le verdict déjà calculé.
   *
   * Le verdict est conservé avec le jeton : confirmer un message averti ne doit
   * pas repayer un appel modèle sur le chemin d'envoi, et le cache de résultats
   * (60 s) expire avant le jeton (120 s).
   */
  consumeWarnToken(
    token: string,
    socketId: string,
    text: string,
  ): ModerationResult | null {
    const entry = this.warnTokens.get(token);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.warnTokens.delete(token);
      return null;
    }
    if (entry.socketId !== socketId || entry.text !== text.trim()) {
      return null;
    }
    this.warnTokens.delete(token);
    return entry.result;
  }

  getBlockMessage(result?: ModerationResult): string {
    const base = "Ton message ne respecte pas les règles, reformule-le.";
    return result?.suggestion ? `${base} ${result.suggestion}` : base;
  }

  getWarnMessage(result?: ModerationResult): string {
    const base = "Ce message pourrait être perçu comme agressif, veux-tu le modifier ?";
    return result?.suggestion ? `${base} ${result.suggestion}` : base;
  }

  // ------------------------------------------------------------------ privé

  private async callService(texts: string[]): Promise<ModerationResult[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs * (texts.length > 1 ? 4 : 1));

    try {
      const single = texts.length === 1;
      const response = await fetch(`${this.serviceUrl}${single ? "/moderate" : "/moderate/batch"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(single ? { text: texts[0] } : { texts }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const items: ModerationResult[] = single ? [data] : data.results;
      return items.map((item) => ({ ...item, source: "detoxify" as const }));
    } finally {
      clearTimeout(timer);
    }
  }

  private applyFallback(text: string, cause: string): ModerationResult {
    this.stats.fallbacks += 1;
    this.logger.warn(`Modération dégradée (${cause}) — filtre lexical local`);
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

  private circuitIsOpen(): boolean {
    if (this.circuitOpenUntil === 0) return false;
    if (Date.now() >= this.circuitOpenUntil) {
      // Demi-ouverture : on retente un appel réel.
      this.circuitOpenUntil = 0;
      this.consecutiveFailures = 0;
      this.logger.log("Circuit modération refermé — nouvelle tentative");
      return false;
    }
    return true;
  }

  private onSuccess(latencyMs: number): void {
    this.consecutiveFailures = 0;
    this.circuitOpenUntil = 0;
    this.stats.latencySum += latencyMs;
    this.stats.latencyCount += 1;
  }

  private onFailure(error: unknown): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold && this.circuitOpenUntil === 0) {
      this.circuitOpenUntil = Date.now() + this.circuitResetMs;
      this.logger.warn(
        `Service de modération injoignable (${this.errorMessage(error)}) — circuit ouvert ${this.circuitResetMs}ms`,
      );
    }
  }

  private record(result: ModerationResult): ModerationResult {
    this.stats.requests += 1;
    if (result.action === "block") this.stats.blocked += 1;
    else if (result.action === "warn") this.stats.warned += 1;
    else this.stats.allowed += 1;
    for (const category of result.categories ?? []) {
      this.stats.byCategory[category] = (this.stats.byCategory[category] ?? 0) + 1;
    }
    return result;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.name === "AbortError" ? `timeout ${this.timeoutMs}ms` : error.message;
    }
    return "erreur inconnue";
  }

  private hashText(text: string): string {
    return createHash("sha256").update(text.trim().toLowerCase()).digest("hex");
  }

  private pruneCache(): void {
    if (this.resultCache.size < 5_000) return;
    const now = Date.now();
    for (const [key, entry] of this.resultCache) {
      if (entry.expiresAt < now) this.resultCache.delete(key);
    }
  }

  private pruneWarnTokens(): void {
    const now = Date.now();
    for (const [key, entry] of this.warnTokens) {
      if (entry.expiresAt < now) this.warnTokens.delete(key);
    }
  }
}
