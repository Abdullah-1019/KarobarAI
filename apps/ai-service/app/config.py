from pydantic_settings import BaseSettings


# Feature 13 — deliberate deviation from D3 (GPT-4V primary / GPT-3.5-turbo fallback): Gemini
# Flash is used on both sides of the fallback pair during development for its free tier (see
# docs/handoffs/F13-ai-store-builder.md). LLM_PRIMARY_MODEL/LLM_FALLBACK_MODEL are the *only*
# place model identity is configured — no model name is hardcoded anywhere else in app/llm/.
class Settings(BaseSettings):
    port_ai: int = 8000
    ollama_base_url: str = "http://ollama:11434"
    ollama_chat_model: str = "qwen2.5vl:7b"
    ollama_embed_model: str = "nomic-embed-text"
    ollama_timeout_seconds: float = 600.0
    ollama_max_attempts: int = 3
    ollama_backoff_base_seconds: float = 0.25
    gemini_api_key: str = ""
    llm_primary_model: str = "gemini-1.5-flash"
    llm_fallback_model: str = "gemini-1.5-flash-8b"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
