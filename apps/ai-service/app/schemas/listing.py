from pydantic import BaseModel


class GenerateListingRequest(BaseModel):
    image_url: str
    hint: str | None = None


# REQ-AI-Store002's exact schema — field names (snake_case) are the wire contract apps/backend's
# orchestration layer parses; do not rename without updating that side too.
class GeneratedListing(BaseModel):
    title_en: str
    title_ur: str
    description_en: str
    description_ur: str
    category: str
    tags: list[str]
