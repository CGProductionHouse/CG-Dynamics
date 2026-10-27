"""Small original burn-overlay A/B. No downloaded effects or client media.

Run: py render_synthetic_ab.py PRIVATE_OUTPUT_DIRECTORY
This tests transition readability, not an editor preset or creative approval.
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

W, H, FPS, N, CUT = 540, 960, 30, 36, 18


def picture(i: int) -> np.ndarray:
    # The same visible yellow object continues in place across a location change.
    before = i < CUT
    im = Image.new("RGB", (W, H), (28, 53, 73) if before else (36, 71, 60))
    d = ImageDraw.Draw(im)
    if before:
        d.rectangle((0, 705, W, H), fill=(57, 85, 103))
        d.line((0, 704, W, 704), fill=(213, 205, 171), width=6)
        d.rectangle((338, 180, 405, 705), fill=(40, 66, 81))
    else:
        d.rectangle((0, 705, W, H), fill=(97, 101, 61))
        d.line((0, 704, W, 704), fill=(214, 207, 160), width=6)
        d.ellipse((325, 112, 490, 275), fill=(56, 95, 68))
    x = 245 + (i - CUT) * 6
    d.ellipse((x - 78, 455, x + 78, 611), fill=(249, 187, 65))
    d.ellipse((x - 27, 484, x + 27, 538), fill=(255, 222, 137))
    return np.asarray(im)


def burn(frame: np.ndarray, i: int) -> np.ndarray:
    if i not in (CUT - 1, CUT, CUT + 1, CUT + 2):
        return frame
    y, x = np.mgrid[:H, :W].astype(np.float32)
    # A narrow irregular light-leak band travels left-to-right. It does not
    # replace the new picture or turn the entire frame white.
    phase = (i - (CUT - 1)) / 3
    centre = -100 + phase * (W + 200) + 22 * np.sin(y / 103)
    distance = np.abs(x - centre)
    band = np.clip((125 - distance) / 125, 0, 1) ** 1.6
    strength = np.float32(0.52) * band[..., None]
    light = np.array([255, 170, 69], dtype=np.float32)[None, None, :]
    return np.clip(frame * (1 - strength) + light * strength, 0, 255).astype(np.uint8)


def render(path: Path, mode: str) -> list[Image.Image]:
    proc = subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
         "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0",
         "-an", "-c:v", "libx264", "-crf", "19", "-pix_fmt", "yuv420p", str(path)],
        stdin=subprocess.PIPE,
    )
    assert proc.stdin
    samples = []
    for i in range(N):
        frame = picture(i)
        if mode == "burn":
            frame = burn(frame, i)
        if i in (16, 17, 18, 19, 20, 22):
            samples.append(Image.fromarray(frame).resize((180, 320)))
        proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    if proc.wait():
        raise RuntimeError(path)
    return samples


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    contact = Image.new("RGB", (180 * 6, 320 * 2))
    for row, mode in enumerate(("plain", "burn")):
        for col, sample in enumerate(render(args.output_dir / f"{mode}.mp4", mode)):
            contact.paste(sample, (col * 180, row * 320))
    contact.save(args.output_dir / "burn-contact.jpg", quality=92)
