from unittest.mock import MagicMock

from fastapi.testclient import TestClient

import app.routers.listing as listing_router
from app.llm.errors import AiGenerationError
from app.main import app
from app.schemas.listing import GeneratedListing

client = TestClient(app)

REQUIRED_FIELDS = ["title_en", "title_ur", "description_en", "description_ur", "category", "tags"]

SAMPLE_RESULT = GeneratedListing(
    title_en="Sample Shoes",
    title_ur="نمونہ جوتے",
    description_en="Comfortable running shoes.",
    description_ur="آرام دہ دوڑنے والے جوتے۔",
    category="Fashion",
    tags=["shoes", "running", "sports", "comfortable", "lightweight"],
)


def test_generate_listing_returns_schema_conformant_result_on_success(monkeypatch) -> None:
    mock_orchestrator = MagicMock()
    mock_orchestrator.generate.return_value = SAMPLE_RESULT
    monkeypatch.setattr(listing_router, "_orchestrator", mock_orchestrator)

    response = client.post(
        "/generate-listing", json={"image_url": "http://example.com/x.jpg", "hint": "Shoes"}
    )

    assert response.status_code == 200
    body = response.json()
    for field in REQUIRED_FIELDS:
        assert field in body
    assert body["title_en"] == "Sample Shoes"
    mock_orchestrator.generate.assert_called_once_with("http://example.com/x.jpg", "Shoes")


def test_generate_listing_requires_image_url() -> None:
    response = client.post("/generate-listing", json={})
    assert response.status_code == 422


def test_generate_listing_returns_a_structured_502_when_every_provider_fails(monkeypatch) -> None:
    mock_orchestrator = MagicMock()
    mock_orchestrator.generate.side_effect = AiGenerationError("both failed")
    monkeypatch.setattr(listing_router, "_orchestrator", mock_orchestrator)

    response = client.post("/generate-listing", json={"image_url": "http://example.com/x.jpg"})

    assert response.status_code == 502
    assert response.json() == {"error": "GENERATION_FAILED"}


def test_a_failure_response_never_contains_partial_ai_fields(monkeypatch) -> None:
    mock_orchestrator = MagicMock()
    mock_orchestrator.generate.side_effect = AiGenerationError("both failed")
    monkeypatch.setattr(listing_router, "_orchestrator", mock_orchestrator)

    response = client.post("/generate-listing", json={"image_url": "http://example.com/x.jpg"})

    body = response.json()
    assert not any(field in body for field in REQUIRED_FIELDS)
