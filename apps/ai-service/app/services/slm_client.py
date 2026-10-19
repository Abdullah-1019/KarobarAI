"""Async Ollama clients used by the shared agent and retrieval infrastructure.

Tool calls deliberately use a JSON envelope in message content. The selected Qwen model is
not sent Ollama's native ``tools`` parameter, because native tool calling is not reliable in
this deployment. Invalid envelopes are corrected at most twice, then rejected closed.
"""

import asyncio
import json
import math
import re
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.config import settings

CORRECTIVE_PROMPT = (
    "Your last response wasn't valid JSON. Respond only with the required JSON envelope."
)
SAFE_FAILURE_REPLY = "I couldn't safely process that request. Please rephrase it."
INVENTORY_GROUNDING_INSTRUCTION = (
    "Ground product availability and inventory claims only in supplied product facts "
    "or tool results. "
    "Treat an explicit stock count as the maximum available quantity and compare it "
    "numerically with the quantity requested by the user. If the requested quantity "
    "exceeds stock, clearly say that "
    "the requested amount is unavailable and state no larger quantity than the confirmed stock. "
    "Never say the requested amount is available or confirm adding it. "
    "If stock is missing or unclear, "
    "do not affirm availability."
)


class OllamaClientError(RuntimeError):
    """Ollama request failed or returned an invalid response after bounded retries."""


class InvalidEnvelopeError(OllamaClientError):
    """The model failed to produce a valid allowlisted JSON envelope."""


class SLMClient:
    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        *,
        timeout_seconds: float | None = None,
        max_attempts: int | None = None,
        backoff_base_seconds: float | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self.model = model or settings.ollama_chat_model
        self.timeout_seconds = timeout_seconds or settings.ollama_timeout_seconds
        self.max_attempts = max(1, min(max_attempts or settings.ollama_max_attempts, 3))
        self.backoff_base_seconds = (
            settings.ollama_backoff_base_seconds
            if backoff_base_seconds is None
            else backoff_base_seconds
        )
        self._client = client

    async def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        response_format: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        allowed_tools = _allowed_tool_names(tools)
        prompt_messages = _envelope_messages(messages, tools, response_format)
        last_failure = "invalid JSON"
        last_raw = ""

        for attempt in range(self.max_attempts):
            try:
                response = await self._post(
                    "/v1/chat/completions",
                    {
                        "model": self.model,
                        "messages": prompt_messages,
                        "temperature": 0,
                        "max_tokens": 512,
                    },
                )
                raw = response["choices"][0]["message"]["content"]
                last_raw = raw if isinstance(raw, str) else str(raw)
                envelope, last_failure = _parse_envelope(raw, allowed_tools)
                if envelope is not None:
                    return envelope
            except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as error:
                last_failure = str(error)
                if attempt + 1 == self.max_attempts:
                    raise OllamaClientError("Ollama chat request failed") from error

            if attempt + 1 < self.max_attempts:
                prompt_messages = [
                    *prompt_messages,
                    {"role": "assistant", "content": last_raw},
                    {"role": "user", "content": CORRECTIVE_PROMPT},
                ]
                await asyncio.sleep(self.backoff_base_seconds * (2**attempt))

        raise InvalidEnvelopeError(
            f"Invalid Ollama JSON envelope after {self.max_attempts} attempts: {last_failure}"
        )

    async def stream_chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        response_format: dict[str, Any] | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream Ollama's actual generation. Tool-call JSON is never emitted as reply text."""
        prompt_messages = _envelope_messages(messages, tools, response_format)
        allowed = _allowed_tool_names(tools)
        raw = ""
        exposed = ""
        timeout = httpx.Timeout(self.timeout_seconds, connect=min(10.0, self.timeout_seconds))
        try:
            if self._client is not None:
                client = self._client
                owns_client = False
            else:
                client = httpx.AsyncClient(timeout=timeout)
                owns_client = True
            try:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.model,
                        "messages": prompt_messages,
                        "stream": True,
                        "options": {"temperature": 0, "num_predict": 512},
                    },
                    timeout=timeout,
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        chunk = json.loads(line)
                        if not isinstance(chunk, dict):
                            raise ValueError("Invalid Ollama stream chunk")
                        fragment = chunk.get("message", {}).get("content", "")
                        if not isinstance(fragment, str):
                            raise ValueError("Invalid Ollama stream content")
                        raw += fragment
                        reply_prefix = _completed_reply_prefix(raw)
                        if reply_prefix is not None and len(reply_prefix) > len(exposed):
                            delta = reply_prefix[len(exposed) :]
                            exposed = reply_prefix
                            yield {"type": "delta", "text": delta}
                        if chunk.get("done") is True:
                            break
            finally:
                if owns_client:
                    await client.aclose()
        except (httpx.HTTPError, json.JSONDecodeError, ValueError, TypeError) as error:
            raise OllamaClientError("Ollama stream failed") from error

        envelope, _ = _parse_envelope(raw, allowed)
        if envelope is None:
            # The original bounded corrective path remains the safe fallback.
            envelope = await self.chat(messages, tools, response_format)
        yield {"type": "final", "envelope": envelope}

    async def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        if self._client is not None:
            response = await self._client.post(
                f"{self.base_url}{path}", json=payload, timeout=self.timeout_seconds
            )
        else:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(f"{self.base_url}{path}", json=payload)
        response.raise_for_status()
        value = response.json()
        if not isinstance(value, dict):
            raise ValueError("Ollama returned a non-object JSON response")
        return value


