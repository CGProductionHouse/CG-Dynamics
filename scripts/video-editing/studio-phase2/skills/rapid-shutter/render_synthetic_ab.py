"""Bounded original shutter-cut and tonal-cue A/B. Synthetic media only.

Run: py render_synthetic_ab.py OUTPUT_DIRECTORY
The pictures deliberately test timing and direction, not a client-ready design.
"""

from __future__ import annotations

import argparse
import subprocess
import wave
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FPS = 30
RATE = 48000
W, H = 540, 960
FRAMES = 120
CUT = 60


def font(size: int) -> ImageFont.FreeTypeFont:
    path = Path("C:/Windows/Fonts/arialbd.ttf")
    return ImageFont.truetype(str(path), size)


def scene(which: int, frame: int) -> np.ndarray:
    """Two distinct rooms linked by one circular object moving left to right."""
    bg = (235, 234, 228) if which == 0 else (18, 46, 72)
    fg = (17, 49, 70) if which == 0 else (241, 236, 221)
    accent = (230, 93, 49) if which == 0 else (247, 186, 63)
    im = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(im)
    # Strong architecture keeps orientation across the cut.
    d.rectangle((34, 124, 506, 758), outline=fg, width=6)
    d.line((40, 690, 500, 690), fill=fg, width=5)
    for x in (100, 270, 440):
        d.line((x, 125, x, 690), fill=fg, width=2)
    x = (70 if which == 0 else 270) + round(200 * frame / 59)
    y = 472 - round(52 * np.sin(np.pi * frame / 59))
    d.ellipse((x - 62, y - 62, x + 62, y + 62), fill=accent)
    d.arc((x - 37, y - 38, x + 37, y + 38), 12, 168, fill=bg, width=5)
    label = "ROOM 01" if which == 0 else "ROOM 02"
    d.text((48, 805), label, font=font(47), fill=fg)
    d.text((49, 863), "ONE DIRECTION / TWO SPACES", font=font(19), fill=fg)
    return np.asarray(im)


def shutter_frame(index: int) -> np.ndarray:
    # This alternates a few 1-frame glimpses around the real cut. The object
    # retains screen direction. Settle immediately; do not flash across a hold.
    map_ = {
        56: (0, 55), 57: (1, 0), 58: (0, 57), 59: (1, 1),
        60: (0, 59), 61: (1, 2), 62: (1, 3),
    }
    which, src = map_.get(index, (0, index) if index < CUT else (1, index - CUT))
    rgb = scene(which, src)
    if index in (57, 59, 61):
        # A narrow vertical directional blur, as shown in the reference's
        # 90-degree directional-blur control. Do not blur the entire sequence.
        rgb = cv2.filter2D(rgb, -1, np.ones((13, 1), np.float32) / 13)
    return rgb


def picture_frame(index: int, mode: str) -> np.ndarray:
    if mode == "shutter":
        return shutter_frame(index)
    return scene(0, index) if index < CUT else scene(1, index - CUT)


def render_picture(path: Path, mode: str) -> None:
    proc = subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
         "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0",
         "-an", "-c:v", "libx264", "-crf", "19", "-pix_fmt", "yuv420p", str(path)],
        stdin=subprocess.PIPE,
    )
    assert proc.stdin
    for i in range(FRAMES):
        proc.stdin.write(picture_frame(i, mode).tobytes())
    proc.stdin.close()
    if proc.wait():
        raise RuntimeError(f"FFmpeg failed for {path}")


def cue(mode: str) -> np.ndarray:
    """Same picture timing; one noise sweep versus one root-pitched sweep."""
    n = RATE * 4
    t = np.arange(n) / RATE
    audio = np.zeros(n, dtype=np.float64)
    # Quiet A drone supplies an explicit tonal context, not a commercial song.
    audio += 0.025 * np.sin(2 * np.pi * 220 * t)
    start, end = 1.72, 2.0
    region = (t >= start) & (t < end)
    rt = (t[region] - start) / (end - start)
    envelope = 0.08 * rt ** 1.8
    if mode == "tonal":
        freq = 220 + 220 * rt
        phase = 2 * np.pi * np.cumsum(freq) / RATE
        audio[region] += envelope * (np.sin(phase) + 0.20 * np.sin(2 * phase))
    else:
        rng = np.random.default_rng(874)
        audio[region] += envelope * rng.standard_normal(region.sum()) * 0.68
    # Same punctual cut accent in both. A short zero-mean pulse, not a borrowed hit.
    decay = np.arange(round(0.055 * RATE)) / RATE
    impact = 0.20 * np.exp(-85 * decay) * np.sin(2 * np.pi * 110 * decay)
    at = CUT * RATE // FPS
    audio[at:at + len(impact)] += impact
    fade = np.clip((4 - t) / 0.16, 0, 1)
    return np.clip(audio * fade, -0.95, 0.95)


def write_wav(path: Path, samples: np.ndarray) -> None:
    pcm = (samples * 32767).astype("<i2")
    with wave.open(str(path), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(pcm.tobytes())


def mux(video: Path, audio: Path, result: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(video),
         "-i", str(audio), "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
         "-shortest", str(result)], check=True,
    )


def contact(path: Path) -> None:
    frames = (55, 56, 57, 58, 59, 60, 61, 62, 64)
    out = Image.new("RGB", (W // 3 * len(frames), H // 3 * 2))
    for row, mode in enumerate(("plain", "shutter")):
        for col, i in enumerate(frames):
            out.paste(Image.fromarray(picture_frame(i, mode)).resize((W // 3, H // 3)),
                      (col * (W // 3), row * (H // 3)))
    out.save(path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for mode in ("plain", "shutter"):
        render_picture(args.output_dir / f"{mode}-silent.mp4", mode)
    for mode in ("noise", "tonal"):
        write_wav(args.output_dir / f"{mode}-cue.wav", cue(mode))
    mux(args.output_dir / "plain-silent.mp4", args.output_dir / "noise-cue.wav",
        args.output_dir / "plain-noise.mp4")
    mux(args.output_dir / "shutter-silent.mp4", args.output_dir / "tonal-cue.wav",
        args.output_dir / "shutter-tonal.mp4")
    contact(args.output_dir / "cut-contact.png")
