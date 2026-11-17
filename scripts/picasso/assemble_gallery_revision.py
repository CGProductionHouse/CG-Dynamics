"""Build an immutable local gallery revision from a reviewed base and replacements.

This does not edit photos, upload media, or imply photographic approval. It keeps
the local manifest aligned with images replaced in an existing review gallery.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import shutil
import tempfile
from pathlib import Path

from PIL import Image, ImageCms


def sha256(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def checked_jpeg(path: Path, dimensions: tuple[int, int]) -> None:
    with Image.open(path) as image:
        image.verify()
    with Image.open(path) as image:
        if image.format != "JPEG" or image.mode != "RGB" or image.size != dimensions or image.getexif():
            raise ValueError(f"Replacement is not a full-size RGB JPEG without EXIF: {path.name}")
        profile = image.info.get("icc_profile")
        if not profile or "srgb" not in ImageCms.getProfileName(ImageCms.ImageCmsProfile(io.BytesIO(profile))).lower():
            raise ValueError(f"Replacement lacks an sRGB ICC profile: {path.name}")


def assemble(base_manifest: Path, base_images: Path, replacement_file: Path, destination: Path) -> dict:
    if destination.exists():
        raise FileExistsError(f"Revision already exists: {destination}")
    manifest = json.loads(base_manifest.read_text(encoding="utf-8"))
    replacements = json.loads(replacement_file.read_text(encoding="utf-8"))["replacements"]
    items = manifest["items"]
    if manifest.get("count") != len(items) or len({item["file"] for item in items}) != len(items):
        raise ValueError("Base manifest count or filenames are invalid")
    edits = {}
    for edit in replacements:
        name = edit["file"]
        if name in edits or not edit.get("route") or not edit.get("reason"):
            raise ValueError(f"Duplicate replacement or missing route/reason: {name}")
        edits[name] = edit
    if not edits or not set(edits).issubset({item["file"] for item in items}):
        raise ValueError("Replacement list is empty or names a photo absent from the base")
    actual = {path.name for path in base_images.iterdir() if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg"}}
    expected = {item["file"] for item in items}
    if actual != expected:
        raise ValueError("Base image folder and manifest differ")

    destination.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix="picasso-revision-building-", dir=destination.parent))
    try:
        output = stage / "images"
        output.mkdir()
        for item in items:
            name = item["file"]
            if Path(name).name != name:
                raise ValueError(f"Unsafe manifest filename: {name}")
            base = base_images / name
            if sha256(base) != item["output_sha256"]:
                raise ValueError(f"Base JPEG changed: {name}")
            source = Path(item["source"])
            if sha256(source) != item["source_sha256"]:
                raise ValueError(f"Camera original changed: {name}")
            edit = edits.get(name)
            selected = Path(edit["path"]) if edit else base
            if edit:
                checked_jpeg(selected, tuple(item["dimensions"]))
                item["route"] = edit["route"]
                item["revision_reason"] = edit["reason"]
                item["editorial_decision"] = "REVIEW"
            shutil.copyfile(selected, output / name)
            item["output_sha256"] = sha256(output / name)
        manifest["purpose"] = "private revised gallery snapshot; photographic and client approval pending"
        manifest["revision_from"] = sha256(base_manifest)
        manifest["replaced_files"] = sorted(edits)
        (stage / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        stage.rename(destination)
    except Exception:
        shutil.rmtree(stage)
        raise
    return {"count": len(items), "replaced": len(edits), "destination": str(destination)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-manifest", type=Path, required=True)
    parser.add_argument("--base-images", type=Path, required=True)
    parser.add_argument("--replacements", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(assemble(args.base_manifest, args.base_images, args.replacements, args.out), indent=2))


if __name__ == "__main__":
    main()
