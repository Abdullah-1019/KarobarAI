import asyncio
import json

import httpx

from app.services.slm_client import SLMClient


def _line(fragment: str, done: bool = False) -> str:
    return json.dumps({"message": {"content": fragment}, "done": done}) + "\n"


def test_native_ollama_stream_emits_incremental_reply_and_final_envelope() -> None:
    requests = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append((request.url.path, json.loads(request.content)))
        return httpx.Response(
            200, text=_line('{"reply":"Hel') + _line("lo", False) + _line('!"}', True)
        )

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as http:
            return [
                item
                async for item in SLMClient(client=http).stream_chat(
                    [{"role": "user", "content": "Hi"}]
                )
            ]

    events = asyncio.run(run())
    assert events == [
        {"type": "delta", "text": "Hel"},
        {"type": "delta", "text": "lo"},
        {"type": "delta", "text": "!"},
        {"type": "final", "envelope": {"reply": "Hello!"}},
    ]
    assert requests[0][0] == "/api/chat"
    assert requests[0][1]["stream"] is True


def test_tool_call_is_never_exposed_as_reply_delta() -> None:
    raw = '{"tool_call":{"type":"search_products","payload":{"query":"shirt"}}}'

    def handle(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            text="".join(
                _line(raw[i : i + 10], i + 10 >= len(raw)) for i in range(0, len(raw), 10)
            ),
        )

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as http:
            return [
                item
                async for item in SLMClient(client=http).stream_chat(
                    [{"role": "user", "content": "Find a shirt"}],
                    [{"name": "search_products", "parameters": {}}],
                )
            ]

    assert asyncio.run(run()) == [
        {
            "type": "final",
            "envelope": {"tool_call": {"type": "search_products", "payload": {"query": "shirt"}}},
        }
    ]


def test_invalid_stream_uses_bounded_nonstream_fallback() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/chat":
            return httpx.Response(200, text=_line("not valid JSON", True))
        return httpx.Response(
            200, json={"choices": [{"message": {"content": '{"reply":"Safe answer"}'}}]}
        )

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as http:
            return [
                item
                async for item in SLMClient(client=http).stream_chat(
                    [{"role": "user", "content": "Hi"}]
                )
            ]

    assert asyncio.run(run()) == [{"type": "final", "envelope": {"reply": "Safe answer"}}]
