from app.config import (
    THRESHOLD_BLOCK,
    THRESHOLD_COMBINED_WARN,
    THRESHOLD_HATE_BLOCK,
    THRESHOLD_INSULT_BLOCK,
    THRESHOLD_THREAT_BLOCK,
    THRESHOLD_WARN,
)


def decide_action(scores: dict[str, float]) -> tuple[str, bool, str | None]:
    """
    Retourne (action, is_toxic, reason).
    action: allow | warn | block
    """
    toxicity = scores.get("toxicity", 0.0)
    insult = scores.get("insult", 0.0)
    threat = scores.get("threat", 0.0)
    identity_hate = scores.get("identity_hate", 0.0)

    # Blocage dur : menace ou haine identitaire
    if threat >= THRESHOLD_THREAT_BLOCK:
        return "block", True, "Menace détectée"
    if identity_hate >= THRESHOLD_HATE_BLOCK:
        return "block", True, "Discours haineux détecté"
    if insult >= THRESHOLD_INSULT_BLOCK:
        return "block", True, "Insulte grave détectée"

    # Blocage sur toxicité globale
    if toxicity >= THRESHOLD_BLOCK:
        return "block", True, "Toxicité élevée"

    # Logique combinée : insult + hate modérés
    if insult >= THRESHOLD_COMBINED_WARN and identity_hate >= THRESHOLD_COMBINED_WARN:
        return "warn", True, "Ton agressif possible (insulte + haine)"

    if insult >= THRESHOLD_COMBINED_WARN and threat >= THRESHOLD_COMBINED_WARN:
        return "warn", True, "Ton agressif possible (insulte + menace)"

    # Avertissement
    if toxicity >= THRESHOLD_WARN:
        return "warn", True, "Toxicité modérée"

    if insult >= THRESHOLD_WARN or threat >= THRESHOLD_WARN or identity_hate >= THRESHOLD_WARN:
        return "warn", True, "Contenu potentiellement offensant"

    return "allow", False, None
