"""Image-to-listing generation using the configured local Ollama vision model."""

import asyncio
import base64
import json

import httpx
from pydantic import ValidationError

from app.config import settings
from app.llm.client import LlmClient
from app.llm.errors import LlmClientError
from app.schemas.listing import GeneratedListing
from app.services.slm_client import OllamaClientError, SLMClient


class OllamaListingClient(LlmClient):
    def __init__(
        self,
        model: str | None = None,
        *,
        slm_client: SLMClient | None = None,
        image_timeout_seconds: float = 30.0,
    ) -> None:
        self._model = model or settings.ollama_chat_model
        self._slm_client = slm_client or SLMClient(model=self._model)
        self._image_timeout_seconds = image_timeout_seconds

    def generate(self, image_url: str, hint: str | None = None) -> GeneratedListing:
        try:
            image_data, mime_type = self._fetch_image(image_url)
            user_content: list[dict[str, object]] = [
                {"type": "text", "text": self._prompt(hint)},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "data:{};base64,{}".format(
                            mime_type, base64.b64encode(image_data).decode("ascii")
                        )
                    },
                },
            ]
            response = asyncio.run(
                self._slm_client.chat([{"role": "user", "content": user_content}])
            )
            listing_data = json.loads(response["reply"])
            return GeneratedListing.model_validate(listing_data)
        except (
            httpx.HTTPError,
            KeyError,
            TypeError,
            ValueError,
            ValidationError,
            OllamaClientError,
        ) as error:
            raise LlmClientError(f"Ollama listing generation failed: {error}") from error

    def _fetch_image(self, image_url: str) -> tuple[bytes, str]:
        response = httpx.get(image_url, timeout=self._image_timeout_seconds)
        response.raise_for_status()
        mime_type = response.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        if not mime_type.startswith("image/"):
            raise ValueError("Listing image URL did not return an image")
        return response.content, mime_type

    @staticmethod
    def _prompt(hint: str | None) -> str:
        prompt = (
            "You write bilingual product listings for a Pakistani online marketplace. "
            "Use only visible product evidence and the optional seller hint. Do not invent "
            "price, stock, variants, brand, or specifications. Return a JSON object with exactly "
            "these fields: title_en, title_ur, description_en, description_ur, category, tags. "
            "Use concise natural English and Urdu, and provide 5 to 10 short relevant tags."
        )
        if hint:
            prompt += f"\nSeller hint: {hint}"
        return prompt
