"""Compare a natural stage-light cut with a brief added exposure pulse."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output" / "flare-cut"
SOURCES = (
    ("mixkit-472-720.mp4", "022555a6a6b108a57e54ca7dc4df48c0ab78ddf7e1d0facd5ccb84121c8f6f1f", 272),
    ("mixkit-474-720.mp4", "924ed8a9dbf8b62a9d5f5603359718c8dbc3f40bf3e1ec829c0b08d6034cfcf6", 450),
)
FPS = "30000/1001"
FRAMES_PER_SHOT = 45
PULSE = {43: 1.04, 44: 1.10, 45: 1.10, 46: 1.04}


def encode(name: str) -> None:
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-framerate", FPS,
        "-i", str(OUT / name / "%04d.png"), "-frames:v", "90", "-an", "-c:v", "libx264",
        "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", str(OUT / f"{name}.mp4"),
    ], check=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name in ("control", "pulse"):
        (OUT / name).mkdir(exist_ok=True)
    observed = []
    for shot, (filename, expected_sha, first) in enumerate(SOURCES):
        source = ROOT / "media" / filename
        if hashlib.sha256(source.read_bytes()).hexdigest().lower() != expected_sha:
            raise RuntimeError(f"Missing or changed source: {source}")
        cap = cv2.VideoCapture(str(source))
        if not cap.isOpened() or cap.get(cv2.CAP_PROP_FRAME_COUNT) < first + 2 * FRAMES_PER_SHOT:
            raise RuntimeError(f"Cannot reach selected source frames: {source}")
        cap.set(cv2.CAP_PROP_POS_FRAMES, first)
        for local in range(FRAMES_PER_SHOT):
            ok, frame = cap.read()
            if not ok or frame.shape[:2] != (720, 1280):
                raise RuntimeError(f"Unexpected source frame {filename}:{first + 2 * local}")
            index = shot * FRAMES_PER_SHOT + local
            if not cv2.imwrite(str(OUT / "control" / f"{index:04d}.png"), frame):
                raise RuntimeError("Control frame write failed")
            gain = PULSE.get(index, 1.0)
            treated = np.uint8(np.clip(frame.astype(np.float32) * gain, 0, 255))
            if not cv2.imwrite(str(OUT / "pulse" / f"{index:04d}.png"), treated):
                raise RuntimeError("Pulse frame write failed")
            if index in PULSE:
                observed.append({"output_frame": index, "source": filename,
                                 "source_frame": first + 2 * local, "gain": gain,
                                 "bright_luma_fraction_control": float(np.mean(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) >= 235)),
                                 "bright_luma_fraction_pulse": float(np.mean(cv2.cvtColor(treated, cv2.COLOR_BGR2GRAY) >= 235))})
            # Native stock is 60000/1001; select every other frame for 30000/1001.
            ok, _ = cap.read()
            if not ok and local != FRAMES_PER_SHOT - 1:
                raise RuntimeError("Unexpected source end")
        cap.release()
    encode("control")
    encode("pulse")

    label = Image.new("RGBA", (2560, 90), (0, 0, 0, 0))
    draw = ImageDraw.Draw(label)
    font = ImageFont.truetype(str(ROOT / "scene" / "assets" / "SpaceGrotesk.ttf"), 38)
    for left, word in ((16, "NATURAL CUT"), (1296, "ADDED PULSE")):
        draw.rounded_rectangle((left, 12, left + 330, 72), radius=10, fill=(0, 0, 0, 195))
        draw.text((left + 13, 20), word, font=font, fill="white")
    label.save(OUT / "labels.png")
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(OUT / "control.mp4"),
        "-i", str(OUT / "pulse.mp4"), "-loop", "1", "-i", str(OUT / "labels.png"),
        "-filter_complex", "[0:v][1:v]hstack=inputs=2[b];[b][2:v]overlay=0:0:shortest=1[v]",
        "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "19",
        "-pix_fmt", "yuv420p", str(OUT / "comparison.mp4"),
    ], check=True)

    contact = Image.new("RGB", (1280, 720), "#111111")
    draw = ImageDraw.Draw(contact)
    for row, index in enumerate((42, 44, 45, 47)):
        for col, name in enumerate(("control", "pulse")):
            with Image.open(OUT / name / f"{index:04d}.png") as sample:
                contact.paste(sample.resize((640, 180)), (col * 640, row * 180))
            draw.rectangle((col * 640, row * 180, col * 640 + 110, row * 180 + 22), fill="black")
            draw.text((col * 640 + 4, row * 180 + 3), f"{name} {index}", fill="white")
    contact.save(OUT / "contact.png")
    print(json.dumps({"source_in_frames": [x[2] for x in SOURCES], "source_frames_per_shot": 90,
                      "output_frames_per_shot": FRAMES_PER_SHOT, "delivery_fps": FPS,
                      "pulse": observed,
                      "sha256": {name: hashlib.sha256((OUT / f"{name}.mp4").read_bytes()).hexdigest()
                                 for name in ("control", "pulse", "comparison")}}, indent=2))


if __name__ == "__main__":
    main()
