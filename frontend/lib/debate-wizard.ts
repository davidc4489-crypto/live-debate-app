export type DebateStance = "for" | "against";

export const STANCE_LABELS: Record<DebateStance, string> = {
  for: "Pour",
  against: "Contre",
};

/**
 * Étapes du lancement d'un débat.
 *
 * L'étape « Adversaire » (humain ou IA) a été retirée : Argumen est une
 * plateforme de débat entre deux personnes. L'IA n'intervient que pour la
 * modération et les indicateurs de qualité, jamais comme interlocuteur.
 */
export const WIZARD_STEPS = [
  { id: "topic", label: "Sujet" },
  { id: "stance", label: "Position" },
  { id: "launch", label: "Lancement" },
] as const;
