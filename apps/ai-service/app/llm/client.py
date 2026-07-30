"""Provider-agnostic LLM client for the AI Store Builder (REQ-AI-Store001/002, D3).

Mock-only for now — a deliberate, explicitly-confirmed scope decision for Feature 4's first pass
(see docs/handoffs/F4-catalog-backend.md). Always returns a fixed, schema-conformant listing
rather than calling a real GPT-4 Vision primary / GPT-3.5-turbo fallback provider. The real
implementation (reading settings.openai_api_key/llm_primary_model/llm_fallback_model from
app/config.py, which already exist) is a separate, later task — this function's signature and
return contract are exactly what that implementation will fill in without any caller (the
/generate-listing route, apps/backend's orchestration call) needing to change.
"""

from app.schemas.listing import GeneratedListing


def generate_listing(image_url: str, hint: str | None = None) -> GeneratedListing:
    title_en = f"Sample {hint}" if hint else "Sample Product"
    return GeneratedListing(
        title_en=title_en,
        title_ur="نمونہ پروڈکٹ",
        description_en="AI-generated description placeholder (mock mode).",
        description_ur="اے آئی سے تیار کردہ تفصیل کا نمونہ۔",
        category="general",
        tags=["new", "sample"],
    )
