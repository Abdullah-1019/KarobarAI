"""Typed exceptions for the LLM client layer (Task 1.4)."""


class LlmClientError(Exception):
    """Raised by an LlmClient implementation when a single provider call fails after
    exhausting its own internal retries (network error, non-2xx response, or a response that
    fails ListingSchema validation)."""


class AiGenerationError(Exception):
    """Raised by LlmFallbackOrchestrator when every configured client has failed. The only
    exception type the generate_listing router needs to catch (Task 3.1)."""
