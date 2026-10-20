from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.llm.errors import AiGenerationError
from app.llm.gemini_listing_client import GeminiListingError
from app.llm.fallback_orchestrator import build_default_orchestrator
from app.schemas.listing import GeneratedListing, GenerateListingRequest

router = APIRouter()

# Built once at import time (module-level singleton, same lifetime as the FastAPI app) — cheap
# to construct (just wraps two client instances, no network I/O at construction), and avoids
# re-reading config on every request.
_orchestrator = build_default_orchestrator()


# Task 3.1 — never exposed publicly (TRD §8): this router is only ever reached over the private
# Docker network by the Core API, never through Nginx's public /api proxy (confirmed by the
# infra compose/nginx config, which has no route to ai-service's port).
@router.post(
    "/generate-listing",
    response_model=GeneratedListing,
    responses={422: {"description": "Photo did not identify a product"}, 502: {"description": "Listing generation failed"}},
)
def generate_listing_route(payload: GenerateListingRequest) -> GeneratedListing | JSONResponse:
    try:
        return _orchestrator.generate(payload.image_url, payload.hint)
    except AiGenerationError as error:
        cause = error.__cause__
        if isinstance(cause, GeminiListingError):
            if cause.reason == "configuration_unavailable":
                return JSONResponse(status_code=503, content={"error": "LISTING_PROVIDER_NOT_CONFIGURED"})
            if cause.reason == "rate_limited":
                return JSONResponse(status_code=429, content={"error": "LISTING_PROVIDER_RATE_LIMITED"})
            if cause.reason == "unidentifiable_image":
                return JSONResponse(status_code=422, content={"error": "LISTING_IMAGE_NOT_IDENTIFIABLE"})
        return JSONResponse(status_code=502, content={"error": "GENERATION_FAILED"})
