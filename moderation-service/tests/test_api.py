"""Tests API FastAPI avec modèle Detoxify mocké (rapides, sans GPU)."""

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch):
    """Client HTTP sans charger le vrai modèle Detoxify."""
    import app.main as main_module

    def fake_predict(normalized: str) -> tuple[float, float, float, float]:
        if "blockme" in normalized:
            return (0.95, 0.9, 0.8, 0.7)
        if "warnme" in normalized:
            return (0.65, 0.55, 0.2, 0.15)
        return (0.05, 0.05, 0.05, 0.05)

    monkeypatch.setattr(main_module, "get_model", lambda: MagicMock())
    monkeypatch.setattr(main_module, "_predict", fake_predict)
    if hasattr(main_module._predict, "cache_clear"):
        main_module._predict.cache_clear()

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

    def test_moderate_block(self, client):
        response = client.post("/moderate", json={"text": "blockme espèce de..."})
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "block"
        assert data["is_toxic"] is True

    def test_moderate_warn(self, client):
        response = client.post("/moderate", json={"text": "warnme tu es vraiment nul"})
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "warn"
        assert data["is_toxic"] is True

    def test_moderate_empty_text_rejected(self, client):
        response = client.post("/moderate", json={"text": "   "})
        assert response.status_code == 422 or response.status_code == 400

    def test_thresholds_endpoint(self, client):
        response = client.get("/thresholds")
        assert response.status_code == 200
        body = response.json()
        assert "block" in body
        assert "warn" in body
