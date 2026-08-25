"""Détection de langue légère (sans dépendance externe).

Objectif : router un message vers le bon modèle, pas faire de la linguistique.
Un score par mots-outils suffit largement pour des messages de débat.
"""

from __future__ import annotations

import re

_TOKEN_RE = re.compile(r"[a-zà-öø-ÿœæ']+", re.IGNORECASE)

_STOPWORDS: dict[str, set[str]] = {
    "fr": {
        "le", "la", "les", "un", "une", "des", "de", "du", "et", "est", "que", "qui",
        "pas", "pour", "dans", "sur", "je", "tu", "il", "elle", "nous", "vous", "ils",
        "ce", "cette", "mais", "avec", "plus", "moins", "être", "avoir", "faire", "sont",
        "on", "au", "aux", "en", "ne", "se", "son", "sa", "ses", "leur", "donc", "car",
        "toi", "moi", "très", "bien", "tout", "tous", "parce", "aussi", "alors", "même",
        "tu", "ta", "tes", "es", "ai", "as", "quoi", "ça", "où", "quand", "peut", "faut",
    },
    "en": {
        "the", "a", "an", "of", "and", "is", "that", "which", "not", "for", "in", "on",
        "i", "you", "he", "she", "we", "they", "this", "but", "with", "more", "less",
        "be", "have", "do", "are", "to", "it", "his", "her", "their", "so", "because",
        "your", "my", "just", "about", "would", "should", "can", "will", "what",
    },
    "es": {
        "el", "la", "los", "las", "un", "una", "de", "y", "es", "que", "no", "para",
        "en", "yo", "tu", "él", "nosotros", "pero", "con", "más", "ser", "hacer", "son",
        "por", "como", "porque", "muy", "todo", "está",
    },
    "de": {
        "der", "die", "das", "ein", "eine", "und", "ist", "dass", "nicht", "für", "in",
        "ich", "du", "er", "sie", "wir", "aber", "mit", "mehr", "sein", "haben", "sind",
        "auch", "noch", "wie", "wenn", "was",
    },
    "it": {
        "il", "lo", "la", "gli", "le", "un", "una", "di", "e", "è", "che", "non", "per",
        "in", "io", "tu", "lui", "noi", "ma", "con", "più", "essere", "fare", "sono",
        "come", "perché", "anche",
    },
    "pt": {
        "o", "a", "os", "as", "um", "uma", "de", "e", "é", "que", "não", "para", "em",
        "eu", "você", "ele", "nós", "mas", "com", "mais", "ser", "fazer", "são", "como",
        "porque", "também",
    },
}

_ACCENT_HINTS = {
    "fr": "éèêàçùôû",
    "es": "ñáíóú¿¡",
    "de": "äöüß",
    "it": "àìòù",
    "pt": "ãõçá",
}

DEFAULT_LANGUAGE = "fr"


def detect_language(text: str) -> tuple[str, float]:
    """Retourne `(code_langue, confiance 0..1)`.

    Sur texte trop court, renvoie la langue par défaut avec une confiance basse
    — l'appelant décide alors d'utiliser le modèle multilingue.
    """
    tokens = _TOKEN_RE.findall(text.lower())
    if not tokens:
        return DEFAULT_LANGUAGE, 0.0

    # Un mot-outil partagé par plusieurs langues (« un », « tu », « es ») ne peut
    # pas départager : son poids est divisé entre les langues qui le contiennent.
    scores: dict[str, float] = {lang: 0.0 for lang in _STOPWORDS}
    for token in tokens:
        owners = [lang for lang, stopwords in _STOPWORDS.items() if token in stopwords]
        if not owners:
            continue
        weight = 1.0 / len(owners)
        for lang in owners:
            scores[lang] += weight
    for lang in scores:
        scores[lang] /= len(tokens)

    lowered = text.lower()
    for lang, accents in _ACCENT_HINTS.items():
        if any(char in lowered for char in accents):
            scores[lang] = scores.get(lang, 0.0) + 0.12

    best_lang = max(scores, key=lambda key: scores[key])
    best_score = scores[best_lang]
    if best_score <= 0.0:
        return DEFAULT_LANGUAGE, 0.0

    ordered = sorted(scores.values(), reverse=True)
    margin = ordered[0] - (ordered[1] if len(ordered) > 1 else 0.0)
    confidence = min(1.0, best_score * 2.0 + margin)
    if len(tokens) < 4:
        confidence *= 0.6
    return best_lang, round(confidence, 3)
