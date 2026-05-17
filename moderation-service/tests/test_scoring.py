"""Tests unitaires de la logique de seuils (sans charger Detoxify)."""

import pytest

from app.scoring import decide_action


class TestDecideAction:
    def test_allow_neutral(self):
        action, is_toxic, reason = decide_action(
            {"toxicity": 0.1, "insult": 0.05, "threat": 0.02, "identity_hate": 0.01}
        )
        assert action == "allow"
        assert is_toxic is False
        assert reason is None

    def test_block_high_toxicity(self):
        action, is_toxic, reason = decide_action(
            {"toxicity": 0.9, "insult": 0.3, "threat": 0.2, "identity_hate": 0.1}
        )
        assert action == "block"
        assert is_toxic is True
        assert "Toxicité" in (reason or "")

    def test_block_threat(self):
        action, _, reason = decide_action(
            {"toxicity": 0.3, "insult": 0.2, "threat": 0.85, "identity_hate": 0.1}
        )
        assert action == "block"
        assert reason == "Menace détectée"

    def test_block_identity_hate(self):
        action, _, reason = decide_action(
            {"toxicity": 0.3, "insult": 0.2, "threat": 0.1, "identity_hate": 0.9}
        )
        assert action == "block"
        assert reason == "Discours haineux détecté"

    def test_block_insult(self):
        action, _, _ = decide_action(
            {"toxicity": 0.4, "insult": 0.95, "threat": 0.1, "identity_hate": 0.1}
        )
        assert action == "block"

    def test_warn_moderate_toxicity(self):
        action, is_toxic, _ = decide_action(
            {"toxicity": 0.6, "insult": 0.2, "threat": 0.1, "identity_hate": 0.1}
        )
        assert action == "warn"
        assert is_toxic is True

    def test_warn_combined_insult_hate(self):
        action, is_toxic, reason = decide_action(
            {"toxicity": 0.3, "insult": 0.5, "threat": 0.1, "identity_hate": 0.5}
        )
        assert action == "warn"
        assert is_toxic is True
        assert "insulte" in (reason or "").lower() or "haine" in (reason or "").lower()

    def test_warn_single_category_above_warn_threshold(self):
        action, _, _ = decide_action(
            {"toxicity": 0.2, "insult": 0.55, "threat": 0.1, "identity_hate": 0.05}
        )
        assert action == "warn"

    @pytest.mark.parametrize(
        "toxicity,expected",
        [
            (0.74, "warn"),
            (0.75, "block"),
            (0.49, "allow"),
            (0.50, "warn"),
        ],
    )
    def test_toxicity_boundaries(self, toxicity, expected):
        action, _, _ = decide_action(
            {"toxicity": toxicity, "insult": 0.0, "threat": 0.0, "identity_hate": 0.0}
        )
        assert action == expected
