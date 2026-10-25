"""Private, reversible JPEG first-pass assistant. No network or original writes."""

from __future__ import annotations

import argparse
import ctypes
import hashlib
import json
import os
import shutil
import sys
import time
from collections import Counter
from io import BytesIO
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageCms, ImageDraw, ImageOps, __version__ as pillow_version

VERSION = "0.3.4"
SETTINGS = {"jpeg_quality": 94, "max_ev": 0.35, "max_wb": 0.025, "max_shadow_lift": 0.07,
            "max_highlight_pull": 0.05, "max_contrast": 0.035, "max_saturation": 0.035}
SUFFIXES = {".jpg", ".jpeg"}
FILE_ATTRIBUTE_OFFLINE = 0x1000
FILE_ATTRIBUTE_RECALL_ON_OPEN = 0x40000
FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS = 0x400000


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def atomic_json(path: Path, value: dict) -> None:
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(temp, path)


def check_paths(source: Path, job: Path) -> None:
    if not source.is_dir():
        raise ValueError("Input must be an existing local folder")
    if source.is_symlink() or job.is_symlink():
        raise ValueError("Symlinked input or job roots are not supported")
    source, job = source.resolve(), job.resolve()
    if source == job or source in job.parents or job in source.parents:
        raise ValueError("Job and source folders must be separate, with neither inside the other")


def source_files(source: Path) -> list[Path]:
    return sorted((p for p in source.iterdir() if p.is_file() and not p.is_symlink()
                   and p.suffix.lower() in SUFFIXES), key=lambda p: p.name.lower())


def online_only(path: Path) -> bool:
    """Inspect Windows cloud-file attributes without reading or hydrating media bytes."""
    if os.name != "nt":
        return False
    get_attributes = ctypes.windll.kernel32.GetFileAttributesW
    get_attributes.argtypes = [ctypes.c_wchar_p]
    get_attributes.restype = ctypes.c_uint32
    attributes = get_attributes(str(path))
    if attributes == 0xFFFFFFFF:
        raise OSError(f"Cannot inspect local file attributes: {path.name}")
    return bool(attributes & (FILE_ATTRIBUTE_OFFLINE | FILE_ATTRIBUTE_RECALL_ON_OPEN |
                              FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS))


def preflight(source: Path, job: Path | None = None, limit: int | None = None,
              onedrive_root: Path | None = None) -> dict:
    """Read only filesystem metadata; never hydrate a OneDrive placeholder."""
    if not source.is_dir():
        raise ValueError("Input must be an existing local folder")
    if job is not None:
        check_paths(source, job)
    if limit is not None and limit < 1:
        raise ValueError("Limit must be at least 1")
    if onedrive_root is not None:
        root = onedrive_root.resolve()
        if not root.is_dir() or not source.resolve().is_relative_to(root):
            raise ValueError("Input is outside the selected OneDrive sync root")
        if source.resolve() == root:
            raise ValueError("Select one shoot folder, not the whole OneDrive root")
    files = source_files(source)
    selected = files[:limit] if limit is not None else files
    if not selected:
        raise ValueError("No JPEG files in input folder")
    offline = [p for p in selected if online_only(p)]
    selected_bytes = sum(p.stat().st_size for p in selected)
    # Output JPEGs, previews and temporary files require space beyond the source bytes.
    required = max(1024**3, selected_bytes * 3 + 100 * 1024**2)
    destination = job if job is not None else source
    while not destination.exists():
        destination = destination.parent
    free = shutil.disk_usage(destination).free
    return {"jpeg_count": len(files), "selected_count": len(selected),
            "selected_bytes": selected_bytes, "online_only_count": len(offline),
            "free_bytes": free, "required_free_bytes": required,
            "ready": not offline and free >= required,
            "onedrive_root_checked": onedrive_root is not None}


def srgb_image(raw: Image.Image) -> tuple[Image.Image, str]:
    oriented = ImageOps.exif_transpose(raw)
    profile = oriented.info.get("icc_profile")
    rgb = oriented.convert("RGB")
    if profile:
        from io import BytesIO
        rgb = ImageCms.profileToProfile(rgb, ImageCms.ImageCmsProfile(BytesIO(profile)),
                                        ImageCms.createProfile("sRGB"), outputMode="RGB")
        return rgb, "converted_from_embedded_icc"
    return rgb, "untagged_assumed_srgb_review"


