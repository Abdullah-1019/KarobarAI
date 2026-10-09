from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port_ai: int = 8000
    ollama_base_url: str = "http://ollama:11434"
    ollama_chat_model: str = "qwen2.5vl:7b"
    ollama_embed_model: str = "nomic-embed-text"
    ollama_timeout_seconds: float = 600.0
    ollama_max_attempts: int = 3
    ollama_backoff_base_seconds: float = 0.25

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
