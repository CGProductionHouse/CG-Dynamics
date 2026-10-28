"""Private same-source plain-title versus footage-in-type workshop proof."""

from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SOURCE = Path(r"C:\Users\chris\Videos\CG-AI-Editing\TBS-Nov-2026\restart-source\mixkit-carpenter-saw-39691.mp4")
OUT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\footage-in-type-workshop-20261027")
FONT = Path(__file__).resolve().parents[2] / "scene/assets/SpaceGrotesk.ttf"
SOURCE_SHA = "186bc1eb994695af1d7c2312d3f8ea6aac0a4e23767d24727471066e7cceb618"
W, H, FPS, N = 540, 960, 24, 48
BLACK = np.array((6, 9, 12), dtype=np.uint8)


def encode(path: Path, frames: list[np.ndarray]) -> None:
    process = subprocess.Popen([
        "ffmpeg", "-nostdin", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0", "-an",
        "-c:v", "libx264", "-crf", "19", "-pix_fmt", "yuv420p", str(path),
    ], stdin=subprocess.PIPE)
    assert process.stdin
    for frame in frames:
        process.stdin.write(frame.tobytes())
    process.stdin.close()
    if process.wait():
        raise RuntimeError(f"Encoding failed: {path}")


def main() -> None:
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SOURCE_SHA:
        raise RuntimeError("Practice source changed")
    OUT.mkdir(exist_ok=True, parents=True)
    cap = cv2.VideoCapture(str(SOURCE))
    source = []
    for index in range(N):
        cap.set(cv2.CAP_PROP_POS_MSEC, (2 + index / FPS) * 1000)
        good, frame = cap.read()
        if not good:
            raise RuntimeError(f"Missing frame {index}")
        source.append(cv2.cvtColor(cv2.resize(frame, (W, H)), cv2.COLOR_BGR2RGB))
    cap.release()
    font = ImageFont.truetype(str(FONT), 220)
    font.set_variation_by_name("Bold")
    layer = Image.new("L", (W, H), 0)
    draw = ImageDraw.Draw(layer)
    bounds = draw.textbbox((0, 0), "CUT", font=font)
    x = round((W - (bounds[2] - bounds[0])) / 2 - bounds[0])
    y = round(500 - (bounds[3] - bounds[1]) / 2 - bounds[1])
    draw.text((x, y), "CUT", font=font, fill=255)
    base_mask = np.asarray(layer)
    # Sampled solid T stroke, not the hollow interior of U.
    anchor_x, anchor_y = 410, 500
    if base_mask[anchor_y, anchor_x] != 255:
        raise RuntimeError("Zoom anchor is outside opaque type")

    plain, aperture = [], []
    for index, picture in enumerate(source):
        fade = max(0, min(1, (index - 36) / 8))
        title_alpha = np.uint8(base_mask * (1 - fade) * .92)
        plain_frame = picture.copy()
        plain_frame = ((plain_frame.astype(float) * (255 - title_alpha[..., None])
                        + np.array((250, 246, 229)) * title_alpha[..., None]) / 255).astype(np.uint8)
        plain.append(plain_frame)

        p = max(0, min(1, (index - 25) / 17))
        p = p * p * (3 - 2 * p)
        scale = 1 + 9 * p
        dest_x = anchor_x * (1 - p) + (W / 2) * p
        dest_y = anchor_y * (1 - p) + (H / 2) * p
        # Identity at p=0; move the solid T stroke toward frame centre as it grows.
        matrix = np.array([[1 / scale, 0, anchor_x - dest_x / scale],
                           [0, 1 / scale, anchor_y - dest_y / scale]], dtype=np.float32)
        mask = cv2.warpAffine(base_mask, matrix, (W, H), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP)
        fill = max(0, min(1, (index - 37) / 7))
        alpha = mask.astype(float) / 255 * (1 - fill) + fill
        background = np.empty_like(picture)
        background[:] = BLACK
        aperture.append((picture.astype(float) * alpha[..., None]
                         + background.astype(float) * (1 - alpha[..., None])).astype(np.uint8))

    encode(OUT / "plain-title.mp4", plain)
    encode(OUT / "footage-in-type.mp4", aperture)
    selected = (0, 6, 12, 18, 24, 30, 36, 42, 47)
    contact = Image.new("RGB", (9 * 180, 2 * 320), "black")
    for row, frames in enumerate((plain, aperture)):
        for col, index in enumerate(selected):
            contact.paste(Image.fromarray(frames[index]).resize((180, 320)), (col * 180, row * 320))
    contact.save(OUT / "phone-contact.jpg", quality=93)
    Image.fromarray(aperture[30]).save(OUT / "aperture-mid-full-size.png")
    print(OUT)


if __name__ == "__main__":
    main()
