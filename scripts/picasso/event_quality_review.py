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
VERSION = "0.3.3"
CELL = 500
LABEL = 55
ROWS_PER_SHEET = 4


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def face_roi(image: Image.Image, detector: cv2.FaceDetectorYN) -> tuple[tuple[int, int, int, int], int, str, list[tuple[int, int, int, int]]]:
    width, height = image.size
    scale = min(1.0, 1200 / width)
    small = cv2.resize(np.asarray(image), (round(width * scale), round(height * scale)))
    detector.setInputSize((small.shape[1], small.shape[0]))
    _, detections = detector.detect(cv2.cvtColor(small, cv2.COLOR_RGB2BGR))
    if detections is None or len(detections) == 0:
        side = min(CELL, width, height)
        left, top = (width - side) // 2, (height - side) // 2
        return (left, top, left + side, top + side), 0, "center fallback; subject unverified", []
    ranked = sorted(detections, key=lambda row: float(row[2] * row[3] * row[-1]), reverse=True)
    boxes = []
    for face in ranked[:3]:
        x, y, w, h = (float(v) / scale for v in face[:4])
        side = min(max(CELL, round(1.4 * max(w, h))), width, height)
        left = max(0, min(width - side, round(x + w / 2 - side / 2)))
        top = max(0, min(height - side, round(y + h / 2 - side / 2)))
        boxes.append((left, top, left + side, top + side))
    return boxes[0], len(detections), "face candidate 1; inspect all subjects", boxes


