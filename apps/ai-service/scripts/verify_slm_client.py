"""Live smoke check for Feature 16's envelope client and embedding client."""

from fastapi.testclient import TestClient

from app.main import app


def main() -> None:
    with TestClient(app) as client:
        chat_response = client.post(
            "/internal/chat",
            json={
                "messages": [
                    {"role": "system", "content": "You are a marketplace assistant. Use the catalog search tool when asked to find products."},
                    {"role": "user", "content": "Find blue cotton shirts."},
                ],
                "tools": [{"name": "search_products", "description": "Search the live catalog", "parameters": {"query": "string"}}],
            },
        )
        chat_response.raise_for_status()
        chat = chat_response.json()
        if chat.get("tool_call", {}).get("type") != "search_products":
            raise ValueError(f"Expected a search_products envelope, got {chat!r}")

        embedding_response = client.post("/internal/embeddings", json={"texts": ["blue cotton shirt"]})
        embedding_response.raise_for_status()
        vectors = embedding_response.json()["embeddings"]
        print(f"SLM envelope valid: {chat!r}")
        print(f"Embedding valid: {len(vectors)} vector(s), {len(vectors[0])} dimensions")


if __name__ == "__main__":
    main()
