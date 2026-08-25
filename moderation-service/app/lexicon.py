"""Lexique FR/EN par catégorie.

Sert deux rôles :
1. donner une granularité par catégorie là où le modèle multilingue ne renvoie
   qu'un score global (`toxic` / `not_toxic`) ;
2. rester opérationnel sans aucun modèle (backend `heuristic`, CI, service dégradé).

Les scores sont volontairement conservateurs : ils *complètent* le modèle, ils ne
le remplacent pas — la décision finale prend le max par catégorie.
"""

from __future__ import annotations

import re
import unicodedata

Category = str

CATEGORIES: tuple[Category, ...] = (
    "insult",
    "threat",
    "identity_hate",
    "severe_toxicity",
    "obscene",
)

# (regex, catégorie, score)
_RULES: list[tuple[re.Pattern[str], Category, float]] = [
    # --- insultes directes (FR) -------------------------------------------
    (re.compile(r"\b(connard|connasse|salope|pute|encule|enculee|fdp|ntm)\b"), "insult", 0.92),
    (re.compile(r"\b(batard|salaud|enfoire|enfoiree|ordure|raclure)\b"), "insult", 0.85),
    (re.compile(r"\bva te faire (foutre|voir|enculer|mettre)\b"), "insult", 0.9),
    (re.compile(r"\b(abruti|abrutie|cretin|debile|imbecile|idiot|idiote|stupide|conne)\b"), "insult", 0.72),
    (re.compile(r"\b(ta gueule|ferme ta gueule|ferme-la|tais-toi|degage)\b"), "insult", 0.68),
    (re.compile(r"\b(nul a chier|minable|pathetique|lamentable|risible)\b"), "insult", 0.55),
    # --- insultes directes (EN) -------------------------------------------
    (re.compile(r"\b(fuck you|fucker|asshole|bitch|bastard|moron|retard)\b"), "insult", 0.9),
    (re.compile(r"\b(stupid|idiot|dumb|shut up|loser)\b"), "insult", 0.6),
    # --- menaces -----------------------------------------------------------
    (re.compile(r"\b(je vais te (tuer|buter|crever|defoncer|casser)|te casser la gueule)\b"), "threat", 0.95),
    (re.compile(r"\b(va (crever|mourir)|crev[e]? |tue-toi|suicide-toi|creve)\b"), "threat", 0.9),
    (re.compile(r"\b(on sait ou tu habites|je te retrouverai|tu vas payer|tu vas le regretter)\b"), "threat", 0.85),
    (re.compile(r"\b(i will (kill|hurt|find) you|kill yourself|kys)\b"), "threat", 0.95),
    # --- haine identitaire -------------------------------------------------
    (re.compile(r"\b(sale (juif|arabe|noir|blanc|musulman|chretien|pede|gay))\b"), "identity_hate", 0.95),
    (re.compile(r"\b(bougnoule|negre|youpin|pede|tapette|tarlouze|gouine)\b"), "identity_hate", 0.95),
    (re.compile(r"\b(tous les (juifs|arabes|noirs|musulmans|immigres|etrangers))\b.{0,40}\b(degager|virer|chasser|dehors|expulser|renvoyer)\b"), "identity_hate", 0.8),
    (re.compile(r"\b(retourne dans ton pays|rentre chez toi)\b"), "identity_hate", 0.75),
    (re.compile(r"\b(nigger|faggot|kike|towelhead)\b"), "identity_hate", 0.95),
    # --- grossièretés ------------------------------------------------------
    (re.compile(r"\b(merde|putain|bordel|chier|foutre)\b"), "obscene", 0.4),
    (re.compile(r"\b(shit|fuck|damn)\b"), "obscene", 0.4),
]

#: Déshumanisation / appels à la violence collective → toxicité sévère.
_SEVERE = re.compile(
    r"\b(sous-?homme|vermine|parasites?|cafards?|il faut (les|le|la) (eliminer|exterminer|supprimer))\b"
)

_LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s"})
_REPEAT_RE = re.compile(r"(.)\1{2,}")
_SEPARATOR_RE = re.compile(r"[.\-_*]+(?=\w)")


def normalize(text: str) -> str:
    """Minuscule, sans accents, anti-leetspeak et anti-espacement (`c.o.n.n.a.r.d`)."""
    lowered = text.lower().translate(_LEET)
    stripped = "".join(
        char
        for char in unicodedata.normalize("NFD", lowered)
        if unicodedata.category(char) != "Mn"
    )
    stripped = _REPEAT_RE.sub(r"\1\1", stripped)
    stripped = _SEPARATOR_RE.sub("", stripped)
    return " ".join(stripped.split())


def lexicon_scores(text: str) -> dict[str, float]:
    """Scores par catégorie issus du lexique (0.0 si aucune règle ne matche)."""
    normalized = normalize(text)
    scores: dict[str, float] = {category: 0.0 for category in CATEGORIES}

    for pattern, category, weight in _RULES:
        if pattern.search(normalized):
            scores[category] = max(scores[category], weight)

    if _SEVERE.search(normalized):
        scores["severe_toxicity"] = max(scores["severe_toxicity"], 0.85)
        scores["identity_hate"] = max(scores["identity_hate"], 0.8)

    # Cris prolongés : signal faible d'agressivité, jamais bloquant seul.
    letters = [char for char in text if char.isalpha()]
    if len(letters) >= 12:
        caps_ratio = sum(1 for char in letters if char.isupper()) / len(letters)
        if caps_ratio > 0.75:
            scores["insult"] = max(scores["insult"], 0.3)

    scores["toxicity"] = max(
        scores["insult"],
        scores["threat"],
        scores["identity_hate"],
        scores["severe_toxicity"],
        scores["obscene"] * 0.6,
    )
    return scores
