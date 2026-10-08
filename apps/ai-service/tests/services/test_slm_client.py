import asyncio
import json

import httpx
import pytest

from app.services.slm_client import (
    CORRECTIVE_PROMPT,
    EmbeddingClient,
    InvalidEnvelopeError,
    SLMClient,
)


def test_chat_parses_allowlisted_json_envelope_without_native_tools() -> None:
    requests: list[dict] = []

    def handle(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        requests.append(payload)
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"tool_call":{"type":"search_products","payload":{"query":"shirts"}}}'}}]},
        )

    async def run() -> dict:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as http:
            return await SLMClient(client=http, backoff_base_seconds=0).chat(
                [{"role": "user", "content": "Find shirts"}],
                [{"name": "search_products", "parameters": {"query": "string"}}],
            )

    result = asyncio.run(run())
    assert result == {"tool_call": {"type": "search_products", "payload": {"query": "shirts"}}}
    assert "tools" not in requests[0]
    assert "search_products" in requests[0]["messages"][0]["content"]


def test_chat_corrects_invalid_json_and_retries_at_most_three_total_attempts() -> None:
    requests: list[dict] = []
    replies = ["not json", "{bad", '{"reply":"ready"}']

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(json.loads(request.content))
        return httpx.Response(200, json={"choices": [{"message": {"content": replies.pop(0)}}]})

    async def run() -> dict:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as http:
            return await SLMClient(max_attempts=9, client=http, backoff_base_seconds=0).chat(
                [{"role": "user", "content": "hello"}]
            )

    assert asyncio.run(run()) == {"reply": "ready"}
    assert len(requests) == 3
    assert requests[1]["messages"][-2]["content"] == "not json"
    assert requests[1]["messages"][-1]["content"] == CORRECTIVE_PROMPT


def test_chat_fails_closed_after_three_invalid_attempts() -> None:
    calls = 0

    def handle(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"tool_call":{"type":"unknown","payload":{}}}'}}]})

    async def run() -> None:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as http:
            await SLMClient(max_attempts=3, client=http, backoff_base_seconds=0).chat(
                [{"role": "user", "content": "do something"}],
                [{"name": "search_products", "parameters": {}}],
            )

    with pytest.raises(InvalidEnvelopeError):
        asyncio.run(run())
    assert calls == 3


def test_embedding_client_retries_then_returns_768_dimension_vector() -> None:
    calls = 0
    vector = [0.125] * 768

    def handle(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(503)
        return httpx.Response(200, json={"embedding": vector})

    async def run() -> list[list[float]]:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as http:
            return await EmbeddingClient(client=http, backoff_base_seconds=0).embed(["cotton shirt"])

    result = asyncio.run(run())
    assert calls == 2
    assert result == [vector]
