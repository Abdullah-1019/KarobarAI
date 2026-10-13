"""Listing-generation orchestration independent of the local chatbot model."""

from app.llm.client import LlmClient
from app.llm.errors import AiGenerationError, LlmClientError
from app.llm.gemini_listing_client import GeminiListingClient
from app.schemas.listing import GeneratedListing


class LlmFallbackOrchestrator:
    def __init__(self, primary: LlmClient, fallback: LlmClient | None = None) -> None:
        self._primary = primary
        self._fallback = fallback

    def generate(self, image_url: str, hint: str | None = None) -> GeneratedListing:
        try:
            return self._primary.generate(image_url, hint)
        except LlmClientError as primary_error:
            if self._fallback is None:
                raise AiGenerationError("Listing generation failed") from primary_error

        try:
            return self._fallback.generate(image_url, hint)
        except LlmClientError as err:
            raise AiGenerationError("Both primary and fallback LLM clients failed") from err


# Hosted listing generation has no Ollama fallback: failures never consume chatbot capacity.
def build_default_orchestrator() -> LlmFallbackOrchestrator:
    return LlmFallbackOrchestrator(
        primary=GeminiListingClient(),
    )
