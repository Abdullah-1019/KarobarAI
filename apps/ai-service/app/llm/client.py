"""Provider-neutral interface for local listing-generation clients."""

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
