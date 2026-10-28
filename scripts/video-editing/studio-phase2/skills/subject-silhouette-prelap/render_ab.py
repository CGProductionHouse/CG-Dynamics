"""One incoming-subject matte prelap, reusing the licensed green-screen proof.

Not natural-background segmentation or a CapCut-template extraction.
Usage: python render_ab.py --output-dir PRIVATE_DIR
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "media/mixkit-28306-2160.mp4"
SOURCE_SHA = "80e0bf3d84faf6e2b0efabfc9001aeadde09e1ce56d0530360ceff5b9be596a5"
W, H, FPS, COUNT, CUT = 540, 960, 30, 72, 36
FW, FH = 400, 710


def encode(path: Path, frames: list[np.ndarray]) -> None:
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                          "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264",
                          "-crf", "18", "-pix_fmt", "yuv420p", str(path)], stdin=subprocess.PIPE)
    for frame in frames:
        p.stdin.write(frame.tobytes())
    p.stdin.close()
    if p.wait():
        raise RuntimeError("encode failed")


def stage(i: int, incoming: bool) -> np.ndarray:
    yy, xx = np.mgrid[:H, :W]
    color = np.array((17, 52, 64) if not incoming else (56, 39, 31))
    glow = np.exp(-((xx - (370 + i * .8)) ** 2 + (yy - 280) ** 2) / 150000)
    return np.clip(color + glow[..., None] * np.array((24, 28, 32)), 0, 255).astype(np.uint8)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SOURCE_SHA:
        raise RuntimeError("Missing/changed licensed source; do not substitute silently")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    raw = subprocess.check_output([
        "ffmpeg", "-v", "error", "-ss", "3", "-i", str(SOURCE), "-t", "1.2",
        "-vf", f"crop=1215:2160:1312:0,scale={FW}:{FH},fps={FPS},"
               "chromakey=0x56ee00:0.13:0.09,despill=type=green:mix=0.7:expand=0.05,format=rgba",
        "-frames:v", "36", "-pix_fmt", "rgba", "-f", "rawvideo", "-",
    ])
    subject = np.frombuffer(raw, np.uint8).reshape(36, FH, FW, 4)
    plain, effect, changed = [], [], []
    for i in range(COUNT):
        a = stage(i, i >= CUT)
        b = a.copy()
        if i >= CUT:
            fg = subject[i - CUT]
            alpha = fg[..., 3:4].astype(float) / 255
            a[H-FH:, :FW] = np.rint(a[H-FH:, :FW] * (1-alpha) + fg[..., :3] * alpha)
            b = a.copy()
        if 34 <= i <= 36:
            # Incoming pose is held for anticipation, then resolves on its actual first frame.
            alpha = subject[0, ..., 3:4].astype(float) / 255
            b[H-FH:, :FW] = np.rint(stage(i, i >= CUT)[H-FH:, :FW] * (1-alpha)
                                       + np.array((242, 239, 227)) * alpha)
        if np.any(a != b):
            changed.append(i)
        plain.append(a)
        effect.append(b)
    assert changed == [34, 35, 36]
    encode(args.output_dir / "plain.mp4", plain)
    encode(args.output_dir / "silhouette.mp4", effect)
    # Original non-tonal 90 ms accent; separate stem, not the reference's sound.
    rate = 48000
    samples = np.zeros(round(COUNT / FPS * rate), dtype=np.float64)
    rng = np.random.default_rng(874)
    n = round(.09 * rate)
    noise = rng.normal(size=n)
    high = np.r_[noise[0], np.diff(noise)]
    cue = high / max(abs(high)) * np.sin(np.linspace(0, np.pi, n)) ** 2 * .16
    at = round(34 / FPS * rate)
    samples[at:at+n] = cue
    with wave.open(str(args.output_dir / "accent.wav"), "wb") as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(rate)
        f.writeframes(np.rint(samples * 32767).astype("<i2").tobytes())
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(args.output_dir / "silhouette.mp4"),
                    "-i", str(args.output_dir / "accent.wav"), "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest",
                    str(args.output_dir / "silhouette-accent.mp4")], check=True)
    contact = Image.new("RGB", (540*4, 960*2))
    for col, i in enumerate((33, 34, 36, 37)):
        for row, seq in enumerate((plain, effect)):
            contact.paste(Image.fromarray(seq[i]), (col*W, row*H))
    contact.resize((1080, 960)).save(args.output_dir / "contact.jpg", quality=92)
    receipt = {"source_sha256": SOURCE_SHA, "source_in": 3, "fps": FPS, "frames": COUNT,
               "cut_frame": CUT, "preencode_changed_frames": changed, "matte_origin": [0, H-FH],
               "grounding": "cropped left hand at frame-left; body at frame-bottom",
               "sound": "original noise accent; measured construction only, unheard",
               "outputs": {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                           for p in args.output_dir.glob("*.mp4")}}
    (args.output_dir / "receipt.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    print(json.dumps(receipt))


if __name__ == "__main__":
    main()
