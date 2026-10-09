import math
import struct
import zlib

W = H = 128
background = (246, 247, 250)
shirt = (34, 93, 176)
poly = [(x // 4, y // 4) for x, y in [(160, 105), (210, 58), (245, 105), (267, 105), (302, 58), (352, 105), (415, 176), (350, 218), (329, 183), (329, 438), (183, 438), (183, 183), (162, 218), (97, 176)]]


def inside_polygon(x, y):
    inside = False
    j = len(poly) - 1
    for i, (xi, yi) in enumerate(poly):
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1) + xi:
            inside = not inside
        j = i
    return inside


rows = []
for y in range(H):
    row = bytearray([0])
    for x in range(W):
        color = shirt if inside_polygon(x, y) else background
        # White collar opening makes the garment shape easier to identify.
        if (x - 64) ** 2 + (y - 28) ** 2 < 7**2 and y < 32:
            color = background
        row.extend(color)
    rows.append(bytes(row))


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


png = b"\x89PNG\r\n\x1a\n"
png += chunk(b"IHDR", struct.pack(">2I5B", W, H, 8, 2, 0, 0, 0))
png += chunk(b"IDAT", zlib.compress(b"".join(rows), 8))
png += chunk(b"IEND", b"")
with open("ollama-listing-product.png", "wb") as f:
    f.write(png)
