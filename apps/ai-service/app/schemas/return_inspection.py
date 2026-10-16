from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ComparisonStatus = Literal[
    "LIKELY_MATCH",
    "POSSIBLE_MISMATCH",
    "INSUFFICIENT_VISUAL_EVIDENCE",
    "COMPARISON_FAILED",
]
ReasonCode = Literal[
    "HIGH_SIMILARITY",
    "LOW_SIMILARITY",
    "AMBIGUOUS_SIMILARITY",
    "CONFLICTING_VIEWS",
    "NO_LISTING_IMAGES",
    "LOW_QUALITY_EVIDENCE",
    "INVALID_IMAGE",
    "MODEL_UNAVAILABLE",
    "INFERENCE_FAILED",
]


class EvidenceImage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mime_type: Literal["image/jpeg", "image/png", "image/webp"]
    data: str = Field(min_length=4, max_length=14_000_000)


class CompareReturnRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reference_images: list[EvidenceImage] = Field(min_length=1, max_length=5)
    return_images: list[EvidenceImage] = Field(min_length=1, max_length=5)

    @model_validator(mode="after")
    def matching_counts(self):
        if len(self.reference_images) != len(self.return_images):
            raise ValueError("Each return image needs one listing reference")
        return self


class PairResult(BaseModel):
    index: int = Field(ge=1, le=5)
    similarity_score: float = Field(ge=-1, le=1)


class ComparisonResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider: Literal["dinov2"] = "dinov2"
    model: str = Field(min_length=1, max_length=100)
    revision: str = Field(min_length=40, max_length=40)
    policy_version: Literal["dinov2_comparison_v1"] = "dinov2_comparison_v1"
    status: ComparisonStatus
    similarity_score: float | None = Field(default=None, ge=-1, le=1)
    reference_image_count: int = Field(ge=1, le=5)
    return_image_count: int = Field(ge=1, le=5)
    pairs: list[PairResult] = Field(min_length=1, max_length=5)
    evidence_sufficient: bool
    reason_code: ReasonCode
    processed_at: datetime
