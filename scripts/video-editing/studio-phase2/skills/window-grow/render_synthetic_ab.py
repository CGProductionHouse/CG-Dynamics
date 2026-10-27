"""Original window-grow versus plain cut. No client or tutorial media.

Run: py render_synthetic_ab.py OUTPUT_DIRECTORY
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS, FRAMES = 540, 960, 30, 90
START, END = 36, 54


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", size)


def incoming(i: int) -> Image.Image:
    im = Image.new("RGB", (W, H), (21, 48, 75))
    d = ImageDraw.Draw(im)
    # The same entire moving scene is visible inside the screen and after the reveal.
    for n in range(5):
        x = 36 + 96 * n - (i % 24) * 2
        d.rounded_rectangle((x, 120 + 110 * n, x + 64, 400 + 110 * n),
                            radius=22, fill=(30 + n * 13, 97 + n * 8, 121 + n * 8))
    x = 52 + 5 * i
    d.ellipse((x - 44, 482, x + 44, 570), fill=(252, 186, 57))
    d.text((58, 746), "A NEW VIEW", font=font(48), fill=(252, 245, 231))
    d.text((59, 820), "CONTINUOUS SCENE", font=font(20), fill=(252, 245, 231))
    return im


def background(i: int) -> Image.Image:
    im = Image.new("RGB", (W, H), (236, 227, 208))
    d = ImageDraw.Draw(im)
    d.line((0, 735, W, 735), fill=(100, 79, 66), width=9)
    d.rectangle((0, 742, W, H), fill=(146, 119, 91))
    d.text((66, 110), "FOLLOW THE SCREEN", font=font(32), fill=(27, 51, 68))
    d.text((114, 166), "same moving view inside", font=font(17), fill=(27, 51, 68))
    # A small, finite physical frame: no unsupported floating masked subject.
    d.rounded_rectangle((119, 224, 421, 736), radius=31,
                        fill=(19, 25, 30), outline=(40, 40, 40), width=3)
    d.rounded_rectangle((125, 230, 415, 730), radius=25,
                        outline=(244, 244, 240), width=3)
    d.ellipse((258, 704, 282, 728), fill=(204, 203, 197))
    return im


def ease(v: float) -> float:
    v = max(0.0, min(1.0, v))
    return v * v * (3 - 2 * v)


def frame(i: int, mode: str) -> Image.Image:
    if mode == "plain" and i >= (START + END) // 2:
        return incoming(i)
    if i >= END:
        return incoming(i)
    canvas = background(i)
    p = ease((i - START) / (END - START)) if mode == "grow" else 0.0
    x0 = round(135 * (1 - p))
    y0 = round(240 * (1 - p))
    x1 = round(405 + 135 * p)
    y1 = round(720 + 240 * p)
    scene = incoming(i).resize((x1 - x0, y1 - y0), Image.Resampling.BICUBIC)
    canvas.paste(scene, (x0, y0))
    if p == 0:
        d = ImageDraw.Draw(canvas)
        d.rectangle((x0, y0, x1 - 1, y1 - 1), outline=(240, 238, 226), width=3)
    return canvas


def render(path: Path, mode: str) -> None:
    proc = subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
         "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0",
         "-an", "-c:v", "libx264", "-crf", "19", "-pix_fmt", "yuv420p", str(path)],
        stdin=subprocess.PIPE,
    )
    assert proc.stdin
    for i in range(FRAMES):
        proc.stdin.write(np.asarray(frame(i, mode)).tobytes())
    proc.stdin.close()
    if proc.wait():
        raise RuntimeError(path)


def contact(path: Path) -> None:
    times = (34, 38, 42, 46, 50, 53, 54, 60)
    tile_w, tile_h = 180, 320
    out = Image.new("RGB", (tile_w * len(times), tile_h * 2))
    for row, mode in enumerate(("plain", "grow")):
        for col, i in enumerate(times):
            out.paste(frame(i, mode).resize((tile_w, tile_h)), (col * tile_w, row * tile_h))
    out.save(path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for mode in ("plain", "grow"):
        render(args.output_dir / f"{mode}.mp4", mode)
    contact(args.output_dir / "grow-contact.png")
