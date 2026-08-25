"""API de modération et d'analyse de débat (FastAPI + modèles Hugging Face)."""

from __future__ import annotations

import logging
import threading
import time
from collections import OrderedDict
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.analysis import argument_quality, classify_topic, sentiment
from app.config import SETTINGS, thresholds_dict
from app.languages import detect_language
from app.lexicon import normalize
from app.metrics import METRICS
from app.registry import REGISTRY, ToxicityPrediction
from app.scoring import evaluate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("moderation-service")

_warmup_state = {"status": "idle", "error": None}


def _warmup_worker() -> None:
    _warmup_state["status"] = "loading"
    try:
        REGISTRY.warmup()
        _warmup_state["status"] = "ready"
    except Exception as error:  # pragma: no cover - dépend du réseau/disque
        _warmup_state["status"] = "degraded"
        _warmup_state["error"] = str(error)
        logger.warning("Warmup échoué : %s", error)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Chargement en tâche de fond : /health répond immédiatement, le lexique
    # assure la modération pendant le téléchargement des poids.
    if SETTINGS.backend == "heuristic" or not SETTINGS.warmup:
        _warmup_state["status"] = "ready"
    else:
        threading.Thread(target=_warmup_worker, name="warmup", daemon=True).start()
    yield


app = FastAPI(title="Live Debate Moderation", version="2.0.0", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Schémas
# ---------------------------------------------------------------------------


class ModerateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    language: str | None = Field(default=None, description="Force la langue (fr, en, ...)")


class BatchModerateRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=64)
    language: str | None = None


class ModerateResponse(BaseModel):
    # Champs historiques (contrat NestJS v1) ------------------------------
    toxicity: float
    insult: float
    threat: float
    identity_hate: float
    is_toxic: bool
    action: Literal["allow", "warn", "block"]
    reason: str | None = None
    cached: bool = False
    latency_ms: float
    # Enrichissements v2 ---------------------------------------------------
    severe_toxicity: float = 0.0
    obscene: float = 0.0
    sexual_explicit: float = 0.0
    categories: list[str] = Field(default_factory=list)
    severity: float = 0.0
    suggestion: str | None = None
    language: str = "fr"
    models: list[str] = Field(default_factory=list)
    degraded: bool = False


class AnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    with_sentiment: bool = True


class AnalyzeResponse(BaseModel):
    quality_score: int
    quality_label: str
    breakdown: dict
    tips: list[str]
    sentiment: dict | None = None
    language: str


class ClassifyRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    candidates: list[str] | None = None


# ---------------------------------------------------------------------------
# Cache LRU (texte normalisé → résultat)
# ---------------------------------------------------------------------------


class _LruCache:
    def __init__(self, maxsize: int) -> None:
        self._data: OrderedDict[str, dict] = OrderedDict()
        self._maxsize = maxsize
        self._lock = threading.Lock()

    def get(self, key: str) -> dict | None:
        with self._lock:
            value = self._data.get(key)
            if value is not None:
                self._data.move_to_end(key)
            return value

    def set(self, key: str, value: dict) -> None:
        with self._lock:
            self._data[key] = value
            self._data.move_to_end(key)
            while len(self._data) > self._maxsize:
                self._data.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    def __len__(self) -> int:
        return len(self._data)


_cache = _LruCache(SETTINGS.cache_size)


# ---------------------------------------------------------------------------
# Cœur
# ---------------------------------------------------------------------------


def _score_texts(texts: list[str], languages: list[str]) -> list[ToxicityPrediction]:
    """Point d'injection unique (les tests remplacent cette fonction)."""
    return REGISTRY.predict_batch(texts, languages)


def _build_payload(prediction: ToxicityPrediction) -> dict:
    decision = evaluate(prediction.scores)
    scores = prediction.scores
    return {
        "toxicity": round(scores.get("toxicity", 0.0), 4),
        "insult": round(scores.get("insult", 0.0), 4),
        "threat": round(scores.get("threat", 0.0), 4),
        "identity_hate": round(scores.get("identity_hate", 0.0), 4),
        "severe_toxicity": round(scores.get("severe_toxicity", 0.0), 4),
        "obscene": round(scores.get("obscene", 0.0), 4),
        "sexual_explicit": round(scores.get("sexual_explicit", 0.0), 4),
        "is_toxic": decision.is_toxic,
        "action": decision.action,
        "reason": decision.reason,
        "categories": decision.categories,
        "severity": decision.severity,
        "suggestion": decision.suggestion,
        "language": prediction.language,
        "models": prediction.models,
        "degraded": prediction.degraded,
    }


