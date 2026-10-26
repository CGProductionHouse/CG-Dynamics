"""Synthetic masked-shine visual A/B. No client media or external assets.

Usage: python render_shine_ab.py OUTPUT_DIR
The output is a visual construction proof, not a native editable client title.
"""

import argparse
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


W, H, FPS, FRAMES = 540, 960, 24, 72
TITLE = "ECHOFORM"  # Fictional practice identity.
BASE = (120, 177, 163)


def font_face(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts/montserrat-bold.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    raise FileNotFoundError("No local bold font for the synthetic proof")


def title_mask(font: ImageFont.FreeTypeFont) -> Image.Image:
    mask = Image.new("L", (W, H), 0)
    draw = ImageDraw.Draw(mask)
    box = draw.textbbox((0, 0), TITLE, font=font)
    x = (W - (box[2] - box[0])) // 2 - box[0]
    y = 403 - box[1]
    draw.text((x, y), TITLE, font=font, fill=255)
    return mask


def frame(index: int, mode: str, mask: Image.Image, title_opacity: float = 1.0) -> Image.Image:
    # A restrained synthetic stage makes the title the only changed variable.
    im = Image.new("RGB", (W, H))
    pix = im.load()
    for y in range(H):
        t = y / H
        row = (round(10 + 12 * t), round(30 + 16 * t), round(38 + 18 * t))
        for x in range(W):
            pix[x, y] = row
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle((44, 345, W - 44, 575), radius=22, outline=(52, 83, 85), width=2)
    draw.line((44, 600, W - 44, 600), fill=(51, 81, 82), width=2)
    draw.text((W // 2, 632), "A MOMENT OF FOCUS", font=font_face(19),
              anchor="ma", fill=(147, 178, 173))
    base_layer = Image.new("RGB", (W, H), BASE)
    if title_opacity < 1.0:
        mask_for_frame = mask.point(lambda value: round(value * title_opacity))
    else:
        mask_for_frame = mask
    im.paste(base_layer, (0, 0), mask_for_frame)

    if mode == "shine" and 14 <= index <= 35:
        # Narrow diagonal highlight: it only replaces pixels *inside* the glyph mask.
        # The sweep enters at the left edge and clears the right edge in 0.92 s.
        centre = -80 + (index - 14) / 21 * (W + 160)
        out = im.load()
        mp = mask.load()
        for y in range(360, 525):
            for x in range(W):
                if not mp[x, y]:
                    continue
                distance = abs(x - 0.33 * (y - 430) - centre)
                strength = max(0.0, 1.0 - distance / 38)
                strength = strength ** 1.6 * 0.78 * (mp[x, y] / 255)
                if strength:
                    old = out[x, y]
                    out[x, y] = tuple(round(old[c] * (1 - strength) + 255 * strength)
                                      for c in range(3))
    return im


def render(path: Path, mode: str, mask: Image.Image) -> None:
    proc = subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
         "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0",
         "-an", "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", str(path)],
        stdin=subprocess.PIPE,
    )
    assert proc.stdin
    for i in range(FRAMES):
        proc.stdin.write(frame(i, mode, mask).tobytes())
    proc.stdin.close()
    if proc.wait():
        raise RuntimeError(f"FFmpeg encode failed: {mode}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    glyphs = title_mask(font_face(58))
    for mode in ("steady", "shine"):
        render(args.output_dir / f"synthetic-title-{mode}.mp4", mode, glyphs)
    for i in (13, 20, 25, 30, 36):
        frame(i, "shine", glyphs).save(args.output_dir / f"shine-frame-{i:02d}.png")
