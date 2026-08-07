"""Provider-agnostic LLM client interface (Task 1.2, REQ-AI-Store001/D3's adapter philosophy —
mirrors the Core API's D2 adapter pattern, applied here to the AI Service's vision-LLM provider).

Concrete implementations: GeminiVisionClient (app/llm/gemini_client.py, the sole real provider
for now — see docs/handoffs/F13-ai-store-builder.md for why this deviates from D3's literal
GPT-4V/GPT-3.5 pairing) and MockLlmClient (app/llm/mock_client.py, dev/test double only, same
role as every Core API adapter's mock/live split). Swapping to a paid provider later (GPT-4o,
Claude) means adding one new class implementing this interface and changing LLM_PRIMARY_MODEL/
LLM_FALLBACK_MODEL (plus, if the new provider isn't Gemini, the client-selection wiring in
fallback_orchestrator.py's build_default_orchestrator()) — nothing else in this codebase changes.
"""

from abc import ABC, abstractmethod

from app.schemas.listing import GeneratedListing


class LlmClient(ABC):
    @abstractmethod
    def generate(self, image_url: str, hint: str | None = None) -> GeneratedListing:
        """Generate a schema-conformant listing from a product image URL and an optional
        category hint. Raises LlmClientError (app/llm/errors.py) on any failure — network,
        non-2xx response, or a response that fails ListingSchema validation — never returns a
        partial/malformed result."""
        raise NotImplementedError
