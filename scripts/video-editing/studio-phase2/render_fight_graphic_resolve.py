"""One silent, source-specific glove-detail-to-clean-contact visual A/B."""

from __future__ import annotations

import hashlib
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "media" / "fight-practice" / "40974.mp4"
LABEL = ROOT / "output" / "fight-practice" / "stock-practice-label.png"
EXPECTED = "938bba8c5c586d700be40e2cabf628713dcc440caefb931d8229d1e99f1ce634"
FRAME_COUNT = 48
SIZE = (1080, 1920)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def resolve_frame(original: Image.Image, index: int) -> Image.Image:
    # The punch in this source reaches the face near source 5.375 s, output ≈0.725 s.
    # Complete the graphic release beforehand; never alter the contact frame.
    release = smoothstep((index - 6) / 11)
    zoom = 2.25 - 1.25 * release
    centre_x = 470 - 110 * release
    centre_y = 685 - 45 * release
    crop_w, crop_h = 720 / zoom, 1280 / zoom
    box = (round(centre_x - crop_w / 2), round(centre_y - crop_h / 2),
           round(centre_x + crop_w / 2), round(centre_y + crop_h / 2))
    result = original.crop(box).resize(SIZE, Image.Resampling.LANCZOS)

    if index < 17:
        graphic = ImageOps.posterize(ImageOps.grayscale(result).convert("RGB"), 4)
        graphic = ImageEnhance.Contrast(graphic).enhance(1.45)
        result = Image.blend(graphic, result, release)
        # One short focus streak during the zoom release, fully gone before contact.
        if 10 <= index <= 14:
            strength = (1 - abs(index - 12) / 3) * 0.30
            result = Image.blend(result, result.filter(ImageFilter.GaussianBlur(7)), strength)
    return result


def encode(frames: Path, destination: Path) -> None:
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-framerate", "24000/1001",
        "-i", str(frames / "frame-%03d.png"), "-frames:v", str(FRAME_COUNT),
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-an", str(destination),
    ], check=True)
    print(destination.name, sha256(destination))


def main() -> None:
    if not SOURCE.is_file() or sha256(SOURCE) != EXPECTED or not LABEL.is_file():
        raise SystemExit("Practice source or watermark missing/changed")
    with tempfile.TemporaryDirectory(prefix="fight-graphic-resolve-") as temp:
        base = Path(temp)
        source_frames = base / "source"
        control_frames = base / "control"
        effect_frames = base / "effect"
        for folder in (source_frames, control_frames, effect_frames):
            folder.mkdir()
        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error", "-ss", "4.65", "-i", str(SOURCE),
            "-frames:v", str(FRAME_COUNT), str(source_frames / "frame-%03d.png"),
        ], check=True)
        watermark = Image.open(LABEL).convert("RGBA")
        for index in range(FRAME_COUNT):
            original = Image.open(source_frames / f"frame-{index + 1:03}.png").convert("RGB")
            for name, picture in [("control", original.resize(SIZE, Image.Resampling.LANCZOS)),
                                  ("effect", resolve_frame(original, index))]:
                canvas = picture.convert("RGBA")
                canvas.alpha_composite(watermark)
                canvas.convert("RGB").save(base / name / f"frame-{index:03}.png")
        encode(control_frames, ROOT / "proof-fight-graphic-control.mp4")
        encode(effect_frames, ROOT / "proof-fight-graphic-resolve.mp4")


if __name__ == "__main__":
    main()
