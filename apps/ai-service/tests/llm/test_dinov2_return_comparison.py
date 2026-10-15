import base64
from io import BytesIO
from types import SimpleNamespace

import pytest
from PIL import Image

from app.llm import dinov2_return_comparison as comparison
from app.schemas.return_inspection import CompareReturnRequest, EvidenceImage


def image_payload(color=(180, 50, 30), size=(224, 224)):
    image = Image.new("RGB", size)
    for x in range(size[0]):
        for y in range(size[1]):
            image.putpixel((x, y), ((color[0] + x) % 256, (color[1] + y) % 256, color[2]))
    stream = BytesIO()
    image.save(stream, format="PNG")
    return EvidenceImage(mime_type="image/png", data=base64.b64encode(stream.getvalue()).decode())


def test_image_decoding_checks_mime_dimensions_and_content():
    decoded = comparison.decode_image(image_payload())
    assert decoded.size == (224, 224)
    assert decoded.mode == "RGB"
    with pytest.raises(comparison.EvidenceError, match="INVALID_IMAGE"):
        comparison.decode_image(EvidenceImage(mime_type="image/jpeg", data=image_payload().data))
    with pytest.raises(comparison.EvidenceError, match="LOW_QUALITY_EVIDENCE"):
        comparison.decode_image(image_payload(size=(64, 64)))
    with pytest.raises(comparison.EvidenceError, match="INVALID_IMAGE"):
        comparison.decode_image(EvidenceImage(mime_type="image/png", data="not-base64"))


@pytest.mark.parametrize(
    ("scores", "status", "sufficient"),
    [
        ([0.95], "LIKELY_MATCH", True),
        ([0.45], "POSSIBLE_MISMATCH", True),
        ([0.80], "POSSIBLE_MISMATCH", True),
        ([0.95, 0.40], "INSUFFICIENT_VISUAL_EVIDENCE", False),
    ],
)
def test_provisional_thresholds_and_conflicting_views(scores, status, sufficient):
    result = comparison.classify_scores(scores)
    assert result[0] == status
    assert result[2] is sufficient


def test_invalid_similarity_rejected():
    with pytest.raises(ValueError):
        comparison.classify_scores([float("nan")])


def test_model_loads_once_and_inference_uses_cls_embedding(monkeypatch):
    torch = pytest.importorskip("torch")
    reference = image_payload()
    returned = image_payload((60, 100, 70))
    request = CompareReturnRequest(reference_images=[reference], return_images=[returned])
    calls = []

    def fake_embeddings(images):
        calls.append(len(images))
        return torch.tensor([[1.0, 0.0], [1.0, 0.0]])

    monkeypatch.setattr(comparison, "embeddings", fake_embeddings)
    result = comparison.compare_images(request)
    assert calls == [2]
    assert result.status == "LIKELY_MATCH"
    assert result.similarity_score == 1.0
    assert result.evidence_sufficient is True
    assert result.pairs[0].index == 1
    assert result.pairs[0].similarity_score == 1.0


def test_pairs_use_corresponding_listing_image_not_best_other_view(monkeypatch):
    torch = pytest.importorskip("torch")
    reference = image_payload()
    request = CompareReturnRequest(
        reference_images=[reference, reference], return_images=[reference, reference]
    )
    monkeypatch.setattr(
        comparison,
        "embeddings",
        lambda images: torch.tensor(
            [
                [1.0, 0.0],
                [0.0, 1.0],
                [0.0, 1.0],
                [1.0, 0.0],
            ]
        ),
    )
    result = comparison.compare_images(request)
    assert [pair.similarity_score for pair in result.pairs] == [0.0, 0.0]
    assert result.status == "POSSIBLE_MISMATCH"


def test_mismatched_photo_count_is_invalid():
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        CompareReturnRequest(
            reference_images=[image_payload()], return_images=[image_payload(), image_payload()]
        )


def test_official_processor_receives_rgb_and_cls_embedding_is_normalized(monkeypatch):
    torch = pytest.importorskip("torch")
    calls = []

    def processor(*, images, return_tensors):
        calls.append((images[0].mode, return_tensors))
        return {"pixel_values": torch.ones((1, 3, 224, 224))}

    class Model:
        def __call__(self, *, pixel_values):
            assert pixel_values.shape == (1, 3, 224, 224)
            return SimpleNamespace(last_hidden_state=torch.tensor([[[3.0, 4.0], [0.0, 0.0]]]))

    monkeypatch.setattr(comparison, "load_model", lambda: (processor, Model()))
    vector = comparison.embeddings([comparison.decode_image(image_payload())])
    assert calls == [("RGB", "pt")]
    assert vector.tolist()[0] == pytest.approx([0.6, 0.8])


def test_model_unavailable_reports_not_ready(monkeypatch):
    def unavailable():
        raise OSError("cache unavailable")

    monkeypatch.setattr(comparison, "load_model", unavailable)
    assert comparison.model_ready() is False


def test_checkpoint_is_initialized_only_once(monkeypatch):
    calls = []
    marker = (object(), object())
    monkeypatch.setattr(comparison, "_loaded_model", None)
    monkeypatch.setattr(comparison, "_load_checkpoint", lambda: calls.append(1) or marker)
    assert comparison.load_model() is marker
    assert comparison.load_model() is marker
    assert calls == [1]
