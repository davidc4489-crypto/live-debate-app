"""Décision de modération à partir des scores par catégorie."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.config import (
    THRESHOLD_BLOCK,
    THRESHOLD_COMBINED_WARN,
    THRESHOLD_HATE_BLOCK,
    THRESHOLD_INSULT_BLOCK,
    THRESHOLD_SEVERE_BLOCK,
    THRESHOLD_SEXUAL_BLOCK,
    THRESHOLD_THREAT_BLOCK,
    THRESHOLD_WARN,
)

#: Poids de gravité par catégorie (menace > haine > insulte > grossièreté).
_SEVERITY_WEIGHTS = {
    "threat": 1.0,
    "identity_hate": 1.0,
    "severe_toxicity": 1.0,
    "insult": 0.8,
    "sexual_explicit": 0.8,
    "toxicity": 0.7,
    "obscene": 0.5,
}

#: Conseil de reformulation affiché à l'auteur (pédagogie > sanction).
_SUGGESTIONS = {
    "threat": "Retire toute formulation qui vise la personne physiquement.",
    "identity_hate": "Vise l'argument, jamais un groupe ou une identité.",
    "insult": "Critique l'idée plutôt que la personne : « cet argument me semble faible » plutôt qu'une insulte.",
    "severe_toxicity": "Reformule sans déshumaniser ton interlocuteur.",
    "obscene": "Retire les grossièretés : le fond passe mieux sans elles.",
    "sexual_explicit": "Retire le contenu explicite, hors-sujet dans un débat.",
    "toxicity": "Adoucis le ton et développe ton argument.",
}


@dataclass
class Decision:
    action: str
    is_toxic: bool
    reason: str | None
    categories: list[str] = field(default_factory=list)
    severity: float = 0.0
    suggestion: str | None = None


def _categories_above(scores: dict[str, float], threshold: float) -> list[str]:
    return sorted(
        (
            category
            for category, value in scores.items()
            if category != "toxicity" and value >= threshold
        ),
        key=lambda category: scores[category],
        reverse=True,
    )


def _severity(scores: dict[str, float]) -> float:
    return round(
        min(
            1.0,
            max(
                (value * _SEVERITY_WEIGHTS.get(category, 0.5) for category, value in scores.items()),
                default=0.0,
            ),
        ),
        4,
    )


def evaluate(scores: dict[str, float]) -> Decision:
    """Applique les seuils et renvoie une décision enrichie (catégories, gravité, conseil)."""
    toxicity = scores.get("toxicity", 0.0)
    insult = scores.get("insult", 0.0)
    threat = scores.get("threat", 0.0)
    identity_hate = scores.get("identity_hate", 0.0)
    severe = scores.get("severe_toxicity", 0.0)
    sexual = scores.get("sexual_explicit", 0.0)

    severity = _severity(scores)

    def decision(action: str, reason: str, category: str) -> Decision:
        categories = _categories_above(scores, THRESHOLD_COMBINED_WARN) or [category]
        return Decision(
            action=action,
            is_toxic=True,
            reason=reason,
            categories=categories,
            severity=severity,
            suggestion=_SUGGESTIONS.get(category),
        )

    # --- Blocages durs -----------------------------------------------------
    if threat >= THRESHOLD_THREAT_BLOCK:
        return decision("block", "Menace détectée", "threat")
    if identity_hate >= THRESHOLD_HATE_BLOCK:
        return decision("block", "Discours haineux détecté", "identity_hate")
    if severe >= THRESHOLD_SEVERE_BLOCK:
        return decision("block", "Toxicité sévère détectée", "severe_toxicity")
    if insult >= THRESHOLD_INSULT_BLOCK:
        return decision("block", "Insulte grave détectée", "insult")
    if sexual >= THRESHOLD_SEXUAL_BLOCK:
        return decision("block", "Contenu sexuel explicite", "sexual_explicit")
    if toxicity >= THRESHOLD_BLOCK:
        return decision("block", "Toxicité élevée", "toxicity")

    # --- Signaux combinés --------------------------------------------------
    if insult >= THRESHOLD_COMBINED_WARN and identity_hate >= THRESHOLD_COMBINED_WARN:
        return decision("warn", "Ton agressif possible (insulte + haine)", "identity_hate")
    if insult >= THRESHOLD_COMBINED_WARN and threat >= THRESHOLD_COMBINED_WARN:
        return decision("warn", "Ton agressif possible (insulte + menace)", "threat")

    # --- Avertissements ----------------------------------------------------
    if toxicity >= THRESHOLD_WARN:
        return decision("warn", "Toxicité modérée", "toxicity")
    if insult >= THRESHOLD_WARN:
        return decision("warn", "Contenu potentiellement offensant", "insult")
    if threat >= THRESHOLD_WARN:
        return decision("warn", "Contenu potentiellement offensant", "threat")
    if identity_hate >= THRESHOLD_WARN:
        return decision("warn", "Contenu potentiellement offensant", "identity_hate")

    return Decision(
        action="allow",
        is_toxic=False,
        reason=None,
        categories=[],
        severity=severity,
        suggestion=None,
    )


def decide_action(scores: dict[str, float]) -> tuple[str, bool, str | None]:
    """Signature historique conservée (action, is_toxic, reason)."""
    result = evaluate(scores)
    return result.action, result.is_toxic, result.reason
