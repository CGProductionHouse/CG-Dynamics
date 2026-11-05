"""Synthetic steady versus restrained-opacity entrance; no client source.

Usage: python render_flicker_ab.py OUTPUT_DIR
"""

import argparse
import subprocess
from pathlib import Path

from PIL import Image

from render_shine_ab import FPS, FRAMES, H, W, font_face, frame, title_mask


def opacity(index: int, mode: str) -> float:
    if index < 12:
        return 0.0
    if mode == "steady":
        return 1.0
    # One brief opacity accent; it settles before the readable hold.
    return {12: 0.75, 13: 1.0, 14: 0.75}.get(index, 1.0)


def render(path: Path, mode: str, glyphs: Image.Image) -> None:
    proc = subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
         "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0",
         "-an", "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", str(path)],
        stdin=subprocess.PIPE,
    )
    assert proc.stdin
    for i in range(FRAMES):
        proc.stdin.write(frame(i, "steady", glyphs, opacity(i, mode)).tobytes())
    proc.stdin.close()
    if proc.wait():
        raise RuntimeError(f"FFmpeg encode failed: {mode}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    glyphs = title_mask(font_face(58))
    for mode in ("steady", "flicker"):
        render(args.output_dir / f"synthetic-{mode}.mp4", mode, glyphs)
    contact = Image.new("RGB", (W * 6, H * 2))
    for row, mode in enumerate(("steady", "flicker")):
        for col, i in enumerate((11, 12, 13, 14, 15, 16)):
            contact.paste(frame(i, "steady", glyphs, opacity(i, mode)),
                          (col * W, row * H))
    contact.resize((270 * 6, 480 * 2)).save(args.output_dir / "flicker-contact.png")
