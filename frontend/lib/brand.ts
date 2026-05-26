export const APP_NAME = "Argumen";

export const APP_TAGLINE = "Apprendre à argumenter, pas à réagir";

export const PRODUCT_POSITIONING =
  "Une plateforme pour apprendre à argumenter, réfléchir et comprendre les idées grâce à des débats structurés — avec des humains ou l'IA.";

export const AI_ROLES = {
  opponent: {
    id: "opponent",
    title: "AI Opponent",
    shortTitle: "Adversaire IA",
    description:
      "Un partenaire qui contre-argumente sur votre position, sans injure ni dérive — pour tester vos idées.",
  },
  judge: {
    id: "judge",
    title: "AI Judge",
    shortTitle: "Juge IA",
    description:
      "Évalue la force, la clarté et la pertinence des arguments des deux camps en fin d'échange.",
  },
  coach: {
    id: "coach",
    title: "AI Coach",
    shortTitle: "Coach IA",
    description:
      "Suggère comment reformuler, structurer ou renforcer vos arguments — sans écrire à votre place.",
  },
} as const;
