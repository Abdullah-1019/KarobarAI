"""LlmFallbackOrchestrator — the single entry point every generation task calls (Task 1.4).

D3 (binding) specifies GPT-4 Vision primary -> GPT-3.5-turbo fallback. This deployment
deliberately runs GeminiVisionClient on both sides of that same primary/fallback shape (see
gemini_client.py's docstring for why) — LLM_PRIMARY_MODEL and LLM_FALLBACK_MODEL name two
independent Gemini model strings (e.g. a larger and a smaller/faster Flash variant), so a
transient failure or capacity limit on one genuinely has a different model to fall back to, not
just a retry of the identical call. Each client additionally retries-with-backoff internally
(GeminiVisionClient.generate) before the orchestrator ever switches to the other one — two layers
of resilience: retry the same model, then fail over to the other configured model.

Swapping to a different provider later requires zero changes here: build_default_orchestrator()
already reads model identity from config only; only a new LlmClient subclass plus that provider's
own API-key setting would need to be wired into the two `if` branches below.
"""

from app.config import settings
from app.llm.client import LlmClient
from app.llm.errors import AiGenerationError, LlmClientError
from app.llm.gemini_client import GeminiVisionClient
from app.llm.mock_client import MockLlmClient
from app.schemas.listing import GeneratedListing


class LlmFallbackOrchestrator:
    def __init__(self, primary: LlmClient, fallback: LlmClient) -> None:
        self._primary = primary
        self._fallback = fallback

    def generate(self, image_url: str, hint: str | None = None) -> GeneratedListing:
        try:
            return self._primary.generate(image_url, hint)
        except LlmClientError:
            pass

        try:
            return self._fallback.generate(image_url, hint)
        except LlmClientError as err:
            raise AiGenerationError("Both primary and fallback LLM clients failed") from err


# Task 1.3/REQ-AI-Store001 — model selection is 100% config-driven (LLM_PRIMARY_MODEL/
# LLM_FALLBACK_MODEL, app/config.py): no model name is hardcoded anywhere in this module. When
# GEMINI_API_KEY is unset (local dev/CI without secrets), both sides fall back to MockLlmClient
# rather than failing to boot — the same dev-mode graceful-degradation this codebase's D2 mock/
# live adapters already provide on the Core API side.
def build_default_orchestrator() -> LlmFallbackOrchestrator:
    if not settings.gemini_api_key:
        return LlmFallbackOrchestrator(primary=MockLlmClient(), fallback=MockLlmClient())

    primary = GeminiVisionClient(model=settings.llm_primary_model, api_key=settings.gemini_api_key)
    fallback = GeminiVisionClient(
        model=settings.llm_fallback_model, api_key=settings.gemini_api_key
    )
    return LlmFallbackOrchestrator(primary=primary, fallback=fallback)
