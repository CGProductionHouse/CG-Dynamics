"""Source-specific Mixkit carpentry plane/foreground A/B, without client media.

Usage: python render_carpenter_plane.py SOURCE_MP4 OUTPUT_DIR
The source remains external to Git; this is not a general roto or tracking engine.
"""

import argparse
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


START_FRAME = 48  # approximately 2.002 s at 24000/1001 fps
FRAME_COUNT = 36


def title_alpha(width: int, height: int, projected: bool) -> np.ndarray:
    mask_image = Image.new("L", (520, 130), 0)
    draw = ImageDraw.Draw(mask_image)
    draw.text((10, 5), "COVER", font=ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 104), fill=255)
    mask = np.asarray(mask_image)
    source = np.float32([[0, 0], [519, 0], [519, 129], [0, 129]])
    if projected:
        # The board is stationary over this brief take; this quadrilateral is
        # hand-fitted to its visible plane and must not be reused on other shots.
        destination = np.float32([[345, 823], [690, 738], [710, 818], [310, 913]])
    else:
        destination = np.float32([[330, 790], [710, 790], [710, 885], [330, 885]])
    transform = cv2.getPerspectiveTransform(source, destination)
    return cv2.warpPerspective(mask, transform, (width, height)).astype(np.float32) / 255


def foreground(frame: np.ndarray) -> np.ndarray:
    height, width = frame.shape[:2]
    # One source-specific hand/bit contour, checked only over this 36-frame take.
    # A luminance threshold was tried first and rejected because it punched
    # grey holes through the letter on the otherwise white board.
    mask = np.zeros((height, width), np.uint8)
    contour = np.array([[(0, 525), (85, 585), (180, 675), (290, 765),
                         (340, 802), (355, 824), (360, 844), (348, 867),
                         (318, 879), (0, 880)]], dtype=np.int32)
    cv2.fillPoly(mask, contour, 255)
    return cv2.GaussianBlur(mask, (5, 5), 0).astype(np.float32) / 255


def compose(frame: np.ndarray, alpha: np.ndarray, protected: bool) -> np.ndarray:
    if protected:
        alpha = alpha * (1 - foreground(frame))
    ink = np.array([68, 55, 40], np.float32)  # dark, board-coloured ink in BGR
    opacity = alpha[..., None] * 0.86
    return np.uint8(np.clip(frame.astype(np.float32) * (1 - opacity) + ink * opacity, 0, 255))


def writer(destination: Path, width: int, height: int) -> subprocess.Popen:
    return subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
         "-pix_fmt", "bgr24", "-s", f"{width}x{height}", "-r", "24000/1001",
         "-i", "pipe:0", "-an", "-c:v", "libx264", "-crf", "18", "-preset", "medium",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(destination)],
        stdin=subprocess.PIPE,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(args.source))
    if not cap.isOpened():
        raise FileNotFoundError(args.source)
    fps = cap.get(cv2.CAP_PROP_FPS)
    if abs(fps - 24000 / 1001) > 0.02:
        raise ValueError(f"Unexpected source fps: {fps}")
    width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if (width, height) != (720, 1280):
        raise ValueError(f"Unexpected source size: {width}x{height}")
    flat = title_alpha(width, height, False)
    projected = title_alpha(width, height, True)
    writers = {mode: writer(args.output / f"carpenter-{mode}.mp4", width, height)
               for mode in ("flat", "projected", "foreground")}
    cap.set(cv2.CAP_PROP_POS_FRAMES, START_FRAME)
    overlaps = []
    try:
        for _ in range(FRAME_COUNT):
            ok, frame = cap.read()
            if not ok:
                raise RuntimeError("Source ended before 36 frames")
            overlaps.append(float(np.sum(projected * foreground(frame)) / np.sum(projected)))
            images = {
                "flat": compose(frame, flat, False),
                "projected": compose(frame, projected, False),
                "foreground": compose(frame, projected, True),
            }
            for mode, image in images.items():
                assert writers[mode].stdin is not None
                writers[mode].stdin.write(image.tobytes())
    finally:
        cap.release()
        for process in writers.values():
            assert process.stdin is not None
            process.stdin.close()
    for mode, process in writers.items():
        if process.wait() != 0:
            raise RuntimeError(f"FFmpeg failed: {mode}")
    print(f"Foreground covers {min(overlaps):.2%} to {max(overlaps):.2%} of projected glyph opacity")
