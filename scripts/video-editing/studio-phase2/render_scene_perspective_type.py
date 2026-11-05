"""Disposable flat-versus-ground-plane typography test on cleared stock."""

from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).parent
SOURCE = ROOT / "media" / "mixkit-2029-720.mp4"
FONT = ROOT / "scene" / "assets" / "SpaceGrotesk.ttf"
OUT = ROOT / "output" / "perspective-type"
EXPECTED_SHA256 = "45c834f4cc2909ad30584cfc192077b1250290c8fd7a1d93fdbc4ad0367c9e2a"
W, H = 1280, 720
FPS = "24000/1001"
N_FRAMES = 48


def check_source() -> None:
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != EXPECTED_SHA256:
        raise RuntimeError("Missing or changed licensed Mixkit #2029 source")
    if not FONT.exists():
        raise RuntimeError("Space Grotesk font missing")


def make_title() -> np.ndarray:
    img = Image.new("L", (640, 160))
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(str(FONT), 122)
    box = draw.textbbox((0, 0), "FOCUS", font=font, stroke_width=0)
    x = (640 - (box[2] - box[0])) // 2 - box[0]
    y = (160 - (box[3] - box[1])) // 2 - box[1]
    draw.text((x, y), "FOCUS", font=font, fill=255)
    return np.asarray(img)


def title_masks(title: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    src = np.float32([[0, 0], [639, 0], [639, 159], [0, 159]])
    # A patch on the real green, well away from the player's feet and flagpole.
    ground = np.float32([[830, 565], [1110, 565], [1210, 690], [755, 690]])
    front = np.float32([[785, 565], [1175, 565], [1175, 690], [785, 690]])
    warped = []
    for dst in (front, ground):
        matrix = cv2.getPerspectiveTransform(src, dst)
        mask = cv2.warpPerspective(title, matrix, (W, H), flags=cv2.INTER_CUBIC)
        warped.append(cv2.GaussianBlur(mask, (3, 3), 0.55).astype(np.float32) / 255.0)
    return warped[0], warped[1]


def compose(frame: np.ndarray, mask: np.ndarray) -> np.ndarray:
    # Let the grass texture remain visible through the painted letterforms.
    alpha = (mask * 0.67)[..., None]
    ink = np.array([216, 235, 236], dtype=np.float32)  # BGR muted off-white
    return np.clip(frame * (1.0 - alpha) + ink * alpha, 0, 255).astype(np.uint8)


def encode(path: Path, frames: list[np.ndarray]) -> None:
    proc = subprocess.Popen(
        [
            "ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24",
            "-s", f"{W}x{H}", "-r", FPS, "-i", "-", "-an", "-c:v", "libx264", "-crf", "18",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(path),
        ],
        stdin=subprocess.PIPE,
    )
    assert proc.stdin is not None
    for frame in frames:
        proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError(f"Encoding failed: {path}")


def main() -> None:
    check_source()
    OUT.mkdir(parents=True, exist_ok=True)
    masks = title_masks(make_title())
    reader = subprocess.Popen(
        ["ffmpeg", "-loglevel", "error", "-ss", "6.3", "-i", str(SOURCE),
         "-vf", f"fps={FPS}", "-frames:v", str(N_FRAMES), "-f", "rawvideo",
         "-pix_fmt", "bgr24", "-"],
        stdout=subprocess.PIPE,
    )
    assert reader.stdout is not None
    results: list[list[np.ndarray]] = [[], []]
    for _ in range(N_FRAMES):
        raw = reader.stdout.read(W * H * 3)
        if len(raw) != W * H * 3:
            raise RuntimeError("Short source decode")
        frame = np.frombuffer(raw, dtype=np.uint8).reshape(H, W, 3).copy()
        for i, mask in enumerate(masks):
            results[i].append(compose(frame, mask))
    reader.stdout.close()
    if reader.wait() != 0:
        raise RuntimeError("Source decode failed")
    encode(OUT / "flat-control.mp4", results[0])
    encode(OUT / "ground-plane.mp4", results[1])
    cv2.imwrite(str(OUT / "flat-frame.png"), results[0][10])
    cv2.imwrite(str(OUT / "ground-frame.png"), results[1][10])
    cv2.imwrite(str(OUT / "ground-phone.png"), cv2.resize(results[1][10], (480, 270)))
    print(OUT)


if __name__ == "__main__":
    main()