def face_boxes(small: np.ndarray) -> list[list[int]]:
    cascade_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
    if not cascade_path.is_file():
        return []
    detector = cv2.CascadeClassifier(str(cascade_path))
    gray = cv2.cvtColor(small, cv2.COLOR_RGB2GRAY)
    return [list(map(int, box)) for box in detector.detectMultiScale(gray, scaleFactor=1.12,
            minNeighbors=5, minSize=(32, 32))]


def analyze(image: Image.Image) -> dict:
    thumb = image.copy()
    thumb.thumbnail((960, 960))
    a = np.asarray(thumb, dtype=np.uint8)
    f = a.astype(np.float32) / 255.0
    luma = (f @ np.array([0.2126, 0.7152, 0.0722], np.float32))
    gray = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY)
    faces = face_boxes(a)
    face_luma = [float(np.median(luma[y:y+h, x:x+w])) for x, y, w, h in faces]
    mean_channels = f.reshape(-1, 3).mean(axis=0)
    clipping = ((a <= 2).mean(axis=(0, 1)).tolist(), (a >= 253).mean(axis=(0, 1)).tolist())
    # Focus metric is a weak technical hint, never an automatic rejection.
    focus = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    tiny = cv2.resize(gray, (9, 8), interpolation=cv2.INTER_AREA).astype(np.int16)
    phash = ''.join('1' if v else '0' for v in (tiny[:, 1:] > tiny[:, :-1]).flatten())
    median = float(np.median(luma))
    highlight = float(np.mean(luma > .985))
    shadow = float(np.mean(luma < .08))
    warm = float(mean_channels[0] - mean_channels[2])
    if face_luma and min(face_luma) < .32 and median > .38:
        scene = "backlit_face"
    elif median < .27:
        scene = "low_light"
    elif warm > .09:
        scene = "warm_or_mixed_light_review"
    elif median > .63:
        scene = "bright_daylight"
    else:
        scene = "balanced_or_unknown"
    return {"scene": scene, "median_luma": round(median, 4), "shadow_fraction": round(shadow, 4),
            "highlight_fraction": round(highlight, 4), "rgb_dark_fraction": [round(x, 4) for x in clipping[0]],
            "rgb_clipped_fraction": [round(x, 4) for x in clipping[1]], "warm_channel_bias": round(warm, 4),
            "focus_hint": round(focus, 2), "face_count_hint": len(faces),
            "face_median_luma_hint": [round(v, 4) for v in face_luma], "dhash": phash}


def settings_for(a: dict) -> dict:
    median = a["median_luma"]
    scene = a["scene"]
    ev = float(np.clip(np.log2(.46 / max(median, .08)) * .30, -.25, SETTINGS["max_ev"]))
    if scene == "low_light":
        ev = min(ev, .22)  # preserve event atmosphere and avoid amplifying JPEG noise
    if scene == "balanced_or_unknown" and .36 <= median <= .57:
        ev = 0.0
    shadow = min(SETTINGS["max_shadow_lift"], a["shadow_fraction"] * .18)
    if scene == "low_light":
        shadow *= .35
    if scene == "backlit_face":
        shadow = min(SETTINGS["max_shadow_lift"], shadow + .025)
    highlight = min(SETTINGS["max_highlight_pull"], a["highlight_fraction"] * .5)
    # A JPEG cannot regain clipped channels; avoid aggressive highlight tricks.
    if max(a["rgb_clipped_fraction"]) > .04:
        highlight = min(highlight, .025)
    wb = 0.0
    if scene != "warm_or_mixed_light_review" and abs(a["warm_channel_bias"]) > .055:
        wb = float(np.clip(-a["warm_channel_bias"] * .12, -SETTINGS["max_wb"], SETTINGS["max_wb"]))
    return {"exposure_ev": round(ev, 4), "shadow_lift": round(shadow, 4),
            "highlight_pull": round(highlight, 4), "red_blue_balance": round(wb, 4),
            "contrast": .015 if scene == "balanced_or_unknown" else 0.0,
            "saturation": .01 if scene not in ("low_light", "warm_or_mixed_light_review") else 0.0,
            "sharpen": "none_for_jpeg"}


