"""Original graphic shutter-sampling proof; not optical-flow footage processing."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / "proof"
W, H, FPS, FRAMES = 540, 960, 24, 48
BG = (16, 21, 26)
FONT = ROOT / "scene/assets/SpaceGrotesk.ttf"


def encode(path: Path, frames: list[np.ndarray]) -> None:
    process = subprocess.Popen([
        "ffmpeg", "-nostdin", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0", "-an", "-c:v", "libx264",
        "-crf", "18", "-pix_fmt", "yuv420p", str(path),
    ], stdin=subprocess.PIPE)
    assert process.stdin
    for frame in frames:
        process.stdin.write(frame.tobytes())
    process.stdin.close()
    if process.wait():
        raise RuntimeError(path)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    font = ImageFont.truetype(str(FONT), 120)
    font.set_variation_by_name("Bold")
    small = ImageFont.truetype(str(FONT), 24)
    bounds = font.getbbox("MOVE")
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    centre = (W - width) / 2
    sprite = Image.new("L", (width, height), 0)
    ImageDraw.Draw(sprite).text((-bounds[0], -bounds[1]), "MOVE", font=font, fill=255)
    sprite_alpha = np.asarray(sprite).astype(float) / 255
    base = Image.new("RGB", (W, H), BG)
    label = "WITH PURPOSE"
    ImageDraw.Draw(base).text(((W - small.getlength(label)) / 2, 530), label,
                             font=small, fill=(200, 255, 85))
    base_rgb = np.asarray(base).astype(float)

    def position(t: float) -> float:
        if t < .1:
            return -width - 30
        if t < .5:
            u = (t - .1) / .4
            p = 1 - (1 - u) ** 3
            return (-width - 30) * (1 - p) + centre * p
        if t < 1.5:
            return centre
        if t < 1.9:
            p = ((t - 1.5) / .4) ** 3
            return centre * (1 - p) + (W + 30) * p
        return W + 30

    def render_samples(times: np.ndarray) -> np.ndarray:
        # Aggregate integer-position coverage, avoiding sparse repeated outlines.
        positions, counts = np.unique(np.rint([position(t) for t in times]).astype(int), return_counts=True)
        alpha = np.zeros((H, W), dtype=float)
        for x, count in zip(positions, counts):
            left, right = max(0, x), min(W, x + width)
            if right > left:
                alpha[390:390 + height, left:right] += sprite_alpha[:, left - x:right - x] * (count / len(times))
        return np.rint(base_rgb * (1 - alpha[..., None])
                       + np.array((242, 241, 232)) * alpha[..., None]).astype(np.uint8)

    versions = {}
    for name, angle in (("no-blur", 0), ("shutter-180", 180), ("shutter-300", 300)):
        frames = []
        for index in range(FRAMES):
            t = index / FPS
            if angle == 0:
                frame = render_samples(np.array([t]))
            else:
                exposure = angle / 360 / FPS
                offsets = np.linspace(-exposure / 2, exposure / 2, 129)
                frame = render_samples(t + offsets)
            frames.append(frame)
        versions[name] = frames
        encode(OUT / f"{name}.mp4", frames)

    hold_matches = {}
    for name in ("shutter-180", "shutter-300"):
        hold_matches[name] = all(np.array_equal(versions[name][i], versions["no-blur"][i]) for i in range(14, 35))
        assert hold_matches[name]
    captures = [cv2.VideoCapture(str(OUT / f"{name}.mp4")) for name in versions]
    decoded_differences = []
    for index in range(FRAMES):
        decoded = []
        for capture in captures:
            ok, frame = capture.read()
            if not ok:
                raise RuntimeError(f"Encoded output ended at {index}")
            decoded.append(frame)
        if 14 <= index <= 34:
            decoded_differences.append([float(np.mean(np.abs(decoded[j].astype(float) - decoded[0].astype(float)))) for j in (1, 2)])
        if index == 24:
            cv2.imwrite(str(OUT / "encoded-hold.png"), decoded[1])
    for capture in captures:
        capture.release()
    selected = (3, 4, 5, 6, 8, 12, 24, 38, 41, 44)
    contact = Image.new("RGB", (10 * 135, 3 * 260), BG)
    draw = ImageDraw.Draw(contact)
    for row, (name, frames) in enumerate(versions.items()):
        for col, index in enumerate(selected):
            contact.paste(Image.fromarray(frames[index]).resize((135, 240)), (col * 135, row * 260 + 20))
            draw.text((col * 135 + 3, row * 260 + 3), f"{name} {index}", fill="white")
    contact.save(OUT / "phone-contact.jpg", quality=93)
    Image.fromarray(versions["shutter-180"][4]).save(OUT / "motion-full-size.png")
    Image.fromarray(versions["shutter-180"][24]).save(OUT / "hold-full-size.png")
    (OUT / "evidence.json").write_text(json.dumps({
        "fps": FPS, "frames": FRAMES, "size": [W, H], "angles": [0, 180, 300],
        "temporal_samples": 129, "hold_exact_preencode_frames": [14, 34],
        "hold_matches": hold_matches, "audio": "none; original graphics only",
        "decoded_hold_mean_absolute_rgb_error_vs_control": np.mean(decoded_differences, axis=0).round(4).tolist(),
    }, indent=2), encoding="utf-8")
    print(OUT)


if __name__ == "__main__":
    main()
