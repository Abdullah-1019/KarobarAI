import base64
from unittest.mock import AsyncMock

import httpx
import pytest

from app.llm.errors import AiGenerationError, LlmClientError
from app.llm.fallback_orchestrator import LlmFallbackOrchestrator
from app.llm.ollama_listing_client import OllamaListingClient
from app.schemas.listing import GeneratedListing
from app.services.slm_client import OllamaClientError

SAMPLE_LISTING = GeneratedListing(
    title_en="Blue Cotton Shirt",
    title_ur="نیلی کاٹن شرٹ",
    description_en="A blue cotton shirt.",
    description_ur="نیلی کاٹن کی شرٹ۔",
    category="Clothing",
    tags=["shirt", "cotton", "blue", "clothing", "casual"],
)


def _client(reply: str) -> tuple[OllamaListingClient, AsyncMock]:
    slm = AsyncMock()
    slm.chat.return_value = {"reply": reply}
    client = OllamaListingClient(model="qwen2.5vl:7b", slm_client=slm)
    client._fetch_image = lambda _: (b"image-bytes", "image/jpeg")  # type: ignore[method-assign]
    return client, slm


def test_listing_client_passes_image_and_hint_through_json_envelope() -> None:
    client, slm = _client(SAMPLE_LISTING.model_dump_json())

    result = client.generate("https://cdn.example/product.jpg", "blue cotton shirt")

    assert result == SAMPLE_LISTING
    slm.chat.assert_awaited_once()
    messages = slm.chat.call_args.args[0]
    user_content = messages[0]["content"]
    assert "blue cotton shirt" in user_content[0]["text"]
    image_url = user_content[1]["image_url"]["url"]
    assert image_url == f"data:image/jpeg;base64,{base64.b64encode(b'image-bytes').decode()}"


def test_listing_client_rejects_malformed_or_schema_invalid_model_output() -> None:
    malformed, _ = _client("not-json")
    with pytest.raises(LlmClientError, match="listing generation failed"):
        malformed.generate("https://cdn.example/product.jpg")

    incomplete, _ = _client('{"title_en":"Only a title"}')
    with pytest.raises(LlmClientError, match="listing generation failed"):
        incomplete.generate("https://cdn.example/product.jpg")


def test_listing_client_converts_ollama_failure_to_provider_error() -> None:
    slm = AsyncMock()
    slm.chat.side_effect = OllamaClientError("inference unavailable")
    client = OllamaListingClient(slm_client=slm)
    client._fetch_image = lambda _: (b"image-bytes", "image/jpeg")  # type: ignore[method-assign]

    with pytest.raises(LlmClientError, match="inference unavailable"):
        client.generate("https://cdn.example/product.jpg")


def test_listing_failure_preserves_safe_generation_error_contract() -> None:
    class FailedClient:
        def generate(self, image_url: str, hint: str | None = None) -> GeneratedListing:
            raise LlmClientError("local model unavailable")

    orchestrator = LlmFallbackOrchestrator(primary=FailedClient())  # type: ignore[arg-type]
    with pytest.raises(AiGenerationError, match="Listing generation failed"):
        orchestrator.generate("https://cdn.example/product.jpg")


def test_non_image_url_response_is_rejected(monkeypatch) -> None:
    response = httpx.Response(
        200,
        headers={"content-type": "text/html"},
        content=b"not image",
        request=httpx.Request("GET", "https://cdn.example/not-image"),
    )
    monkeypatch.setattr("app.llm.ollama_listing_client.httpx.get", lambda *args, **kwargs: response)
    client = OllamaListingClient()

    with pytest.raises(LlmClientError, match="did not return an image"):
        client.generate("https://cdn.example/not-image")