def finish(image: Image.Image, settings: dict, analysis: dict) -> Image.Image:
    a = np.asarray(image, dtype=np.float32) / 255.0
    ev = settings["exposure_ev"]
    a *= 2 ** ev
    luma = a @ np.array([.2126, .7152, .0722], np.float32)
    lift = settings["shadow_lift"] * np.square(np.clip(1 - luma / .65, 0, 1))
    pull = settings["highlight_pull"] * np.square(np.clip((luma - .65) / .35, 0, 1))
    a = a + lift[..., None] - pull[..., None]
    wb = settings["red_blue_balance"]
    a[..., 0] *= (1 + wb)
    a[..., 2] *= (1 - wb)
    a = np.clip((a - .5) * (1 + settings["contrast"]) + .5, 0, 1)
    gray = (a @ np.array([.2126, .7152, .0722], np.float32))[..., None]
    a = np.clip(gray + (a - gray) * (1 + settings["saturation"]), 0, 1)
    return Image.fromarray(np.uint8(np.round(a * 255)), "RGB")


def make_preview(original: Image.Image, edited: Image.Image, path: Path) -> None:
    halves = []
    for image in (original, edited):
        copy = image.copy()
        copy.thumbnail((640, 640))
        halves.append(copy)
    canvas = Image.new("RGB", (1280, 680), "#252525")
    draw = ImageDraw.Draw(canvas)
    for index, im in enumerate(halves):
        canvas.paste(im, (index * 640 + (640 - im.width) // 2, 30 + (640 - im.height) // 2))
    draw.text((12, 8), "BEFORE", fill="white")
    draw.text((652, 8), "PICASSO FIRST PASS", fill="white")
    canvas.save(path, "JPEG", quality=88)


def contact_sheet(job: Path, rows: list[dict]) -> None:
    good = [r for r in rows if r.get("preview") and (job / r["preview"]).exists()]
    if not good:
        return
    tile_w, tile_h, cols, page_size = 640, 360, 2, 50
    for page, start in enumerate(range(0, len(good), page_size)):
        group = good[start:start + page_size]
        sheet = Image.new("RGB", (tile_w * cols, tile_h * ((len(group) + cols - 1) // cols)), "#252525")
        draw = ImageDraw.Draw(sheet)
        for idx, row in enumerate(group):
            with Image.open(job / row["preview"]) as source:
                im = source.copy()
            im.thumbnail((tile_w - 12, tile_h - 44))
            x, y = (idx % cols) * tile_w, (idx // cols) * tile_h
            sheet.paste(im, (x + (tile_w - im.width) // 2, y + 20))
            draw.text((x + 8, y + 4), f'{row["id"]}  {row["classification"]}', fill="white")
        name = "contact-sheet.jpg" if page == 0 else f"contact-sheet-{page + 1:03d}.jpg"
        sheet.save(job / name, "JPEG", quality=88)


def run(source: Path, job: Path, limit: int | None,
        onedrive_root: Path | None = None) -> int:
    readiness = preflight(source, job, limit, onedrive_root)
    if readiness["online_only_count"]:
        raise ValueError("Selected OneDrive JPEGs are online-only; make this shoot available locally first")
    if readiness["free_bytes"] < readiness["required_free_bytes"]:
        raise ValueError("Not enough free space for a separate private job and exports")
    files = source_files(source)
    if limit is not None:
        files = files[:limit]
    if not files:
        raise ValueError("No JPEG files in input folder")
    job.mkdir(parents=True, exist_ok=True)
    (job / "output").mkdir(exist_ok=True)
    (job / "previews").mkdir(exist_ok=True)
    if (job / "output").is_symlink() or (job / "previews").is_symlink():
        raise ValueError("Symlinked job output folders are not supported")
    manifest_path = job / "manifest.json"
    existing = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else None
    if existing and (Path(existing["source_root"]).resolve() != source.resolve() or existing["settings"] != SETTINGS):
        raise ValueError("Existing job source or settings differ; create a new job folder")
    if existing and [r["source_name"] for r in existing["items"]] != [p.name for p in files]:
        raise ValueError("Source inventory changed; create a new job folder to avoid ambiguous outputs")
    rows = {row["source_name"]: row for row in existing["items"]} if existing else {}
    manifest = {"picasso_version": VERSION, "source_root": str(source.resolve()), "settings": SETTINGS,
                "runtime": {"python": sys.version.split()[0], "pillow": pillow_version, "opencv": cv2.__version__},
                "started_at": existing["started_at"] if existing else datetime.now().isoformat(),
                "delivery_approved": False, "internal_review_approval": None,
                "classification_history": existing.get("classification_history", []) if existing else [],
                "revisions": existing.get("revisions", []) if existing else [], "items": []}
    start = time.monotonic()
    hashes = []
    resumed = set()
    for index, path in enumerate(files):
        name = path.name
        old = rows.get(name)
        ident = f"{index + 1:04d}"
        output = job / "output" / f"{ident}.jpg"
        preview = job / "previews" / f"{ident}.jpg"
        row = {"id": ident, "source_name": name, "source_sha256": None, "classification": "REVIEW",
               "status": "pending", "review_note": "", "output": str(output.relative_to(job)),
               "preview": str(preview.relative_to(job))}
        try:
            row["source_sha256"] = digest(path)
            if (old and old.get("source_sha256") == row["source_sha256"] and old.get("status") == "complete"
                    and output.exists() and preview.exists() and digest(output) == old.get("output_sha256")):
                row = old
                resumed.add(name)
            else:
                with Image.open(path) as raw:
                    if raw.format not in {"JPEG", "MPO"}:
                        raise ValueError("File is not a JPEG-compatible image")
                    row["source_container"] = raw.format
                    row["source_frames"] = getattr(raw, "n_frames", 1)
                    if raw.format == "MPO":
                        raw.seek(0)  # Use the full-size primary JPEG, never an auxiliary frame.
                    image, color_note = srgb_image(raw)
                metrics = analyze(image)
                adjustments = settings_for(metrics)
                edited = finish(image, adjustments, metrics)
                # One final JPEG encode. No source EXIF, GPS, or private metadata copied.
                profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
                temp = output.with_suffix(".tmp")
                edited.save(temp, "JPEG", quality=SETTINGS["jpeg_quality"], subsampling=0, icc_profile=profile)
                os.replace(temp, output)
                make_preview(image, edited, preview)
                row.update(status="complete", classification="REVIEW" if color_note.startswith("untagged") or
                           metrics["scene"] == "warm_or_mixed_light_review" else "KEEP",
                           color_management=color_note, dimensions=list(image.size), analysis=metrics,
                           adjustments=adjustments, output_sha256=digest(output))
            hashes.append((name, row))
        except Exception as error:
            row.update(status="error", error=f"{type(error).__name__}: {error}", classification="REVIEW")
        manifest["items"].append(row)
        atomic_json(manifest_path, manifest)
    # Similarity is advisory. Keep the hint even when colour review takes precedence.
    for i, (name, row) in enumerate(hashes):
        if row["status"] != "complete":
            continue
        row.pop("similarity_hint", None)
        nearest = None
        for prior_name, prior in hashes[:i]:
            if prior.get("status") == "complete" and prior.get("analysis") and row.get("analysis"):
                distance = sum(a != b for a, b in zip(row["analysis"]["dhash"], prior["analysis"]["dhash"]))
                if nearest is None or distance < nearest[0]:
                    nearest = (distance, prior["id"])
        if nearest and nearest[0] <= 7:
            row["similarity_hint"] = {"nearest_id": nearest[1], "dhash_distance": nearest[0]}
            if name not in resumed and row["classification"] == "KEEP":
                row["classification"] = "ALTERNATE"
                row["review_note"] = f"Visual similarity to {nearest[1]}; keep documentary moments manually"
    manifest["elapsed_seconds_last_run"] = round(time.monotonic() - start, 2)
    manifest["items"] = [next((r for n, r in hashes if n == item["source_name"]), item)
                         for item in manifest["items"]]
    approval = existing.get("internal_review_approval") if existing else None
    if approval:
        current = {r["id"]: r for r in manifest["items"]}
        if all((ident in current and current[ident]["status"] == "complete"
                and current[ident]["output_sha256"] == expected
                and current[ident]["classification"] == approval["classifications"][ident])
               for ident, expected in approval.get("base_outputs", approval["outputs"]).items()):
            manifest["internal_review_approval"] = approval
            try:
                verified_review_selection(job, manifest)
            except (ValueError, OSError):
                manifest["internal_review_approval"] = None
    contact_sheet(job, manifest["items"])
    atomic_json(manifest_path, manifest)
    counts = {key: sum(r["classification"] == key for r in manifest["items"]) for key in ("KEEP", "REVIEW", "ALTERNATE")}
    print(json.dumps({"job": str(job.resolve()), "total": len(files), "counts": counts,
                      "errors": sum(r["status"] == "error" for r in manifest["items"]),
                      "seconds": manifest["elapsed_seconds_last_run"],
                      "internal_review_approved": bool(manifest["internal_review_approval"])}))
    return 1 if any(r["status"] == "error" for r in manifest["items"]) else 0


def verified_review_selection(job: Path, manifest: dict) -> list[tuple[dict, Path]]:
    approval = manifest.get("internal_review_approval")
    if not approval or not approval.get("outputs"):
        raise ValueError("A human must approve specific image IDs for internal review first")
    rows = {row["id"]: row for row in manifest["items"]}
    selected = []
    job_root = job.resolve()
    for ident, expected in approval["outputs"].items():
        row = rows.get(ident)
        if not row or row["status"] != "complete" or row["classification"] != approval["classifications"][ident]:
            raise ValueError(f"Review selection changed for image {ident}; approve again")
        relative = approval.get("paths", {}).get(ident, row["output"])
        permitted = {row["output"]} | {r["output"] for r in manifest.get("revisions", [])
                                       if r["id"] == ident and r["source_sha256"] == row["source_sha256"]}
        if relative not in permitted:
            raise ValueError(f"Approved export path is invalid for image {ident}; approve again")
        output = (job / relative).resolve()
        if not output.is_relative_to(job_root) or not output.is_file() or digest(output) != expected:
            raise ValueError(f"Approved export changed or is missing for image {ident}; approve again")
        selected.append((row, output))
    return selected


def approve_review(job: Path, reviewer: str, ids: list[str], latest_revisions: bool = False) -> dict:
    if not reviewer.strip() or not ids or len(ids) != len(set(ids)):
        raise ValueError("Name the human reviewer and distinct image IDs")
    path = job / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if any(row["status"] == "error" for row in manifest["items"]):
        raise ValueError("Resolve or explicitly exclude failed source files before review approval")
    rows = {row["id"]: row for row in manifest["items"]}
    outputs = {}
    base_outputs = {}
    paths = {}
    classifications = {}
    output_root = (job / "output").resolve()
    for ident in ids:
        row = rows.get(ident)
        if not row or row["status"] != "complete":
            raise ValueError(f"Image {ident} is not a completed job item")
        output = (job / row["output"]).resolve()
        if not output.is_relative_to(output_root) or not output.is_file() or digest(output) != row["output_sha256"]:
            raise ValueError(f"Image {ident} output failed its hash check")
        base_outputs[ident] = row["output_sha256"]
        selected_path = row["output"]
        selected_hash = row["output_sha256"]
        if latest_revisions:
            revisions = [r for r in manifest.get("revisions", []) if r["id"] == ident]
            if revisions:
                revision = revisions[-1]
                if revision["source_sha256"] != row["source_sha256"]:
                    raise ValueError(f"Image {ident} revision source changed; amend again")
                selected_path = revision["output"]
                selected_hash = revision["output_sha256"]
                revision_file = (job / selected_path).resolve()
                if not revision_file.is_relative_to(job.resolve()) or digest(revision_file) != selected_hash:
                    raise ValueError(f"Image {ident} latest revision failed its hash check")
        outputs[ident] = selected_hash
        paths[ident] = selected_path
        classifications[ident] = row["classification"]
    token = hashlib.sha256(json.dumps({"outputs": outputs, "paths": paths, "classifications": classifications},
                                   sort_keys=True).encode("utf-8")).hexdigest()[:12]
    manifest["internal_review_approval"] = {"reviewer": reviewer.strip(), "approved_at": datetime.now().isoformat(),
                                             "outputs": outputs, "base_outputs": base_outputs,
                                             "paths": paths, "classifications": classifications,
                                             "stage_folder": f"review-upload/{token}"}
    atomic_json(path, manifest)
    return {"approved_count": len(outputs), "scope": "internal_pixieset_review_only",
            "stage_folder": manifest["internal_review_approval"]["stage_folder"]}


def prepare_review(job: Path) -> dict:
    manifest = json.loads((job / "manifest.json").read_text(encoding="utf-8"))
    selected = verified_review_selection(job, manifest)
    parent = job / "review-upload"
    staging = job / manifest["internal_review_approval"]["stage_folder"]
    if parent.is_symlink() or staging.is_symlink() or not staging.resolve().is_relative_to(job.resolve()):
        raise ValueError("Symlinked review upload folder is not supported")
    expected_names = {f'{row["id"]}_{Path(row["source_name"]).stem}.jpg' for row, _ in selected}
    if staging.exists() and {p.name for p in staging.iterdir()} != expected_names:
        raise ValueError("Existing review upload folder differs from approval; use a new job or resolve manually")
    staging.mkdir(parents=True, exist_ok=True)
    for row, source in selected:
        target = staging / f'{row["id"]}_{Path(row["source_name"]).stem}.jpg'
        if target.is_symlink():
            raise ValueError(f"Symlinked staged image {row['id']} is not supported")
        if target.exists():
            if digest(target) != manifest["internal_review_approval"]["outputs"][row["id"]]:
                raise ValueError(f"Staged image {row['id']} differs from approval")
            continue
        temporary = target.with_suffix(".tmp")
        shutil.copyfile(source, temporary)
        if digest(temporary) != manifest["internal_review_approval"]["outputs"][row["id"]]:
            temporary.unlink()
            raise ValueError(f"Staging copy failed hash check for image {row['id']}")
        os.replace(temporary, target)
    return {"staged_count": len(selected), "scope": "internal_pixieset_review_only",
            "stage_folder": str(staging.resolve()),
            "pixieset_published": False, "whatsapp_sent": False}


def amend(job: Path, ident: str, reviewer: str, request: str, overrides: dict) -> dict:
    """Render a new, bounded revision directly from the unchanged source JPEG."""
    if not reviewer.strip() or not request.strip() or not overrides:
        raise ValueError("Name the reviewer, the requested change, and at least one adjustment")
    allowed = {"exposure_ev": (-.35, .35), "shadow_lift": (0, .07),
               "highlight_pull": (0, .05), "red_blue_balance": (-.025, .025),
               "contrast": (-.035, .035), "saturation": (-.035, .035)}
    if any(k not in allowed or not allowed[k][0] <= v <= allowed[k][1] for k, v in overrides.items()):
        raise ValueError("Requested adjustment exceeds conservative JPEG limits")
    manifest_path = job / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    row = next((r for r in manifest["items"] if r["id"] == ident), None)
    if not row or row["status"] != "complete":
        raise ValueError("Amendment requires a completed image ID")
    source = Path(manifest["source_root"]) / row["source_name"]
    if source.is_symlink() or digest(source) != row["source_sha256"]:
        raise ValueError("Source changed or is unavailable; create a new job")
    revisions = manifest.setdefault("revisions", [])
    for old in reversed(revisions):
        if old["id"] == ident and old["reviewer"] == reviewer.strip() and old["request"] == request.strip() \
                and old["overrides"] == overrides and old["source_sha256"] == row["source_sha256"]:
            candidate = job / old["output"]
            if candidate.is_file() and digest(candidate) == old["output_sha256"]:
                return {"revision": old["revision"], "output": str(candidate.resolve()), "reused": True}
    revision_root = job / "revisions"
    existing_numbers = [int(p.name[1:]) for p in revision_root.iterdir()
                        if p.is_dir() and p.name.startswith("r") and p.name[1:].isdigit()] if revision_root.exists() else []
    number = 1 + max([r["revision"] for r in revisions] + existing_numbers, default=0)
    directory = job / "revisions" / f"r{number:03d}"
    if directory.is_symlink():
        raise ValueError("Symlinked revision folder is not supported")
    directory.mkdir(parents=True, exist_ok=False)
    with Image.open(source) as raw:
        if raw.format not in {"JPEG", "MPO"}:
            raise ValueError("Source is not a JPEG-compatible image")
        if raw.format == "MPO":
            raw.seek(0)
        image, color_note = srgb_image(raw)
    metrics = analyze(image)
    settings = settings_for(metrics)
    settings.update(overrides)
    edited = finish(image, settings, metrics)
    profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    output = directory / f"{ident}.jpg"
    edited.save(output, "JPEG", quality=SETTINGS["jpeg_quality"], subsampling=0, icc_profile=profile)
    preview = directory / f"{ident}-preview.jpg"
    make_preview(image, edited, preview)
    record = {"revision": number, "id": ident, "reviewer": reviewer.strip(),
              "request": request.strip(), "overrides": overrides,
              "settings": settings, "source_sha256": row["source_sha256"],
              "output": str(output.relative_to(job)), "output_sha256": digest(output),
              "preview": str(preview.relative_to(job)), "color_management": color_note,
              "created_at": datetime.now().isoformat()}
    revisions.append(record)
    manifest["internal_review_approval"] = None
    atomic_json(manifest_path, manifest)
    return {"revision": number, "output": str(output.resolve()), "reused": False,
            "internal_review_approved": False}


def classify(job: Path, ident: str, decision: str, reviewer: str, reason: str) -> dict:
    """Reversibly record a human cull decision without touching image bytes."""
    if decision not in {"KEEP", "ALTERNATE", "REVIEW"} or not reviewer.strip() or not reason.strip():
        raise ValueError("Name a KEEP/ALTERNATE/REVIEW decision, reviewer, and reason")
    manifest_path = job / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    row = next((r for r in manifest["items"] if r["id"] == ident), None)
    if not row or row["status"] != "complete":
        raise ValueError("Cull decision requires a completed image ID")
    history = manifest.setdefault("classification_history", [])
    if row["classification"] == decision and history and all(
        history[-1].get(key) == value for key, value in
        {"id": ident, "decision": decision, "reviewer": reviewer.strip(), "reason": reason.strip()}.items()
    ):
        return {"id": ident, "classification": decision, "reused": True}
    previous = row["classification"]
    row["classification"] = decision
    row["review_note"] = reason.strip()
    history.append({"id": ident, "previous": previous, "decision": decision,
                    "reviewer": reviewer.strip(), "reason": reason.strip(),
                    "changed_at": datetime.now().isoformat()})
    manifest["internal_review_approval"] = None
    contact_sheet(job, manifest["items"])
    atomic_json(manifest_path, manifest)
    return {"id": ident, "previous": previous, "classification": decision,
            "reused": False, "internal_review_approved": False}


def verify(job: Path) -> dict:
    """Check private job exports against their sources without writing or re-encoding."""
    manifest = json.loads((job / "manifest.json").read_text(encoding="utf-8"))
    source_root = Path(manifest["source_root"]).resolve()
    output_root = (job / "output").resolve()
    failures = []
    scene_counts = Counter()
    classification_counts = Counter()
    for row in manifest["items"]:
        ident = row["id"]
        classification_counts[row["classification"]] += 1
        if row["status"] != "complete":
            failures.append({"id": ident, "reason": "incomplete"})
            continue
        scene_counts[row["analysis"]["scene"]] += 1
        source = (source_root / row["source_name"]).resolve()
        output = (job / row["output"]).resolve()
        if (not source.is_relative_to(source_root) or not output.is_relative_to(output_root)
                or not source.is_file() or not output.is_file()):
            failures.append({"id": ident, "reason": "missing_or_outside_job"})
            continue
        if digest(source) != row["source_sha256"] or digest(output) != row["output_sha256"]:
            failures.append({"id": ident, "reason": "hash_mismatch"})
            continue
        try:
            with Image.open(source) as original, Image.open(output) as export:
                source_format = original.format
                if source_format == "MPO":
                    original.seek(0)
                profile_bytes = export.info.get("icc_profile")
                profile_name = (ImageCms.getProfileName(ImageCms.ImageCmsProfile(BytesIO(profile_bytes)))
                                if profile_bytes else "")
                if (source_format not in {"JPEG", "MPO"} or export.format != "JPEG"
                        or (row.get("source_container") and row["source_container"] != source_format)
                        or (row.get("source_frames") and row["source_frames"] != getattr(original, "n_frames", 1))
                        or list(ImageOps.exif_transpose(original).size) != row["dimensions"]
                        or list(export.size) != row["dimensions"]
                        or export.mode != "RGB" or len(export.getexif()) != 0
                        or "srgb" not in profile_name.lower()):
                    failures.append({"id": ident, "reason": "jpeg_dimensions_profile_or_exif"})
        except (OSError, ValueError, TypeError):
            failures.append({"id": ident, "reason": "decode_or_profile_error"})
    return {"version": manifest["picasso_version"], "total": len(manifest["items"]),
            "verified": len(manifest["items"]) - len(failures), "failures": failures,
            "scenes": dict(scene_counts), "classifications": dict(classification_counts),
            "multiple_scene_labels_detected": len(scene_counts) >= 2,
            "human_quality_approved": False,
            "internal_review_approved": bool(manifest.get("internal_review_approval"))}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    launch = sub.add_parser("run", help="Analyze, first-pass edit, preview, and resume a local JPEG job")
    launch.add_argument("--input", type=Path, required=True)
    launch.add_argument("--job", type=Path, required=True)
    launch.add_argument("--limit", type=int)
    launch.add_argument("--onedrive-root", type=Path,
                        help="Explicit sync root; refuse an input outside this root")
    inspect = sub.add_parser("preflight", help="Check JPEG count, hydration and disk space without reading pixels")
    inspect.add_argument("--input", type=Path, required=True)
    inspect.add_argument("--job", type=Path)
    inspect.add_argument("--limit", type=int)
    inspect.add_argument("--onedrive-root", type=Path)
    status = sub.add_parser("status", help="Summarize a job without displaying private filenames")
    status.add_argument("--job", type=Path, required=True)
    approve = sub.add_parser("approve-review", help="Record explicit human approval of selected outputs for internal review")
    approve.add_argument("--job", type=Path, required=True)
    approve.add_argument("--reviewer", required=True)
    approve.add_argument("--ids", nargs="+", required=True)
    approve.add_argument("--latest-revisions", action="store_true",
                         help="Use latest amendment for each selected image when present")
    stage = sub.add_parser("prepare-review", help="Copy approved JPEGs once to a private Pixieset upload folder")
    stage.add_argument("--job", type=Path, required=True)
    change = sub.add_parser("amend", help="Render a new conservative revision from the source JPEG")
    change.add_argument("--job", type=Path, required=True)
    change.add_argument("--id", required=True)
    change.add_argument("--reviewer", required=True)
    change.add_argument("--request", required=True)
    for name in ("exposure-ev", "shadow-lift", "highlight-pull", "red-blue-balance", "contrast", "saturation"):
        change.add_argument(f"--{name}", type=float)
    cull = sub.add_parser("classify", help="Record a reversible human KEEP/ALTERNATE/REVIEW decision")
    cull.add_argument("--job", type=Path, required=True)
    cull.add_argument("--id", required=True)
    cull.add_argument("--decision", choices=("KEEP", "ALTERNATE", "REVIEW"), required=True)
    cull.add_argument("--reviewer", required=True)
    cull.add_argument("--reason", required=True)
    qc = sub.add_parser("verify", help="Check source/output hashes, JPEG dimensions, sRGB profile and EXIF")
    qc.add_argument("--job", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.action == "run":
            return run(args.input, args.job, args.limit, args.onedrive_root)
        if args.action == "preflight":
            result = preflight(args.input, args.job, args.limit, args.onedrive_root)
            print(json.dumps(result))
            return 0 if result["ready"] else 1
        if args.action == "approve-review":
            print(json.dumps(approve_review(args.job, args.reviewer, args.ids, args.latest_revisions)))
            return 0
        if args.action == "prepare-review":
            print(json.dumps(prepare_review(args.job)))
            return 0
        if args.action == "amend":
            overrides = {key: getattr(args, key) for key in
                         ("exposure_ev", "shadow_lift", "highlight_pull", "red_blue_balance", "contrast", "saturation")
                         if getattr(args, key) is not None}
            print(json.dumps(amend(args.job, args.id, args.reviewer, args.request, overrides)))
            return 0
        if args.action == "classify":
            print(json.dumps(classify(args.job, args.id, args.decision, args.reviewer, args.reason)))
            return 0
        if args.action == "verify":
            result = verify(args.job)
            print(json.dumps(result))
            return 0 if not result["failures"] else 1
        data = json.loads((args.job / "manifest.json").read_text(encoding="utf-8"))
        print(json.dumps({"version": data["picasso_version"], "total": len(data["items"]),
                          "complete": sum(x["status"] == "complete" for x in data["items"]),
                          "errors": sum(x["status"] == "error" for x in data["items"]),
                          "revisions": len(data.get("revisions", [])),
                          "human_cull_decisions": len(data.get("classification_history", [])),
                          "internal_review_approved": bool(data.get("internal_review_approval")),
                          "client_delivery_approved": data.get("delivery_approved", False)}))
        return 0
    except Exception as error:
        print(f"PICASSO: {type(error).__name__}: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
