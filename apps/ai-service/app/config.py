from pydantic import Field, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port_ai: int = 8000
    ollama_base_url: str = "http://ollama:11434"
    ollama_chat_model: str = "qwen2.5vl:7b"
    ollama_embed_model: str = "nomic-embed-text"
    gemini_api_key: str = ""
    gemini_listing_model: str = "gemini-3.1-flash-lite"
    gemini_listing_timeout_seconds: float = 45.0
    return_dino_model: str = "facebook/dinov2-small"
    return_dino_revision: str = "ed25f3a31f01632728cabb09d1542f84ab7b0056"
    return_dino_cache_dir: str = "/models/dinov2"
    # Provisional similarity cutoffs. They are not probabilities or calibrated decisions.
    return_dino_match_threshold: float = Field(default=0.90, ge=-1, le=1)
    return_dino_mismatch_threshold: float = Field(default=0.65, ge=-1, le=1)
    return_dino_max_spread: float = Field(default=0.20, ge=0, le=2)
    return_dino_cpu_threads: int = Field(default=2, ge=1, le=8)
    listing_image_allowed_hosts: str = "minio"
    ollama_timeout_seconds: float = 600.0
    ollama_max_attempts: int = 3
    ollama_backoff_base_seconds: float = 0.25

    @model_validator(mode="after")
    def validate_comparison_thresholds(self) -> "Settings":
        if self.return_dino_mismatch_threshold >= self.return_dino_match_threshold:
            raise ValueError("Return comparison mismatch threshold must be below match threshold")
        return self

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
