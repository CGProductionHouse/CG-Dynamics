"""Private index-first culling ledger for large JPEG shoots; never edits or deletes originals."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

from picasso import analyze, digest, online_only, srgb_image


VERSION = "0.3.0"
SUFFIXES = {".jpg", ".jpeg"}
DECISIONS = {"KEEP", "ALTERNATE", "REVIEW", "EXCLUDE"}
FIELDS = ["id", "root", "relative", "source", "source_sha256", "bytes", "capture_time",
          "time_basis", "width", "height", "burst", "near_duplicate_of", "scene",
          "focus_hint", "face_count_hint", "median_luma", "status", "decision", "reviewer", "reason"]


def linked_dir(path: Path) -> bool:
    return path.is_symlink() or getattr(path, "is_junction", lambda: False)()


def file_inventory(roots: list[Path], job: Path) -> list[tuple[int, Path, Path]]:
    if not roots or len({str(root.resolve()).casefold() for root in roots}) != len(roots):
        raise ValueError("Provide distinct approved shoot folders")
    resolved_roots = [root.resolve() for root in roots]
    if any(a in b.parents or b in a.parents for index, a in enumerate(resolved_roots)
           for b in resolved_roots[index + 1:]):
        raise ValueError("Input roots overlap; select each approved source only once")
    inventory = []
    for number, root in enumerate(roots, 1):
        if not root.is_dir() or linked_dir(root):
            raise ValueError(f"Input is not a local folder: {root}")
        resolved = root.resolve()
        target = job.resolve()
        if resolved == target or resolved in target.parents or target in resolved.parents:
            raise ValueError("The private index job must be separate from every source folder")
        for parent, directories, filenames in os.walk(resolved, followlinks=False):
            if any(linked_dir(Path(parent) / name) for name in directories):
                raise ValueError(f"Linked source directory in {parent}")
            for name in filenames:
                path = Path(parent) / name
                if path.suffix.lower() in SUFFIXES:
                    if path.is_symlink() or not path.resolve().is_relative_to(resolved):
                        raise ValueError(f"Symlinked or escaping source file: {path}")
                    inventory.append((number, path.relative_to(resolved), path))
    inventory.sort(key=lambda row: (row[0], str(row[1]).casefold()))
    if not inventory:
        raise ValueError("No JPEGs in the selected shoot folders")
    return inventory


def connect(job: Path) -> sqlite3.Connection:
    database = job / "index.sqlite3"
    connection = sqlite3.connect(database)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.executescript("""
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS photos (
            id TEXT PRIMARY KEY, root INTEGER NOT NULL, relative TEXT NOT NULL,
            source TEXT NOT NULL UNIQUE, bytes INTEGER NOT NULL, mtime_ns INTEGER NOT NULL,
            source_sha256 TEXT, capture_time TEXT, time_basis TEXT,
            width INTEGER, height INTEGER, analysis TEXT, thumb TEXT,
            burst TEXT, near_duplicate_of TEXT, status TEXT NOT NULL,
            decision TEXT NOT NULL DEFAULT 'REVIEW', reviewer TEXT NOT NULL DEFAULT '',
            reason TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS decisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT, photo_id TEXT NOT NULL,
            old_decision TEXT NOT NULL, new_decision TEXT NOT NULL,
            reviewer TEXT NOT NULL, reason TEXT NOT NULL, at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS burst_reviews (
            burst TEXT PRIMARY KEY, reviewer TEXT NOT NULL,
            note TEXT NOT NULL, at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS burst_review_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT, burst TEXT NOT NULL,
            reviewer TEXT NOT NULL, note TEXT NOT NULL, at TEXT NOT NULL
        );
    """)
    return connection


def capture_time(image: Image.Image, stat: os.stat_result) -> tuple[str, str]:
    exif = image.getexif()
    value = exif.get_ifd(34665).get(36867) or exif.get(36867) or exif.get(306)
    if value:
        try:
            return datetime.strptime(str(value), "%Y:%m:%d %H:%M:%S").isoformat(), "camera_exif_second"
        except ValueError:
            pass
    return datetime.fromtimestamp(stat.st_mtime).isoformat(), "file_mtime_fallback"


def photo_id(root: int, relative: Path) -> str:
    key = f"{root}:{relative.as_posix()}".encode("utf-8")
    return f"r{root}-{hashlib.sha256(key).hexdigest()[:16]}"


def quick_analysis(image: Image.Image) -> dict:
    """Cheap whole-frame hints; Lightroom handles subject and eye judgments."""
    pixels = np.asarray(image, dtype=np.uint8)
    gray = cv2.cvtColor(pixels, cv2.COLOR_RGB2GRAY)
    tiny = cv2.resize(gray, (9, 8), interpolation=cv2.INTER_AREA).astype(np.int16)
    return {"scene": "unclassified_preview", "focus_hint": round(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 2),
            "face_count_hint": None, "median_luma": round(float(np.median(gray)) / 255, 4),
            "dhash": "".join("1" if bit else "0" for bit in (tiny[:, 1:] > tiny[:, :-1]).flat)}


def index_one(root: int, relative: Path, path: Path, job: Path, mode: str = "fast") -> dict:
    if online_only(path):
        raise ValueError("Online-only OneDrive placeholder; pin the approved shoot locally")
    before = path.stat()
    source_hash = digest(path)
    with Image.open(path) as raw:
        if raw.format not in {"JPEG", "MPO"}:
            raise ValueError("The source is not a JPEG-compatible image")
        when, basis = capture_time(raw, before)
        width, height = raw.size
        if raw.getexif().get(274, 1) in {5, 6, 7, 8}:
            width, height = height, width
        raw.draft("RGB", (1200, 1200) if mode == "detailed" else (600, 600))
        proxy, colour = srgb_image(raw)
        proxy.thumbnail((960, 960) if mode == "detailed" else (500, 500), Image.Resampling.LANCZOS)
        analysis = analyze(proxy) if mode == "detailed" else quick_analysis(proxy)
        preview = proxy.copy()
        preview.thumbnail((440, 440), Image.Resampling.LANCZOS)
    after = path.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise ValueError("Source changed during indexing")
    ident = photo_id(root, relative)
    thumb = job / "thumbs" / f"{ident}.jpg"
    thumb.parent.mkdir(parents=True, exist_ok=True)
    temporary = thumb.with_suffix(".tmp")
    preview.save(temporary, "JPEG", quality=82, optimize=True)
    os.replace(temporary, thumb)
    return {"source_sha256": source_hash, "capture_time": when, "time_basis": basis,
            "width": width, "height": height,
            "analysis": json.dumps({**analysis, "colour_management": colour}),
            "thumb": str(thumb.relative_to(job)), "status": "indexed", "error": ""}


def group_bursts(connection: sqlite3.Connection) -> None:
    rows = connection.execute("SELECT id, root, capture_time, analysis FROM photos WHERE status='indexed' "
                              "ORDER BY root, capture_time, relative").fetchall()
    previous = None
    burst_number = 0
    burst_size = 0
    for row in rows:
        instant = datetime.fromisoformat(row["capture_time"])
        if (previous is None or row["root"] != previous["root"] or
                (instant - previous["instant"]).total_seconds() > 2 or
                (instant - previous["instant"]).total_seconds() < 0 or burst_size >= 40):
            burst_number += 1
            burst_size = 0
            previous_hash = None
            previous_id = None
        visual_hash = json.loads(row["analysis"])["dhash"]
        distance = sum(a != b for a, b in zip(visual_hash, previous_hash)) if previous_hash else 64
        connection.execute("UPDATE photos SET burst=?, near_duplicate_of=? WHERE id=?",
                           (f"B{burst_number:05d}", previous_id if distance <= 6 else None, row["id"]))
        previous = {"root": row["root"], "instant": instant}
        previous_hash, previous_id = visual_hash, row["id"]
        burst_size += 1
    connection.commit()


def write_review(connection: sqlite3.Connection, job: Path) -> None:
    rows = connection.execute("SELECT * FROM photos ORDER BY root, capture_time, relative").fetchall()
    temporary = job / "review.csv.tmp"
    with temporary.open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.DictWriter(stream, FIELDS)
        writer.writeheader()
        for row in rows:
            analysis = json.loads(row["analysis"]) if row["analysis"] else {}
            writer.writerow({"id": row["id"], "root": row["root"], "relative": row["relative"],
                             "source": row["source"], "source_sha256": row["source_sha256"],
                             "bytes": row["bytes"], "capture_time": row["capture_time"],
                             "time_basis": row["time_basis"], "width": row["width"],
                             "height": row["height"], "burst": row["burst"],
                             "near_duplicate_of": row["near_duplicate_of"], "scene": analysis.get("scene"),
                             "focus_hint": analysis.get("focus_hint"),
                             "face_count_hint": analysis.get("face_count_hint"),
                             "median_luma": analysis.get("median_luma"), "status": row["status"],
                             "decision": row["decision"], "reviewer": row["reviewer"], "reason": row["reason"]})
    os.replace(temporary, job / "review.csv")


def contact_sheets(connection: sqlite3.Connection, job: Path) -> None:
    from PIL import ImageDraw
    rows = connection.execute("SELECT id,relative,burst,thumb FROM photos WHERE status='indexed' "
                              "ORDER BY root,capture_time,relative").fetchall()
    sheets = job / "contact-sheets"
    sheets.mkdir(exist_ok=True)
    for page, start in enumerate(range(0, len(rows), 50), 1):
        canvas = Image.new("RGB", (1250, 1900), (25, 25, 25))
        draw = ImageDraw.Draw(canvas)
        for position, row in enumerate(rows[start:start + 50]):
            x, y = (position % 5) * 250, (position // 5) * 190
            with Image.open(job / row["thumb"]) as raw:
                image = raw.copy()
            image.thumbnail((238, 145), Image.Resampling.LANCZOS)
            canvas.paste(image, (x + (250 - image.width) // 2, y))
            draw.text((x + 5, y + 148), row["burst"] or "", fill="white")
            draw.text((x + 5, y + 164), f"{row['id']} {Path(row['relative']).name}"[:34], fill="white")
        destination = sheets / f"page-{page:04d}.jpg"
        temporary = destination.with_suffix(".tmp")
        canvas.save(temporary, "JPEG", quality=83)
        os.replace(temporary, destination)


def status(connection: sqlite3.Connection) -> dict:
    recorded_version = connection.execute("SELECT value FROM meta WHERE key='version'").fetchone()
    recorded_mode = connection.execute("SELECT value FROM meta WHERE key='mode'").fetchone()
    counts = {row["status"]: row["count"] for row in connection.execute(
        "SELECT status,COUNT(*) count FROM photos GROUP BY status")}
    decisions = {row["decision"]: row["count"] for row in connection.execute(
        "SELECT decision,COUNT(*) count FROM photos GROUP BY decision")}
    bursts = connection.execute("SELECT COUNT(DISTINCT burst) FROM photos WHERE burst IS NOT NULL").fetchone()[0]
    reviewed_bursts = connection.execute("SELECT COUNT(*) FROM burst_reviews WHERE burst IN "
                                         "(SELECT DISTINCT burst FROM photos WHERE burst IS NOT NULL)").fetchone()[0]
    return {"tool_version": VERSION, "index_version": recorded_version["value"] if recorded_version else None,
            "mode": recorded_mode["value"] if recorded_mode else "legacy_detailed",
            "total": sum(counts.values()), "status": counts, "decisions": decisions,
            "bursts": bursts, "reviewed_bursts": reviewed_bursts, "unreviewed_bursts": bursts - reviewed_bursts,
            "near_duplicate_hints": connection.execute(
                "SELECT COUNT(*) FROM photos WHERE near_duplicate_of IS NOT NULL").fetchone()[0]}


def run_index(roots: list[Path], job: Path, *, sheets: bool = True, mode: str = "fast") -> dict:
    if mode not in {"fast", "detailed"}:
        raise ValueError("Unknown index mode")
    inventory = file_inventory(roots, job)
    for _, _, path in inventory:
        if online_only(path):
            raise ValueError(f"Online-only source: {path.name}")
    destination = job
    while not destination.exists():
        destination = destination.parent
    if shutil.disk_usage(destination).free < 1024**3:
        raise ValueError("At least 1 GB free space is required for private previews")
    job.mkdir(parents=True, exist_ok=True)
    connection = connect(job)
    root_list = [str(path.resolve()) for path in roots]
    prior = connection.execute("SELECT value FROM meta WHERE key='roots'").fetchone()
    if prior and json.loads(prior["value"]) != root_list:
        connection.close()
        raise ValueError("Input roots changed; use the same source list or a new index job")
    previous_mode = connection.execute("SELECT value FROM meta WHERE key='mode'").fetchone()
    if (previous_mode and previous_mode["value"] != mode) or (prior and not previous_mode and mode != "detailed"):
        connection.close()
        raise ValueError("Index mode changed; keep the original mode or start a new job")
    source_inventory = json.dumps([(root, relative.as_posix()) for root, relative, _ in inventory])
    prior_inventory = connection.execute("SELECT value FROM meta WHERE key='inventory'").fetchone()
    if prior_inventory and prior_inventory["value"] != source_inventory:
        connection.close()
        raise ValueError("Source inventory changed; use a new index job for added or removed cards")
    connection.execute("INSERT OR IGNORE INTO meta VALUES ('roots',?)", (json.dumps(root_list),))
    connection.execute("INSERT OR IGNORE INTO meta VALUES ('version',?)", (VERSION,))
    connection.execute("INSERT OR IGNORE INTO meta VALUES ('mode',?)", (mode,))
    connection.execute("INSERT OR IGNORE INTO meta VALUES ('inventory',?)", (source_inventory,))
    known = {row["source"]: row for row in connection.execute("SELECT * FROM photos")}
    if set(known) - {str(path) for _, _, path in inventory}:
        connection.close()
        raise ValueError("Indexed source is missing; keep the original shoot available")
    start = time.monotonic()
    processed = reused = errors = 0
    for root, relative, path in inventory:
        stat = path.stat()
        old = known.get(str(path))
        if old and (old["bytes"], old["mtime_ns"]) == (stat.st_size, stat.st_mtime_ns) and old["status"] == "indexed" and (job / old["thumb"]).is_file():
            reused += 1
            continue
        if old and (old["bytes"], old["mtime_ns"]) != (stat.st_size, stat.st_mtime_ns):
            connection.close()
            raise ValueError(f"Source changed since index: {path.name}; start a new job")
        try:
            values = index_one(root, relative, path, job, mode)
            processed += 1
        except (OSError, ValueError, SyntaxError) as error:
            values = {"source_sha256": None, "capture_time": None, "time_basis": None,
                      "width": None, "height": None, "analysis": None, "thumb": None,
                      "status": "error", "error": f"{type(error).__name__}: {error}"}
            errors += 1
        connection.execute("""INSERT INTO photos
            (id,root,relative,source,bytes,mtime_ns,source_sha256,capture_time,time_basis,width,height,
             analysis,thumb,status,error) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET source_sha256=excluded.source_sha256,
              capture_time=excluded.capture_time,time_basis=excluded.time_basis,width=excluded.width,
              height=excluded.height,analysis=excluded.analysis,thumb=excluded.thumb,
              status=excluded.status,error=excluded.error""",
            (photo_id(root, relative), root, relative.as_posix(), str(path), stat.st_size, stat.st_mtime_ns,
             values["source_sha256"], values["capture_time"], values["time_basis"], values["width"],
             values["height"], values["analysis"], values["thumb"], values["status"], values["error"]))
        connection.commit()
    group_bursts(connection)
    write_review(connection, job)
    if sheets and (processed or not any((job / "contact-sheets").glob("page-*.jpg"))):
        contact_sheets(connection, job)
    result = {**status(connection), "mode": mode, "processed": processed, "reused": reused,
              "errors_this_run": errors, "seconds": round(time.monotonic() - start, 2)}
    (job / "summary.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    connection.close()
    return result


def classify(job: Path, ids: list[str], decision: str, reviewer: str, reason: str) -> dict:
    if not ids or len(ids) != len(set(ids)) or decision not in DECISIONS or not reviewer.strip() or not reason.strip():
        raise ValueError("Distinct IDs, decision, reviewer and reason are required")
    if not (job / "index.sqlite3").is_file():
        raise ValueError("No PICASSO index job at that path")
    connection = connect(job)
    rows = {row["id"]: row for row in connection.execute(
        f"SELECT id,status,decision FROM photos WHERE id IN ({','.join('?' for _ in ids)})", ids)}
    if set(rows) != set(ids) or any(row["status"] != "indexed" for row in rows.values()):
        connection.close()
        raise ValueError("Every selected ID must be indexed")
    at = datetime.now().isoformat()
    for ident in ids:
        connection.execute("UPDATE photos SET decision=?,reviewer=?,reason=? WHERE id=?",
                           (decision, reviewer, reason, ident))
        connection.execute("INSERT INTO decisions (photo_id,old_decision,new_decision,reviewer,reason,at) "
                           "VALUES (?,?,?,?,?,?)", (ident, rows[ident]["decision"], decision, reviewer, reason, at))
    connection.commit()
    write_review(connection, job)
    result = status(connection)
    connection.close()
    return result


def review_bursts(job: Path, bursts: list[str], reviewer: str, note: str) -> dict:
    if not (job / "index.sqlite3").is_file() or not bursts or len(bursts) != len(set(bursts)):
        raise ValueError("An existing index and distinct burst IDs are required")
    if not reviewer.strip() or not note.strip():
        raise ValueError("Reviewer and note are required")
    connection = connect(job)
    actual = {row[0] for row in connection.execute("SELECT DISTINCT burst FROM photos WHERE burst IS NOT NULL")}
    if not set(bursts).issubset(actual):
        connection.close()
        raise ValueError("Unknown burst ID")
    at = datetime.now().isoformat()
    for burst in bursts:
        connection.execute("INSERT INTO burst_reviews VALUES (?,?,?,?) ON CONFLICT(burst) "
                           "DO UPDATE SET reviewer=excluded.reviewer,note=excluded.note,at=excluded.at",
                           (burst, reviewer, note, at))
        connection.execute("INSERT INTO burst_review_history (burst,reviewer,note,at) VALUES (?,?,?,?)",
                           (burst, reviewer, note, at))
    connection.commit()
    result = status(connection)
    connection.close()
    return result


def stage_selected(job: Path, *, calibration: bool = False) -> dict:
    """Copy reviewed KEEP camera bytes into a private Lightroom intake folder."""
    if not (job / "index.sqlite3").is_file():
        raise ValueError("No PICASSO index job at that path")
    connection = connect(job)
    if not calibration:
        state = status(connection)
        if state["status"].get("error", 0):
            connection.close()
            raise ValueError("Source index has errors; inspect every camera file before full staging")
        if state["unreviewed_bursts"]:
            connection.close()
            raise ValueError("Some bursts have no human review; use --calibration only for a limited pilot")
    rows = connection.execute("SELECT id,source,source_sha256,bytes,reviewer,reason FROM photos "
                              "WHERE decision='KEEP' AND status='indexed' ORDER BY id").fetchall()
    connection.close()
    if not rows or any(not row["reviewer"] or not row["reason"] for row in rows):
        raise ValueError("No human-reviewed KEEP originals are available to stage")
    if calibration and len(rows) > 25:
        raise ValueError("Calibration staging is limited to 25 reviewed KEEP originals")
    scope = "calibration" if calibration else "full"
    token = scope + "-" + hashlib.sha256(json.dumps([(row["id"], row["source_sha256"]) for row in rows]).encode()).hexdigest()[:16]
    parent = job / "selected-originals"
    parent.mkdir(exist_ok=True)
    destination = parent / token
    expected = [{"id": row["id"], "source": row["source"], "sha256": row["source_sha256"],
                 "file": f"{row['id']}__{Path(row['source']).name}"} for row in rows]
    if destination.exists():
        manifest = destination / "manifest.json"
        if not manifest.is_file() or json.loads(manifest.read_text(encoding="utf-8")) != expected:
            raise ValueError("Existing staged originals do not match the reviewed selection")
        if {path.name for path in destination.iterdir() if path.is_file()} != {item["file"] for item in expected} | {"manifest.json"}:
            raise ValueError("Existing staged folder has missing or extra files")
        if any(digest(destination / item["file"]) != item["sha256"] for item in expected):
            raise ValueError("Existing staged JPEG changed; do not use it")
        return {"folder": str(destination), "count": len(expected), "scope": scope, "reused": True}
    required = sum(row["bytes"] for row in rows) + 100 * 1024**2
    if shutil.disk_usage(parent).free < required:
        raise ValueError("Not enough space for separate selected-original copies")
    with tempfile.TemporaryDirectory(prefix="stage-", dir=parent) as temporary:
        staging = Path(temporary)
        for item in expected:
            source = Path(item["source"])
            if not source.is_file() or online_only(source) or digest(source) != item["sha256"]:
                raise ValueError(f"Selected camera source changed: {item['id']}")
            shutil.copyfile(source, staging / item["file"])
            if digest(staging / item["file"]) != item["sha256"]:
                raise ValueError(f"Selected copy failed hash verification: {item['id']}")
        (staging / "manifest.json").write_text(json.dumps(expected, indent=2), encoding="utf-8")
        os.replace(staging, destination)
    return {"folder": str(destination), "count": len(expected), "scope": scope, "reused": False}


def burst_sheets(job: Path, bursts: list[str], crop: tuple[float, float, float, float] | None = None) -> dict:
    """Make private full-frame and same-area comparisons for adjacent camera frames."""
    if not (job / "index.sqlite3").is_file() or not bursts or len(bursts) != len(set(bursts)):
        raise ValueError("An existing index and distinct burst IDs are required")
    if crop is not None and (len(crop) != 4 or any(not 0 <= value <= 1 for value in crop)
                             or crop[2] <= 0 or crop[3] <= 0 or crop[0] + crop[2] > 1
                             or crop[1] + crop[3] > 1):
        raise ValueError("Crop must be normalized x y width height within the frame")
    connection = connect(job)
    rows = connection.execute(
        f"SELECT id,relative,source,source_sha256,burst,decision,thumb FROM photos "
        f"WHERE burst IN ({','.join('?' for _ in bursts)}) AND status='indexed' "
        "ORDER BY burst,capture_time,relative", bursts).fetchall()
    connection.close()
    if {row["burst"] for row in rows} != set(bursts):
        raise ValueError("Unknown or unindexed burst ID")
    output = job / "burst-sheets"
    output.mkdir(exist_ok=True)
    pages = []
    for burst in bursts:
        members = [row for row in rows if row["burst"] == burst]
        for start in range(0, len(members), 8):
            current = members[start:start + 8]
            sheet = Image.new("RGB", (2000, 1440), (22, 22, 22))
            draw = ImageDraw.Draw(sheet)
            for position, row in enumerate(current):
                source = Path(row["source"])
                if not source.is_file() or online_only(source) or digest(source) != row["source_sha256"]:
                    raise ValueError(f"Camera source changed: {row['id']}")
                with Image.open(source) as raw:
                    raw.draft("RGB", (2400, 2400))
                    photo, _ = srgb_image(raw)
                full = photo.copy()
                full.thumbnail((480, 315), Image.Resampling.LANCZOS)
                area = crop or (0.25, 0.15, 0.5, 0.6)
                left = int(area[0] * photo.width)
                top = int(area[1] * photo.height)
                right = max(left + 1, int((area[0] + area[2]) * photo.width))
                bottom = max(top + 1, int((area[1] + area[3]) * photo.height))
                detail = photo.crop((left, top, right, bottom))
                detail.thumbnail((480, 315), Image.Resampling.LANCZOS)
                x = (position % 4) * 500
                y = (position // 4) * 720
                sheet.paste(full, (x + (500 - full.width) // 2, y))
                sheet.paste(detail, (x + (500 - detail.width) // 2, y + 320))
                draw.text((x + 8, y + 642), f"{row['relative']}  {row['decision']}", fill="white")
                draw.text((x + 8, y + 663), row["id"], fill="#cccccc")
                draw.text((x + 8, y + 685), "Full frame above / same-area detail below", fill="#aaaaaa")
            target = output / f"{burst}-{start // 8 + 1:02d}.jpg"
            temporary = target.with_suffix(".tmp")
            sheet.save(temporary, "JPEG", quality=87)
            os.replace(temporary, target)
            pages.append(str(target))
    return {"bursts": len(bursts), "frames": len(rows), "pages": pages,
            "crop": list(crop or (0.25, 0.15, 0.5, 0.6)),
            "note": "Comparison proxy only; inspect each subject in the original at 100% before KEEP"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    scan = commands.add_parser("index", help="Index approved JPEG roots before editing")
    scan.add_argument("--input", type=Path, action="append", required=True)
    scan.add_argument("--job", type=Path, required=True)
    scan.add_argument("--no-sheets", action="store_true")
    scan.add_argument("--mode", choices=("fast", "detailed"), default="fast")
    review = commands.add_parser("classify", help="Record reversible human culling decisions")
    review.add_argument("--job", type=Path, required=True)
    review.add_argument("--ids", nargs="+", required=True)
    review.add_argument("--decision", choices=sorted(DECISIONS), required=True)
    review.add_argument("--reviewer", required=True)
    review.add_argument("--reason", required=True)
    burst_review = commands.add_parser("review-bursts", help="Record human inspection of every frame in named bursts")
    burst_review.add_argument("--job", type=Path, required=True)
    burst_review.add_argument("--bursts", nargs="+", required=True)
    burst_review.add_argument("--reviewer", required=True)
    burst_review.add_argument("--note", required=True)
    show = commands.add_parser("status", help="Read the private index ledger")
    show.add_argument("--job", type=Path, required=True)
    stage = commands.add_parser("stage-selected", help="Hash-check and copy human KEEP originals for local Lightroom")
    stage.add_argument("--job", type=Path, required=True)
    stage.add_argument("--calibration", action="store_true", help="Stage a limited pilot before full burst coverage")
    compare = commands.add_parser("burst-sheet", help="Private adjacent-frame comparison with the same-area detail")
    compare.add_argument("--job", type=Path, required=True)
    compare.add_argument("--bursts", nargs="+", required=True)
    compare.add_argument("--crop", nargs=4, type=float, metavar=("X", "Y", "W", "H"),
                         help="Optional normalized detail rectangle shared across all burst frames")
    args = parser.parse_args()
    try:
        if args.command == "index":
            result = run_index(args.input, args.job, sheets=not args.no_sheets, mode=args.mode)
        elif args.command == "classify":
            result = classify(args.job, args.ids, args.decision, args.reviewer, args.reason)
        elif args.command == "review-bursts":
            result = review_bursts(args.job, args.bursts, args.reviewer, args.note)
        elif args.command == "stage-selected":
            result = stage_selected(args.job, calibration=args.calibration)
        elif args.command == "burst-sheet":
            result = burst_sheets(args.job, args.bursts, tuple(args.crop) if args.crop else None)
        else:
            if not (args.job / "index.sqlite3").is_file():
                raise ValueError("No PICASSO index job at that path")
            connection = connect(args.job)
            result = status(connection)
            connection.close()
        print(json.dumps(result, indent=2))
    except (OSError, ValueError, sqlite3.Error) as error:
        print(f"PICASSO index blocked: {error}", file=sys.stderr)
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
