"""Configuration du service de modération (pilotée par variables d'environnement)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if not raw:
        return list(default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# --------------------------------------------------------------------------
# Seuils (compat : constantes historiques importées par app.scoring / tests)
# --------------------------------------------------------------------------

THRESHOLD_BLOCK = _env_float("MOD_THRESHOLD_BLOCK", 0.75)
THRESHOLD_WARN = _env_float("MOD_THRESHOLD_WARN", 0.50)
THRESHOLD_INSULT_BLOCK = _env_float("MOD_INSULT_BLOCK", 0.80)
THRESHOLD_THREAT_BLOCK = _env_float("MOD_THREAT_BLOCK", 0.70)
THRESHOLD_HATE_BLOCK = _env_float("MOD_HATE_BLOCK", 0.70)
THRESHOLD_COMBINED_WARN = _env_float("MOD_COMBINED_WARN", 0.45)
THRESHOLD_SEVERE_BLOCK = _env_float("MOD_SEVERE_BLOCK", 0.50)
THRESHOLD_SEXUAL_BLOCK = _env_float("MOD_SEXUAL_BLOCK", 0.85)


# --------------------------------------------------------------------------
# Modèles Hugging Face
# --------------------------------------------------------------------------

#: Modèle principal : Detoxify `multilingual` (XLM-RoBERTa, Jigsaw multilingue).
#: Couvre fr/en/es/it/pt/ru/tr avec les 7 catégories — mesuré très supérieur au
#: checkpoint `original` (anglais) sur des messages français.
DETOXIFY_CHECKPOINT = os.getenv("MOD_DETOXIFY_CHECKPOINT", "multilingual")
#: Modèle secondaire léger (distilbert 540 Mo) : second avis sur la toxicité globale.
MULTILINGUAL_TOXICITY_MODEL = os.getenv(
    "MOD_MULTILINGUAL_MODEL", "citizenlab/distilbert-base-multilingual-cased-toxicity"
)
#: Haine/agression ciblée en français (optionnel, plus lourd).
FRENCH_HATE_MODEL = os.getenv("MOD_FRENCH_HATE_MODEL", "Hate-speech-CNERG/dehatebert-mono-french")
#: Sentiment multilingue pour l'analyse de ton (optionnel).
SENTIMENT_MODEL = os.getenv("MOD_SENTIMENT_MODEL", "cardiffnlp/twitter-xlm-roberta-base-sentiment")
#: Zero-shot multilingue pour la classification thématique des débats (optionnel).
ZEROSHOT_MODEL = os.getenv(
    "MOD_ZEROSHOT_MODEL", "MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7"
)

#: Langues couvertes par Detoxify `multilingual`.
MULTILINGUAL_LANGUAGES = set(
    _env_list("MOD_MULTILINGUAL_LANGS", ["fr", "en", "es", "it", "pt", "ru", "tr"])
)

#: Thèmes de débat (alignés sur `frontend/lib/debate.ts`).
DEBATE_TOPICS = _env_list(
    "MOD_DEBATE_TOPICS",
    ["Politique", "Technologie", "Sport", "Philosophie", "Société", "Économie"],
)


@dataclass(frozen=True)
class Settings:
    """Instantané de configuration, résolu au démarrage."""

    #: `auto` = modèles HF si disponibles, sinon lexique ; `local` = HF obligatoire ;
    #: `heuristic` = lexique seul (dev/CI, aucun téléchargement).
    backend: str = os.getenv("MOD_BACKEND", "auto").strip().lower()
    multilingual_model: str = MULTILINGUAL_TOXICITY_MODEL
    detoxify_checkpoint: str = DETOXIFY_CHECKPOINT
    french_hate_model: str = FRENCH_HATE_MODEL
    sentiment_model: str = SENTIMENT_MODEL
    zeroshot_model: str = ZEROSHOT_MODEL
    enable_detoxify: bool = _env_bool("MOD_ENABLE_DETOXIFY", True)
    enable_multilingual_secondary: bool = _env_bool("MOD_ENABLE_SECONDARY", False)
    enable_french_hate: bool = _env_bool("MOD_ENABLE_FRENCH_HATE", False)
    enable_sentiment: bool = _env_bool("MOD_ENABLE_SENTIMENT", False)
    enable_zeroshot: bool = _env_bool("MOD_ENABLE_ZEROSHOT", False)
    hf_token: str | None = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_HUB_TOKEN")
    device: str = os.getenv("MOD_DEVICE", "auto")
    cache_size: int = _env_int("MOD_CACHE_SIZE", 4096)
    max_batch: int = _env_int("MOD_MAX_BATCH", 32)
    max_text_length: int = _env_int("MOD_MAX_TEXT_LENGTH", 5000)
    warmup: bool = _env_bool("MOD_WARMUP", True)
    topics: list[str] = field(default_factory=lambda: list(DEBATE_TOPICS))

    @property
    def allow_model_download(self) -> bool:
        return self.backend in {"auto", "local"}


SETTINGS = Settings()


def thresholds_dict() -> dict[str, float]:
    return {
        "block": THRESHOLD_BLOCK,
        "warn": THRESHOLD_WARN,
        "insult_block": THRESHOLD_INSULT_BLOCK,
        "threat_block": THRESHOLD_THREAT_BLOCK,
        "hate_block": THRESHOLD_HATE_BLOCK,
        "severe_block": THRESHOLD_SEVERE_BLOCK,
        "sexual_block": THRESHOLD_SEXUAL_BLOCK,
        "combined_warn": THRESHOLD_COMBINED_WARN,
    }