def crop_tile(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    crop = image.crop(box)
    if crop.size != (CELL, CELL):
        crop.thumbnail((CELL, CELL), Image.Resampling.LANCZOS)
    tile = Image.new("RGB", (CELL, CELL), (25, 25, 25))
    tile.paste(crop, ((CELL - crop.width) // 2, (CELL - crop.height) // 2))
    return tile


def full_tile(image: Image.Image, candidate_boxes: list[tuple[int, int, int, int]] | None = None) -> Image.Image:
    preview = image.copy()
    preview.thumbnail((CELL, CELL), Image.Resampling.LANCZOS)
    tile = Image.new("RGB", (CELL, CELL), (25, 25, 25))
    offset_x, offset_y = (CELL - preview.width) // 2, (CELL - preview.height) // 2
    tile.paste(preview, (offset_x, offset_y))
    if candidate_boxes:
        draw = ImageDraw.Draw(tile)
        scale_x, scale_y = preview.width / image.width, preview.height / image.height
        for number, box in enumerate(candidate_boxes, 1):
            x1, y1, x2, y2 = box
            scaled = (round(offset_x + x1 * scale_x), round(offset_y + y1 * scale_y),
                      round(offset_x + x2 * scale_x), round(offset_y + y2 * scale_y))
            draw.rectangle(scaled, outline=(255, 145, 0), width=2)
            draw.text((scaled[0] + 2, scaled[1] + 2), str(number), fill="white", stroke_width=1, stroke_fill="black")
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


def crop_tone_metrics(image: Image.Image, box: tuple[int, int, int, int]) -> dict[str, float]:
    """Describe the same native crop without assuming it is skin or the main subject."""
    crop = image.crop(box)
    crop.thumbnail((512, 512), Image.Resampling.LANCZOS)
    pixels = np.asarray(crop.convert("RGB"), dtype=np.uint8)
    lab = cv2.cvtColor(pixels, cv2.COLOR_RGB2LAB)
    hsv = cv2.cvtColor(pixels, cv2.COLOR_RGB2HSV)
    return {
        "median_luma": round(float(np.median(lab[:, :, 0])), 1),
        "p99_luma": round(float(np.percentile(lab[:, :, 0], 99)), 1),
        "nearwhite_any_channel_pct": round(float(np.mean(np.max(pixels, axis=2) >= 253) * 100), 2),
        "nearwhite_all_channels_pct": round(float(np.mean(np.min(pixels, axis=2) >= 253) * 100), 2),
        "median_saturation": round(float(np.median(hsv[:, :, 1])), 1),
        "median_lab_b": round(float(np.median(lab[:, :, 2]) - 128), 1),
    }


def make_sheet(rows: list[dict], destination: Path) -> None:
    sheet = Image.new("RGB", (CELL * 4, (CELL + LABEL) * len(rows)), (25, 25, 25))
    draw = ImageDraw.Draw(sheet)
    for index, row in enumerate(rows):
        y = index * (CELL + LABEL)
        sheet.paste(row.pop("_source_full"), (0, y))
        sheet.paste(row.pop("_output_full"), (CELL, y))
        sheet.paste(row.pop("_source_tile"), (CELL * 2, y))
        sheet.paste(row.pop("_output_tile"), (CELL * 3, y))
        title = (f"{row['key']} | {row['set']} | {row['roi_type']} | "
                 f"focus probe {row['laplacian_var']} | output crop L50 {row['output_crop_median_luma']} "
                 f"near-white {row['output_crop_nearwhite_any_channel_pct']}%")
        draw.text((8, y + CELL + 5), title[:130], fill="white")
        for column, label in enumerate(("ORIGINAL FULL SCENE: FACE CANDIDATES", "EDITED FULL SCENE", "ORIGINAL 100% CROP 1", "EDITED SAME CROP")):
            draw.text((column * CELL + 8, y + CELL + 28), label, fill="#dddddd")
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, "JPEG", quality=88)


def safe_name(value: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-.")[:70] or "set"
    return f"{stem}-{hashlib.sha1(value.encode('utf-8')).hexdigest()[:6]}"


def selected_rows(manifest: dict, manifest_path: Path, keys: set[str] | None) -> tuple[Path, list[dict]]:
    """Normalize the original event manifest and immutable flat gallery revisions."""
    if "rows" in manifest:
        output_root = Path(manifest.get("output_root", manifest_path.parent / "output"))
        selected = [row for row in manifest["rows"] if row.get("upload") and row.get("mode") in {"color", "mono"}]
    elif "items" in manifest:
        output_root = Path(manifest_path.parent / "images")
        if manifest.get("count") != len(manifest["items"]):
            raise ValueError("Flat gallery manifest count differs from items")
        selected = []
        for item in manifest["items"]:
            name = item["file"]
            if Path(name).name != name:
                raise ValueError(f"Unsafe flat gallery filename: {name}")
            selected.append({
                "key": item["key"], "set": item["group"], "source": item["source"],
                "source_sha256": item["source_sha256"], "output": name,
                "output_sha256": item["output_sha256"], "upload": True,
                "mode": "mono" if any(token in item.get("route", "").lower() for token in ("mono", "black-and-white")) else "color",
            })
    else:
        raise ValueError("Manifest has neither event rows nor flat gallery items")
    if len({row["key"] for row in selected}) != len(selected):
        raise ValueError("Selected camera keys are not unique")
    if keys is not None:
        selected = [row for row in selected if row["key"] in keys]
        if len(selected) != len(keys):
            raise ValueError(f"Missing camera keys: {sorted(keys - {row['key'] for row in selected})}")
    return output_root, selected


def run(manifest_path: Path, destination: Path, keys: set[str] | None,
        subject_boxes: dict[str, list[int]] | None = None) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    output_root, selected = selected_rows(manifest, manifest_path, keys)
    subject_boxes = subject_boxes or {}
    unknown = set(subject_boxes) - {row["key"] for row in selected}
    if unknown:
        raise ValueError(f"Subject boxes name unselected camera keys: {sorted(unknown)}")
    if not MODEL.is_file():
        raise FileNotFoundError(f"Pinned local face detector missing: {MODEL}")
    detector = cv2.FaceDetectorYN.create(str(MODEL), "", (1200, 800), score_threshold=0.6)
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
            box, count, roi_type, candidate_boxes = face_roi(source, detector)
            if item["key"] in subject_boxes:
                proposed = subject_boxes[item["key"]]
                if (not isinstance(proposed, list) or len(proposed) != 4
                    or any(not isinstance(value, int) or isinstance(value, bool) for value in proposed)):
                    raise ValueError(f"Invalid subject box for {item['key']}")
                x1, y1, x2, y2 = proposed
                if not (0 <= x1 < x2 <= source.width and 0 <= y1 < y2 <= source.height
                        and x2 - x1 >= 100 and y2 - y1 >= 100):
                    raise ValueError(f"Subject box outside original or too small for {item['key']}")
                box = (x1, y1, x2, y2)
                roi_type = "reviewer-selected subject box; inspect full scene"
                candidate_boxes = [box]
            sharpness, rgb_delta, l_delta = comparison_metrics(source, result, box)
            source_tone = crop_tone_metrics(source, box)
            output_tone = crop_tone_metrics(result, box)
            row = {"key": item["key"], "set": item["set"], "source": str(source_path),
                   "output": str(output_path), "face_candidates": count, "roi_type": roi_type,
                   "crop_xyxy": json.dumps(box), "laplacian_var": sharpness,
                   "top_face_candidate_boxes_xyxy": json.dumps(candidate_boxes),
                   "mean_abs_rgb_delta": rgb_delta, "mean_l_delta": l_delta,
                   **{f"source_crop_{key}": value for key, value in source_tone.items()},
                   **{f"output_crop_{key}": value for key, value in output_tone.items()},
                   "native_subject_focus": "UNREVIEWED", "grade_vs_staff_reference": "UNREVIEWED",
                   "editorial_decision": "REVIEW"}
            report.append(row)
            page = pages.setdefault(item["set"], [])
            page.append({**row, "_source_full": full_tile(source, candidate_boxes), "_output_full": full_tile(result),
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
               "review_state": "UNREVIEWED; detected crops may be the wrong person or a light; tone and focus measurements are triage only"}
    (destination / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--keys", nargs="*", help="Optional camera keys for a focused proof")
    parser.add_argument("--subject-boxes", type=Path,
                        help="Private JSON mapping camera keys to native source [x1,y1,x2,y2] subject crops")
    args = parser.parse_args()
    boxes = json.loads(args.subject_boxes.read_text(encoding="utf-8")) if args.subject_boxes else None
    run(args.manifest, args.out, set(args.keys) if args.keys else None, boxes)


if __name__ == "__main__":
    main()
