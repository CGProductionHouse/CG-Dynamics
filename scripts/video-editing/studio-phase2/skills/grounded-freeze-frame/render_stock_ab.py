"""Source-specific freeze foreground A/B. Reuses an existing screened GrabCut mask.

Run: py render_stock_ab.py PRIVATE_OUTPUT_DIRECTORY
Stock and derivative output stay outside Git. This is not a general segmentation tool.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

HERE = Path("C:/Users/chris/Videos/CG-AI-Editing/Nolan-Skill-Proofs/object-mask-20261026")
SOURCE = HERE / "mixkit-1252-720.mp4"
MASK_FILE = HERE / "mask-4.png"
EXPECTED_SOURCE = "3ec4c2ad8f277f41d30f2226de4f1596161f2db545defa7d2610122fed2a5e56"
EXPECTED_MASK = "9459b47be62b781b8d7c4264690a1350d4cb937e711e2732ccaf346c0c87c994"
W, H, FPS, FRAMES = 720, 1280, 24, 24
START = 3.75
FREEZE_AT = 6


def check_sources() -> None:
    for path, expected in ((SOURCE, EXPECTED_SOURCE), (MASK_FILE, EXPECTED_MASK)):
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != expected:
            raise ValueError(f"Unexpected source bytes: {path.name} {digest}")


def frame_at(cap: cv2.VideoCapture, seconds: float) -> np.ndarray:
    cap.set(cv2.CAP_PROP_POS_MSEC, seconds * 1000)
    ok, bgr = cap.read()
    if not ok:
        raise RuntimeError(f"No frame at {seconds:.3f}s")
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def source_background(rgb: np.ndarray) -> np.ndarray:
    """Reconstruct this shot's plain colored wall from unoccluded edge columns."""
    left = np.median(rgb[:, 35:70].astype(np.float32), axis=1)
    right = np.median(rgb[:, 650:685].astype(np.float32), axis=1)
    # Rowwise copying brought an unrelated horizontal light band across the
    # foreground. This is a smooth cyc wall, so fit its broad vertical falloff
    # instead of preserving local spikes from the edge samples.
    y = np.linspace(-1, 1, H)
    left = np.stack([np.polyval(np.polyfit(y, left[:, c], 3), y) for c in range(3)], axis=1)
    right = np.stack([np.polyval(np.polyfit(y, right[:, c], 3), y) for c in range(3)], axis=1)
    weight = np.linspace(0, 1, W, dtype=np.float32)[None, :, None]
    plate = left[:, None, :] * (1 - weight) + right[:, None, :] * weight
    return np.clip(plate, 0, 255).astype(np.uint8)


def render(path: Path, mode: str) -> tuple[list[Image.Image], list[np.ndarray]]:
    cap = cv2.VideoCapture(str(SOURCE))
    held = frame_at(cap, 4.0)
    mask = cv2.imread(str(MASK_FILE), cv2.IMREAD_GRAYSCALE)
    assert mask is not None and mask.shape == (H, W)
    # Tiny edge softness only; large feathering makes the subject float.
    alpha = cv2.GaussianBlur(mask.astype(np.float32) / 255.0, (3, 3), 0.55)[:, :, None]
    proc = subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
         "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0",
         "-an", "-c:v", "libx264", "-crf", "19", "-pix_fmt", "yuv420p", str(path)],
        stdin=subprocess.PIPE,
    )
    assert proc.stdin
    stills: list[Image.Image] = []
    samples: list[np.ndarray] = []
    try:
        for i in range(FRAMES):
            moving = frame_at(cap, START + i / FPS)
            if mode == "freeze" and i >= FREEZE_AT:
                plate = source_background(moving)
                output = np.clip(held * alpha + plate * (1 - alpha), 0, 255).astype(np.uint8)
            else:
                output = moving
            if i in (5, 6, 11, 17, 23):
                stills.append(Image.fromarray(output).resize((270, 480)))
            if i in (11, 17):
                samples.append(output.copy())
            proc.stdin.write(output.tobytes())
    finally:
        proc.stdin.close()
        cap.release()
    if proc.wait():
        raise RuntimeError(f"Encode failed: {mode}")
    return stills, samples


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    check_sources()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    rows, samples = [], []
    for mode in ("normal", "freeze"):
        row, pair = render(args.output_dir / f"{mode}.mp4", mode)
        rows.append(row)
        samples.append(pair)
    contact = Image.new("RGB", (270 * 5, 480 * 2))
    for y, row in enumerate(rows):
        for x, im in enumerate(row):
            contact.paste(im, (x * 270, y * 480))
    contact.save(args.output_dir / "freeze-contact.jpg", quality=92)
    # This is a signal control, not a perceptual or matte-quality verdict.
    alpha = cv2.imread(str(MASK_FILE), cv2.IMREAD_GRAYSCALE) > 250
    stable = alpha & (np.indices(alpha.shape)[0] < 1100)
    subject_delta = float(np.mean(np.abs(samples[1][0][stable].astype(np.int16) -
                                          samples[1][1][stable].astype(np.int16))))
    edge = np.indices(alpha.shape)[1] > 600
    background_delta = float(np.mean(np.abs(samples[1][0][edge].astype(np.int16) -
                                             samples[1][1][edge].astype(np.int16))))
    (args.output_dir / "signal-check.json").write_text(json.dumps({
        "freeze_subject_mean_abs_change": subject_delta,
        "background_edge_mean_abs_change": background_delta,
        "note": "Frame-domain check only; not an edge or creative approval.",
    }, indent=2), encoding="utf-8")
