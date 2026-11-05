"""Render an original synthetic tabletop-card timing comparison.

This tests frame-hold timing, not physical stop-motion photography.
Usage: python render_stepped_timing.py OUTPUT_DIR
"""

import argparse
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


WIDTH, HEIGHT, FPS, FRAMES = 540, 960, 30, 72
FONT_BOLD = Path("C:/Windows/Fonts/arialbd.ttf")
FONT_REGULAR = Path("C:/Windows/Fonts/arial.ttf")


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def card_art() -> Image.Image:
    card = Image.new("RGBA", (248, 320), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle((5, 5, 243, 315), radius=13,
                           fill=(252, 247, 231, 255), outline=(33, 49, 61, 255), width=3)
    draw.rectangle((22, 25, 226, 38), fill=(238, 104, 72, 255))
    draw.text((24, 58), "FIELD NOTE", font=font(FONT_BOLD, 22), fill=(33, 49, 61, 255))
    draw.text((22, 107), "MOVE", font=font(FONT_BOLD, 58), fill=(33, 49, 61, 255))
    draw.line((24, 183, 224, 183), fill=(33, 49, 61, 255), width=2)
    draw.text((24, 204), "FRAME BY FRAME", font=font(FONT_REGULAR, 19),
              fill=(33, 49, 61, 255))
    draw.ellipse((171, 247, 221, 297), fill=(238, 104, 72, 255))
    draw.text((181, 260), "01", font=font(FONT_BOLD, 20), fill=(255, 255, 255, 255))
    return card


def background() -> Image.Image:
    canvas = Image.new("RGB", (WIDTH, HEIGHT), (218, 201, 174))
    draw = ImageDraw.Draw(canvas)
    for y in range(0, HEIGHT, 4):
        draw.line((0, y, WIDTH, y), fill=(215 + y % 3, 199, 173), width=1)
    draw.rectangle((0, 0, WIDTH, 104), fill=(35, 52, 62))
    draw.text((25, 31), "MOTION STUDY  /  01", font=font(FONT_BOLD, 25),
              fill=(250, 246, 229))
    draw.text((25, 905), "SYNTHETIC TABLETOP / NO AUDIO", font=font(FONT_REGULAR, 18),
              fill=(35, 52, 62))
    return canvas


def smooth(t: float) -> float:
    return t * t * (3 - 2 * t)


def make_frame(base: Image.Image, card: Image.Image, frame: int, hold: int) -> Image.Image:
    step = (frame // hold) * hold
    progress = smooth(step / (FRAMES - 1))
    x = round(-210 + 358 * progress)
    y = round(646 - 267 * progress)
    angle = -17 + 24 * progress
    paper = card.rotate(angle, Image.Resampling.BICUBIC, expand=True)
    picture = base.copy().convert("RGBA")
    mask = paper.getchannel("A")
    shadow = Image.new("RGBA", paper.size, (25, 29, 31, 0))
    shadow.putalpha(mask.point(lambda value: round(value * 0.30)).filter(
        ImageFilter.GaussianBlur(11)))
    picture.alpha_composite(shadow, (x + 13, y + 17))
    picture.alpha_composite(paper, (x, y))
    return picture.convert("RGB")


def render(destination: Path, hold: int) -> None:
    base, paper = background(), card_art()
    process = subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
         "-pix_fmt", "rgb24", "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS),
         "-i", "pipe:0", "-an", "-c:v", "libx264", "-crf", "18", "-preset", "medium",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(destination)],
        stdin=subprocess.PIPE,
    )
    assert process.stdin is not None
    try:
        for frame in range(FRAMES):
            process.stdin.write(make_frame(base, paper, frame, hold).tobytes())
    finally:
        process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError(f"FFmpeg failed for {destination}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for hold, label in [(1, "continuous"), (2, "two-frame"), (4, "four-frame")]:
        render(args.output / f"synthetic-card-{label}.mp4", hold)
