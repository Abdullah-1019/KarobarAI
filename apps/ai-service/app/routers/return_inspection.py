from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.llm.dinov2_return_comparison import EvidenceError, compare_images, model_ready
from app.schemas.return_inspection import CompareReturnRequest, ComparisonResponse

router = APIRouter()


@router.get("/return-comparison/health")
def comparison_health() -> JSONResponse:
    ready = model_ready()
    return JSONResponse(status_code=200 if ready else 503, content={"ready": ready})


@router.post("/compare-return-images", response_model=ComparisonResponse)
def compare_return_route(request: CompareReturnRequest) -> ComparisonResponse | JSONResponse:
    try:
        return compare_images(request)
    except EvidenceError as error:
        return JSONResponse(status_code=422, content={"error": error.reason_code})
    except (OSError, ImportError, RuntimeError, ValueError):
        return JSONResponse(status_code=503, content={"error": "RETURN_COMPARISON_UNAVAILABLE"})
