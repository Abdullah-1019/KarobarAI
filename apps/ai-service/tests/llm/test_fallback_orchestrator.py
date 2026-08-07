from unittest.mock import MagicMock

import pytest

from app.llm.client import LlmClient
from app.llm.errors import AiGenerationError, LlmClientError
from app.llm.fallback_orchestrator import LlmFallbackOrchestrator, build_default_orchestrator
from app.llm.gemini_client import GeminiVisionClient
from app.llm.mock_client import MockLlmClient
from app.schemas.listing import GeneratedListing

FALLBACK_RESULT = GeneratedListing(
    title_en="Fallback Title",
    title_ur="متبادل عنوان",
    description_en="Fallback description text here.",
    description_ur="متبادل تفصیل۔",
    category="Electronics",
    tags=["a", "b", "c", "d", "e"],
)

PRIMARY_RESULT = GeneratedListing(
    title_en="Primary Title",
    title_ur="بنیادی عنوان",
    description_en="Primary description text here.",
    description_ur="بنیادی تفصیل۔",
    category="Electronics",
    tags=["a", "b", "c", "d", "e"],
)


def _client(result: GeneratedListing | None = None, error: Exception | None = None) -> LlmClient:
    mock = MagicMock(spec=LlmClient)
    if error is not None:
        mock.generate.side_effect = error
    else:
        mock.generate.return_value = result
    return mock


class TestLlmFallbackOrchestrator:
    def test_primary_success_path_never_touches_the_fallback_client(self) -> None:
        primary = _client(result=PRIMARY_RESULT)
        fallback = _client(result=FALLBACK_RESULT)
        orchestrator = LlmFallbackOrchestrator(primary=primary, fallback=fallback)

        result = orchestrator.generate("https://cdn.example/x.jpg", hint="Speaker")

        assert result is PRIMARY_RESULT
        fallback.generate.assert_not_called()

    def test_primary_fails_fallback_succeeds_returns_the_fallback_result(self) -> None:
        primary = _client(error=LlmClientError("primary down"))
        fallback = _client(result=FALLBACK_RESULT)
        orchestrator = LlmFallbackOrchestrator(primary=primary, fallback=fallback)

        result = orchestrator.generate("https://cdn.example/x.jpg")

        assert result is FALLBACK_RESULT
        primary.generate.assert_called_once()
        fallback.generate.assert_called_once()

    def test_both_clients_failing_raises_ai_generation_error(self) -> None:
        primary = _client(error=LlmClientError("primary down"))
        fallback = _client(error=LlmClientError("fallback down too"))
        orchestrator = LlmFallbackOrchestrator(primary=primary, fallback=fallback)

        with pytest.raises(AiGenerationError):
            orchestrator.generate("https://cdn.example/x.jpg")

    def test_hint_is_passed_through_to_whichever_client_actually_serves_the_request(self) -> None:
        primary = _client(error=LlmClientError("primary down"))
        fallback = _client(result=FALLBACK_RESULT)
        orchestrator = LlmFallbackOrchestrator(primary=primary, fallback=fallback)

        orchestrator.generate("https://cdn.example/x.jpg", hint="Running shoes")

        fallback.generate.assert_called_once_with("https://cdn.example/x.jpg", "Running shoes")


class TestBuildDefaultOrchestrator:
    def test_falls_back_to_mock_clients_when_no_gemini_api_key_is_configured(
        self, monkeypatch
    ) -> None:
        monkeypatch.setattr("app.llm.fallback_orchestrator.settings.gemini_api_key", "")
        orchestrator = build_default_orchestrator()

        assert isinstance(orchestrator._primary, MockLlmClient)
        assert isinstance(orchestrator._fallback, MockLlmClient)

    def test_builds_two_gemini_clients_reading_model_names_from_config_when_a_key_is_present(
        self, monkeypatch
    ) -> None:
        monkeypatch.setattr("app.llm.fallback_orchestrator.settings.gemini_api_key", "real-key")
        monkeypatch.setattr(
            "app.llm.fallback_orchestrator.settings.llm_primary_model", "model-primary-x"
        )
        monkeypatch.setattr(
            "app.llm.fallback_orchestrator.settings.llm_fallback_model", "model-fallback-y"
        )

        orchestrator = build_default_orchestrator()

        assert isinstance(orchestrator._primary, GeminiVisionClient)
        assert isinstance(orchestrator._fallback, GeminiVisionClient)
        assert orchestrator._primary._model == "model-primary-x"
        assert orchestrator._fallback._model == "model-fallback-y"
