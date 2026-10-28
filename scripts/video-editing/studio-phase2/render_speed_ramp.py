"""One-shot speed-ramp timing comparison; no cross-shot continuity claim."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "media" / "mixkit-28289-720.mp4"
SOURCE_SHA = "04d1ad1735db6c8024afd7aae5cc95d29649c67c1f2310c7a48cd404ee99339c"
OUT = ROOT / "output" / "speed-ramp"
SOURCE_FIRST, SOURCE_LAST, FRAMES = 300, 539, 120
FPS = "30000/1001"


def smoothstep(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    v = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
    return v * v * (3 - 2 * v)


def frame_maps() -> dict[str, list[int]]:
    control = np.rint(np.linspace(SOURCE_FIRST, SOURCE_LAST, FRAMES)).astype(int)
    t = np.linspace(0, 4, FRAMES)
    speed = 0.65 + 1.35 * (smoothstep(t, 1.1, 1.6) - smoothstep(t, 2.4, 2.9))
    # Trapezoidal integration normalizes the curve to exactly the same source span.
    area = np.r_[0.0, np.cumsum((speed[:-1] + speed[1:]) / 2 * np.diff(t))]
    ramp = SOURCE_FIRST + np.rint((SOURCE_LAST - SOURCE_FIRST) * area / area[-1]).astype(int)
    assert control[0] == ramp[0] == SOURCE_FIRST
    assert control[-1] == ramp[-1] == SOURCE_LAST
    assert np.all(np.diff(control) > 0) and np.all(np.diff(ramp) > 0)
    return {"control": control.tolist(), "ramp": ramp.tolist()}


def main() -> None:
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest().lower() != SOURCE_SHA:
        raise RuntimeError(f"Missing or changed source: {SOURCE}")
    maps = frame_maps()
    OUT.mkdir(parents=True, exist_ok=True)
    targets = {name: {} for name in maps}
    for name, source_indices in maps.items():
        directory = OUT / name
        directory.mkdir(exist_ok=True)
        for output_index, source_index in enumerate(source_indices):
            targets[name].setdefault(source_index, []).append(output_index)

    cap = cv2.VideoCapture(str(SOURCE))
    if not cap.isOpened() or cap.get(cv2.CAP_PROP_FRAME_COUNT) <= SOURCE_LAST:
        raise RuntimeError("Cannot open or reach selected stock frames")
    cap.set(cv2.CAP_PROP_POS_FRAMES, SOURCE_FIRST)
    for source_index in range(SOURCE_FIRST, SOURCE_LAST + 1):
        ok, frame = cap.read()
        if not ok or frame.shape[:2] != (720, 1280):
            raise RuntimeError(f"Missing or unexpected source frame {source_index}")
        for name in maps:
            for output_index in targets[name].get(source_index, []):
                if not cv2.imwrite(str(OUT / name / f"{output_index:04d}.png"), frame):
                    raise RuntimeError("Frame write failed")
    cap.release()

    for name in maps:
        subprocess.run([
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-framerate", FPS,
            "-i", str(OUT / name / "%04d.png"), "-frames:v", str(FRAMES), "-an",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
            str(OUT / f"{name}.mp4"),
        ], check=True)

    label = Image.new("RGBA", (2560, 90), (0, 0, 0, 0))
    label_draw = ImageDraw.Draw(label)
    label_font = ImageFont.truetype(str(ROOT / "scene" / "assets" / "SpaceGrotesk.ttf"), 38)
    for left, word in ((16, "CONSTANT"), (1296, "RAMP")):
        label_draw.rounded_rectangle((left, 12, left + 230, 72), radius=10, fill=(0, 0, 0, 195))
        label_draw.text((left + 13, 20), word, font=label_font, fill="white")
    label.save(OUT / "labels.png")
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(OUT / "control.mp4"),
        "-i", str(OUT / "ramp.mp4"), "-loop", "1", "-i", str(OUT / "labels.png"),
        "-filter_complex", "[0:v][1:v]hstack=inputs=2[b];[b][2:v]overlay=0:0:shortest=1[v]",
        "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "19",
        "-pix_fmt", "yuv420p", str(OUT / "comparison.mp4"),
    ], check=True)

    # The contact is two columns by four rows at half source size.
    contact = Image.new("RGB", (1280, 1440), "#111111")
    draw = ImageDraw.Draw(contact)
    for row, index in enumerate((0, 30, 60, 90)):
        for col, name in enumerate(("control", "ramp")):
            with Image.open(OUT / name / f"{index:04d}.png") as sample:
                contact.paste(sample.resize((640, 360)), (col * 640, row * 360))
            draw.rectangle((col * 640, row * 360, col * 640 + 115, row * 360 + 23), fill="black")
            draw.text((col * 640 + 5, row * 360 + 3), f"{name} {index}", fill="white")
    contact.save(OUT / "contact.png")
    print(json.dumps({
        "source_sha256": SOURCE_SHA, "source_frames": [SOURCE_FIRST, SOURCE_LAST],
        "delivery_fps": FPS, "delivery_frames": FRAMES,
        "source_step_ranges": {name: [int(min(np.diff(indices))), int(max(np.diff(indices)))]
                               for name, indices in maps.items()},
        "sha256": {name: hashlib.sha256((OUT / f"{name}.mp4").read_bytes()).hexdigest()
                   for name in ("control", "ramp", "comparison")},
    }, indent=2))


if __name__ == "__main__":
    main()
