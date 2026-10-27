"""Compare two portrait stabilization candidates without claiming perceptual approval."""

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw


def read_frames(path: Path):
    cap = cv2.VideoCapture(str(path))
    frames = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frames.append(frame)
    cap.release()
    return frames


def background_motion(frames):
    """Track side-band corners; median per-frame drift is a diagnostic only."""
    shifts = []
    for before, after in zip(frames, frames[1:]):
        gray_a = cv2.cvtColor(before, cv2.COLOR_BGR2GRAY)
        gray_b = cv2.cvtColor(after, cv2.COLOR_BGR2GRAY)
        h, w = gray_a.shape
        mask = np.zeros((h, w), np.uint8)
        mask[: int(h * 0.8), : int(w * 0.25)] = 255
        mask[: int(h * 0.8), int(w * 0.75) :] = 255
        pts = cv2.goodFeaturesToTrack(gray_a, 200, 0.01, 8, mask=mask)
        if pts is None or len(pts) < 8:
            shifts.append([np.nan, np.nan])
            continue
        moved, valid, _ = cv2.calcOpticalFlowPyrLK(gray_a, gray_b, pts, None)
        delta = (moved - pts)[valid.reshape(-1) == 1].reshape(-1, 2)
        shifts.append(np.median(delta, axis=0).tolist() if len(delta) >= 8 else [np.nan, np.nan])
    motion = np.asarray(shifts)
    # The second difference flags small frame-to-frame changes in velocity,
    # while leaving a deliberate steady follow/pan largely alone.
    acceleration = np.diff(motion, axis=0)
    valid = np.isfinite(acceleration).all(axis=1)
    return {
        "tracked_pairs": int(np.isfinite(motion).all(axis=1).sum()),
        "median_step_px": np.nanmedian(motion, axis=0).round(3).tolist(),
        "rms_velocity_change_px": float(np.sqrt(np.mean(np.sum(acceleration[valid] ** 2, axis=1)))) if valid.any() else None,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("control", type=Path)
    parser.add_argument("candidate", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    control = read_frames(args.control)
    candidate = read_frames(args.candidate)
    if not control or len(control) != len(candidate):
        raise SystemExit("A/B must contain the same nonzero number of frames")
    args.output.mkdir(parents=True, exist_ok=True)
    metrics = {
        "frames": len(control),
        "control": background_motion(control),
        "candidate": background_motion(candidate),
        "warning": "Side-band motion is not a warp, crop, subject, or creative-quality verdict.",
    }
    (args.output / "motion.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    picks = [0, len(control) // 4, len(control) // 2, 3 * len(control) // 4, len(control) - 1]
    cell_w, cell_h = 270, 480
    canvas = Image.new("RGB", (cell_w * len(picks), cell_h * 2 + 38), "#151515")
    draw = ImageDraw.Draw(canvas)
    for row, frames in enumerate((control, candidate)):
        for col, idx in enumerate(picks):
            rgb = cv2.cvtColor(frames[idx], cv2.COLOR_BGR2RGB)
            panel = Image.fromarray(rgb).resize((cell_w, cell_h))
            canvas.paste(panel, (col * cell_w, row * (cell_h + 19) + 19))
            draw.text((col * cell_w + 5, row * (cell_h + 19) + 2), f"{'plain' if row == 0 else 'candidate'} frame {idx}", fill="white")
    canvas.save(args.output / "phone_contact.jpg", quality=90)
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
