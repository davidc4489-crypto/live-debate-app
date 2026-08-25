"""Tests API FastAPI avec inférence mockée (rapides, sans GPU ni téléchargement)."""

import pytest
from fastapi.testclient import TestClient

from app.registry import ToxicityPrediction


def _scores(**overrides) -> dict:
    base = {
        "toxicity": 0.05,
        "insult": 0.05,
        "threat": 0.02,
        "identity_hate": 0.01,
        "severe_toxicity": 0.0,
        "obscene": 0.0,
        "sexual_explicit": 0.0,
    }
    base.update(overrides)
    return base


@pytest.fixture
def client(monkeypatch):
    """Client HTTP sans charger le moindre modèle."""
    import app.main as main_module

    def fake_score(texts, languages):
        predictions = []
        for text, language in zip(texts, languages):
            lowered = text.lower()
            if "blockme" in lowered:
                scores = _scores(toxicity=0.95, insult=0.9, threat=0.8, identity_hate=0.7)
            elif "warnme" in lowered:
                scores = _scores(toxicity=0.65, insult=0.55)
            else:
                scores = _scores()
            predictions.append(
                ToxicityPrediction(
                    scores=scores, models=["fake-model"], language=language, degraded=False
                )
            )
        return predictions

    monkeypatch.setattr(main_module, "_score_texts", fake_score)
    main_module._cache.clear()

    with TestClient(main_module.app) as test_client:
        yield test_client


class TestModerateEndpoint:
    def test_health(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_moderate_allow(self, client):
        response = client.post("/moderate", json={"text": "Bonjour, argument constructif."})
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "allow"
        assert data["is_toxic"] is False
        assert "toxicity" in data
        assert data["latency_ms"] >= 0
        assert data["categories"] == []

    def test_moderate_block(self, client):
        response = client.post("/moderate", json={"text": "blockme espèce de..."})
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "block"
        assert data["is_toxic"] is True
        assert data["categories"]
        assert data["suggestion"]

    def test_moderate_warn(self, client):
        response = client.post("/moderate", json={"text": "warnme tu es vraiment nul"})
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "warn"
        assert data["is_toxic"] is True

    def test_moderate_empty_text_rejected(self, client):
        response = client.post("/moderate", json={"text": "   "})
        assert response.status_code in (400, 422)

    def test_thresholds_endpoint(self, client):
        response = client.get("/thresholds")
        assert response.status_code == 200
        body = response.json()
        assert "block" in body
        assert "warn" in body

    def test_language_detected_and_forced(self, client):
        auto = client.post("/moderate", json={"text": "I think your point is weak but fair"})
        assert auto.json()["language"] == "en"
        forced = client.post("/moderate", json={"text": "peu importe", "language": "es"})
        assert forced.json()["language"] == "es"

    def test_cache_second_call(self, client):
        payload = {"text": "Un argument parfaitement neutre sur le climat"}
        assert client.post("/moderate", json=payload).json()["cached"] is False
        assert client.post("/moderate", json=payload).json()["cached"] is True


class TestBatchEndpoint:
    def test_batch_moderation(self, client):
        response = client.post(
            "/moderate/batch",
            json={"texts": ["message neutre", "blockme", "warnme un peu"]},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["count"] == 3
        assert [item["action"] for item in body["results"]] == ["allow", "block", "warn"]

    def test_batch_rejects_empty(self, client):
        response = client.post("/moderate/batch", json={"texts": ["  "]})
        assert response.status_code == 400


class TestAnalyzeEndpoint:
    def test_quality_of_argued_message(self, client):
        response = client.post(
            "/analyze",
            json={
                "text": (
                    "Je pense que le nucléaire est utile car il émet peu de CO2, "
                    "selon le GIEC environ 12 g/kWh, donc il complète le renouvelable."
                )
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["quality_score"] >= 70
        assert body["quality_label"] == "argumenté"
        assert "connecteurs_logiques" in body["breakdown"]["signals"]

    def test_quality_of_ad_hominem(self, client):
        response = client.post("/analyze", json={"text": "Tu es vraiment un idiot"})
        body = response.json()
        assert body["quality_score"] < 40
        assert "attaque_ad_hominem" in body["breakdown"]["signals"]
        assert body["tips"]

    def test_classify_disabled_by_default(self, client):
        response = client.post("/classify", json={"text": "Faut-il taxer les riches ?"})
        assert response.status_code == 200
        assert response.json()["available"] is False


class TestObservability:
    def test_metrics_track_actions(self, client):
        client.post("/moderate", json={"text": "blockme maintenant"})
        client.post("/moderate", json={"text": "un message tout à fait normal ici"})
        body = client.get("/metrics").json()
        assert body["requests"] >= 2
        assert body["actions"]["block"] >= 1
        assert body["latency_ms"]["p50"] >= 0

    def test_models_endpoint(self, client):
        body = client.get("/models").json()
        assert "backend" in body
        assert "models" in body
