"""GeminiVisionClient — the sole real LlmClient implementation for now (Task 1.3, adapted).

Deliberate deviation from D3 (GPT-4 Vision primary / GPT-3.5-turbo fallback): Google Gemini's
Flash models have a free tier (1,500 requests/day, no credit card) with native vision support,
chosen purely for development cost reasons. See docs/handoffs/F13-ai-store-builder.md for the
full reasoning and the migration path to a paid provider at production launch.

Nothing here hardcodes a model name — `model` is a constructor parameter, always sourced from
LLM_PRIMARY_MODEL/LLM_FALLBACK_MODEL (app/config.py) by the orchestrator builder
(fallback_orchestrator.py's build_default_orchestrator), never read from settings directly by
this class. Two instances of this exact class (one per configured model) stand in for D3's
primary/fallback pair — see LlmFallbackOrchestrator's own docstring.
"""

import base64
import json
import time

import httpx
from pydantic import ValidationError

from app.llm.client import LlmClient
from app.llm.errors import LlmClientError
from app.schemas.listing import GeneratedListing

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

_PROMPT_TEMPLATE = """You are a bilingual (English/Urdu) e-commerce listing writer for a \
Pakistani online marketplace. Look at the attached product photo and produce a JSON object \
with EXACTLY these fields, no others:

- title_en: a concise English product title (max ~80 characters)
- title_ur: the same title, naturally written in Urdu (not a literal transliteration)
- description_en: a 2-3 sentence English product description
- description_ur: a 2-3 sentence Urdu product description
- category: your best-guess single category name for this product (plain text, e.g. \
"Electronics", "Fashion & Clothing")
- tags: a JSON array of 5 to 10 short, relevant SEO search tags (strings), ordered from most \
to least relevant

Respond with ONLY the JSON object, no other text."""


def _build_prompt(hint: str | None) -> str:
    if not hint:
        return _PROMPT_TEMPLATE
    return f"{_PROMPT_TEMPLATE}\n\nAdditional context from the seller: {hint}"


def _fetch_image(image_url: str, timeout_seconds: float) -> tuple[bytes, str]:
    response = httpx.get(image_url, timeout=timeout_seconds)
    response.raise_for_status()
    content_type = response.headers.get("content-type", "image/jpeg").split(";")[0].strip()
    return response.content, content_type


def _extract_json_text(response_body: dict) -> str:
    try:
        return response_body["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as err:
        raise ValueError(
            "Gemini response did not contain the expected candidates/content shape"
        ) from err


class GeminiVisionClient(LlmClient):
    def __init__(
        self,
        model: str,
        api_key: str,
        timeout_seconds: float = 10.0,
        max_retries: int = 1,
        backoff_base_seconds: float = 1.0,
    ) -> None:
        self._model = model
        self._api_key = api_key
        self._timeout_seconds = timeout_seconds
        self._max_retries = max_retries
        self._backoff_base_seconds = backoff_base_seconds

    def generate(self, image_url: str, hint: str | None = None) -> GeneratedListing:
        last_error: Exception | None = None
        attempts = self._max_retries + 1
        for attempt in range(attempts):
            try:
                return self._call_once(image_url, hint)
            except (httpx.HTTPError, ValidationError, ValueError, json.JSONDecodeError) as err:
                last_error = err
                if attempt < attempts - 1:
                    time.sleep(self._backoff_base_seconds * (2**attempt))
        raise LlmClientError(
            f"Gemini model '{self._model}' failed after {attempts} attempt(s): {last_error}"
        ) from last_error

    def _call_once(self, image_url: str, hint: str | None) -> GeneratedListing:
        image_bytes, mime_type = _fetch_image(image_url, self._timeout_seconds)

        response = httpx.post(
            f"{GEMINI_API_BASE}/{self._model}:generateContent",
            params={"key": self._api_key},
            json={
                "contents": [
                    {
                        "parts": [
                            {"text": _build_prompt(hint)},
                            {
                                "inline_data": {
                                    "mime_type": mime_type,
                                    "data": base64.b64encode(image_bytes).decode("ascii"),
                                }
                            },
                        ]
                    }
                ],
                "generationConfig": {"responseMimeType": "application/json"},
            },
            timeout=self._timeout_seconds,
        )
        response.raise_for_status()

        text = _extract_json_text(response.json())
        data = json.loads(text)
        return GeneratedListing.model_validate(data)
