"""Real filmed green-screen phone: plain cut versus digital screen growth.

This tests screen replacement and continuous-frame alignment only. The device
never covers the lens, so it does NOT prove the filmed last-frame transition.
"""
from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\filmed-screen-20261027")
PHONE = ROOT / "mixkit-42630-720.mp4"
NEXT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\TBS-Nov-2026\restart-source\mixkit-carpenter-saw-39691.mp4")
PHONE_SHA = "0b1f1ec15a30b59fa06240b03adad50e3f6cef38ec6a3a8d8587d983644a7418"
NEXT_SHA = "186bc1eb994695af1d7c2312d3f8ea6aac0a4e23767d24727471066e7cceb618"
W, H, FPS, N, START, END = 720, 1280, 24, 60, 36, 45
PLATE_X0, PLATE_X1 = 390, 795


def at(cap: cv2.VideoCapture, t: float, shape: tuple[int, int]) -> np.ndarray:
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    good, bgr = cap.read()
    if not good or bgr.shape[:2] != shape:
        raise RuntimeError(f"Missing frame at {t:.3f}s or wrong shape")
    return bgr


def quad_and_mask(plate: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    hsv = cv2.cvtColor(plate, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, np.array([35, 75, 40]), np.array([90, 255, 255]))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        raise RuntimeError("Green phone screen not found")
    contour = max(contours, key=cv2.contourArea)
    if not 44000 <= cv2.contourArea(contour) <= 52000:
        raise RuntimeError("Unexpected screen area; inspect before replacing")
    corners = cv2.boxPoints(cv2.minAreaRect(contour))
    top, bottom = sorted(corners, key=lambda p: p[1])[:2], sorted(corners, key=lambda p: p[1])[2:]
    tl, tr = sorted(top, key=lambda p: p[0])
    bl, br = sorted(bottom, key=lambda p: p[0])
    return np.float32([tl, tr, br, bl]), mask


def warp(image: np.ndarray, quad: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    ih, iw = image.shape[:2]
    source = np.float32([[0, 0], [iw - 1, 0], [iw - 1, ih - 1], [0, ih - 1]])
    matrix = cv2.getPerspectiveTransform(source, quad)
    return cv2.warpPerspective(image, matrix, size, flags=cv2.INTER_LINEAR)


def portrait(plate: np.ndarray) -> np.ndarray:
    return cv2.resize(plate[:, PLATE_X0:PLATE_X1], (W, H), interpolation=cv2.INTER_LINEAR)


def compose_phone(plate: np.ndarray, scene: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    quad, mask = quad_and_mask(plate)
    warped = warp(scene, quad, (1280, 720))
    alpha = cv2.GaussianBlur(mask.astype(np.float32) / 255, (3, 3), .7)[:, :, None]
    replaced = np.clip(plate * (1 - alpha) + warped * alpha, 0, 255).astype(np.uint8)
    factor = W / (PLATE_X1 - PLATE_X0)
    portrait_quad = quad.copy()
    portrait_quad[:, 0] = (quad[:, 0] - PLATE_X0) * factor
    portrait_quad[:, 1] = quad[:, 1] * (H / 720)
    return portrait(replaced), portrait_quad


def grow(base: np.ndarray, scene: np.ndarray, quad: np.ndarray, index: int) -> np.ndarray:
    if index <= START:
        return base
    if index >= END:
        return scene
    p = (index - START) / (END - START)
    p = p * p * (3 - 2 * p)
    target = np.float32([[0, 0], [W - 1, 0], [W - 1, H - 1], [0, H - 1]])
    current = quad * (1 - p) + target * p
    displayed = warp(scene, current, (W, H))
    full_mask = np.full((H, W), 255, dtype=np.uint8)
    alpha = warp(full_mask, current, (W, H)).astype(np.float32) / 255
    # The growing image lifts off the filmed device after the first matched frame.
    return np.clip(base * (1 - alpha[:, :, None]) + displayed * alpha[:, :, None], 0, 255).astype(np.uint8)


def encode(path: Path, frames: list[np.ndarray]) -> None:
    process = subprocess.Popen([
        "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0", "-an",
        "-c:v", "libx264", "-crf", "19", "-pix_fmt", "yuv420p", str(path),
    ], stdin=subprocess.PIPE)
    assert process.stdin
    for frame in frames:
        process.stdin.write(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB).tobytes())
    process.stdin.close()
    if process.wait():
        raise RuntimeError(f"Encode failed: {path}")


def main() -> None:
    for path, expected in ((PHONE, PHONE_SHA), (NEXT, NEXT_SHA)):
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise RuntimeError(f"Practice source hash changed: {path}")
    ROOT.mkdir(parents=True, exist_ok=True)
    phone_cap = cv2.VideoCapture(str(PHONE))
    next_cap = cv2.VideoCapture(str(NEXT))
    phone_frames = [at(phone_cap, .8 + i / FPS, (720, 1280)) for i in range(N)]
    next_frames = [at(next_cap, 4.0 + i / FPS, (1280, 720)) for i in range(N)]
    phone_cap.release()
    next_cap.release()
    plain, candidate = [], []
    for i, (plate, scene) in enumerate(zip(phone_frames, next_frames)):
        replaced, quad = compose_phone(plate, scene)
        plain.append(replaced if i < (START + END) // 2 else scene)
        candidate.append(grow(replaced, scene, quad, i))
    assert np.array_equal(candidate[END], next_frames[END])
    encode(ROOT / "plain-cut.mp4", plain)
    encode(ROOT / "tracked-grow.mp4", candidate)
    samples = (32, 36, 37, 39, 41, 44, 45, 52)
    sheet = Image.new("RGB", (8 * 180, 2 * 320), "white")
    draw = ImageDraw.Draw(sheet)
    for row, frames in enumerate((plain, candidate)):
        for col, index in enumerate(samples):
            x, y = col * 180, row * 320
            rgb = cv2.cvtColor(frames[index], cv2.COLOR_BGR2RGB)
            sheet.paste(Image.fromarray(rgb).resize((180, 320)), (x, y))
            draw.text((x + 3, y + 3), f"{('plain', 'grow')[row]} {index}", fill="white", stroke_width=1, stroke_fill="black")
    sheet.save(ROOT / "grow-contact.jpg", quality=92)
    for name, index in (("phone", 35), ("middle", 41), ("full", 45)):
        cv2.imwrite(str(ROOT / f"{name}-full-size.png"), candidate[index])


if __name__ == "__main__":
    main()
