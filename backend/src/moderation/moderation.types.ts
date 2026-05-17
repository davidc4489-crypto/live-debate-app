export type ModerationAction = "allow" | "warn" | "block";

export interface ModerationScores {
  toxicity: number;
  insult: number;
  threat: number;
  identity_hate: number;
}

export interface ModerationResult extends ModerationScores {
  is_toxic: boolean;
  action: ModerationAction;
  reason: string | null;
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
}
