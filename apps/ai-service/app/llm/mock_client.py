"""Deterministic test double for LlmClient. Production listing generation uses local Ollama."""

from app.llm.client import LlmClient
from app.schemas.listing import GeneratedListing


class MockLlmClient(LlmClient):
    def generate(self, image_url: str, hint: str | None = None) -> GeneratedListing:
        title_en = f"Sample {hint}" if hint else "Sample Product"
        return GeneratedListing(
            title_en=title_en,
            title_ur="نمونہ پروڈکٹ",
            description_en="AI-generated description placeholder (mock mode).",
            description_ur="اے آئی سے تیار کردہ تفصیل کا نمونہ۔",
            category="general",
            tags=["new", "sample"],
        )
