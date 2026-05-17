import { ModerationResult } from "./moderation.types";

/**
 * Fallback JS léger (sans Python) — heuristiques + liste réduite.
 * Utilisé si le service Detoxify est indisponible.
 */
const BLOCK_PATTERNS = [
  /\b(nique|ntm|fdp|encul[eé]|salope|pute|batard|bâtard)\b/i,
  /\b(crev[eé]|meurt|tuer|tue-toi|suicide)\b/i,
];

const WARN_PATTERNS = [
  /\b(idiot|stupide|debile|débile|nul|pathétique|honteux)\b/i,
  /\b(tais-toi|ferme-la|ta gueule)\b/i,
];

export function moderateLight(text: string): ModerationResult {
  const normalized = text.trim().toLowerCase();

  for (const pattern of BLOCK_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        toxicity: 0.85,
        insult: 0.8,
        threat: 0.5,
        identity_hate: 0.3,
        is_toxic: true,
        action: "block",
        reason: "Contenu bloqué (filtre léger)",
        source: "light",
      };
    }
  }

  for (const pattern of WARN_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        toxicity: 0.55,
        insult: 0.5,
        threat: 0.2,
        identity_hate: 0.1,
        is_toxic: true,
        action: "warn",
        reason: "Contenu potentiellement agressif (filtre léger)",
        source: "light",
      };
    }
  }

  return {
    toxicity: 0.05,
    insult: 0.05,
    threat: 0.05,
    identity_hate: 0.05,
    is_toxic: false,
    action: "allow",
    reason: null,
    source: "light",
  };
}