def _moderate_texts(texts: list[str], forced_language: str | None) -> list[dict]:
    """Modère une liste de textes : cache d'abord, un seul batch modèle ensuite."""
    payloads: list[dict | None] = [None] * len(texts)
    pending: list[int] = []
    keys: list[str] = []
    languages: list[str] = []

    for index, text in enumerate(texts):
        language = forced_language or detect_language(text)[0]
        languages.append(language)
        key = f"{language}:{normalize(text)}"
        keys.append(key)
        cached = _cache.get(key)
        if cached is not None:
            payloads[index] = {**cached, "cached": True}
        else:
            pending.append(index)

    if pending:
        predictions = _score_texts(
            [texts[index] for index in pending], [languages[index] for index in pending]
        )
        for position, index in enumerate(pending):
            payload = _build_payload(predictions[position])
            _cache.set(keys[index], payload)
            payloads[index] = {**payload, "cached": False}

    return [payload for payload in payloads if payload is not None]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
def health():
    status = REGISTRY.status()
    return {
        "status": "ok",
        "version": app.version,
        "warmup": _warmup_state["status"],
        "model_loaded": bool(status["loaded"]["detoxify"] or status["loaded"]["multilingual"]),
        "backend": SETTINGS.backend,
        "cache_entries": len(_cache),
    }


@app.get("/models")
def models():
    return REGISTRY.status() | {"warmup": _warmup_state["status"]}


@app.get("/metrics")
def metrics():
    return METRICS.snapshot() | {"cache_entries": len(_cache)}


@app.get("/thresholds")
def thresholds():
    return thresholds_dict()


@app.post("/moderate", response_model=ModerateResponse)
def moderate(body: ModerateRequest):
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    t0 = time.perf_counter()
    payload = _moderate_texts([text], body.language)[0]
    latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    METRICS.record(
        action=payload["action"],
        language=payload["language"],
        categories=payload["categories"],
        latency_ms=latency_ms,
        cached=payload["cached"],
        degraded=payload["degraded"],
    )
    return ModerateResponse(**payload, latency_ms=latency_ms)


@app.post("/moderate/batch")
def moderate_batch(body: BatchModerateRequest):
    texts = [text.strip() for text in body.texts if text and text.strip()]
    if not texts:
        raise HTTPException(status_code=400, detail="texts is required")
    if len(texts) > SETTINGS.max_batch:
        texts = texts[: SETTINGS.max_batch]

    t0 = time.perf_counter()
    payloads = _moderate_texts(texts, body.language)
    latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    per_item = round(latency_ms / max(1, len(payloads)), 2)

    for payload in payloads:
        METRICS.record(
            action=payload["action"],
            language=payload["language"],
            categories=payload["categories"],
            latency_ms=per_item,
            cached=payload["cached"],
            degraded=payload["degraded"],
        )

    return {
        "results": [{**payload, "latency_ms": per_item} for payload in payloads],
        "count": len(payloads),
        "latency_ms": latency_ms,
    }


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(body: AnalyzeRequest):
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    quality = argument_quality(text)
    language = detect_language(text)[0]
    tone = sentiment(text) if body.with_sentiment else None

    return AnalyzeResponse(
        quality_score=quality.score,
        quality_label=quality.label,
        breakdown={
            "words": quality.breakdown.words,
            "structure": quality.breakdown.structure,
            "evidence": quality.breakdown.evidence,
            "civility": quality.breakdown.civility,
            "nuance": quality.breakdown.nuance,
            "signals": quality.breakdown.signals,
        },
        tips=quality.tips,
        sentiment=tone,
        language=language,
    )


@app.post("/classify")
def classify(body: ClassifyRequest):
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    result = classify_topic(text, body.candidates)
    if result is None:
        return {
            "topic": None,
            "confidence": 0.0,
            "ranking": [],
            "available": False,
            "detail": "Classification zero-shot désactivée (MOD_ENABLE_ZEROSHOT=true pour l'activer).",
        }
    return result | {"available": True}


@app.post("/cache/clear")
def clear_cache():
    _cache.clear()
    return {"cleared": True}
