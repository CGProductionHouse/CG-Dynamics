"""Bounded stock-footage A/B: ordinary push versus tracked lens opening.

This is a source-specific silent technique test, not a general masking engine.
"""

from __future__ import annotations

import hashlib
import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "media" / "mixkit-13807-720.mp4"
EXPECTED_SHA256 = "e89e671250c33c37732708bd97009db253c13c4870f2672fd90f5199f2c7085f"
DEST = ROOT / "media" / "masked-lens-proof"
FPS = 24000 / 1001
FRAME_COUNT = 36
START_FRAME = 18  # 0.75 s into the source
SIZE = (1280, 720)


def smoothstep(value: float) -> float:
    value = min(1.0, max(0.0, value))
    return value * value * (3 - 2 * value)


def edges(frame: np.ndarray) -> np.ndarray:
    grey = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return cv2.Canny(cv2.GaussianBlur(grey, (5, 5), 1), 55, 120)


def fit(frame: np.ndarray, centre: tuple[int, int], progress: float) -> np.ndarray:
    """Digital push toward the real lens centre; identical endpoint in both A/Bs."""
    width = round(1280 - 880 * progress)
    height = round(720 - 495 * progress)
    x = max(0, min(1280 - width, round(centre[0] - width / 2)))
    y = max(0, min(720 - height, round(centre[1] - height / 2)))
    return cv2.resize(frame[y:y + height, x:x + width], SIZE,
                      interpolation=cv2.INTER_CUBIC)


def foreground_hand(frame: np.ndarray) -> np.ndarray:
    """Source-specific warm-hand matte; exclude book and dark lens ring."""
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    skin = cv2.inRange(hsv, (0, 65, 40), (25, 255, 255))
    region = np.zeros((720, 1280), dtype=np.uint8)
    region[:270, 240:] = 255
    region[535:, 240:] = 255
    skin = cv2.bitwise_and(skin, region)
    skin = cv2.morphologyEx(skin, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    return cv2.GaussianBlur(skin, (0, 0), 4)


def opening(frame: np.ndarray, pushed: np.ndarray, macro: np.ndarray,
            centre: tuple[int, int], progress: float,
            protect_hand: bool) -> np.ndarray:
    if progress <= 0:
        return frame.copy()
    if progress >= 1:
        return macro.copy()
    # Expand from the physical opening across the whole transition, not in a
    # last-second jump; the incoming crop contains no second copy of the rim.
    radius = round(218 + 1250 * progress**1.5)
    mask = np.zeros((720, 1280), dtype=np.uint8)
    cv2.ellipse(mask, centre, (radius, radius), 0, 0, 360, 255, -1)
    strength = smoothstep(progress / 0.18)
    alpha = cv2.GaussianBlur(mask, (0, 0), 3).astype(np.float32)[..., None] / 255
    alpha *= strength
    result = frame * (1 - alpha) + macro * alpha
    if not protect_hand:
        return np.clip(result, 0, 255).astype(np.uint8)
    hand_alpha = fit(foreground_hand(frame), centre, progress)
    hand_alpha = np.clip(hand_alpha.astype(np.float32) / 255, 0, 1)[..., None] * alpha
    result = result * (1 - hand_alpha) + pushed * hand_alpha
    return np.clip(result, 0, 255).astype(np.uint8)


def main() -> None:
    if not SOURCE.is_file() or hashlib.sha256(SOURCE.read_bytes()).hexdigest() != EXPECTED_SHA256:
        raise SystemExit("Expected licensed practice source missing or changed")
    capture = cv2.VideoCapture(str(SOURCE))
    if not capture.isOpened():
        raise SystemExit("Cannot open practice source")
    capture.set(cv2.CAP_PROP_POS_FRAMES, 24)  # 1.00 s template
    ok, reference = capture.read()
    if not ok or reference.shape[:2] != (720, 1280):
        raise SystemExit("Unexpected source frame")
    template = edges(reference)[110:630, 250:750]
    DEST.mkdir(parents=True, exist_ok=True)
    tracks: list[tuple[int, int, float]] = []
    with tempfile.TemporaryDirectory(prefix="lens-zoom-") as scratch:
        work = Path(scratch)
        for name in ("control", "unprotected", "opening"):
            (work / name).mkdir()
        for index in range(FRAME_COUNT):
            capture.set(cv2.CAP_PROP_POS_FRAMES, START_FRAME + index)
            ok, frame = capture.read()
            if not ok:
                raise RuntimeError(f"Missing source frame {START_FRAME + index}")
            search = edges(frame)[50:700, 100:900]
            match = cv2.matchTemplate(search, template, cv2.TM_CCOEFF_NORMED)
            _, score, _, point = cv2.minMaxLoc(match)
            centre = (point[0] + 350, point[1] + 310)
            if not (400 <= centre[0] <= 540 and 350 <= centre[1] <= 390):
                raise RuntimeError(f"Lens tracking wandered at {index}: {centre}")
            tracks.append((*centre, score))
            progress = smoothstep((index - 7) / 18)
            pushed = fit(frame, centre, progress)
            macro = fit(frame, centre, 1.0)
            versions = {
                "control": pushed,
                "unprotected": opening(frame, pushed, macro, centre, progress, False),
                "opening": opening(frame, pushed, macro, centre, progress, True),
            }
            for name, picture in versions.items():
                cv2.putText(picture, "STOCK PRACTICE", (25, 690),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
                cv2.imwrite(str(work / name / f"frame-{index:03d}.png"), picture)
        capture.release()
        for name in ("control", "unprotected", "opening"):
            output = DEST / f"lens-{name}.mp4"
            subprocess.run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-framerate", "24000/1001", "-i", str(work / name / "frame-%03d.png"),
                "-frames:v", str(FRAME_COUNT), "-c:v", "libx264", "-crf", "18",
                "-pix_fmt", "yuv420p", "-an", str(output),
            ], check=True)
            print(name, output, hashlib.sha256(output.read_bytes()).hexdigest())
    print("track x-range", min(row[0] for row in tracks), max(row[0] for row in tracks))
    print("track y-range", min(row[1] for row in tracks), max(row[1] for row in tracks))
    print("minimum template score", min(row[2] for row in tracks))


if __name__ == "__main__":
    main()
