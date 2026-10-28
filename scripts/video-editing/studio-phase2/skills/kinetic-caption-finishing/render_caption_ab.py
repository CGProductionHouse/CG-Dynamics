"""Small visual A/B for a title treatment; source stays outside Git.

Usage: python render_caption_ab.py SOURCE.mp4 OUTPUT_DIR
This is a comparison proof, not a client-film renderer or native editable project.
"""

import argparse
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


W, H, FPS, FRAMES = 540, 960, 24, 96
YELLOW = (251, 225, 6)
WHITE = (249, 247, 240)


def ease(value):
    value = max(0.0, min(1.0, value))
    return 1 - (1 - value) ** 3


def draw_variant(frame, index, font, variant):
    frame = frame.convert("RGBA")
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    brush = ImageDraw.Draw(overlay)
    words = ("NET IETS", "VIR IEMAND")  # Technical placeholder, not approved copy.
    positions = (455, 540)
    if variant == "motion":
        # Local readability wash, with a feathered top/bottom. No dark text stroke.
        for y in range(370, 690):
            envelope = min(1.0, (y - 370) / 70, (690 - y) / 90)
            brush.line((0, y, W, y), fill=(0, 0, 0, round(118 * max(0, envelope))))
    for line, (word, y) in enumerate(zip(words, positions)):
        start = (0.55 if variant == "static" else 0.30 + 0.38 * line) * FPS
        progress = ease((index - start) / (1 if variant == "static" else 10))
        if progress == 0:
            continue
        box = brush.textbbox((0, 0), word, font=font)
        text_w = box[2] - box[0]
        x = (W - text_w) // 2
        shift = 0 if variant == "static" else round((1 - progress) * 58)
        colour = WHITE if line == 0 else YELLOW
        brush.text((x, y + shift), word, font=font, fill=(*colour, round(255 * progress)))
    frame.alpha_composite(overlay)
    return frame.convert("RGB")


def make(source, out, font, variant):
    reader = subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", "0.4", "-i", str(source),
         "-vf", f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}",
         "-frames:v", str(FRAMES), "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"],
        stdout=subprocess.PIPE,
    )
    writer = subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0", "-an", "-c:v", "libx264", "-crf", "20",
         "-pix_fmt", "yuv420p", str(out)],
        stdin=subprocess.PIPE,
    )
    assert reader.stdout and writer.stdin
    try:
        for i in range(FRAMES):
            pixels = reader.stdout.read(W * H * 3)
            if len(pixels) != W * H * 3:
                raise RuntimeError(f"Source ended at frame {i}")
            image = Image.frombytes("RGB", (W, H), pixels)
            writer.stdin.write(draw_variant(image, i, font, variant).tobytes())
    finally:
        reader.stdout.close()
        writer.stdin.close()
    if reader.wait() or writer.wait():
        raise RuntimeError("FFmpeg source decode or proof encode failed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--font", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    face = ImageFont.truetype(str(args.font), 51)
    try:
        face.set_variation_by_name("Bold")
    except OSError:
        pass
    for mode in ("static", "motion"):
        make(args.source, args.output_dir / f"caption-{mode}.mp4", face, mode)
