"""Private same-source reaction-panel versus full-context control.

This is an editorial crop comparison, not an effect pack or client film.
"""
from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

SOURCE = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Daisy-Nov-2026\stock-november-v1\41225-720.mp4")
OUT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\stacked-reaction-panels-20261027")
SOURCE_SHA = "28d499c55c9fa1e50920ba51028262669a5762ffd98e8b5ae12d1d828727c5d5"
W, H, FPS, FRAMES = 720, 1280, 24, 60
BG = (22, 28, 26)


def frame_at(cap: cv2.VideoCapture, seconds: float) -> np.ndarray:
    cap.set(cv2.CAP_PROP_POS_MSEC, seconds * 1000)
    good, bgr = cap.read()
    if not good or bgr.shape[:2] != (720, 1280):
        raise RuntimeError(f"Source frame unavailable at {seconds:.3f}s")
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def make_frame(source: np.ndarray, mode: str, index: int) -> np.ndarray:
    canvas = np.empty((H, W, 3), dtype=np.uint8)
    canvas[:] = BG
    if mode == "plain" or index >= 29:
        # Same moving wide frame, including both people and the shared table.
        canvas[438:843] = cv2.resize(source, (W, 405))
    else:
        # Two faces are source-synchronous, then their full shared context is revealed.
        for left, y in ((0, 100), (640, 650)):
            panel = cv2.resize(source[0:444, left:left + 640], (W, 500))
            canvas[y:y + 500] = panel
            canvas[y:y + 4] = (245, 233, 215)
            canvas[y + 496:y + 500] = (245, 233, 215)
    return canvas


def encode(path: Path, frames: list[np.ndarray]) -> None:
    process = subprocess.Popen([
        "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0", "-an",
        "-c:v", "libx264", "-crf", "19", "-pix_fmt", "yuv420p", str(path),
    ], stdin=subprocess.PIPE)
    assert process.stdin
    for frame in frames:
        process.stdin.write(frame.tobytes())
    process.stdin.close()
    if process.wait():
        raise RuntimeError(f"Encode failed: {path}")


def main() -> None:
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SOURCE_SHA:
        raise RuntimeError("Practice source hash changed")
    OUT.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(SOURCE))
    source = [frame_at(cap, 4.2 + i / FPS) for i in range(FRAMES)]
    cap.release()
    plain = [make_frame(frame, "plain", i) for i, frame in enumerate(source)]
    panels = [make_frame(frame, "panels", i) for i, frame in enumerate(source)]
    encode(OUT / "plain-context.mp4", plain)
    encode(OUT / "faces-then-context.mp4", panels)

    selected = (0, 12, 24, 28, 29, 30, 42, 59)
    contact = Image.new("RGB", (8 * 180, 2 * 320), "white")
    draw = ImageDraw.Draw(contact)
    for row, frames in enumerate((plain, panels)):
        for column, index in enumerate(selected):
            x, y = column * 180, row * 320
            contact.paste(Image.fromarray(frames[index]).resize((180, 320)), (x, y))
            draw.text((x + 3, y + 3), f"{('plain', 'panels')[row]} {index}", fill="white", stroke_width=1, stroke_fill="black")
    contact.save(OUT / "portrait-contact.jpg", quality=92)
    Image.fromarray(panels[24]).save(OUT / "panels-full-size.png")


if __name__ == "__main__":
    main()
