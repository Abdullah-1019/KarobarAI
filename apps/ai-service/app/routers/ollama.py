"""Private network endpoints for the backend's chat and embedding workers."""

from typing import Any, Literal

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.gemini_chat_client import GeminiChatClient, GeminiChatError
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
_gemini_chat_client = GeminiChatClient()

# Safe failure codes for Fast Mode. The caller shows a mode-specific message; it never silently
# switches provider, because that would defeat the mode the user selected.
_GEMINI_FAILURES: dict[str, tuple[int, str]] = {
    "not_configured": (503, "GEMINI_NOT_CONFIGURED"),
    "rate_limited": (429, "GEMINI_RATE_LIMITED"),
    "timeout": (504, "GEMINI_TIMEOUT"),
    "unavailable": (502, "GEMINI_UNAVAILABLE"),
}


class ChatRequest(BaseModel):
    messages: list[dict[str, Any]]
    tools: list[dict[str, Any]] = Field(default_factory=list)
    response_format: dict[str, Any] | None = None
    provider: Literal["ollama", "gemini"] = "ollama"


class EmbeddingRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=64)


@router.post("/chat")
async def chat(payload: ChatRequest) -> dict[str, Any]:
    if payload.provider == "gemini":
        return await _gemini_chat(payload)
    try:
        return await _slm_client.chat(payload.messages, payload.tools, payload.response_format)
    except InvalidEnvelopeError:
        # Invalid or unallowlisted model output must never be interpreted as a tool call.
        return fail_closed_response()
    except OllamaClientError as error:
        raise HTTPException(status_code=502, detail="Local model unavailable") from error


@router.post("/chat/stream")
async def chat_stream(payload: ChatRequest) -> StreamingResponse:
    async def events():
        if payload.provider == "gemini":
            # Gemini replies are short and fast; send the validated envelope as one final event.
            try:
                envelope = await _gemini_chat(payload)
            except HTTPException as error:
                code = error.detail.get("code") if isinstance(error.detail, dict) else None
                error_event = {"type": "error", "code": code or "GEMINI_UNAVAILABLE"}
                yield f"data: {json.dumps(error_event)}\n\n"
                return
            final_event = {"type": "final", "envelope": envelope}
            yield f"data: {json.dumps(final_event, ensure_ascii=False)}\n\n"
            return
        try:
            async for item in _slm_client.stream_chat(
                payload.messages, payload.tools, payload.response_format
            ):
                yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"
        except OllamaClientError:
            yield 'data: {"type":"error","code":"LOCAL_AI_UNAVAILABLE"}\n\n'

    return StreamingResponse(
        events(), media_type="text/event-stream", headers={"Cache-Control": "no-store"}
    )


async def _gemini_chat(payload: ChatRequest) -> dict[str, Any]:
    try:
        return await _gemini_chat_client.chat(
            payload.messages, payload.tools, payload.response_format
        )
    except GeminiChatError as error:
        if error.reason == "invalid_output":
            return fail_closed_response()
        status, code = _GEMINI_FAILURES.get(error.reason, (502, "GEMINI_UNAVAILABLE"))
        raise HTTPException(status_code=status, detail={"code": code}) from error


@router.post("/embeddings")
async def embeddings(payload: EmbeddingRequest) -> dict[str, list[list[float]]]:
    try:
        return {"embeddings": await _embedding_client.embed(payload.texts)}
    except OllamaClientError as error:
        raise HTTPException(status_code=502, detail="Local embedding model unavailable") from error
