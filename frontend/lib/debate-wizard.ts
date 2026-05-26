export type DebateStance = "for" | "against";
export type OpponentMode = "human" | "ai";

export const STANCE_LABELS: Record<DebateStance, string> = {
  for: "Pour",
  against: "Contre",
};

export const OPPONENT_LABELS: Record<OpponentMode, string> = {
  human: "Un autre utilisateur",
  ai: "L'IA (adversaire)",
};

export const WIZARD_STEPS = [
  { id: "topic", label: "Sujet" },
  { id: "stance", label: "Position" },
  { id: "opponent", label: "Adversaire" },
  { id: "launch", label: "Lancement" },
] as const;
