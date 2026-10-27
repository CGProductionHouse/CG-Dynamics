"""Disposable two-source split-screen readability study using existing Mixkit practice files.

Outputs remain in the caller's private media directory; no stock source is committed.
Run from repository root: py render_practice.py PRIVATE_OUTPUT_DIRECTORY
"""

from __future__ import annotations

import argparse
import hashlib
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
MEDIA = ROOT / "media"
SOURCES = (
    (MEDIA / "mixkit-41865-720.mp4", "883b71655e2f2448a03b02f6e318eced58b51bac5b74da86c018995f3c817331"),
    (MEDIA / "mixkit-43391-720.mp4", "f35d2e3be611fde1d81b95ff84f9be81f5fad9f4d8f6d3edaef3d002bbf666d7"),
)
W, H, FPS, FRAMES = 540, 960, 30, 90


def verify() -> None:
    for path, expected in SOURCES:
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != expected:
            raise ValueError(f"Practice source hash mismatch: {path.name} {actual}")


def seek_rgb(cap: cv2.VideoCapture, seconds: float) -> Image.Image:
    cap.set(cv2.CAP_PROP_POS_MSEC, seconds * 1000)
    ok, frame = cap.read()
    if not ok:
        raise RuntimeError(f"Cannot read practice source at {seconds:.3f}s")
    return Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))


def panel(source: Image.Image, width: int, height: int, shift_x: int = 0) -> Image.Image:
    """Fill a box and preserve geometry; no subject warping."""
    scale = max(width / source.width, height / source.height)
    resized = source.resize((round(source.width * scale), round(source.height * scale)),
                            Image.Resampling.LANCZOS)
    left = max(0, min(resized.width - width, (resized.width - width) // 2 + shift_x))
    top = max(0, (resized.height - height) // 2)
    return resized.crop((left, top, left + width, top + height))


def frame(caps: tuple[cv2.VideoCapture, cv2.VideoCapture], i: int, mode: str) -> Image.Image:
    elapsed = i / FPS
    # Pour and reaction are conceptually related. They are different shoots, so
    # the film must never imply this woman receives this exact cup.
    pour = seek_rgb(caps[0], 1.0 + elapsed)
    reaction = seek_rgb(caps[1], 1.9 + elapsed)
    if mode == "sequential":
        # Plain editorial alternative: single useful action per full frame.
        return panel(pour if i < FRAMES // 2 else reaction, W, H)
    out = Image.new("RGB", (W, H), (18, 18, 18))
    out.paste(panel(pour, 265, H), (0, 0))
    out.paste(panel(reaction, 265, H, shift_x=-20), (275, 0))
    d = ImageDraw.Draw(out)
    d.rectangle((265, 0, 275, H), fill=(245, 241, 233))
    face = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 26)
    for x, label in ((16, "MAKE"), (292, "ENJOY")):
        d.rounded_rectangle((x - 5, 27, x + 117, 73), radius=8, fill=(12, 25, 30))
        d.text((x, 34), label, fill=(255, 245, 221), font=face)
    return out


def render(path: Path, mode: str, stills: list[Image.Image]) -> None:
    caps = tuple(cv2.VideoCapture(str(p)) for p, _ in SOURCES)
    proc = subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
         "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0",
         "-an", "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", str(path)],
        stdin=subprocess.PIPE,
    )
    assert proc.stdin
    try:
        for i in range(FRAMES):
            image = frame(caps, i, mode)
            if i in (15, 45, 75):
                stills.append(image.resize((270, 480)))
            proc.stdin.write(np.asarray(image).tobytes())
    finally:
        proc.stdin.close()
        for cap in caps:
            cap.release()
    if proc.wait():
        raise RuntimeError(f"Encode failed: {mode}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    verify()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    rows: list[list[Image.Image]] = []
    for mode in ("sequential", "split"):
        row: list[Image.Image] = []
        render(args.output_dir / f"{mode}.mp4", mode, row)
        rows.append(row)
    sheet = Image.new("RGB", (270 * 3, 480 * 2))
    for y, row in enumerate(rows):
        for x, im in enumerate(row):
            sheet.paste(im, (x * 270, y * 480))
    sheet.save(args.output_dir / "split-source-contact.jpg", quality=92)
