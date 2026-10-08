"""Private network endpoints for the backend's chat and embedding workers."""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.slm_client import (
    EmbeddingClient,
    InvalidEnvelopeError,
    OllamaClientError,
    SLMClient,
    fail_closed_response,
)

router = APIRouter()
_slm_client = SLMClient()
_embedding_client = EmbeddingClient()


class ChatRequest(BaseModel):
    messages: list[dict[str, Any]]
    tools: list[dict[str, Any]] = Field(default_factory=list)
    response_format: dict[str, Any] | None = None


class EmbeddingRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=64)


@router.post("/chat")
async def chat(payload: ChatRequest) -> dict[str, Any]:
    try:
        return await _slm_client.chat(payload.messages, payload.tools, payload.response_format)
    except InvalidEnvelopeError:
        # Invalid or unallowlisted model output must never be interpreted as a tool call.
        return fail_closed_response()
    except OllamaClientError as error:
        raise HTTPException(status_code=502, detail="Local model unavailable") from error


@router.post("/embeddings")
async def embeddings(payload: EmbeddingRequest) -> dict[str, list[list[float]]]:
    try:
        return {"embeddings": await _embedding_client.embed(payload.texts)}
    except OllamaClientError as error:
        raise HTTPException(status_code=502, detail="Local embedding model unavailable") from error
