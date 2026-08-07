import json
from unittest.mock import patch

import httpx
import pytest

from app.llm.errors import LlmClientError
from app.llm.gemini_client import GeminiVisionClient

VALID_LISTING = {
    "title_en": "Wireless Speaker",
    "title_ur": "وائرلیس اسپیکر",
    "description_en": "A great wireless speaker with long battery life and loud sound.",
    "description_ur": "ایک بہترین وائرلیس اسپیکر۔",
    "category": "Electronics",
    "tags": ["speaker", "wireless", "bluetooth", "audio", "portable"],
}


def _gemini_success_response() -> httpx.Response:
    return httpx.Response(
        200,
        json={"candidates": [{"content": {"parts": [{"text": json.dumps(VALID_LISTING)}]}}]},
        request=httpx.Request("POST", "https://example.com"),
    )


def _image_response() -> httpx.Response:
    return httpx.Response(
        200,
        content=b"\xff\xd8\xff fake jpeg bytes",
        headers={"content-type": "image/jpeg"},
        request=httpx.Request("GET", "https://example.com/x.jpg"),
    )


@patch("app.llm.gemini_client.time.sleep")  # never actually wait in tests
class TestGeminiVisionClient:
    def test_successful_generation_parses_and_validates_the_response(self, mock_sleep) -> None:
        client = GeminiVisionClient(model="gemini-1.5-flash", api_key="test-key")
        with (
            patch("app.llm.gemini_client.httpx.get", return_value=_image_response()),
            patch("app.llm.gemini_client.httpx.post", return_value=_gemini_success_response()),
        ):
            result = client.generate("https://cdn.example/x.jpg", hint="Speaker")

        assert result.title_en == "Wireless Speaker"
        assert result.tags == VALID_LISTING["tags"]

    def test_the_model_name_is_never_hardcoded_it_comes_from_the_constructor(
        self, mock_sleep
    ) -> None:
        client = GeminiVisionClient(model="some-custom-model-name", api_key="test-key")
        with (
            patch("app.llm.gemini_client.httpx.get", return_value=_image_response()),
            patch(
                "app.llm.gemini_client.httpx.post", return_value=_gemini_success_response()
            ) as mock_post,
        ):
            client.generate("https://cdn.example/x.jpg")

        called_url = mock_post.call_args.args[0]
        assert "some-custom-model-name" in called_url

    def test_malformed_json_from_gemini_is_retried_then_succeeds_on_the_second_attempt(
        self, mock_sleep
    ) -> None:
        bad_response = httpx.Response(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "not valid json"}]}}]},
            request=httpx.Request("POST", "https://example.com"),
        )
        client = GeminiVisionClient(model="gemini-1.5-flash", api_key="test-key", max_retries=1)
        with (
            patch("app.llm.gemini_client.httpx.get", return_value=_image_response()),
            patch(
                "app.llm.gemini_client.httpx.post",
                side_effect=[bad_response, _gemini_success_response()],
            ),
        ):
            result = client.generate("https://cdn.example/x.jpg")

        assert result.title_en == "Wireless Speaker"
        mock_sleep.assert_called_once()  # backoff happened between the two attempts

    def test_a_response_missing_a_required_field_fails_pydantic_validation_and_is_retried(
        self, mock_sleep
    ) -> None:
        incomplete = {k: v for k, v in VALID_LISTING.items() if k != "title_ur"}
        bad_response = httpx.Response(
            200,
            json={"candidates": [{"content": {"parts": [{"text": json.dumps(incomplete)}]}}]},
            request=httpx.Request("POST", "https://example.com"),
        )
        client = GeminiVisionClient(model="gemini-1.5-flash", api_key="test-key", max_retries=1)
        with (
            patch("app.llm.gemini_client.httpx.get", return_value=_image_response()),
            patch("app.llm.gemini_client.httpx.post", return_value=bad_response),
        ):
            with pytest.raises(LlmClientError):
                client.generate("https://cdn.example/x.jpg")

    def test_exhausting_all_retries_raises_llm_client_error_with_the_model_name_in_the_message(
        self, mock_sleep
    ) -> None:
        client = GeminiVisionClient(model="gemini-1.5-flash", api_key="test-key", max_retries=2)
        with (
            patch("app.llm.gemini_client.httpx.get", return_value=_image_response()),
            patch(
                "app.llm.gemini_client.httpx.post",
                side_effect=httpx.ConnectError("connection refused"),
            ) as mock_post,
        ):
            with pytest.raises(LlmClientError, match="gemini-1.5-flash"):
                client.generate("https://cdn.example/x.jpg")

        assert mock_post.call_count == 3  # max_retries=2 -> 3 total attempts
        assert (
            mock_sleep.call_count == 2
        )  # backoff between attempts 1->2 and 2->3, none after the last

    def test_a_non_2xx_response_is_treated_as_a_failure_and_retried(self, mock_sleep) -> None:
        error_response = httpx.Response(
            500, text="internal error", request=httpx.Request("POST", "https://example.com")
        )
        client = GeminiVisionClient(model="gemini-1.5-flash", api_key="test-key", max_retries=1)
        with (
            patch("app.llm.gemini_client.httpx.get", return_value=_image_response()),
            patch("app.llm.gemini_client.httpx.post", return_value=error_response),
        ):
            with pytest.raises(LlmClientError):
                client.generate("https://cdn.example/x.jpg")

    def test_backoff_delay_doubles_between_attempts(self, mock_sleep) -> None:
        client = GeminiVisionClient(
            model="gemini-1.5-flash", api_key="test-key", max_retries=2, backoff_base_seconds=1.0
        )
        with (
            patch("app.llm.gemini_client.httpx.get", return_value=_image_response()),
            patch("app.llm.gemini_client.httpx.post", side_effect=httpx.ConnectError("down")),
        ):
            with pytest.raises(LlmClientError):
                client.generate("https://cdn.example/x.jpg")

        delays = [call.args[0] for call in mock_sleep.call_args_list]
        assert delays == [1.0, 2.0]
