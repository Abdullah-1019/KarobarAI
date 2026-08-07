"""Dev/test double for LlmClient — same role as every Core API adapter's mock/live split (D2).
Selected automatically (app/llm/fallback_orchestrator.py's build_default_orchestrator) when no
GEMINI_API_KEY is configured, so local dev/CI never needs a real key to boot the AI Service.
Never used in production — GeminiVisionClient is the sole real implementation."""

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
