import pytest

from app.llm.client import LlmClient


def test_llm_client_cannot_be_instantiated_directly() -> None:
    with pytest.raises(TypeError):
        LlmClient()  # type: ignore[abstract]


def test_a_concrete_subclass_missing_generate_still_cannot_be_instantiated() -> None:
    class Incomplete(LlmClient):
        pass

    with pytest.raises(TypeError):
        Incomplete()  # type: ignore[abstract]
