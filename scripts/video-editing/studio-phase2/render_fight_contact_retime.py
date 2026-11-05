"""Silent stock A/B: retain a real bag contact while retiming 59.94 fps footage."""

from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "media" / "fight-practice" / "pexels-7986157-720.mp4"
EXPECTED_SHA = "56d9d9b01954509236a5b81bec172f99d513afad9f2e880c33837b2cb06bf803"
FPS = "24000/1001"
COUNT = 30
FIRST, LAST = 50, 109
FONT = ROOT / "scene" / "assets" / "SpaceGrotesk.ttf"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def maps() -> dict[str, list[int]]:
    constant = np.rint(np.linspace(FIRST, LAST, COUNT)).astype(int)
    # Output-frame/source-frame anchors. Frames 70–80 surround the visibly
    # observed glove/bag contact near source frame 75; no synthetic frames.
    contact = np.rint(np.interp(
        np.arange(COUNT), [0, 8, 12, 18, COUNT - 1],
        [FIRST, 70, 74, 80, LAST],
    )).astype(int)
    for value in (constant, contact):
        assert value[0] == FIRST and value[-1] == LAST
        assert np.all(np.diff(value) > 0)
    return {"constant": constant.tolist(), "contact_slow": contact.tolist()}


def labelled(frame: np.ndarray, name: str, source_index: int) -> Image.Image:
    image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(FONT), 21)
    draw.rounded_rectangle((12, 12, 258, 75), radius=9, fill=(0, 0, 0, 205))
    draw.text((21, 15), name, font=font, fill="white")
    draw.text((21, 43), f"stock practice / source f{source_index}", fill="white")
    return image


def main() -> None:
    if not SOURCE.is_file() or sha256(SOURCE) != EXPECTED_SHA:
        raise RuntimeError("Missing or changed Pexels #7986157 practice source")
    frame_map = maps()
    capture = cv2.VideoCapture(str(SOURCE))
    if not capture.isOpened():
        raise RuntimeError("Cannot open practice source")
    capture.set(cv2.CAP_PROP_POS_FRAMES, FIRST)
    source_frames: dict[int, np.ndarray] = {}
    for index in range(FIRST, LAST + 1):
        ok, frame = capture.read()
        if not ok or frame.shape[:2] != (1280, 720):
            raise RuntimeError(f"Missing or unexpected source frame {index}")
        source_frames[index] = frame
    capture.release()

    samples: dict[str, list[Image.Image]] = {}
    with tempfile.TemporaryDirectory(prefix="fight-contact-retime-") as temp:
        folder = Path(temp)
        for name, indices in frame_map.items():
            frames_folder = folder / name
            frames_folder.mkdir()
            samples[name] = []
            for output_index, source_index in enumerate(indices):
                image = labelled(source_frames[source_index], name.upper(), source_index)
                image.save(frames_folder / f"{output_index:04d}.png")
                if output_index in (0, 5, 10, 13, 18, 24, 29):
                    samples[name].append(image)
            subprocess.run([
                "ffmpeg", "-y", "-loglevel", "error", "-framerate", FPS,
                "-i", str(frames_folder / "%04d.png"), "-frames:v", str(COUNT),
                "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "19",
                "-pix_fmt", "yuv420p", str(ROOT / f"proof-fight-contact-retime-{name}.mp4"),
            ], check=True)

    sheet = Image.new("RGB", (7 * 360, 2 * 640), "#111111")
    for row, name in enumerate(frame_map):
        for col, sample in enumerate(samples[name]):
            sheet.paste(sample.resize((360, 640)), (col * 360, row * 640))
    sheet.save(ROOT / "proof-fight-contact-retime-contact.png")
    print(json.dumps({
        "source_sha256": EXPECTED_SHA, "source_frames": [FIRST, LAST],
        "output_frames": COUNT, "fps": FPS,
        "maps": frame_map,
        "sha256": {name: sha256(ROOT / f"proof-fight-contact-retime-{name}.mp4")
                   for name in frame_map},
    }, indent=2))


if __name__ == "__main__":
    main()
