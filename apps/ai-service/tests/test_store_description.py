import json

import httpx
import pytest

from app.routers.store_description import (
    DescriptionError,
    GeminiStoreDescriptionClient,
    StoreFacts,
)

FACTS = StoreFacts(name="Cloth Corner", categoryEn="Clothing", categoryUr="کپڑے", city="Lahore")
SUGGESTION = {
    "descriptionEn": "Cloth Corner is a clothing store in Lahore. Explore its available products.",
    "descriptionUr": "کلاتھ کارنر لاہور میں کپڑوں کا اسٹور ہے۔ یہاں دستیاب مصنوعات دیکھیں۔",
}


def _response(value=SUGGESTION, *, finish_reason="STOP"):
    return httpx.Response(
        200,
        json={
            "candidates": [
                {"finishReason": finish_reason, "content": {"parts": [{"text": json.dumps(value)}]}}
            ]
        },
    )


def _client(handler, key="test-key"):
    return GeminiStoreDescriptionClient(
        client=httpx.Client(transport=httpx.MockTransport(handler)),
        api_key=key,
        model="gemini-3.1-flash-lite",
    )


def test_uses_existing_gemini_configuration_and_structured_text_request():
    def handler(request):
        assert request.url.host == "generativelanguage.googleapis.com"
        assert request.headers["x-goog-api-key"] == "test-key"
        payload = json.loads(request.content)
        assert payload["generationConfig"]["responseMimeType"] == "application/json"
        assert set(payload["generationConfig"]["responseSchema"]["required"]) == set(SUGGESTION)
        assert payload["contents"][0]["parts"][0]["text"].find("Cloth Corner") >= 0
        assert "inline_data" not in payload["contents"][0]["parts"][0]
        return _response()

    result = _client(handler).generate(FACTS)
    assert result.descriptionEn == SUGGESTION["descriptionEn"]
    assert result.descriptionUr == SUGGESTION["descriptionUr"]


@pytest.mark.parametrize(
    "response",
    [
        _response({"descriptionEn": "English only"}),
        _response({**SUGGESTION, "descriptionUr": "Only Latin script here."}),
        _response(finish_reason="MAX_TOKENS"),
        httpx.Response(200, json={"candidates": []}),
    ],
)
def test_invalid_output_is_rejected(response):
    with pytest.raises(DescriptionError, match="invalid_output"):
        _client(lambda _request: response).generate(FACTS)


def test_missing_key_never_calls_provider():
    with pytest.raises(DescriptionError, match="configuration_unavailable"):
        _client(lambda _request: pytest.fail("unexpected request"), key="").generate(FACTS)


@pytest.mark.parametrize("status,reason", [(429, "rate_limited"), (403, "provider_unavailable")])
def test_rate_limit_and_provider_error_fail_safely(status, reason):
    with pytest.raises(DescriptionError, match=reason):
        _client(lambda _request: httpx.Response(status)).generate(FACTS)


def test_timeout_is_bounded_and_safe(monkeypatch):
    monkeypatch.setattr("app.routers.store_description.time.sleep", lambda _seconds: None)
    calls = []

    def handler(_request):
        calls.append(1)
        raise httpx.ReadTimeout("synthetic timeout")

    with pytest.raises(DescriptionError, match="provider_unavailable"):
        _client(handler).generate(FACTS)
    assert len(calls) == 2
