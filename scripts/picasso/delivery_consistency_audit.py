"""Read-only event gallery audit; measurements are review prompts, not photo decisions.

Accepts the flat final manifest used for a Pixieset upload. It never edits originals,
exports, or a live gallery. ``--check-release`` fails unless every intended upload
has a hash-bound human KEEP decision and a varied-sample acceptance record.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
from collections import Counter, defaultdict
from pathlib import Path
from statistics import median
import sys

import cv2
import numpy as np
from PIL import Image, ImageCms, ImageDraw, ImageOps

VERSION = "0.1.0"
FIELDS = ["key", "group", "file", "sha256", "source_sha256", "route", "width", "height",
          "median_luma", "p99_luma", "bright_pixel_percent", "mean_saturation", "rgb_change",
          "flags", "subject_focus", "grade_vs_reference", "scene_consistency",
          "editorial_decision", "reviewer", "reason"]


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def small_rgb(image: Image.Image, width: int = 480) -> np.ndarray:
    copy = ImageOps.exif_transpose(image).convert("RGB")
    copy.thumbnail((width, width), Image.Resampling.LANCZOS)
    return np.asarray(copy, dtype=np.uint8)


def metrics(path: Path, source: Path | None) -> dict:
    with Image.open(path) as image:
        image.verify()
    with Image.open(path) as image:
        if image.mode != "RGB" or image.getexif():
            raise ValueError(f"Export must be RGB without EXIF: {path.name}")
        icc = image.info.get("icc_profile")
        if not icc or "srgb" not in ImageCms.getProfileName(ImageCms.ImageCmsProfile(io.BytesIO(icc))).lower():
            raise ValueError(f"Export must have sRGB ICC: {path.name}")
        dimensions = image.size
        pixels = small_rgb(image)
    lab = cv2.cvtColor(pixels, cv2.COLOR_RGB2LAB)
    hsv = cv2.cvtColor(pixels, cv2.COLOR_RGB2HSV)
    luma = lab[:, :, 0]
    bright = np.mean(np.max(pixels, axis=2) >= 253) * 100
    rgb_change = None
    source_hash = None
    if source is not None:
        if not source.is_file():
            raise FileNotFoundError(source)
        source_hash = digest(source)
        with Image.open(source) as original:
            if ImageOps.exif_transpose(original).size != dimensions:
                raise ValueError(f"Source dimensions differ: {path.name}")
            prior = small_rgb(original)
        # JPEG output/source thumbnails can differ by a pixel at the edge.
        if prior.shape != pixels.shape:
            prior = cv2.resize(prior, (pixels.shape[1], pixels.shape[0]))
        rgb_change = float(np.mean(np.abs(pixels.astype(np.int16) - prior.astype(np.int16))))
    return {"width": dimensions[0], "height": dimensions[1],
            "median_luma": round(float(np.median(luma)), 1),
            "p99_luma": round(float(np.percentile(luma, 99)), 1),
            "bright_pixel_percent": round(float(bright), 2),
            "mean_saturation": round(float(np.mean(hsv[:, :, 1])), 1),
            "rgb_change": round(rgb_change, 2) if rgb_change is not None else "",
            "source_sha256": source_hash or ""}


def contact_pages(rows: list[dict], images: Path, destination: Path) -> None:
    by_group: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        by_group[row["group"]].append(row)
    contacts = destination / "contact-sheets"
    contacts.mkdir(parents=True, exist_ok=True)
    for group, group_rows in by_group.items():
        for start in range(0, len(group_rows), 20):
            sheet = Image.new("RGB", (1500, 5 * 230), (24, 24, 24))
            draw = ImageDraw.Draw(sheet)
            for pos, row in enumerate(group_rows[start:start + 20]):
                x, y = (pos % 4) * 375, (pos // 4) * 230
                with Image.open(images / row["file"]) as image:
                    thumb = ImageOps.exif_transpose(image).convert("RGB")
                    thumb.thumbnail((355, 185), Image.Resampling.LANCZOS)
                sheet.paste(thumb, (x + (375 - thumb.width) // 2, y))
                caption = f'{row["key"]} / {Path(row["file"]).stem[-9:]}  L={row["median_luma"]}'
                draw.text((x + 5, y + 188), caption, fill="white")
                draw.text((x + 5, y + 204), row["flags"][:60], fill="#ffbd7b")
            safe = "".join(c if c.isalnum() else "-" for c in group).strip("-")[:45]
            sheet.save(contacts / f"{safe}-{start // 20 + 1:02}.jpg", quality=86)


def audit(manifest_path: Path, images: Path, destination: Path, *, sheets: bool = True) -> dict:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    items = manifest["items"]
    if manifest.get("count") != len(items):
        raise ValueError("Manifest count does not match its items")
    if len({item["file"] for item in items}) != len(items) or len({item["key"] for item in items}) != len(items):
        raise ValueError("Duplicate file or key in manifest")
    actual = {p.name for p in images.iterdir() if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg"}}
    expected = {item["file"] for item in items}
    if actual != expected:
        raise ValueError(f"Image/manifest mismatch: missing={sorted(expected-actual)}, extra={sorted(actual-expected)}")
    rows = []
    for item in items:
        name = item["file"]
        if Path(name).name != name:
            raise ValueError(f"Unsafe output file name: {name}")
        source = Path(item["source"]) if item.get("source") else None
        values = metrics(images / name, source)
        output_hash = digest(images / name)
        if item.get("source_sha256") and item["source_sha256"] != values["source_sha256"]:
            raise ValueError(f"Camera source hash differs from manifest: {name}")
        if item.get("output_sha256") and item["output_sha256"] != output_hash:
            raise ValueError(f"Export hash differs from manifest: {name}")
        row = {"key": item["key"], "group": item["group"], "file": name,
               "sha256": output_hash, "route": item.get("route", "UNRECORDED"), **values,
               "flags": "", "subject_focus": "UNREVIEWED", "grade_vs_reference": "UNREVIEWED",
               "scene_consistency": "UNREVIEWED", "editorial_decision": "REVIEW", "reviewer": "", "reason": ""}
        flags = []
        if item.get("route") in {None, "", "colour-checked"}:
            flags.append("editing route not specific")
        if row["rgb_change"] != "" and row["rgb_change"] < 3 and not item["key"].startswith(("drone:", "staff-reference:")):
            flags.append("little visible change against reference")
        if row["bright_pixel_percent"] > 5:
            flags.append("many near-white pixels; inspect clipping")
        row["flags"] = "; ".join(flags)
        rows.append(row)
    for group in {row["group"] for row in rows}:
        members = [row for row in rows if row["group"] == group]
        if len(members) < 4:
            continue
        center = median(row["median_luma"] for row in members)
        for row in members:
            if abs(row["median_luma"] - center) >= 40:
                row["flags"] += ("; " if row["flags"] else "") + "luminance outlier within group"
    destination.mkdir(parents=True, exist_ok=True)
    with (destination / "review.csv").open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.DictWriter(stream, FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    if sheets:
        contact_pages(rows, images, destination)
    summary = {"version": VERSION, "count": len(rows),
               "groups": dict(Counter(row["group"] for row in rows)),
               "flagged": sum(bool(row["flags"]) for row in rows),
               "flags": dict(Counter(flag.strip() for row in rows for flag in row["flags"].split(";") if flag.strip())),
               "release_state": "BLOCKED: all rows require photographic review and accepted varied sample"}
    (destination / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def check_release(review_csv: Path, acceptance_json: Path, images: Path, manifest_path: Path) -> None:
    with review_csv.open(newline="", encoding="utf-8-sig") as stream:
        rows = list(csv.DictReader(stream))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if {(row["key"], row["file"]) for row in rows} != {(item["key"], item["file"]) for item in manifest["items"]}:
        raise ValueError("Release rows differ from manifest")
    actual = {p.name for p in images.iterdir() if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg"}}
    if actual != {row["file"] for row in rows}:
        raise ValueError("Release rows differ from upload folder")
    for row in rows:
        if digest(images / row["file"]) != row["sha256"]:
            raise ValueError(f"Changed JPEG after review: {row['file']}")
        if row["editorial_decision"] != "KEEP" or not row["reviewer"].strip() or not row["reason"].strip():
            raise ValueError(f"Editorial decision incomplete: {row['file']}")
        if any(row[field] != "PASS" for field in ("subject_focus", "grade_vs_reference", "scene_consistency")):
            raise ValueError(f"Photographic review incomplete: {row['file']}")
        source = next(item.get("source") for item in manifest["items"] if item["key"] == row["key"])
        if source and digest(Path(source)) != row["source_sha256"]:
            raise ValueError(f"Camera source changed after review: {row['file']}")
    acceptance = json.loads(acceptance_json.read_text(encoding="utf-8"))
    if (acceptance.get("status") != "ACCEPTED" or not acceptance.get("reviewer")
            or not acceptance.get("accepted_at") or len(acceptance.get("sample_keys", [])) < 25):
        raise ValueError("Varied 25-frame calibration has no accepted review record")
    if len(set(acceptance["sample_keys"])) < 25 or not set(acceptance["sample_keys"]).issubset({row["key"] for row in rows}):
        raise ValueError("Acceptance sample does not match this gallery")
    groups = {row["group"] for row in rows if row["key"] in acceptance["sample_keys"]}
    if len(groups) < 3:
        raise ValueError("Acceptance sample does not cover varied gallery groups")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--images", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--no-sheets", action="store_true")
    parser.add_argument("--check-release", action="store_true")
    parser.add_argument("--review", type=Path, help="Completed review CSV for --check-release")
    parser.add_argument("--acceptance", type=Path, help="Human accepted 25-frame record")
    args = parser.parse_args()
    if args.check_release and (args.acceptance is None or args.review is None):
        parser.error("--check-release requires --acceptance and --review")
    try:
        if args.check_release:
            check_release(args.review, args.acceptance, args.images, args.manifest)
            print("Release gate PASS")
        else:
            summary = audit(args.manifest, args.images, args.out, sheets=not args.no_sheets)
            print(json.dumps(summary, indent=2))
    except (ValueError, FileNotFoundError, KeyError) as exc:
        print(f"Release gate BLOCKED: {exc}" if args.check_release else f"Audit failed: {exc}", file=sys.stderr)
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
