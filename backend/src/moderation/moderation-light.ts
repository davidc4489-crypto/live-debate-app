import { ModerationCategory, ModerationResult } from "./moderation.types";

/**
 * Filtre lexical local (sans Python) — port du lexique `app/lexicon.py`.
 *
 * Utilisé quand le service Detoxify est indisponible : mêmes règles, mêmes
 * catégories, mêmes conseils de reformulation que le service principal, pour
 * que l'expérience utilisateur ne change pas en mode dégradé.
 */

interface LexiconRule {
  pattern: RegExp;
  category: ModerationCategory;
  score: number;
}

const RULES: LexiconRule[] = [
  // Insultes (FR)
  { pattern: /\b(connard|connasse|salope|pute|encule|enculee|fdp|ntm)\b/, category: "insult", score: 0.92 },
  { pattern: /\b(batard|salaud|enfoire|enfoiree|ordure|raclure)\b/, category: "insult", score: 0.85 },
  { pattern: /\bva te faire (foutre|voir|enculer|mettre)\b/, category: "insult", score: 0.9 },
  { pattern: /\b(abruti|abrutie|cretin|debile|imbecile|idiot|idiote|stupide|conne)\b/, category: "insult", score: 0.72 },
  { pattern: /\b(ta gueule|ferme ta gueule|ferme-la|tais-toi|degage)\b/, category: "insult", score: 0.68 },
  { pattern: /\b(nul a chier|minable|pathetique|lamentable)\b/, category: "insult", score: 0.55 },
  // Insultes (EN)
  { pattern: /\b(fuck you|fucker|asshole|bitch|bastard|moron|retard)\b/, category: "insult", score: 0.9 },
  { pattern: /\b(stupid|idiot|dumb|shut up|loser)\b/, category: "insult", score: 0.6 },
  // Menaces
  { pattern: /\b(je vais te (tuer|buter|crever|defoncer|casser)|te casser la gueule)\b/, category: "threat", score: 0.95 },
  { pattern: /\b(va (crever|mourir)|tue-toi|suicide-toi|creve)\b/, category: "threat", score: 0.9 },
  { pattern: /\b(on sait ou tu habites|je te retrouverai|tu vas payer|tu vas le regretter)\b/, category: "threat", score: 0.85 },
  { pattern: /\b(i will (kill|hurt|find) you|kill yourself|kys)\b/, category: "threat", score: 0.95 },
  // Haine identitaire
  { pattern: /\b(sale (juif|arabe|noir|blanc|musulman|chretien|pede|gay))\b/, category: "identity_hate", score: 0.95 },
  { pattern: /\b(bougnoule|negre|youpin|pede|tapette|tarlouze|gouine)\b/, category: "identity_hate", score: 0.95 },
  { pattern: /\b(retourne dans ton pays|rentre chez toi)\b/, category: "identity_hate", score: 0.75 },
  { pattern: /\b(nigger|faggot|kike)\b/, category: "identity_hate", score: 0.95 },
  // Déshumanisation
  { pattern: /\b(sous-?homme|vermine|parasites?|cafards?|il faut (les|le|la) (eliminer|exterminer))\b/, category: "severe_toxicity", score: 0.85 },
  // Grossièretés
  { pattern: /\b(merde|putain|bordel|chier|foutre)\b/, category: "obscene", score: 0.4 },
  { pattern: /\b(shit|fuck|damn)\b/, category: "obscene", score: 0.4 },
];

const SUGGESTIONS: Partial<Record<ModerationCategory, string>> = {
  threat: "Retire toute formulation qui vise la personne physiquement.",
  identity_hate: "Vise l'argument, jamais un groupe ou une identité.",
  insult: "Critique l'idée plutôt que la personne.",
  severe_toxicity: "Reformule sans déshumaniser ton interlocuteur.",
  obscene: "Retire les grossièretés : le fond passe mieux sans elles.",
  toxicity: "Adoucis le ton et développe ton argument.",
};

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s",
};

/** Minuscule, sans accents, anti-leetspeak, anti `c.o.n.n.a.r.d`. */
export function normalizeForLexicon(text: string): string {
  return text
    .toLowerCase()
    .replace(/[01345 7@$]/g, (char) => LEET[char] ?? char)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/[._\-*]+(?=\w)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function moderateLight(text: string): ModerationResult {
  const normalized = normalizeForLexicon(text);
  const scores: Record<string, number> = {
    toxicity: 0,
    insult: 0,
    threat: 0,
    identity_hate: 0,
    severe_toxicity: 0,
    obscene: 0,
  };

  for (const rule of RULES) {
    if (rule.pattern.test(normalized)) {
      scores[rule.category] = Math.max(scores[rule.category], rule.score);
    }
  }
  if (scores.severe_toxicity > 0) {
    scores.identity_hate = Math.max(scores.identity_hate, 0.8);
  }

  const letters = text.replace(/[^a-zA-Zà-üÀ-Ü]/g, "");
  if (letters.length >= 12) {
    const capsRatio = letters.split("").filter((char) => char === char.toUpperCase()).length / letters.length;
    if (capsRatio > 0.75) scores.insult = Math.max(scores.insult, 0.3);
  }

  scores.toxicity = Math.max(
    scores.insult,
    scores.threat,
    scores.identity_hate,
    scores.severe_toxicity,
    scores.obscene * 0.6,
  );

  const categories = (Object.keys(scores) as ModerationCategory[])
    .filter((category) => category !== "toxicity" && scores[category] >= 0.45)
    .sort((a, b) => scores[b] - scores[a]);

  const top = categories[0] ?? "toxicity";
  const action =
    scores.threat >= 0.7 ||
    scores.identity_hate >= 0.7 ||
    scores.severe_toxicity >= 0.5 ||
    scores.insult >= 0.8 ||
    scores.toxicity >= 0.75
      ? "block"
      : scores.toxicity >= 0.5
        ? "warn"
        : "allow";

  const reason =
    action === "block"
      ? "Contenu bloqué (filtre lexical local)"
      : action === "warn"
        ? "Contenu potentiellement agressif (filtre lexical local)"
        : null;

  return {
    toxicity: Number(scores.toxicity.toFixed(4)),
    insult: Number(scores.insult.toFixed(4)),
    threat: Number(scores.threat.toFixed(4)),
    identity_hate: Number(scores.identity_hate.toFixed(4)),
    severe_toxicity: Number(scores.severe_toxicity.toFixed(4)),
    obscene: Number(scores.obscene.toFixed(4)),
    is_toxic: action !== "allow",
    action,
    reason,
    categories: action === "allow" ? [] : categories.length ? categories : [top],
    severity: Number(scores.toxicity.toFixed(4)),
    suggestion: action === "allow" ? null : (SUGGESTIONS[top] ?? null),
    language: "fr",
    models: ["lexicon:fr-en"],
    degraded: true,
    source: "light",
  };
}
