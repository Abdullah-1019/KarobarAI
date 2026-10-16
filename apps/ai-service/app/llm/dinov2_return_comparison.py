"""Advisory visual similarity, not defect detection or product authentication."""

import base64
import binascii
import statistics
from datetime import datetime, timezone
from io import BytesIO
from threading import Lock

from PIL import Image, ImageOps, ImageStat, UnidentifiedImageError

from app.config import settings
from app.schemas.return_inspection import (
    CompareReturnRequest,
    ComparisonResponse,
    EvidenceImage,
    PairResult,
)

MAX_IMAGE_BYTES = 8 * 1024 * 1024
MIN_SIDE = 128
MAX_SIDE = 4096
_inference_lock = Lock()
_model_load_lock = Lock()
_loaded_model = None


class EvidenceError(ValueError):
    def __init__(self, reason_code: str) -> None:
        self.reason_code = reason_code
        super().__init__(reason_code)


def decode_image(value: EvidenceImage) -> Image.Image:
    try:
        raw = base64.b64decode(value.data, validate=True)
        if not raw or len(raw) > MAX_IMAGE_BYTES:
            raise EvidenceError("INVALID_IMAGE")
        with Image.open(BytesIO(raw)) as source:
            if source.format not in {"JPEG", "PNG", "WEBP"}:
                raise EvidenceError("INVALID_IMAGE")
            expected = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}[
                source.format
            ]
            if value.mime_type != expected:
                raise EvidenceError("INVALID_IMAGE")
            width, height = source.size
            if min(width, height) < MIN_SIDE or max(width, height) > MAX_SIDE:
                raise EvidenceError("LOW_QUALITY_EVIDENCE")
            source.load()
            image = ImageOps.exif_transpose(source).convert("RGB")
        if ImageStat.Stat(image.convert("L")).stddev[0] < 5:
            raise EvidenceError("LOW_QUALITY_EVIDENCE")
        return image
    except (
        binascii.Error,
        ValueError,
        UnidentifiedImageError,
        OSError,
        Image.DecompressionBombError,
    ) as error:
        if isinstance(error, EvidenceError):
            raise
        raise EvidenceError("INVALID_IMAGE") from error


def load_model():
    """Load the pinned checkpoint from the provisioned cache once per process, offline."""
    global _loaded_model
    if _loaded_model is not None:
        return _loaded_model
    with _model_load_lock:
        if _loaded_model is not None:
            return _loaded_model
        _loaded_model = _load_checkpoint()
        return _loaded_model


def _load_checkpoint():
    import torch
    from transformers import AutoImageProcessor, AutoModel

    options = {
        "revision": settings.return_dino_revision,
        "cache_dir": settings.return_dino_cache_dir,
        "local_files_only": True,
    }
    processor = AutoImageProcessor.from_pretrained(settings.return_dino_model, **options)
    model = AutoModel.from_pretrained(settings.return_dino_model, use_safetensors=True, **options)
    model.eval()
    model.to("cpu")
    torch.set_num_threads(settings.return_dino_cpu_threads)
    return processor, model


def model_ready() -> bool:
    try:
        load_model()
        return True
    except (OSError, ImportError, RuntimeError, ValueError):
        return False


def embeddings(images: list[Image.Image]):
    import torch
    import torch.nn.functional as functional

    processor, model = load_model()
    inputs = processor(images=images, return_tensors="pt")
    with _inference_lock, torch.inference_mode():
        output = model(**inputs)
    vectors = output.last_hidden_state[:, 0, :]
    vectors = functional.normalize(vectors.float(), p=2, dim=1)
    if not torch.isfinite(vectors).all():
        raise RuntimeError("Non-finite image embedding")
    return vectors


def classify_scores(best_scores: list[float]) -> tuple[str, str, bool]:
    """Median of corresponding listing/return views; conflicting views abstain."""
    if not best_scores or any(not -1 <= score <= 1 for score in best_scores):
        raise ValueError("Invalid similarity scores")
    if (
        len(best_scores) > 1
        and max(best_scores) - min(best_scores) > settings.return_dino_max_spread
    ):
        return "INSUFFICIENT_VISUAL_EVIDENCE", "CONFLICTING_VIEWS", False
    score = statistics.median(best_scores)
    if score >= settings.return_dino_match_threshold:
        return "LIKELY_MATCH", "HIGH_SIMILARITY", True
    if score <= settings.return_dino_mismatch_threshold:
        return "POSSIBLE_MISMATCH", "LOW_SIMILARITY", True
    # A score between the display bands is still a valid comparison. The backend
    # decision policy routes it to seller review; only bad/conflicting evidence abstains.
    return "POSSIBLE_MISMATCH", "AMBIGUOUS_SIMILARITY", True


def compare_images(request: CompareReturnRequest) -> ComparisonResponse:
    import torch

    references = [decode_image(image) for image in request.reference_images]
    returned = [decode_image(image) for image in request.return_images]
    vectors = embeddings(references + returned)
    best_scores = (vectors[: len(references)] * vectors[len(references) :]).sum(dim=1).tolist()
    status, reason_code, sufficient = classify_scores(best_scores)
    return ComparisonResponse(
        model=settings.return_dino_model,
        revision=settings.return_dino_revision,
        status=status,
        similarity_score=round(statistics.median(best_scores), 6),
        reference_image_count=len(references),
        return_image_count=len(returned),
        pairs=[
            PairResult(index=index + 1, similarity_score=round(score, 6))
            for index, score in enumerate(best_scores)
        ],
        evidence_sufficient=sufficient,
        reason_code=reason_code,
        processed_at=datetime.now(timezone.utc),
    )
