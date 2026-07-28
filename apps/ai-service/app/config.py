from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port_ai: int = 8000
    openai_api_key: str = ""
    llm_primary_model: str = "gpt-4-vision-preview"
    llm_fallback_model: str = "gpt-3.5-turbo"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
