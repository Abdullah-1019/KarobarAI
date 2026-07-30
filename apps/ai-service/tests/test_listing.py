from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

REQUIRED_FIELDS = ["title_en", "title_ur", "description_en", "description_ur", "category", "tags"]


def test_generate_listing_returns_schema_conformant_mock() -> None:
    response = client.post("/generate-listing", json={"image_url": "http://example.com/x.jpg"})

    assert response.status_code == 200
    body = response.json()
    for field in REQUIRED_FIELDS:
        assert field in body
    assert isinstance(body["tags"], list)


def test_generate_listing_uses_hint_in_title() -> None:
    response = client.post(
        "/generate-listing", json={"image_url": "http://example.com/x.jpg", "hint": "Shoes"}
    )

    assert response.status_code == 200
    assert "Shoes" in response.json()["title_en"]


def test_generate_listing_requires_image_url() -> None:
    response = client.post("/generate-listing", json={})

    assert response.status_code == 422
