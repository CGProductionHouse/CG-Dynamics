"""Silent equal-timing A/B for a short, source-anchored bag-contact push."""

from __future__ import annotations

import hashlib
import subprocess
import tempfile
from pathlib import Path

import cv2
from PIL import Image, ImageDraw

from render_fight_contact_retime import EXPECTED_SHA, FONT, FPS, ROOT, SOURCE, maps

COUNT = 30
OUTPUT_FRAMES = maps()["contact_slow"]
PEAK_FRAME = 13
ANCHOR = (625.0, 510.0)  # bag/glove side; retain the bag at right frame edge


def strength(index: int) -> float:
    if index < 9 or index > 21:
        return 0.0
    if index <= PEAK_FRAME:
        return 0.06 * (index - 9) / (PEAK_FRAME - 9)
    return 0.06 * (21 - index) / (21 - PEAK_FRAME)


def push(frame, index: int):
    scale = 1.0 + strength(index)
    x, y = ANCHOR
    matrix = cv2.getRotationMatrix2D((x, y), 0, scale)
    return cv2.warpAffine(frame, matrix, (720, 1280), flags=cv2.INTER_LINEAR,
                          borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))


def annotate(frame, name: str, source_index: int) -> Image.Image:
    image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(image)
    draw.rectangle((10, 10, 282, 64), fill="black")
    draw.text((17, 15), name, fill="white")
    draw.text((17, 37), f"STOCK PRACTICE  /  source f{source_index}", fill="white")
    return image


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    if not SOURCE.is_file() or sha256(SOURCE) != EXPECTED_SHA or not FONT.is_file():
        raise RuntimeError("Missing or changed licensed practice source/font")
    cap = cv2.VideoCapture(str(SOURCE))
    if not cap.isOpened():
        raise RuntimeError("Cannot read practice source")
    frames = {}
    for index in set(OUTPUT_FRAMES):
        cap.set(cv2.CAP_PROP_POS_FRAMES, index)
        ok, frame = cap.read()
        if not ok or frame.shape[:2] != (1280, 720):
            raise RuntimeError(f"Missing frame {index}")
        frames[index] = frame
    cap.release()

    contact = Image.new("RGB", (6 * 360, 2 * 640), "#111111")
    with tempfile.TemporaryDirectory(prefix="fight-impact-push-") as temp:
        work = Path(temp)
        for row, name in enumerate(("PLAIN", "CONTACT PUSH")):
            folder = work / name.replace(" ", "-").lower()
            folder.mkdir()
            for out_index, source_index in enumerate(OUTPUT_FRAMES):
                frame = frames[source_index]
                if row:
                    frame = push(frame, out_index)
                image = annotate(frame, name, source_index)
                image.save(folder / f"{out_index:04d}.png")
                if out_index in (7, 10, 12, 13, 16, 21):
                    col = (7, 10, 12, 13, 16, 21).index(out_index)
                    contact.paste(image.resize((360, 640)), (col * 360, row * 640))
            subprocess.run([
                "ffmpeg", "-y", "-loglevel", "error", "-framerate", FPS,
                "-i", str(folder / "%04d.png"), "-frames:v", str(COUNT), "-an",
                "-c:v", "libx264", "-preset", "medium", "-crf", "19",
                "-pix_fmt", "yuv420p", str(ROOT / f"proof-fight-impact-push-{folder.name}.mp4"),
            ], check=True)

    contact.save(ROOT / "proof-fight-impact-push-contact.png")
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(ROOT / "proof-fight-impact-push-plain.mp4"),
        "-i", str(ROOT / "proof-fight-impact-push-contact-push.mp4"),
        "-filter_complex", "[0:v][1:v]hstack=inputs=2[v]", "-map", "[v]", "-an",
        "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
        str(ROOT / "proof-fight-impact-push-ab.mp4"),
    ], check=True)
    for name in ("plain", "contact-push", "ab"):
        path = ROOT / f"proof-fight-impact-push-{name}.mp4"
        print(name, sha256(path))


if __name__ == "__main__":
    main()
