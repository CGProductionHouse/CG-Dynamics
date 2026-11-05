"""Bounded dark-backdrop occlusion test; not a general person segmenter."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output" / "dark-backdrop-depth"
SOURCE = ROOT / "media" / "mixkit-818-720.mp4"
SOURCE_SHA = "7e89890b99af3ce1d9fac49064d6754ddbc636b71c2be78e6d4c18f835b5ba58"
FPS, COUNT = 24, 144


def opacity(t: float) -> float:
    return min(1.0, t / 0.35, (2.5 - t) / 0.5) if t < 2.5 else 0.0


def main() -> None:
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SOURCE_SHA:
        raise RuntimeError(f"Missing or changed source: {SOURCE}")
    OUT.mkdir(parents=True, exist_ok=True)
    frames = OUT / "frames"
    frames.mkdir(exist_ok=True)
    font_path = ROOT / "scene" / "assets" / "SpaceGrotesk.ttf"
    font = ImageFont.truetype(str(font_path), 192)
    font.set_variation_by_name("Bold")
    type_image = Image.new("RGBA", (1280, 720), (0, 0, 0, 0))
    ImageDraw.Draw(type_image).text((640, 328), "MOMENT", font=font, anchor="mm",
                                    fill=(241, 239, 229, 255))
    type_layer = cv2.cvtColor(np.array(type_image), cv2.COLOR_RGBA2BGRA)
    type_rgb = type_layer[:, :, :3].astype(np.float32)
    type_alpha = type_layer[:, :, 3:4].astype(np.float32) / 255
    cap = cv2.VideoCapture(str(SOURCE))
    if not cap.isOpened() or round(cap.get(cv2.CAP_PROP_FPS)) != FPS:
        raise RuntimeError("Source cannot be opened at expected frame rate")
    close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))
    for n in range(COUNT):
        ok, frame = cap.read()
        if not ok or frame.shape[:2] != (720, 1280):
            raise RuntimeError(f"Missing or unexpected source frame {n}")
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        # Source-specific threshold: warm hands and saturated green crockery
        # against this take's nearly-black backdrop. Do not generalize it.
        candidate = (((hsv[:, :, 1] > 35) & (hsv[:, :, 2] > 35)) |
                     (hsv[:, :, 2] > 85)).astype(np.uint8) * 255
        candidate = cv2.morphologyEx(candidate, cv2.MORPH_CLOSE, close_kernel)
        contours, _ = cv2.findContours(candidate, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        solid = np.zeros_like(candidate)
        for contour in contours:
            if cv2.contourArea(contour) > 300:
                cv2.drawContours(solid, [contour], -1, 255, -1)
        foreground_alpha = cv2.GaussianBlur(solid, (5, 5), 0).astype(np.float32)[:, :, None] / 255
        title_alpha = type_alpha * max(0.0, opacity(n / FPS))
        original = frame.astype(np.float32)
        text_on_scene = original * (1 - title_alpha) + type_rgb * title_alpha
        composed = original * foreground_alpha + text_on_scene * (1 - foreground_alpha)
        cv2.imwrite(str(frames / f"{n:04d}.png"), np.uint8(np.clip(composed, 0, 255)))
    cap.release()
    result = OUT / "dark-backdrop-depth.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-framerate", str(FPS),
         "-i", str(frames / "%04d.png"), "-frames:v", str(COUNT), "-an", "-c:v", "libx264",
         "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", str(result)], check=True,
    )
    contact = Image.new("RGB", (960, 540), "#111111")
    for i, n in enumerate((0, 12, 24, 36, 48, 60, 72, 96, 143)):
        with Image.open(frames / f"{n:04d}.png") as sample:
            contact.paste(sample.resize((320, 180)), ((i % 3) * 320, (i // 3) * 180))
    contact.save(OUT / "contact.png")
    print(json.dumps({"video": str(result), "sha256": hashlib.sha256(result.read_bytes()).hexdigest(),
                      "frames": COUNT, "contact": str(OUT / "contact.png")}, indent=2))


if __name__ == "__main__":
    main()
