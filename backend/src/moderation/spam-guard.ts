import { Injectable } from "@nestjs/common";

export interface SpamVerdict {
  blocked: boolean;
  reason?: string;
  code?: "RATE_LIMIT" | "DUPLICATE" | "FLOOD_CHARS";
  retryAfterMs?: number;
}

interface AuthorState {
  timestamps: number[];
  recentTexts: { text: string; at: number }[];
}

/**
 * Garde anti-spam déterministe, en amont des modèles.
 *
 * La modélisation ML ne détecte pas le flood ni la répétition : ce filtre coûte
 * zéro appel réseau et protège aussi le service Python d'une rafale de requêtes.
 */
@Injectable()
export class SpamGuard {
  private readonly authors = new Map<string, AuthorState>();

  private readonly windowMs = Number(process.env.MODERATION_RATE_WINDOW_MS || 10_000);
  private readonly maxPerWindow = Number(process.env.MODERATION_RATE_MAX || 5);
  private readonly duplicateWindowMs = Number(
    process.env.MODERATION_DUPLICATE_WINDOW_MS || 60_000,
  );
  private readonly maxDuplicates = Number(process.env.MODERATION_DUPLICATE_MAX || 2);

  check(authorKey: string, text: string): SpamVerdict {
    const now = Date.now();
    const state = this.authors.get(authorKey) ?? { timestamps: [], recentTexts: [] };

    state.timestamps = state.timestamps.filter((at) => now - at < this.windowMs);
    state.recentTexts = state.recentTexts.filter((entry) => now - entry.at < this.duplicateWindowMs);

    if (state.timestamps.length >= this.maxPerWindow) {
      const oldest = state.timestamps[0];
      this.authors.set(authorKey, state);
      return {
        blocked: true,
        code: "RATE_LIMIT",
        reason: "Tu écris trop vite — laisse à ton interlocuteur le temps de répondre.",
        retryAfterMs: Math.max(0, this.windowMs - (now - oldest)),
      };
    }

    const normalized = this.normalize(text);
    const duplicates = state.recentTexts.filter(
      (entry) => this.normalize(entry.text) === normalized,
    ).length;
    if (normalized.length > 0 && duplicates >= this.maxDuplicates) {
      this.authors.set(authorKey, state);
      return {
        blocked: true,
        code: "DUPLICATE",
        reason: "Message déjà envoyé — reformule plutôt que de répéter.",
      };
    }

    // Mur de caractères sans espace (contournement classique des filtres).
    const longestToken = text
      .split(/\s+/)
      .reduce((max, token) => Math.max(max, token.length), 0);
    if (longestToken > 120) {
      return {
        blocked: true,
        code: "FLOOD_CHARS",
        reason: "Message illisible (bloc de caractères trop long).",
      };
    }

    state.timestamps.push(now);
    state.recentTexts.push({ text, at: now });
    this.authors.set(authorKey, state);
    return { blocked: false };
  }

  forget(authorKey: string): void {
    this.authors.delete(authorKey);
  }

  /** Purge les auteurs inactifs (appelée périodiquement par la gateway). */
  prune(): void {
    const now = Date.now();
    for (const [key, state] of this.authors) {
      const lastSeen = Math.max(
        state.timestamps.at(-1) ?? 0,
        state.recentTexts.at(-1)?.at ?? 0,
      );
      if (now - lastSeen > this.duplicateWindowMs * 2) {
        this.authors.delete(key);
      }
    }
  }

  private normalize(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, " ");
  }
}
