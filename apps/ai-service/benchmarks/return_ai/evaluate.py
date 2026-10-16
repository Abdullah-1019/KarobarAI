"""Evaluate paired visual comparison without business mutations or accuracy claims."""

import argparse
import base64
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent


def safe_images(paths: list[str]) -> list[dict[str, str]]:
    output = []
    for path in paths:
        target = (ROOT / path).resolve()
        if not target.is_relative_to(ROOT.resolve()) or not target.is_file():
            raise ValueError(f"Missing or unsafe fixture: {path}")
        output.append(
            {"mime_type": "image/png", "data": base64.b64encode(target.read_bytes()).decode()}
        )
    return output


def evaluate(cases: list[dict], live: bool) -> dict:
    rows = []
    labeled = []
    for case in cases:
        references = safe_images(case["reference_images"])
        returned = safe_images(case["return_images"])
        row = {
            "id": case["id"],
            "paired": bool(references),
            "source": case.get("source"),
            "status": "NOT_RUN",
            "similarity_score": None,
            "latency_ms": None,
        }
        if not references:
            row["status"] = "INSUFFICIENT_VISUAL_EVIDENCE"
        elif live:
            from app.llm.dinov2_return_comparison import compare_images
            from app.schemas.return_inspection import CompareReturnRequest

            started = time.monotonic()
            try:
                request = CompareReturnRequest(reference_images=references, return_images=returned)
                result = compare_images(request)
                row.update(
                    status=result.status,
                    similarity_score=result.similarity_score,
                    reason_code=result.reason_code,
                    pairs=[pair.model_dump() for pair in result.pairs],
                )
                # Ground truth must come from independently labeled physical-product
                # pairs, never from a defect label or the model's own prediction.
                label = case.get("same_physical_product")
                if isinstance(label, bool) and result.evidence_sufficient:
                    predicted = (
                        "accept"
                        if result.similarity_score >= 0.80
                        else "reject" if result.similarity_score < 0.60 else "review"
                    )
                    labeled.append((label, predicted))
            except Exception as error:
                row.update(status="COMPARISON_FAILED", error=type(error).__name__)
            row["latency_ms"] = round((time.monotonic() - started) * 1000, 1)
        rows.append(row)
    different = [prediction for label, prediction in labeled if not label]
    matching = [prediction for label, prediction in labeled if label]
    return {
        "model": "facebook/dinov2-small",
        "live_model_run": live,
        "cases": rows,
        "paired_cases": sum(row["paired"] for row in rows),
        "independently_labeled_cases": len(labeled),
        "false_acceptance_rate": (
            sum(prediction == "accept" for prediction in different) / len(different)
            if different
            else None
        ),
        "false_rejection_rate": (
            sum(prediction == "reject" for prediction in matching) / len(matching)
            if matching
            else None
        ),
        "manual_review_rate_on_labeled_cases": (
            sum(prediction == "review" for _, prediction in labeled) / len(labeled)
            if labeled
            else None
        ),
        "limitation": "Procedural illustrations and few paired views do not establish real-world matching accuracy.",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=ROOT / "manifest.json")
    parser.add_argument(
        "--live", action="store_true", help="Run local DINOv2 inference; no hosted quota used"
    )
    parser.add_argument("--case", help="Evaluate one case ID")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    cases = manifest["cases"]
    if len({case["id"] for case in cases}) != len(cases):
        raise ValueError("Duplicate case IDs")
    if args.case:
        cases = [case for case in cases if case["id"] == args.case]
        if not cases:
            raise ValueError("Unknown case ID")
    print(json.dumps(evaluate(cases, args.live), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
