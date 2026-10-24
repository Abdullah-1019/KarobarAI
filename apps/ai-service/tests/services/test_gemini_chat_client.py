import asyncio
import json
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import ollama as chat_router
from app.services.gemini_chat_client import GeminiChatClient, GeminiChatError

TOOLS = [{"name": "search_products", "parameters": {"query": "string"}}]
MESSAGES = [{"role": "system", "content": "Store assistant."}, {"role": "user", "content": "hi"}]

# Only the chat router: app.main also loads vision dependencies that these tests do not need.
app = FastAPI()
app.include_router(chat_router.router, prefix="/internal")


def _reply(text: str) -> dict[str, Any]:
    return {"candidates": [{"content": {"parts": [{"text": text}]}}]}


def _client(handler: Any, **kwargs: Any) -> GeminiChatClient:
    transport = httpx.MockTransport(handler)
    http = httpx.AsyncClient(transport=transport)
    return GeminiChatClient(api_key="test-key", model="gemini-test", client=http, **kwargs)


def test_returns_validated_reply_and_keeps_key_in_header() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=_reply('{"reply":"Hello"}'))

    result = asyncio.run(_client(handler).chat(MESSAGES, TOOLS))
    assert result == {"reply": "Hello"}
    assert seen[0].headers["x-goog-api-key"] == "test-key"
    assert "test-key" not in str(seen[0].url)
    body = json.loads(seen[0].content)
    assert body["systemInstruction"]["parts"][0]["text"].startswith("Store assistant.")
    assert body["generationConfig"]["responseMimeType"] == "application/json"


def test_returns_allowlisted_tool_call() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json=_reply('{"tool_call":{"type":"search_products","payload":{"query":"shirt"}}}')
        )

    result = asyncio.run(_client(handler).chat(MESSAGES, TOOLS))
    assert result == {"tool_call": {"type": "search_products", "payload": {"query": "shirt"}}}


def test_rejects_unlisted_tool_after_one_correction() -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json=_reply('{"tool_call":{"type":"drop_table","payload":{}}}'))

    with pytest.raises(GeminiChatError) as error:
        asyncio.run(_client(handler).chat(MESSAGES, TOOLS))
    assert error.value.reason == "invalid_output"
    assert calls == 2


@pytest.mark.parametrize(
    ("status", "reason"), [(429, "rate_limited"), (403, "not_configured"), (400, "unavailable")]
)
def test_maps_provider_status_to_safe_reason(status: int, reason: str) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(status, json={"error": {"message": "secret detail"}})

    with pytest.raises(GeminiChatError) as error:
        asyncio.run(_client(handler).chat(MESSAGES, TOOLS))
    assert error.value.reason == reason


def test_timeout_is_reported_without_retrying_forever() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    with pytest.raises(GeminiChatError) as error:
        asyncio.run(_client(handler).chat(MESSAGES, TOOLS))
    assert error.value.reason == "timeout"


@pytest.mark.parametrize("key", ["", "replace-with-gemini-api-key"])
def test_missing_key_fails_before_any_request(key: str) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise AssertionError("no request expected")

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    client = GeminiChatClient(api_key=key, model="gemini-test", client=http)
    with pytest.raises(GeminiChatError) as error:
        asyncio.run(client.chat(MESSAGES, TOOLS))
    assert error.value.reason == "not_configured"


def test_router_rejects_unknown_provider() -> None:
    response = TestClient(app).post(
        "/internal/chat", json={"messages": MESSAGES, "tools": [], "provider": "openai"}
    )
    assert response.status_code == 422


def test_router_reports_missing_gemini_config_without_falling_back(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(chat_router, "_gemini_chat_client", GeminiChatClient(api_key=""))

    async def fail_ollama(*_: Any, **__: Any) -> dict[str, Any]:
        raise AssertionError("Fast Mode must not fall back to Ollama")

    monkeypatch.setattr(chat_router._slm_client, "chat", fail_ollama)
    response = TestClient(app).post(
        "/internal/chat", json={"messages": MESSAGES, "tools": [], "provider": "gemini"}
    )
    assert response.status_code == 503
    assert response.json()["detail"] == {"code": "GEMINI_NOT_CONFIGURED"}


def test_router_streams_gemini_error_code(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(chat_router, "_gemini_chat_client", GeminiChatClient(api_key=""))
    response = TestClient(app).post(
        "/internal/chat/stream", json={"messages": MESSAGES, "tools": [], "provider": "gemini"}
    )
    assert '"code": "GEMINI_NOT_CONFIGURED"' in response.text
