export const APP_NAME = "Argumen";

export const APP_TAGLINE = "Apprendre à argumenter, pas à réagir";

export const PRODUCT_POSITIONING =
  "Une plateforme de débats structurés entre deux personnes : un sujet, deux camps, " +
  "des tours de parole. Vous prenez le temps de construire un argument, et l'autre " +
  "prend le temps d'y répondre.";

/**
 * Ce que l'IA fait réellement dans l'application.
 *
 * Elle n'est jamais un interlocuteur : on ne débat pas contre elle, elle
 * n'écrit aucun message et ne prend jamais parti. Elle sécurise l'échange et
 * renvoie des indicateurs. N'ajoutez ici que des rôles réellement implémentés —
 * cette liste alimente les pages publiques.
 */
export const AI_ROLES = {
  moderation: {
    id: "moderation",
    title: "Modération",
    shortTitle: "Modération en direct",
    description:
      "Chaque message est analysé avant publication. Les propos injurieux ou haineux sont bloqués, les formulations limites signalées à leur auteur avant l'envoi.",
  },
  quality: {
    id: "quality",
    title: "Climat du débat",
    shortTitle: "Climat du débat",
    description:
      "Un indice de civilité et de qualité argumentative, calculé au fil de l'échange et visible par les deux participants.",
  },
  coach: {
    id: "coach",
    title: "Retour privé",
    shortTitle: "Retour privé",
    description:
      "Après chaque message, vous seul recevez des pistes pour structurer ou étayer votre argument. Rien n'est écrit à votre place.",
  },
} as const;
