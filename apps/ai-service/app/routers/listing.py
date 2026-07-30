from fastapi import APIRouter

from app.llm.client import generate_listing
from app.schemas.listing import GeneratedListing, GenerateListingRequest

router = APIRouter()


@router.post("/generate-listing", response_model=GeneratedListing)
def generate_listing_route(payload: GenerateListingRequest) -> GeneratedListing:
    return generate_listing(payload.image_url, payload.hint)
