/** Contrats partagés avec la modération v2 (service Python + gateway NestJS). */

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
}

export interface ModerationWarnPayload {
  roomId: string;
  text: string;
  warnToken: string;
  message: string;
  scores?: ModerationScores;
  categories?: ModerationCategory[];
  suggestion?: string | null;
  severity?: number;
}

export interface MessageInsight {
  messageId: string;
  qualityScore: number;
  qualityLabel: string;
  tips: string[];
  signals: string[];
  sentiment: { label: string; score: number } | null;
}

export interface DebateInsights {
  roomId: string;
  qualityScore: number;
  civilityScore: number;
  messagesAnalyzed: number;
  trend: "up" | "down" | "stable";
}

const CATEGORY_LABELS: Record<ModerationCategory, string> = {
  insult: "Insulte",
  threat: "Menace",
  identity_hate: "Haine identitaire",
  severe_toxicity: "Propos déshumanisants",
  obscene: "Grossièreté",
  sexual_explicit: "Contenu explicite",
  toxicity: "Ton agressif",
};

const SIGNAL_LABELS: Record<string, string> = {
  connecteurs_logiques: "Raisonnement structuré",
  sources_ou_chiffres: "Chiffres ou sources",
  modalisation: "Formulation nuancée",
  attaque_ad_hominem: "Attaque personnelle",
  généralisation: "Généralisation",
  majuscules_excessives: "Majuscules excessives",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as ModerationCategory] ?? category;
}

export function signalLabel(signal: string): string {
  return SIGNAL_LABELS[signal] ?? signal;
}

/** Un signal est positif s'il valorise l'argumentation plutôt qu'il ne l'alerte. */
export function isPositiveSignal(signal: string): boolean {
  return ["connecteurs_logiques", "sources_ou_chiffres", "modalisation"].includes(signal);
}

export function scoreTone(score: number): "good" | "medium" | "low" {
  if (score >= 70) return "good";
  if (score >= 45) return "medium";
  return "low";
}
