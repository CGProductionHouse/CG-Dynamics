"""Same-source context reveal: plain, linear and eased zoom-out controls."""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "media/mixkit-41865-720.mp4"
OUT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\context-zoom-out-20261027")
SHA = "883b71655e2f2448a03b02f6e318eced58b51bac5b74da86c018995f3c817331"
W, H, FPS, FRAMES = 540, 960, 24, 72


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
        raise RuntimeError(path)


def main() -> None:
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SHA:
        raise RuntimeError("Licensed practice source changed")
    OUT.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(SOURCE))
    source = []
    for index in range(FRAMES):
        cap.set(cv2.CAP_PROP_POS_MSEC, (2 + index / FPS) * 1000)
        ok, frame = cap.read()
        if not ok or frame.shape[:2] != (1280, 720):
            raise RuntimeError(f"Missing source frame {index}")
        source.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    cap.release()
    plain = [cv2.resize(frame, (W, H)) for frame in source]
    versions = {"plain": plain}
    boxes = {}
    for name in ("linear", "eased"):
        frames, ranges = [], []
        for index, frame in enumerate(source):
            p = min(1.0, max(0.0, (index - 12) / 30))
            if name == "eased":
                p = p * p * (3 - 2 * p)
            scale = 1.5 - .5 * p
            width, height = round(720 / scale), round(1280 / scale)
            left, top = (720 - width) // 2, (1280 - height) // 2
            frames.append(cv2.resize(frame[top:top + height, left:left + width], (W, H)))
            ranges.append([left, top, width, height])
        versions[name] = frames
        boxes[name] = ranges
    for name, frames in versions.items():
        encode(OUT / f"{name}.mp4", frames)
    # Same underlying source time and exact full-frame recovery after the move.
    for name in ("linear", "eased"):
        assert all(np.array_equal(versions[name][i], plain[i]) for i in range(42, FRAMES))
    (OUT / "crop-evidence.json").write_text(json.dumps({
        "source": str(SOURCE), "sha256": SHA, "source_in_seconds": 2,
        "fps": FPS, "frames": FRAMES, "crop_boxes": boxes,
        "full_frame_exact_from_output_frame": 42,
        "audio": "absent; no sound added",
    }, indent=2), encoding="utf-8")
    picks = (0, 12, 18, 24, 30, 36, 42, 71)
    contact = Image.new("RGB", (8 * 180, 3 * 340), "#101010")
    draw = ImageDraw.Draw(contact)
    for row, (name, frames) in enumerate(versions.items()):
        for col, index in enumerate(picks):
            contact.paste(Image.fromarray(frames[index]).resize((180, 320)), (col * 180, row * 340 + 20))
            draw.text((col * 180 + 4, row * 340 + 3), f"{name} {index}", fill="white")
    contact.save(OUT / "phone-contact.jpg", quality=93)
    Image.fromarray(versions["eased"][0]).save(OUT / "eased-start-full-size.png")
    print(OUT)


if __name__ == "__main__":
    main()
