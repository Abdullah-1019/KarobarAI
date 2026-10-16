"""Explicit setup command: python -m app.llm.download_dinov2."""

from pathlib import Path

from huggingface_hub import snapshot_download

from app.config import settings
from app.llm.dinov2_return_comparison import load_model


def main() -> None:
    snapshot = snapshot_download(
        repo_id=settings.return_dino_model,
        revision=settings.return_dino_revision,
        cache_dir=settings.return_dino_cache_dir,
        allow_patterns=["config.json", "preprocessor_config.json", "model.safetensors"],
    )
    weight = Path(snapshot) / "model.safetensors"
    if not weight.is_file():
        raise RuntimeError("Pinned DINOv2-Small safetensors checkpoint is incomplete")
    load_model()
    print(f"DINOv2 ready: {settings.return_dino_model}@{settings.return_dino_revision}")
    print(f"Checkpoint bytes: {weight.stat().st_size}")


if __name__ == "__main__":
    main()
