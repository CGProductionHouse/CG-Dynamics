"""Synthetic 2-second end-button placement A/B; no event media or approved claim."""

from __future__ import annotations

import hashlib
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
FONT = ROOT / "scene" / "assets" / "SpaceGrotesk.ttf"
W, H, FPS, FRAMES = 1080, 1920, 24, 48


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def frame(index: int, unsafe: bool) -> Image.Image:
    image = Image.new("RGB", (W, H), "#111417")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, W, 28), fill="#e8eeeb")
    draw.rectangle((0, 28, W, 40), fill="#c3322f")
    draw.text((80, 150), "SYNTHETIC TITLE PLACEMENT", font=ImageFont.truetype(str(FONT), 34), fill="#929a9c")
    # Same appearance and animation in both outputs; only the vertical placement differs.
    offset = round(25 * (1 - min(index / 8, 1)))
    alpha = min(255, round(255 * index / 7))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ink = ImageDraw.Draw(layer)
    title_y = (1630 if unsafe else 1210) + offset
    subtitle_y = (1790 if unsafe else 1390) + offset
    ink.text((W / 2, title_y), "FIGHT NIGHT", anchor="mt",
             font=ImageFont.truetype(str(FONT), 132), fill=(245, 245, 238, alpha), stroke_width=0)
    ink.text((W / 2, subtitle_y), "TRAILER STUDY", anchor="mt",
             font=ImageFont.truetype(str(FONT), 60), fill=(213, 67, 60, alpha))
    image.paste(layer, (0, 0), layer)
    return image


def render(unsafe: bool) -> None:
    name = "proof-fight-title-unsafe.mp4" if unsafe else "proof-fight-title-contained.mp4"
    with tempfile.TemporaryDirectory(prefix="fight-title-") as temp:
        folder = Path(temp)
        for i in range(FRAMES):
            frame(i, unsafe).save(folder / f"frame-{i:03}.png")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS),
                        "-i", str(folder / "frame-%03d.png"), "-frames:v", str(FRAMES),
                        "-c:v", "libx264", "-crf", "19", "-pix_fmt", "yuv420p",
                        str(ROOT / name)], check=True)
    print(name, sha256(ROOT / name))


if __name__ == "__main__":
    render(False)
    render(True)
    sheet = Image.new("RGB", (540, 480), "#000000")
    sheet.paste(frame(18, False).resize((270, 480)), (0, 0))
    sheet.paste(frame(18, True).resize((270, 480)), (270, 0))
    sheet.save(ROOT / "proof-fight-title-phone-comparison.png")