class EmbeddingClient:
    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        *,
        timeout_seconds: float | None = None,
        max_attempts: int | None = None,
        backoff_base_seconds: float | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self.model = model or settings.ollama_embed_model
        self.timeout_seconds = timeout_seconds or settings.ollama_timeout_seconds
        self.max_attempts = max(1, min(max_attempts or settings.ollama_max_attempts, 3))
        self.backoff_base_seconds = (
            settings.ollama_backoff_base_seconds
            if backoff_base_seconds is None
            else backoff_base_seconds
        )
        self._client = client

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        vectors: list[list[float]] = []
        for text in texts:
            last_error: Exception | None = None
            for attempt in range(self.max_attempts):
                try:
                    response = await self._post({"model": self.model, "prompt": text})
                    vector = response.get("embedding")
                    if (
                        not isinstance(vector, list)
                        or len(vector) != 768
                        or not all(
                            isinstance(value, (int, float)) and math.isfinite(value)
                            for value in vector
                        )
                        or not any(value != 0 for value in vector)
                    ):
                        raise ValueError("Ollama returned an invalid 768-dimensional embedding")
                    vectors.append([float(value) for value in vector])
                    break
                except (httpx.HTTPError, ValueError, TypeError) as error:
                    last_error = error
                    if attempt + 1 < self.max_attempts:
                        await asyncio.sleep(self.backoff_base_seconds * (2**attempt))
            else:
                raise OllamaClientError("Ollama embedding request failed") from last_error
        return vectors

    async def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        if self._client is not None:
            response = await self._client.post(
                f"{self.base_url}/api/embeddings", json=payload, timeout=self.timeout_seconds
            )
        else:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(f"{self.base_url}/api/embeddings", json=payload)
        response.raise_for_status()
        value = response.json()
        if not isinstance(value, dict):
            raise ValueError("Ollama returned a non-object embedding response")
        return value


def fail_closed_response() -> dict[str, str]:
    """Safe conversational fallback for callers; it never contains a tool call."""
    return {"reply": SAFE_FAILURE_REPLY}


def _allowed_tool_names(tools: list[dict[str, Any]] | None) -> set[str]:
    names: set[str] = set()
    for tool in tools or []:
        if isinstance(tool.get("function"), dict):
            name = tool["function"].get("name")
        else:
            name = tool.get("name")
        if isinstance(name, str):
            names.add(name)
    return names


def _completed_reply_prefix(raw: str) -> str | None:
    """Decode only complete characters inside a leading reply JSON string."""
    match = re.match(r'^\s*\{\s*"reply"\s*:\s*"', raw)
    if match is None:
        return None
    encoded = ""
    index = match.end()
    while index < len(raw):
        char = raw[index]
        if char == '"':
            break
        if char == "\\":
            if index + 1 >= len(raw):
                break
            escape = raw[index + 1]
            if escape == "u":
                if index + 6 > len(raw):
                    break
                encoded += raw[index : index + 6]
                index += 6
                continue
            encoded += raw[index : index + 2]
            index += 2
            continue
        encoded += char
        index += 1
    try:
        return json.loads('"' + encoded + '"')
    except json.JSONDecodeError:
        return None


def _envelope_messages(
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None,
    response_format: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    result = [dict(message) for message in messages]
    mode = (
        'Use exactly {"tool_call":{"type":"NAME","payload":{...}}} for a tool, '
        'or exactly {"reply":"..."} for a user-facing answer.'
        if tools
        else 'Use exactly {"reply":"..."} for your response.'
    )
    rules = [
        "Return exactly one JSON object, without markdown or surrounding text.",
        mode,
        "Do not include keys outside the selected envelope.",
        INVENTORY_GROUNDING_INSTRUCTION,
    ]
    if tools:
        rules.append("Allowed tool definitions: " + json.dumps(tools, ensure_ascii=False))
    if response_format:
        rules.append("Response constraints: " + json.dumps(response_format, ensure_ascii=False))
    instruction = "\n".join(rules)
    if result and result[0].get("role") == "system":
        result[0]["content"] = f"{result[0].get('content', '')}\n\n{instruction}"
    else:
        result.insert(0, {"role": "system", "content": instruction})
    return result


def _parse_envelope(raw: Any, allowed_tools: set[str]) -> tuple[dict[str, Any] | None, str]:
    if not isinstance(raw, str):
        return None, "assistant content is not text"
    try:
        value = json.loads(raw)
    except (json.JSONDecodeError, TypeError) as error:
        return None, f"invalid JSON: {error}"
    if not isinstance(value, dict):
        return None, "top-level JSON value is not an object"
    if set(value) == {"reply"} and isinstance(value["reply"], str):
        return value, ""
    if set(value) != {"tool_call"} or not isinstance(value["tool_call"], dict):
        return None, "expected exactly a reply or tool_call envelope"
    call = value["tool_call"]
    if (
        set(call) != {"type", "payload"}
        or not isinstance(call["type"], str)
        or not isinstance(call["payload"], dict)
    ):
        return None, "malformed tool_call envelope"
    if call["type"] not in allowed_tools:
        return None, "tool type is not in the supplied allowlist"
    return value, ""
