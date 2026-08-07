from pydantic_settings import BaseSettings


# Feature 13 — deliberate deviation from D3 (GPT-4V primary / GPT-3.5-turbo fallback): Gemini
# Flash is used on both sides of the fallback pair during development for its free tier (see
# docs/handoffs/F13-ai-store-builder.md). LLM_PRIMARY_MODEL/LLM_FALLBACK_MODEL are the *only*
# place model identity is configured — no model name is hardcoded anywhere else in app/llm/.
class Settings(BaseSettings):
    port_ai: int = 8000
    gemini_api_key: str = ""
    llm_primary_model: str = "gemini-1.5-flash"
    llm_fallback_model: str = "gemini-1.5-flash-8b"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
