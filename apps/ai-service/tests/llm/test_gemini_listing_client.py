import json

import httpx
import pytest

from app.llm.gemini_listing_client import GeminiListingClient, GeminiListingError

IMAGE_URL = "http://minio:9000/bucket/product.jpg"
IMAGE = b"\xff\xd8\xffsynthetic-image"
LISTING = {
    "title_en": "Blue Shirt",
    "title_ur": "نیلی قمیض",
    "description_en": "A blue shirt is shown.",
    "description_ur": "تصویر میں نیلی قمیض ہے۔",
    "category": "Clothing",
    "tags": ["shirt", "blue"],
}


def _gemini_response(listing=LISTING, *, finish_reason="STOP") -> httpx.Response:
    return httpx.Response(
        200,
        json={"candidates": [{"finishReason": finish_reason, "content": {"parts": [{"text": json.dumps(listing)}]}}]},
    )


def _client(handler, **kwargs) -> GeminiListingClient:
    return GeminiListingClient(
        api_key=kwargs.pop("api_key", "test-key"),
        model="gemini-3.1-flash-lite",
        allowed_image_hosts="minio",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
        **kwargs,
    )


def test_valid_image_request_is_private_structured_and_schema_checked() -> None:
    calls = []

    def handler(request):
        calls.append(request)
        if request.method == "GET":
            return httpx.Response(200, headers={"content-type": "image/jpeg"}, content=IMAGE)
        assert request.url.host == "generativelanguage.googleapis.com"
        assert request.headers["x-goog-api-key"] == "test-key"
        body = json.loads(request.content)
        assert body["contents"][0]["parts"][1]["inline_data"]["mime_type"] == "image/jpeg"
        assert body["generationConfig"]["responseMimeType"] == "application/json"
        assert set(body["generationConfig"]["responseSchema"]["required"]) == set(LISTING)
        assert "synthetic-image" not in body["contents"][0]["parts"][0]["text"]
        return _gemini_response()

    result = _client(handler).generate(IMAGE_URL)
    assert result.title_en == "Blue Shirt"
    assert len(calls) == 2


@pytest.mark.parametrize("body", [{}, {**LISTING, "title_en": ""}, {"title_en": "Only title"}])
def test_invalid_listing_fails_closed(body) -> None:
    def handler(request):
        return httpx.Response(200, content=IMAGE) if request.method == "GET" else _gemini_response(body)

    with pytest.raises(GeminiListingError, match="invalid_output"):
        _client(handler).generate(IMAGE_URL)


def test_malformed_json_and_empty_provider_response_fail_closed() -> None:
    for provider_response in (
        httpx.Response(200, json={"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": "not-json"}]}}]}),
        httpx.Response(200, json={"candidates": []}),
        _gemini_response(finish_reason="MAX_TOKENS"),
    ):
        def handler(request):
            return httpx.Response(200, content=IMAGE) if request.method == "GET" else provider_response

        with pytest.raises(GeminiListingError, match="invalid_output"):
            _client(handler).generate(IMAGE_URL)


@pytest.mark.parametrize("image,header", [(b"not-image", "image/jpeg"), (IMAGE, "image/png"), (IMAGE, "text/html")])
def test_invalid_image_type_is_not_sent_to_provider(image, header) -> None:
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, headers={"content-type": header}, content=image)

    with pytest.raises(GeminiListingError, match="image_unavailable"):
        _client(handler).generate(IMAGE_URL)
    assert len(calls) == 1


def test_unapproved_image_host_and_missing_key_make_no_request() -> None:
    def fail(_request):
        pytest.fail("No network request is allowed")

    with pytest.raises(GeminiListingError, match="configuration_unavailable"):
        _client(fail, api_key="").generate(IMAGE_URL)
    with pytest.raises(GeminiListingError, match="configuration_unavailable"):
        _client(fail, api_key="replace-with-gemini-api-key").generate(IMAGE_URL)
    with pytest.raises(GeminiListingError, match="image_unavailable"):
        _client(fail).generate("http://127.0.0.1/private")


def test_image_redirect_and_oversize_payload_never_reach_provider() -> None:
    for image_response in (
        httpx.Response(302, headers={"location": "http://untrusted.example/private"}),
        httpx.Response(200, headers={"content-type": "image/jpeg"}, content=IMAGE + b"x" * (10 * 1024 * 1024)),
    ):
        calls = []

        def handler(request):
            calls.append(request)
            return image_response

        with pytest.raises(GeminiListingError, match="image_unavailable"):
            _client(handler).generate(IMAGE_URL)
        assert len(calls) == 1


@pytest.mark.parametrize("status,reason", [(429, "rate_limited"), (403, "provider_unavailable")])
def test_rate_limit_and_auth_error_do_not_retry(status, reason) -> None:
    calls = []

    def handler(request):
        if request.method == "GET":
            return httpx.Response(200, content=IMAGE)
        calls.append(request)
        return httpx.Response(status)

    with pytest.raises(GeminiListingError, match=reason):
        _client(handler).generate(IMAGE_URL)
    assert len(calls) == 1


@pytest.mark.parametrize("failure", ["timeout", "server_error"])
def test_transient_provider_failure_has_at_most_one_retry(failure, monkeypatch) -> None:
    monkeypatch.setattr("app.llm.gemini_listing_client.time.sleep", lambda _: None)
    calls = []

    def handler(request):
        if request.method == "GET":
            return httpx.Response(200, content=IMAGE)
        calls.append(request)
        if failure == "timeout":
            raise httpx.ReadTimeout("timeout")
        return httpx.Response(503)

    with pytest.raises(GeminiListingError, match="provider_unavailable"):
        _client(handler).generate(IMAGE_URL)
    assert len(calls) == 2
