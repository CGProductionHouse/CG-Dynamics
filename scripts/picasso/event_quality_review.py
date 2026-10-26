"""Private, read-only photographic QA for a PICASSO event release manifest.

Produces subject-candidate detail sheets and per-image comparison measurements.
Measurements prioritize review; they never make editorial keep/reject decisions.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path
import re
import statistics

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageOps


MODEL = Path(__file__).parent / "models" / "face_detection_yunet_2026may.onnx"
VERSION = "0.2.0"
CELL = 500
LABEL = 55
ROWS_PER_SHEET = 4


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def face_roi(image: Image.Image, detector: cv2.FaceDetectorYN) -> tuple[tuple[int, int, int, int], int, str]:
    width, height = image.size
    scale = min(1.0, 1200 / width)
    small = cv2.resize(np.asarray(image), (round(width * scale), round(height * scale)))
    detector.setInputSize((small.shape[1], small.shape[0]))
    _, detections = detector.detect(cv2.cvtColor(small, cv2.COLOR_RGB2BGR))
    if detections is None or len(detections) == 0:
        side = min(CELL, width, height)
        left, top = (width - side) // 2, (height - side) // 2
        return (left, top, left + side, top + side), 0, "center fallback; subject unverified"
    face = max(detections, key=lambda row: float(row[2] * row[3] * row[-1]))
    x, y, w, h = (float(v) / scale for v in face[:4])
    side = min(max(CELL, round(1.4 * max(w, h))), width, height)
    left = max(0, min(width - side, round(x + w / 2 - side / 2)))
    top = max(0, min(height - side, round(y + h / 2 - side / 2)))
    return (left, top, left + side, top + side), len(detections), "face candidate; verify main subject"


def crop_tile(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    crop = image.crop(box)
    if crop.size != (CELL, CELL):
        crop.thumbnail((CELL, CELL), Image.Resampling.LANCZOS)
    tile = Image.new("RGB", (CELL, CELL), (25, 25, 25))
    tile.paste(crop, ((CELL - crop.width) // 2, (CELL - crop.height) // 2))
    return tile


def full_tile(image: Image.Image) -> Image.Image:
    preview = image.copy()
    preview.thumbnail((CELL, CELL), Image.Resampling.LANCZOS)
    tile = Image.new("RGB", (CELL, CELL), (25, 25, 25))
    tile.paste(preview, ((CELL - preview.width) // 2, (CELL - preview.height) // 2))
    return tile


def comparison_metrics(source: Image.Image, output: Image.Image, box: tuple[int, int, int, int]) -> tuple[float, float, float]:
    src = cv2.cvtColor(np.asarray(source.crop(box).convert("RGB")), cv2.COLOR_RGB2GRAY)
    out = np.asarray(output.resize((400, round(400 * output.height / output.width))).convert("RGB"), dtype=np.float32)
    orig = np.asarray(source.resize((out.shape[1], out.shape[0])).convert("RGB"), dtype=np.float32)
    sharpness = float(cv2.Laplacian(src, cv2.CV_64F).var())
    rgb_delta = float(np.mean(np.abs(out - orig)))
    l_delta = float(np.mean(cv2.cvtColor(out.astype(np.uint8), cv2.COLOR_RGB2LAB)[:, :, 0].astype(np.int16)
                            - cv2.cvtColor(orig.astype(np.uint8), cv2.COLOR_RGB2LAB)[:, :, 0].astype(np.int16)))
    return round(sharpness, 2), round(rgb_delta, 2), round(l_delta, 2)


def make_sheet(rows: list[dict], destination: Path) -> None:
    sheet = Image.new("RGB", (CELL * 4, (CELL + LABEL) * len(rows)), (25, 25, 25))
    draw = ImageDraw.Draw(sheet)
    for index, row in enumerate(rows):
        y = index * (CELL + LABEL)
        sheet.paste(row.pop("_source_full"), (0, y))
        sheet.paste(row.pop("_output_full"), (CELL, y))
        sheet.paste(row.pop("_source_tile"), (CELL * 2, y))
        sheet.paste(row.pop("_output_tile"), (CELL * 3, y))
        title = f"{row['key']} | {row['set']} | {row['roi_type']} | focus probe {row['laplacian_var']}"
        draw.text((8, y + CELL + 5), title[:130], fill="white")
        for column, label in enumerate(("ORIGINAL FULL SCENE", "EDITED FULL SCENE", "ORIGINAL 100% CROP", "EDITED SAME CROP")):
            draw.text((column * CELL + 8, y + CELL + 28), label, fill="#dddddd")
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, "JPEG", quality=88)


def safe_name(value: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-.")[:70] or "set"
    return f"{stem}-{hashlib.sha1(value.encode('utf-8')).hexdigest()[:6]}"


def run(manifest_path: Path, destination: Path, keys: set[str] | None) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    output_root = Path(manifest.get("output_root", manifest_path.parent / "output"))
    if not MODEL.is_file():
        raise FileNotFoundError(f"Pinned local face detector missing: {MODEL}")
    detector = cv2.FaceDetectorYN.create(str(MODEL), "", (1200, 800), score_threshold=0.6)
    selected = [r for r in manifest["rows"] if r.get("upload") and r.get("mode") in {"color", "mono"}
                and (keys is None or r["key"] in keys)]
    if keys and len(selected) != len(keys):
        raise ValueError(f"Missing camera keys: {sorted(keys - {r['key'] for r in selected})}")
    destination.mkdir(parents=True, exist_ok=True)
    report: list[dict] = []
    pages: dict[str, list[dict]] = {}
    page_numbers: dict[str, int] = {}
    for index, item in enumerate(selected, 1):
        source_path = Path(item["source"])
        output_path = output_root / item["output"]
        if file_hash(source_path) != item["source_sha256"] or file_hash(output_path) != item["output_sha256"]:
            raise ValueError(f"Manifest hash mismatch for {item['key']}")
        with Image.open(source_path) as raw, Image.open(output_path) as edited:
            source = ImageOps.exif_transpose(raw).convert("RGB")
            result = ImageOps.exif_transpose(edited).convert("RGB")
            if source.size != result.size:
                raise ValueError(f"Dimensions changed for {item['key']}")
            box, count, roi_type = face_roi(source, detector)
            sharpness, rgb_delta, l_delta = comparison_metrics(source, result, box)
            row = {"key": item["key"], "set": item["set"], "source": str(source_path),
                   "output": str(output_path), "face_candidates": count, "roi_type": roi_type,
                   "crop_xyxy": json.dumps(box), "laplacian_var": sharpness,
                   "mean_abs_rgb_delta": rgb_delta, "mean_l_delta": l_delta,
                   "native_subject_focus": "UNREVIEWED", "grade_vs_staff_reference": "UNREVIEWED",
                   "editorial_decision": "REVIEW"}
            report.append(row)
            page = pages.setdefault(item["set"], [])
            page.append({**row, "_source_full": full_tile(source), "_output_full": full_tile(result),
                         "_source_tile": crop_tile(source, box), "_output_tile": crop_tile(result, box)})
            if len(page) == ROWS_PER_SHEET:
                page_numbers[item["set"]] = page_numbers.get(item["set"], 0) + 1
                safe_set = safe_name(item["set"])
                make_sheet(page, destination / "crops" / f"{safe_set}-p{page_numbers[item['set']]:02}.jpg")
                pages[item["set"]] = []
        print(f"{index}/{len(selected)} {item['key']} faces={count} focus_probe={sharpness} rgb_delta={rgb_delta}", flush=True)
    for set_name, page in pages.items():
        if page:
            page_numbers[set_name] = page_numbers.get(set_name, 0) + 1
            safe_set = safe_name(set_name)
            make_sheet(page, destination / "crops" / f"{safe_set}-p{page_numbers[set_name]:02}.jpg")
    if report:
        with (destination / "focus-and-grade-review.csv").open("w", newline="", encoding="utf-8-sig") as stream:
            writer = csv.DictWriter(stream, fieldnames=report[0].keys())
            writer.writeheader()
            writer.writerows(report)
    summary = {"tool_version": VERSION, "manifest": str(manifest_path), "camera_images": len(report),
               "no_face_candidates": sum(row["face_candidates"] == 0 for row in report),
               "median_mean_abs_rgb_delta": statistics.median(row["mean_abs_rgb_delta"] for row in report) if report else None,
               "review_state": "UNREVIEWED; measurements are triage only"}
    (destination / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--keys", nargs="*", help="Optional camera keys for a focused proof")
    args = parser.parse_args()
    run(args.manifest, args.out, set(args.keys) if args.keys else None)


if __name__ == "__main__":
    main()
