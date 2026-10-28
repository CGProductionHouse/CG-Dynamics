"""Private one-glimpse shutter versus plain time-cut on one licensed source.

The experiment intentionally contains no sound; no client media enters Git.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

SOURCE = Path(r"C:\Users\chris\Videos\CG-AI-Editing\TBS-Nov-2026\restart-source\mixkit-carpenter-saw-39691.mp4")
OUT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\rapid-shutter-real-20261027")
EXPECTED_SHA = "186bc1eb994695af1d7c2312d3f8ea6aac0a4e23767d24727471066e7cceb618"
W, H, FPS, FRAMES = 720, 1280, 24, 48


def at(cap: cv2.VideoCapture, seconds: float) -> np.ndarray:
    cap.set(cv2.CAP_PROP_POS_MSEC, 1000 * seconds)
    ok, bgr = cap.read()
    if not ok:
        raise RuntimeError(f"Frame unavailable at {seconds:.3f}s")
    frame = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    if frame.shape[:2] != (H, W):
        raise RuntimeError(f"Unexpected source frame {frame.shape}")
    return frame


def directional_blur(frame: np.ndarray) -> np.ndarray:
    # One narrow 90-degree directional smear, then settle to an intact frame.
    return cv2.GaussianBlur(frame, (1, 19), 0)


def write_video(path: Path, frames: list[np.ndarray]) -> None:
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
               "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0",
               "-an", "-c:v", "libx264", "-crf", "19", "-pix_fmt", "yuv420p", str(path)]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin
    for frame in frames:
        process.stdin.write(frame.tobytes())
    process.stdin.close()
    if process.wait():
        raise RuntimeError(f"Encode failed: {path}")


def main() -> None:
    if not SOURCE.is_file():
        raise RuntimeError(f"Missing practice source: {SOURCE}")
    source_sha = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    if EXPECTED_SHA and source_sha.lower() != EXPECTED_SHA.lower():
        raise RuntimeError("Practice source hash changed")
    OUT.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(SOURCE))
    # Both versions skip ahead within the same filmed saw action at output frame 24.
    outgoing = [at(cap, .8 + i / FPS) for i in range(24)]
    incoming = [at(cap, 2.1 + i / FPS) for i in range(24)]
    cap.release()
    plain = outgoing + incoming
    shutter = [frame.copy() for frame in plain]
    shutter[22] = directional_blur(incoming[0])  # one glimpse of the destination
    shutter[23] = directional_blur(outgoing[23])  # one-frame return to the source
    for name, frames in (("plain", plain), ("one-glimpse-shutter", shutter)):
        write_video(OUT / f"{name}.mp4", frames)
    indexes = [20, 21, 22, 23, 24, 25, 26, 27]
    contact = Image.new("RGB", (8 * 180, 2 * 350), "white")
    draw = ImageDraw.Draw(contact)
    for row, frames in enumerate((plain, shutter)):
        for column, index in enumerate(indexes):
            tile = Image.fromarray(frames[index]).resize((180, 320))
            x, y = column * 180, row * 350
            contact.paste(tile, (x, y))
            draw.text((x + 3, y + 324), f"{('plain', 'shutter')[row]} {index}", fill="black")
    contact.save(OUT / "cut-contact.jpg", quality=92)
    Image.fromarray(shutter[22]).save(OUT / "glimpse-full-size.png")
    (OUT / "evidence.json").write_text(json.dumps({
        "source": SOURCE.name, "source_sha256": source_sha,
        "source_license_page": "https://mixkit.co/free-stock-video/carpenter-slicing-a-wooden-board-in-a-close-up-shot-39691/",
        "frames": FRAMES, "fps": FPS, "size": [W, H], "audio": "none",
        "cut_output_frame": 24, "outgoing_source_start_s": .8, "incoming_source_start_s": 2.1,
        "changed_frames": [22, 23],
    }, indent=2), encoding="utf-8")
    print(OUT)


if __name__ == "__main__":
    main()
