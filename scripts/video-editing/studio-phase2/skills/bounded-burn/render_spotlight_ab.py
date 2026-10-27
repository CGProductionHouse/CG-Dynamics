"""Private plain versus source-motivated spotlight exposure A/B.

The first synthetic burn was rejected as a stripe; this tests a different,
source-tied hypothesis on a licensed stage performance. No client picture.
"""
from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

SOURCE = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\freeze-frame-refined-20261027\mixkit-1038-720.mp4")
OUT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\spotlight-bloom-20261027")
SHA = "0678de048ee448ed7c363b41ed80ccc67f42975a2afadf167f5042946de2fd17"
W, H, FPS, N = 1280, 720, 24, 48


def frame_at(cap: cv2.VideoCapture, t: float) -> np.ndarray:
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    good, bgr = cap.read()
    if not good or bgr.shape[:2] != (H, W):
        raise RuntimeError(f"Frame missing at {t}")
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def bloom(frame: np.ndarray, index: int, texture: np.ndarray) -> np.ndarray:
    # Light is anchored to the actual overhead spotlight. The organic low-frequency
    # texture prevents a perfectly smooth computer-generated stripe.
    pulse = {22: .10, 23: .23, 24: .39, 25: .19, 26: .07}.get(index, 0.)
    if not pulse:
        return frame
    y, x = np.mgrid[:H, :W].astype(np.float32)
    radial = np.exp(-(((x - 610) / 380) ** 2 + ((y + 15) / 270) ** 2) / 2)
    alpha = (pulse * radial * (.78 + .22 * texture))[..., None]
    light = np.array([250, 246, 229], dtype=np.float32)[None, None, :]
    return np.clip(frame * (1 - alpha) + light * alpha, 0, 255).astype(np.uint8)


def encode(path: Path, frames: list[np.ndarray]) -> None:
    process = subprocess.Popen([
        "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0", "-an",
        "-c:v", "libx264", "-crf", "19", "-pix_fmt", "yuv420p", str(path),
    ], stdin=subprocess.PIPE)
    assert process.stdin
    for frame in frames:
        process.stdin.write(frame.tobytes())
    process.stdin.close()
    if process.wait():
        raise RuntimeError(f"Encode failed: {path}")


def main() -> None:
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SHA:
        raise RuntimeError("Practice source hash changed")
    OUT.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(SOURCE))
    plain = [frame_at(cap, (8.6 + i / FPS) if i < 24 else (10.6 + (i - 24) / FPS)) for i in range(N)]
    cap.release()
    rng = np.random.default_rng(270)
    noise = rng.random((12, 20), dtype=np.float32)
    texture = cv2.GaussianBlur(cv2.resize(noise, (W, H)), (0, 0), 48)
    texture = (texture - texture.min()) / max(float(texture.max() - texture.min()), 1e-8)
    candidate = [bloom(frame, i, texture) for i, frame in enumerate(plain)]
    encode(OUT / "plain.mp4", plain)
    encode(OUT / "spotlight-bloom.mp4", candidate)
    selected = (20, 21, 22, 23, 24, 25, 26, 27)
    contact = Image.new("RGB", (8 * 230, 2 * 150), "white")
    draw = ImageDraw.Draw(contact)
    for row, frames in enumerate((plain, candidate)):
        for col, i in enumerate(selected):
            x, y = col * 230, row * 150
            contact.paste(Image.fromarray(frames[i]).resize((230, 130)), (x, y))
            draw.text((x + 3, y + 132), f"{('plain', 'bloom')[row]} {i}", fill="black")
    contact.save(OUT / "cut-contact.jpg", quality=92)
    Image.fromarray(candidate[24]).save(OUT / "cut-full-size.png")


if __name__ == "__main__":
    main()
