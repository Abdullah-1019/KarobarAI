"""Task 1 smoke check: run inside ai-service after Ollama finishes pulling models."""

import json
import math
import os
import subprocess
import time


def post(path: str, payload: dict) -> dict:
    base_url = os.environ.get("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/")
    started = time.monotonic()
    result = subprocess.run(
        [
            "curl",
            "--fail-with-body",
            "--silent",
            "--show-error",
            "--max-time",
            "600",
            "--header",
            "Content-Type: application/json",
            "--data-binary",
            json.dumps(payload),
            f"{base_url}{path}",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    print(f"{path}: HTTP success in {time.monotonic() - started:.2f}s")
    return json.loads(result.stdout)


def main() -> None:
    chat_model = os.environ.get("OLLAMA_CHAT_MODEL", "qwen2.5vl:7b")
    embed_model = os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text")
    completion = post(
        "/v1/chat/completions",
        {
            "model": chat_model,
            "messages": [{"role": "user", "content": "Reply with the word ready."}],
            "max_tokens": 16,
            "temperature": 0,
        },
    )
    content = completion["choices"][0]["message"]["content"]
    if not isinstance(content, str) or not content.strip():
        raise ValueError("Ollama returned an empty or invalid completion")
    print(f"Completion valid ({chat_model}): {content.strip()}")

    response = post(
        "/api/embeddings",
        {"model": embed_model, "prompt": "Cotton fabric, new condition, available in stock."},
    )
    vector = response["embedding"]
    if (
        not isinstance(vector, list)
        or len(vector) != 768
        or not all(isinstance(value, (int, float)) and math.isfinite(value) for value in vector)
        or not any(value != 0 for value in vector)
    ):
        raise ValueError("Expected a finite, non-zero 768-dimensional embedding")
    print(f"Embedding valid ({embed_model}): {len(vector)} dimensions")


if __name__ == "__main__":
    main()
