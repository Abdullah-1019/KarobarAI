"""Listing-generation orchestration backed exclusively by the configured local Ollama model."""

from app.config import settings
from app.llm.client import LlmClient
from app.llm.errors import AiGenerationError, LlmClientError
from app.llm.ollama_listing_client import OllamaListingClient
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
                raise AiGenerationError("Local Ollama listing generation failed") from primary_error

        try:
            return self._fallback.generate(image_url, hint)
        except LlmClientError as err:
            raise AiGenerationError("Both primary and fallback LLM clients failed") from err


# The route always uses the selected local Ollama model. No API key or commercial provider is
# consulted. Generation failures surface as the existing safe 502 response.
def build_default_orchestrator() -> LlmFallbackOrchestrator:
    return LlmFallbackOrchestrator(
        primary=OllamaListingClient(model=settings.ollama_chat_model),
    )
