"""Strip private JPEG metadata without decoding or recompressing image pixels.

Use on a *copy* exported by a desktop editor. Only JFIF and ICC application
segments are retained; EXIF, XMP, IPTC, comments, thumbnails, and unknown
application segments are removed. The original file is never changed.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import os
from pathlib import Path

from PIL import Image, ImageChops, ImageCms


def _private_segments_removed(data: bytes) -> tuple[bytes, int]:
    if not data.startswith(b"\xff\xd8"):
        raise ValueError("not a JPEG")
    result = bytearray(data[:2])
    offset = 2
    removed = 0
    while offset < len(data):
        if data[offset] != 0xFF:
            raise ValueError("invalid JPEG marker before image data")
        start = offset
        while offset < len(data) and data[offset] == 0xFF:
            offset += 1
        if offset >= len(data):
            raise ValueError("truncated JPEG marker")
        marker = data[offset]
        offset += 1
        if marker == 0xDA:  # Start of scan: preserve compressed bytes exactly.
            result.extend(data[start:])
            return bytes(result), removed
        if marker == 0xD9:
            raise ValueError("JPEG has no image scan")
        if marker in (0x01, *range(0xD0, 0xD8)):
            result.extend(data[start:offset])
            continue
        if offset + 2 > len(data):
            raise ValueError("truncated JPEG segment length")
        length = int.from_bytes(data[offset:offset + 2], "big")
        end = offset + length
        if length < 2 or end > len(data):
            raise ValueError("invalid JPEG segment length")
        payload = data[offset + 2:end]
        keep = not (0xE0 <= marker <= 0xEF or marker == 0xFE)
        if marker == 0xE0:
            keep = payload.startswith(b"JFIF\x00")
        elif marker == 0xE2:
            keep = payload.startswith(b"ICC_PROFILE\x00")
        if keep:
            result.extend(data[start:end])
        else:
            removed += 1
        offset = end
    raise ValueError("JPEG has no image scan")


def sanitize(source: Path, destination: Path) -> dict[str, object]:
    source = source.resolve(strict=True)
    destination = destination.resolve()
    if source == destination:
        raise ValueError("destination must differ from source")
    if destination.exists():
        raise FileExistsError(destination)
    before = source.read_bytes()
    after, removed = _private_segments_removed(before)
    with Image.open(io.BytesIO(before)) as original, Image.open(io.BytesIO(after)) as clean:
        original.load()
        clean.load()
        if original.mode != "RGB" or clean.mode != "RGB":
            raise ValueError("only RGB JPEGs are supported")
        if original.size != clean.size or ImageChops.difference(original, clean).getbbox():
            raise ValueError("sanitizing changed decoded pixels")
        if clean.getexif():
            raise ValueError("private EXIF remains")
        profile = clean.info.get("icc_profile")
        if not profile or profile != original.info.get("icc_profile"):
            raise ValueError("ICC profile missing or changed")
        name = ImageCms.getProfileName(ImageCms.ImageCmsProfile(io.BytesIO(profile)))
        if "srgb" not in name.lower():
            raise ValueError(f"output is not sRGB: {name.strip()}")
        dimensions = clean.size
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.name + ".tmp")
    try:
        with temporary.open("xb") as output:
            output.write(after)
            output.flush()
            os.fsync(output.fileno())
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)
    return {
        "source_sha256": hashlib.sha256(before).hexdigest(),
        "output_sha256": hashlib.sha256(after).hexdigest(),
        "dimensions": list(dimensions),
        "icc_profile": name.strip(),
        "removed_segments": removed,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    print(sanitize(args.source, args.destination))


if __name__ == "__main__":
    main()
