import logging
import time
from functools import lru_cache
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.config import THRESHOLD_BLOCK, THRESHOLD_WARN
from app.scoring import decide_action

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("moderation-service")

app = FastAPI(title="Live Debate Moderation", version="1.0.0")

# Chargement unique au démarrage (import paresseux pour tests sans torch)
_model = None


def get_model():
    global _model
    if _model is None:
        from detoxify import Detoxify

        logger.info("Chargement du modèle Detoxify (original)...")
        t0 = time.perf_counter()
        _model = Detoxify("original")
        logger.info("Modèle chargé en %.2fs", time.perf_counter() - t0)
    return _model


class ModerateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)


class ModerateResponse(BaseModel):
    toxicity: float
    insult: float
    threat: float
    identity_hate: float
    is_toxic: bool
    action: Literal["allow", "warn", "block"]
    reason: str | None = None
    cached: bool = False
    latency_ms: float


@lru_cache(maxsize=4096)
def _predict(normalized: str) -> tuple[float, float, float, float]:
    """Cache LRU sur texte normalisé (évite recalcul messages identiques)."""
    model = get_model()
    raw = model.predict(normalized)
    return (
        float(raw.get("toxicity", 0)),
        float(raw.get("insult", 0)),
        float(raw.get("threat", 0)),
        float(raw.get("identity_attack", 0)),
    )


def _normalize(text: str) -> str:
    return " ".join(text.strip().lower().split())


@app.on_event("startup")
def warmup():
    get_model()
    _predict("hello world")


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _model is not None}


@app.post("/moderate", response_model=ModerateResponse)
def moderate(body: ModerateRequest):
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    t0 = time.perf_counter()
    normalized = _normalize(text)
    cached = False
    if hasattr(_predict, "cache_info"):
        info_before = _predict.cache_info()
        toxicity, insult, threat, identity_hate = _predict(normalized)
        cached = _predict.cache_info().hits > info_before.hits
    else:
        toxicity, insult, threat, identity_hate = _predict(normalized)

    scores = {
        "toxicity": toxicity,
        "insult": insult,
        "threat": threat,
        "identity_hate": identity_hate,
    }
    action, is_toxic, reason = decide_action(scores)
    latency_ms = (time.perf_counter() - t0) * 1000

    return ModerateResponse(
        toxicity=round(toxicity, 4),
        insult=round(insult, 4),
        threat=round(threat, 4),
        identity_hate=round(identity_hate, 4),
        is_toxic=is_toxic,
        action=action,
        reason=reason,
        cached=cached,
        latency_ms=round(latency_ms, 2),
    )


@app.get("/thresholds")
def thresholds():
    return {
        "block": THRESHOLD_BLOCK,
        "warn": THRESHOLD_WARN,
    }
