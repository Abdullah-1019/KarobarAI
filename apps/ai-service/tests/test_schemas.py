import pytest
from pydantic import ValidationError

from app.schemas.listing import GeneratedListing

VALID = {
    "title_en": "Wireless Speaker",
    "title_ur": "وائرلیس اسپیکر",
    "description_en": "A great wireless speaker.",
    "description_ur": "ایک بہترین اسپیکر۔",
    "category": "Electronics",
    "tags": ["speaker", "wireless", "bluetooth", "audio", "portable"],
}


def test_valid_output_parses_cleanly() -> None:
    listing = GeneratedListing.model_validate(VALID)
    assert listing.title_en == "Wireless Speaker"
    assert listing.tags == VALID["tags"]


@pytest.mark.parametrize(
    "missing_field",
    ["title_en", "title_ur", "description_en", "description_ur", "category", "tags"],
)
def test_a_missing_required_field_raises_validation_error(missing_field: str) -> None:
    payload = {k: v for k, v in VALID.items() if k != missing_field}
    with pytest.raises(ValidationError):
        GeneratedListing.model_validate(payload)


def test_tags_must_be_a_list_not_a_string() -> None:
    payload = {**VALID, "tags": "speaker, wireless"}
    with pytest.raises(ValidationError):
        GeneratedListing.model_validate(payload)


# Task 1.5 vs Task 4.3's split responsibility: the schema itself does NOT enforce the 5-10 tag
# count (that would make Task 4.3's "under-5 is a soft pass-through, not a hard failure"
# impossible) — count bounds are enforced downstream at the Core API's mapping layer instead.
def test_schema_itself_does_not_reject_an_under_or_over_count_tags_list() -> None:
    under = GeneratedListing.model_validate({**VALID, "tags": ["only-one"]})
    over = GeneratedListing.model_validate({**VALID, "tags": [f"tag{i}" for i in range(15)]})
    assert len(under.tags) == 1
    assert len(over.tags) == 15
