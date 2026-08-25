"""Tests du lexique, de la détection de langue et du mode dégradé (sans modèle)."""

import pytest

from app.languages import detect_language
from app.lexicon import lexicon_scores, normalize
from app.scoring import evaluate


class TestNormalization:
    @pytest.mark.parametrize(
        "raw,expected_fragment",
        [
            ("CONNARD", "connard"),
            ("c.o.n.n.a.r.d", "connard"),
            ("c0nn4rd", "connard"),
            ("Débile", "debile"),
            ("saluuuuut", "saluut"),
        ],
    )
    def test_normalize_defeats_obfuscation(self, raw, expected_fragment):
        assert expected_fragment in normalize(raw)


class TestLexicon:
    def test_neutral_message_scores_zero(self):
        scores = lexicon_scores("Je pense que le nucléaire est une bonne option pour le climat.")
        assert scores["toxicity"] == 0.0

    def test_threat_detected(self):
        scores = lexicon_scores("Je vais te casser la gueule")
        assert scores["threat"] >= 0.9

    def test_identity_hate_detected(self):
        scores = lexicon_scores("Retourne dans ton pays")
        assert scores["identity_hate"] >= 0.7

    def test_obfuscated_insult_detected(self):
        assert lexicon_scores("espèce de c0nn4rd")["insult"] >= 0.9

    def test_shouting_is_only_a_weak_signal(self):
        scores = lexicon_scores("CE RAISONNEMENT EST FAUX ET DANGEREUX")
        assert 0 < scores["insult"] < 0.5
        assert evaluate(scores).action == "allow"


class TestLanguageDetection:
    @pytest.mark.parametrize(
        "text,expected",
        [
            ("Je pense que ton argument est faible mais intéressant", "fr"),
            ("I strongly disagree with that point of view", "en"),
            ("Creo que el argumento es debil pero interesante", "es"),
        ],
    )
    def test_detects_main_languages(self, text, expected):
        assert detect_language(text)[0] == expected

    def test_short_text_falls_back_with_low_confidence(self):
        language, confidence = detect_language("ok")
        assert language == "fr"
        assert confidence < 0.5


class TestDegradedMode:
    """Sans modèle chargé, le lexique doit encore bloquer le pire."""

    def _decide(self, text: str) -> str:
        return evaluate(lexicon_scores(text)).action

    def test_blocks_threat_without_model(self):
        assert self._decide("Je vais te retrouver et te casser la gueule") == "block"

    def test_blocks_slur_without_model(self):
        assert self._decide("sale arabe") == "block"

    def test_allows_hard_but_civil_argument(self):
        assert self._decide("Ton raisonnement est économiquement intenable, voici pourquoi.") == "allow"

    def test_warns_on_mild_insult(self):
        assert self._decide("tu es débile ou quoi") in {"warn", "block"}
