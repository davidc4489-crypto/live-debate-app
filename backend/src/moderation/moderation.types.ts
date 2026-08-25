export type ModerationAction = "allow" | "warn" | "block";

export type ModerationCategory =
  | "insult"
  | "threat"
  | "identity_hate"
  | "severe_toxicity"
  | "obscene"
  | "sexual_explicit"
  | "toxicity";

export interface ModerationScores {
  toxicity: number;
  insult: number;
  threat: number;
  identity_hate: number;
  severe_toxicity?: number;
  obscene?: number;
  sexual_explicit?: number;
}

export interface ModerationResult extends ModerationScores {
  is_toxic: boolean;
  action: ModerationAction;
  reason: string | null;
  /** Catégories déclenchées, triées par score décroissant. */
  categories?: ModerationCategory[];
  /** Gravité agrégée 0-1 (pondérée par catégorie). */
  severity?: number;
  /** Conseil de reformulation destiné à l'auteur. */
  suggestion?: string | null;
  /** Langue détectée par le service Python. */
  language?: string;
  /** Modèles ayant contribué au score. */
  models?: string[];
  /** true si seul le lexique a répondu (modèles indisponibles). */
  degraded?: boolean;
  cached?: boolean;
  latency_ms?: number;
  source: "detoxify" | "light" | "fallback";
}

export interface ModerationWarnPayload {
  roomId: string;
  text: string;
  warnToken: string;
  scores: ModerationScores;
  message: string;
  categories?: ModerationCategory[];
  suggestion?: string | null;
  severity?: number;
}

/** Analyse qualitative renvoyée par `POST /analyze` du service Python. */
export interface MessageAnalysis {
  quality_score: number;
  quality_label: string;
  breakdown: {
    words: number;
    structure: number;
    evidence: number;
    civility: number;
    nuance: number;
    signals: string[];
  };
  tips: string[];
  sentiment: { label: string; score: number } | null;
  language: string;
}

export interface ModerationStats {
  requests: number;
  allowed: number;
  warned: number;
  blocked: number;
  fallbacks: number;
  cacheHits: number;
  avgLatencyMs: number;
  circuitOpen: boolean;
  byCategory: Record<string, number>;
  serviceUrl: string;
}
