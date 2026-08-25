"""Analyse qualitative d'un message de débat (au-delà de la modération).

Deux niveaux :

- **sans modèle** : indice de qualité argumentative, calculé sur des marqueurs
  linguistiques (connecteurs logiques, marqueurs de preuve, attaques ad hominem).
  Toujours disponible, coût nul ;
- **avec modèles HF** (optionnels) : sentiment multilingue et classification
  thématique zero-shot.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.config import SETTINGS
from app.lexicon import lexicon_scores, normalize
from app.registry import REGISTRY

_WORD_RE = re.compile(r"[\w'’-]+", re.UNICODE)
_URL_RE = re.compile(r"https?://\S+")

#: Connecteurs logiques : signalent un raisonnement, pas une simple assertion.
_CONNECTORS = re.compile(
    r"\b(parce que|car|donc|ainsi|cependant|toutefois|en revanche|néanmoins|"
    r"d'?abord|ensuite|enfin|par exemple|c'?est-à-dire|en effet|or|puisque|"
    r"however|therefore|because|although|whereas|for instance|moreover)\b",
    re.IGNORECASE,
)

#: Marqueurs de preuve : chiffres, sources, citations.
_EVIDENCE = re.compile(
    r"(\b\d{1,3}\s?%|\b(19|20)\d{2}\b|\bselon\b|\bd'?après\b|\bsource\b|\brapport\b|"
    r"\bétude\b|\bstatistiques?\b|\baccording to\b|\bstudy\b|\bdata\b)",
    re.IGNORECASE,
)

#: Attaques visant la personne plutôt que l'argument.
_AD_HOMINEM = re.compile(
    r"\b(tu es (vraiment |juste )?(un|une|nul|bête|stupide|idiot)|"
    r"t'?es (un|une|nul|débile)|vous êtes (tous|des)|you are (an?|just) (idiot|stupid|dumb))\b",
    re.IGNORECASE,
)

#: Généralisations abusives.
_OVERGENERALIZATION = re.compile(
    r"\b(tout le monde sait|c'?est évident|personne ne peut nier|toujours|jamais|"
    r"tous les|everyone knows|obviously|nobody can deny)\b",
    re.IGNORECASE,
)


@dataclass
class QualityBreakdown:
    words: int
    structure: float
    evidence: float
    civility: float
    nuance: float
    signals: list[str] = field(default_factory=list)


@dataclass
class QualityResult:
    score: int
    label: str
    breakdown: QualityBreakdown
    tips: list[str] = field(default_factory=list)


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def argument_quality(text: str) -> QualityResult:
    """Indice 0-100 de qualité argumentative, déterministe et explicable."""
    words = _WORD_RE.findall(text)
    word_count = len(words)
    normalized = normalize(text)
    signals: list[str] = []
    tips: list[str] = []

    # --- Structure : longueur utile + connecteurs logiques ------------------
    length_score = _clamp((word_count - 4) / 46)  # plateau vers ~50 mots
    connectors = len(_CONNECTORS.findall(text))
    connector_score = _clamp(connectors / 2)
    structure = _clamp(0.55 * length_score + 0.45 * connector_score)
    if connectors:
        signals.append("connecteurs_logiques")
    elif word_count > 12:
        tips.append("Explicite ton raisonnement avec « parce que », « donc », « en revanche ».")

    # --- Preuves : chiffres, sources, liens ---------------------------------
    evidence_hits = len(_EVIDENCE.findall(text)) + len(_URL_RE.findall(text))
    evidence = _clamp(evidence_hits / 2)
    if evidence_hits:
        signals.append("sources_ou_chiffres")
    elif word_count > 20:
        tips.append("Appuie ton argument sur un chiffre, une étude ou un exemple concret.")

    # --- Civilité : pénalités attaque personnelle / cris / toxicité ----------
    toxicity = lexicon_scores(text)
    civility = 1.0
    if _AD_HOMINEM.search(text):
        civility -= 0.45
        signals.append("attaque_ad_hominem")
        tips.append("Vise l'argument, pas la personne.")
    civility -= min(0.5, toxicity["insult"] * 0.5 + toxicity["threat"] * 0.6)
    letters = [char for char in text if char.isalpha()]
    if len(letters) >= 12 and sum(1 for c in letters if c.isupper()) / len(letters) > 0.6:
        civility -= 0.15
        signals.append("majuscules_excessives")
    if text.count("!") >= 3:
        civility -= 0.1
    civility = _clamp(civility)

    # --- Nuance : absence de généralisation abusive, présence de concession --
    nuance = 1.0
    if _OVERGENERALIZATION.search(text):
        nuance -= 0.35
        signals.append("généralisation")
        tips.append("Évite les généralisations : précise à qui ou à quoi tu fais référence.")
    if re.search(r"\b(je pense|à mon avis|il me semble|peut-être|selon moi|i think|maybe)\b", normalized):
        nuance = _clamp(nuance + 0.1)
        signals.append("modalisation")
    nuance = _clamp(nuance)

    if word_count < 6:
        tips.append("Développe : un message trop court porte rarement un argument.")

    raw_score = _clamp(0.32 * structure + 0.23 * evidence + 0.3 * civility + 0.15 * nuance)
    # Un message très court ne peut pas être « bien argumenté », même s'il est poli.
    brevity_factor = 0.55 + 0.45 * _clamp(word_count / 12)
    score = int(round(100 * raw_score * brevity_factor))
    if score >= 75:
        label = "argumenté"
    elif score >= 50:
        label = "correct"
    elif score >= 30:
        label = "à étoffer"
    else:
        label = "faible"

    return QualityResult(
        score=score,
        label=label,
        breakdown=QualityBreakdown(
            words=word_count,
            structure=round(structure, 3),
            evidence=round(evidence, 3),
            civility=round(civility, 3),
            nuance=round(nuance, 3),
            signals=signals,
        ),
        tips=tips[:3],
    )


_SENTIMENT_LABELS = {
    "label_0": "negative",
    "label_1": "neutral",
    "label_2": "positive",
    "negative": "negative",
    "neutral": "neutral",
    "positive": "positive",
}


def sentiment(text: str) -> dict[str, float | str] | None:
    """Sentiment multilingue (None si le modèle est désactivé/indisponible)."""
    model = REGISTRY.get_sentiment()
    if model is None:
        return None
    try:
        raw = model([text])
        entries = raw[0] if isinstance(raw[0], list) else raw
        best = max(entries, key=lambda entry: entry.get("score", 0.0))
        label = _SENTIMENT_LABELS.get(str(best.get("label", "")).lower(), str(best.get("label")))
        return {"label": label, "score": round(float(best.get("score", 0.0)), 4)}
    except Exception:  # pragma: no cover - dépend du modèle
        return None


def classify_topic(text: str, candidates: list[str] | None = None) -> dict | None:
    """Classification thématique zero-shot (None si le modèle est désactivé)."""
    model = REGISTRY.get_zeroshot()
    if model is None:
        return None
    labels = candidates or SETTINGS.topics
    try:
        raw = model(text, labels, hypothesis_template="Ce texte parle de {}.")
        pairs = list(zip(raw["labels"], raw["scores"]))
        return {
            "topic": pairs[0][0],
            "confidence": round(float(pairs[0][1]), 4),
            "ranking": [
                {"label": label, "score": round(float(score), 4)} for label, score in pairs[:5]
            ],
        }
    except Exception:  # pragma: no cover
        return None
