"""Question punctuator and road-to-depot lens push for TBS R08.

One-off scene treatments built from the already screened R06 frames. No new
client source is inferred, and the unchanged scene lengths keep the music bed.
"""
from pathlib import Path
import subprocess
import cv2
import numpy as np

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\TBS-Nov-2026-Goods-Transit")
R06 = ROOT / "film-r06-private"
OUT = ROOT / "film-r08-private"
OUT.mkdir(exist_ok=True)
W, H = 1920, 1080


def question_flash(frame: np.ndarray, n: int) -> np.ndarray:
    # The source phone never actually scans the QR code. Punctuate the onscreen
    # cover question before Kevin enters, without implying a fabricated scan.
    if n in (55, 56):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    if n == 57:
        return np.uint8(np.clip(frame.astype(np.float32) * 1.16 + 12, 0, 255))
    return frame


def zoom(frame: np.ndarray, scale: float, focus: tuple[int, int]) -> np.ndarray:
    if scale <= 1.0001:
        return frame
    matrix = np.float32([[scale, 0, focus[0] * (1 - scale)],
                         [0, scale, focus[1] * (1 - scale)]])
    return cv2.warpAffine(frame, matrix, (W, H), flags=cv2.INTER_LINEAR,
                          borderMode=cv2.BORDER_REFLECT_101)


def road_push(frame: np.ndarray, n: int) -> np.ndarray:
    if n < 84:
        return frame
    v = (n - 83) / 6
    out = zoom(frame, 1 + .085 * v * v, (1030, 550))
    if n >= 87:
        out = cv2.GaussianBlur(out, (0, 0), .55 + (n - 86) * .30)
    return out


def depot_settle(frame: np.ndarray, n: int) -> np.ndarray:
    if n > 6:
        return frame
    v = max(0, 1 - n / 6)
    out = zoom(frame, 1 + .085 * v * v, (980, 540))
    if n < 4:
        out = cv2.GaussianBlur(out, (0, 0), .6 + .8 * v)
    if n < 3:
        out = np.uint8(np.clip(out.astype(np.float32) * (1 + .11 * v), 0, 255))
    return out


def render(name: str, count: int, effect) -> None:
    cap = cv2.VideoCapture(str(R06 / f"{name}.mp4"))
    assert cap.isOpened(), name
    folder = OUT / f"{name}-frames"
    folder.mkdir(exist_ok=True)
    for n in range(count):
        ok, frame = cap.read()
        assert ok, (name, n)
        frame = effect(frame, n)
        assert frame.shape == (H, W, 3)
        cv2.imwrite(str(folder / f"frame-{n:04d}.jpg"), frame,
                    [cv2.IMWRITE_JPEG_QUALITY, 95])
    cap.release()
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-framerate", "30", "-i", str(folder / "frame-%04d.jpg"),
                    "-c:v", "libx264", "-crf", "18", "-preset", "fast",
                    "-vf", "scale=in_range=pc:out_range=tv,format=yuv420p",
                    "-color_range", "tv", "-r", "30", str(OUT / f"{name}.mp4")],
                   check=True)


if __name__ == "__main__":
    render("02-scan", 60, question_flash)
    render("06-road", 90, road_push)
    render("07-depot", 75, depot_settle)
