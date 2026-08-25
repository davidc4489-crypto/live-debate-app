"""Chargement paresseux des modèles Hugging Face + inférence par lots.

Trois backends, choisis par `MOD_BACKEND` :

- `auto`      : tente les modèles HF, retombe sur le lexique si indisponibles ;
- `local`     : modèles HF obligatoires (échec explicite au warmup) ;
- `heuristic` : lexique seul, aucun téléchargement (CI, dev, machines sans GPU).

Aucun import de `torch` / `transformers` au niveau module : les tests et le mode
heuristique doivent tourner sans ces dépendances.
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field

from app.config import SETTINGS, MULTILINGUAL_LANGUAGES
from app.lexicon import lexicon_scores

logger = logging.getLogger("moderation-service.registry")

DETOXIFY_CATEGORIES = {
    "toxicity": "toxicity",
    "severe_toxicity": "severe_toxicity",
    "obscene": "obscene",
    "threat": "threat",
    "insult": "insult",
    "identity_attack": "identity_hate",
    "identity_hate": "identity_hate",
    "sexual_explicit": "sexual_explicit",
}

SCORE_KEYS = (
    "toxicity",
    "insult",
    "threat",
    "identity_hate",
    "severe_toxicity",
    "obscene",
    "sexual_explicit",
)


@dataclass
class ToxicityPrediction:
    scores: dict[str, float]
    models: list[str] = field(default_factory=list)
    language: str = "fr"
    degraded: bool = False


def _empty_scores() -> dict[str, float]:
    return {key: 0.0 for key in SCORE_KEYS}


class ModelRegistry:
    """Détient les modèles chargés et expose l'inférence toxicité/analyse."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._multilingual = None
        self._detoxify = None
        self._french_hate = None
        self._sentiment = None
        self._zeroshot = None
        self._failed: set[str] = set()
        self._load_times: dict[str, float] = {}

    # ----------------------------------------------------------------- utils

    @property
    def heuristic_only(self) -> bool:
        return SETTINGS.backend == "heuristic"

    def _resolve_device(self) -> int:
        if SETTINGS.device == "cpu":
            return -1
        try:
            import torch  # noqa: PLC0415 — import volontairement paresseux

            if SETTINGS.device.startswith("cuda"):
                return 0
            return 0 if torch.cuda.is_available() else -1
        except Exception:  # pragma: no cover - torch absent
            return -1

    def _mark_failed(self, key: str, error: Exception) -> None:
        if key not in self._failed:
            logger.warning("Modèle %s indisponible (%s) — repli lexique", key, error)
        self._failed.add(key)

    def status(self) -> dict[str, object]:
        return {
            "backend": SETTINGS.backend,
            "loaded": {
                "multilingual": self._multilingual is not None,
                "detoxify": self._detoxify is not None,
                "french_hate": self._french_hate is not None,
                "sentiment": self._sentiment is not None,
                "zeroshot": self._zeroshot is not None,
            },
            "failed": sorted(self._failed),
            "load_times_s": {key: round(value, 2) for key, value in self._load_times.items()},
            "models": {
                "primary": f"detoxify:{SETTINGS.detoxify_checkpoint}",
                "secondary": (
                    SETTINGS.multilingual_model
                    if SETTINGS.enable_multilingual_secondary
                    else None
                ),
                "french_hate": SETTINGS.french_hate_model if SETTINGS.enable_french_hate else None,
                "sentiment": SETTINGS.sentiment_model if SETTINGS.enable_sentiment else None,
                "zeroshot": SETTINGS.zeroshot_model if SETTINGS.enable_zeroshot else None,
            },
        }

    # ---------------------------------------------------------------- loaders

    def _pipeline(self, task: str, model: str, **kwargs):
        from transformers import pipeline  # noqa: PLC0415

        t0 = time.perf_counter()
        built = pipeline(
            task,
            model=model,
            device=self._resolve_device(),
            token=SETTINGS.hf_token,
            **kwargs,
        )
        self._load_times[model] = time.perf_counter() - t0
        logger.info("Modèle %s chargé en %.1fs", model, self._load_times[model])
        return built

    def get_multilingual(self):
        if (
            self.heuristic_only
            or not SETTINGS.enable_multilingual_secondary
            or "multilingual" in self._failed
        ):
            return None
        if self._multilingual is None:
            with self._lock:
                if self._multilingual is None and "multilingual" not in self._failed:
                    try:
                        self._multilingual = self._pipeline(
                            "text-classification",
                            SETTINGS.multilingual_model,
                            top_k=None,
                            truncation=True,
                            max_length=512,
                        )
                    except Exception as error:  # pragma: no cover - dépend du réseau
                        self._mark_failed("multilingual", error)
                        if SETTINGS.backend == "local":
                            raise
        return self._multilingual

    def get_detoxify(self):
        if self.heuristic_only or not SETTINGS.enable_detoxify or "detoxify" in self._failed:
            return None
        if self._detoxify is None:
            with self._lock:
                if self._detoxify is None and "detoxify" not in self._failed:
                    try:
                        from detoxify import Detoxify  # noqa: PLC0415

                        t0 = time.perf_counter()
                        self._detoxify = Detoxify(SETTINGS.detoxify_checkpoint)
                        self._load_times["detoxify"] = time.perf_counter() - t0
                        logger.info(
                            "Detoxify (%s) chargé en %.1fs",
                            SETTINGS.detoxify_checkpoint,
                            self._load_times["detoxify"],
                        )
                    except Exception as error:  # pragma: no cover
                        self._mark_failed("detoxify", error)
        return self._detoxify

    def get_french_hate(self):
        if self.heuristic_only or not SETTINGS.enable_french_hate or "french_hate" in self._failed:
            return None
        if self._french_hate is None:
            with self._lock:
                if self._french_hate is None and "french_hate" not in self._failed:
                    try:
                        self._french_hate = self._pipeline(
                            "text-classification",
                            SETTINGS.french_hate_model,
                            top_k=None,
                            truncation=True,
                            max_length=512,
                        )
                    except Exception as error:  # pragma: no cover
                        self._mark_failed("french_hate", error)
        return self._french_hate

    def get_sentiment(self):
        if self.heuristic_only or not SETTINGS.enable_sentiment or "sentiment" in self._failed:
            return None
        if self._sentiment is None:
            with self._lock:
                if self._sentiment is None and "sentiment" not in self._failed:
                    try:
                        self._sentiment = self._pipeline(
                            "text-classification",
                            SETTINGS.sentiment_model,
                            top_k=None,
                            truncation=True,
                            max_length=512,
                        )
                    except Exception as error:  # pragma: no cover
                        self._mark_failed("sentiment", error)
        return self._sentiment

    def get_zeroshot(self):
        if self.heuristic_only or not SETTINGS.enable_zeroshot or "zeroshot" in self._failed:
            return None
        if self._zeroshot is None:
            with self._lock:
                if self._zeroshot is None and "zeroshot" not in self._failed:
                    try:
                        self._zeroshot = self._pipeline(
                            "zero-shot-classification", SETTINGS.zeroshot_model
                        )
                    except Exception as error:  # pragma: no cover
                        self._mark_failed("zeroshot", error)
        return self._zeroshot

    # -------------------------------------------------------------- inférence

    @staticmethod
    def _toxic_probability(raw) -> float:
        """Extrait P(toxique) d'une sortie `text-classification` (labels variables)."""
        entries = raw[0] if raw and isinstance(raw[0], list) else raw
        best = 0.0
        for entry in entries or []:
            label = str(entry.get("label", "")).lower()
            score = float(entry.get("score", 0.0))
            if label in {"toxic", "label_1", "hate", "offensive", "abusive", "1"}:
                best = max(best, score)
            elif label in {"not_toxic", "non_toxic", "label_0", "normal", "neutral", "0"}:
                best = max(best, 1.0 - score)
        return best

    def predict_batch(self, texts: list[str], languages: list[str]) -> list[ToxicityPrediction]:
        """Score une liste de textes ; combine modèles HF et lexique (max par catégorie)."""
        results = [
            ToxicityPrediction(scores=_empty_scores(), language=language)
            for language in languages
        ]

        # 1. Lexique — toujours calculé (rapide, et seul filet si modèles absents).
        for index, text in enumerate(texts):
            for key, value in lexicon_scores(text).items():
                if key in results[index].scores:
                    results[index].scores[key] = max(results[index].scores[key], value)
            results[index].models.append("lexicon:fr-en")

        # 2. Modèle principal : Detoxify multilingue, 7 catégories, toutes langues.
        detoxify = self.get_detoxify()
        if detoxify is not None:
            try:
                raw = detoxify.predict(list(texts))
                for index in range(len(texts)):
                    scores = results[index].scores
                    for raw_key, category in DETOXIFY_CATEGORIES.items():
                        if raw_key not in raw:
                            continue
                        value = raw[raw_key]
                        value = float(value[index] if isinstance(value, list) else value)
                        scores[category] = max(scores[category], value)
                    results[index].models.append(f"detoxify:{SETTINGS.detoxify_checkpoint}")
            except Exception as error:  # pragma: no cover - dépend du modèle chargé
                self._mark_failed("detoxify", error)

        # 3. Second avis léger sur la toxicité globale (désactivé par défaut).
        secondary_index = [
            index
            for index, language in enumerate(languages)
            if language in MULTILINGUAL_LANGUAGES
        ]
        secondary = self.get_multilingual() if secondary_index else None
        if secondary is not None:
            try:
                batch = [texts[index] for index in secondary_index]
                raw_outputs = secondary(batch)
                for position, index in enumerate(secondary_index):
                    probability = self._toxic_probability([raw_outputs[position]])
                    scores = results[index].scores
                    scores["toxicity"] = max(scores["toxicity"], probability)
                    results[index].models.append(SETTINGS.multilingual_model)
            except Exception as error:  # pragma: no cover
                self._mark_failed("multilingual", error)

        # 4. Haine ciblée en français (optionnel).
        french_index = [index for index, language in enumerate(languages) if language == "fr"]
        french_hate = self.get_french_hate() if french_index else None
        if french_hate is not None:
            try:
                batch = [texts[index] for index in french_index]
                raw_outputs = french_hate(batch)
                for position, index in enumerate(french_index):
                    probability = self._toxic_probability([raw_outputs[position]])
                    scores = results[index].scores
                    scores["identity_hate"] = max(scores["identity_hate"], probability)
                    scores["toxicity"] = max(scores["toxicity"], probability * 0.9)
                    results[index].models.append(SETTINGS.french_hate_model)
            except Exception as error:  # pragma: no cover
                self._mark_failed("french_hate", error)

        # 5. Cohérence : la toxicité globale domine toujours ses composantes.
        for result in results:
            scores = result.scores
            scores["toxicity"] = max(
                scores["toxicity"],
                scores["insult"],
                scores["threat"],
                scores["identity_hate"],
                scores["severe_toxicity"],
            )
            # Aucun modèle n'a répondu : seul le lexique a scoré.
            result.degraded = result.models == ["lexicon:fr-en"] and not self.heuristic_only

        return results

    def warmup(self) -> None:
        if self.heuristic_only or not SETTINGS.warmup:
            return
        self.get_detoxify()
        self.get_multilingual()
        self.predict_batch(["bonjour"], ["fr"])
        # Les modèles optionnels sont chargés ici aussi : sur CPU, une première
        # inférence à froid dépasse largement le timeout de l'appelant.
        self.get_sentiment()
        self.get_zeroshot()


REGISTRY = ModelRegistry()
