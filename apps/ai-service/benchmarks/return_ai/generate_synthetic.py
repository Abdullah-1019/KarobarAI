"""Generate tiny, clearly synthetic shirt fixtures. No customer or licensed images."""

import json
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).parent
SIZE = 128


def png(path: Path, pixels: list[list[tuple[int, int, int]]]) -> None:
    raw = b"".join(b"\0" + bytes(channel for pixel in row for channel in pixel) for row in pixels)

    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
        )

    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">2I5B", SIZE, SIZE, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def draw(seed: int, mark: str = "none", quality: str = "clear") -> list[list[tuple[int, int, int]]]:
    background = (239, 231, 215)
    fabric = (80 + seed * 8, 126 + seed * 4, 155 - seed * 5)
    image = [[background for _ in range(SIZE)] for _ in range(SIZE)]
    for y in range(17, 118):
        for x in range(15, 113):
            body = 38 <= x < 90 and y >= 26
            sleeve = 17 <= x < 39 and 29 <= y < 62 or 89 <= x < 111 and 29 <= y < 62
            collar = 56 <= x < 72 and y < 40
            if (body or sleeve) and not collar:
                image[y][x] = fabric
    for y in (50, 68, 86, 104):
        for x in range(63, 66):
            image[y][x] = (236, 234, 225)
    if mark == "stain":
        for y in range(65, 82):
            for x in range(43, 61):
                if (x - 51) ** 2 + (y - 72) ** 2 < 65:
                    image[y][x] = (110, 65, 34)
    elif mark == "hole":
        for y in range(69, 81):
            for x in range(76, 87):
                if (x - 81) ** 2 + (y - 75) ** 2 < 22:
                    image[y][x] = background
    elif mark == "tear":
        for y in range(72, 94):
            for x in range(42 + (y % 5), 46 + (y % 5)):
                image[y][x] = background
    elif mark == "missing_button":
        for y in range(66, 71):
            for x in range(63, 66):
                image[y][x] = fabric
    elif mark == "seam_damage":
        for y in range(70, 91):
            for x in range(38, 41):
                image[y][x] = background if y % 4 < 2 else (30, 40, 45)
    if quality == "occluded":
        for y in range(39, 97):
            for x in range(35, 95):
                image[y][x] = (40, 43, 45)
    if quality == "low_contrast":
        image = [[tuple((c + 225) // 2 for c in pixel) for pixel in row] for row in image]
    if quality == "patterned":
        for y in range(42, 110, 9):
            for x in range(39, 89):
                image[y][x] = tuple(max(0, c - 15) for c in fabric)
    if quality == "folded":
        for y in range(46, 106):
            x = 54 + (y - 46) // 7
            for offset in range(3):
                image[y][x + offset] = tuple(max(0, c - 22) for c in fabric)
    if quality == "shadowed":
        for y in range(37, 111):
            for x in range(39, min(89, 43 + (y - 37) // 2)):
                image[y][x] = tuple(max(0, c - 55) for c in image[y][x])
    return image


def main() -> None:
    rows = [
        ("clear", "none", "clear", [], False),
        ("stain", "stain", "clear", ["stain"], False),
        ("tear", "tear", "clear", ["tear"], False),
        ("hole", "hole", "clear", ["hole"], False),
        ("button", "missing_button", "clear", ["missing_button"], False),
        ("seam", "seam_damage", "clear", ["seam_damage"], False),
        ("occluded", "none", "occluded", [], False),
        ("low_contrast", "none", "low_contrast", [], False),
        ("patterned", "none", "patterned", [], False),
        ("folded", "none", "folded", [], False),
        ("shadowed", "none", "shadowed", [], False),
        ("paired_unchanged", "none", "clear", [], True),
        ("paired_stain", "stain", "clear", ["stain"], True),
    ]
    image_dir = ROOT / "images"
    image_dir.mkdir(exist_ok=True)
    cases = []
    for index, (name, mark, quality, labels, paired) in enumerate(rows):
        image_name = f"{name}.png"
        png(image_dir / image_name, draw(index % 5, mark, quality))
        references = []
        if paired:
            # Keep the existing synthetic fixture filename for reproducibility; it is a listing reference now.
            reference_name = f"{name}_dispatch.png"
            png(image_dir / reference_name, draw(index % 5))
            references = [f"images/{reference_name}"]
        cases.append(
            {
                "id": name,
                "category": "shirt",
                "return_images": [f"images/{image_name}"],
                "reference_images": references,
                "quality": (
                    "unclear" if quality in {"occluded", "low_contrast", "shadowed"} else "clear"
                ),
                "defects": labels,
                "condition_change": (
                    "possible" if paired and labels else "none" if paired else "unknown"
                ),
                "expected_route": "manual_review",
                "source": "procedural synthetic illustration",
                "license": "generated in this repository; CC0",
                "group": name,
            }
        )
    (ROOT / "manifest.json").write_text(
        json.dumps(
            {
                "version": 1,
                "limitations": "Simplified computer-drawn shirts; not representative of real photographs.",
                "cases": cases,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
