"""Source-specific repair of the missing left arm in the Mixkit #1252 freeze.

The manual polygon is a one-frame foreground contour, not a general segmenter.
Client/source originals and proof renders stay outside Git.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

import render_stock_ab as first

OUT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\freeze-frame-refined-20261027")
OUT.mkdir(parents=True, exist_ok=True)


def revised_mask() -> np.ndarray:
    first.check_sources()
    old = cv2.imread(str(first.MASK_FILE), cv2.IMREAD_GRAYSCALE)
    if old is None or old.shape != (first.H, first.W):
        raise RuntimeError("Source mask missing or wrong size")
    # Trace the original still's complete sleeve, forearm and hand. The old
    # automatic matte cut them off against the similarly red backdrop.
    arm = np.zeros_like(old)
    contour = np.array([
        (123, 423), (98, 429), (72, 450), (52, 487), (29, 528),
        (13, 568), (10, 606), (19, 649), (43, 693), (63, 726),
        (86, 772), (102, 806), (119, 831), (139, 836), (142, 819),
        (126, 785), (117, 750), (98, 706), (78, 677), (64, 633),
        (68, 591), (83, 552), (105, 515), (123, 482), (145, 443),
    ], dtype=np.int32)
    cv2.fillPoly(arm, [contour], 255)
    # The polygon is a constrained probable-foreground search area, not the
    # final alpha. Otherwise the red cyc inside the bent elbow becomes a
    # conspicuous frozen red silhouette.
    seeds = np.full(old.shape, cv2.GC_BGD, dtype=np.uint8)
    seeds[old > 0] = cv2.GC_PR_FGD
    seeds[cv2.erode(old, np.ones((13, 13), np.uint8)) > 0] = cv2.GC_FGD
    seeds[arm > 0] = cv2.GC_PR_FGD
    sleeve = np.array([(91, 449), (63, 490), (31, 565), (25, 619),
                       (44, 660), (59, 646), (49, 606), (71, 539), (111, 466)], np.int32)
    forearm = np.array([(43, 674), (56, 713), (87, 766), (112, 804),
                        (123, 806), (99, 752), (70, 697)], np.int32)
    cv2.fillPoly(seeds, [sleeve, forearm], cv2.GC_FGD)
    cap = cv2.VideoCapture(str(first.SOURCE))
    held = first.frame_at(cap, 4.0)
    cap.release()
    bgr = cv2.cvtColor(held, cv2.COLOR_RGB2BGR)
    background, foreground = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(bgr, seeds, None, background, foreground, 8, cv2.GC_INIT_WITH_MASK)
    repaired = np.where((seeds == cv2.GC_FGD) | (seeds == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    # Keep contact at the lower frame edge. A broad blur would detach feet.
    return repaired


def main() -> None:
    mask = revised_mask()
    Image.fromarray(mask).save(OUT / "refined-mask.png")
    cap = cv2.VideoCapture(str(first.SOURCE))
    held = first.frame_at(cap, 4.0)
    alpha = cv2.GaussianBlur(mask.astype(np.float32) / 255, (3, 3), 0.55)[:, :, None]
    preview = np.clip(held * alpha + first.source_background(first.frame_at(cap, 4.38)) * (1 - alpha), 0, 255).astype(np.uint8)
    Image.fromarray(preview).save(OUT / "full-size-check.png")
    controls = []
    for mode in ("normal", "refined-freeze"):
        target = OUT / f"{mode}.mp4"
        process = subprocess.Popen([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
            "-pix_fmt", "rgb24", "-s", f"{first.W}x{first.H}", "-r", str(first.FPS),
            "-i", "pipe:0", "-an", "-c:v", "libx264", "-crf", "19", "-pix_fmt", "yuv420p", str(target),
        ], stdin=subprocess.PIPE)
        assert process.stdin
        frames = []
        for index in range(first.FRAMES):
            moving = first.frame_at(cap, first.START + index / first.FPS)
            if mode == "refined-freeze" and index >= first.FREEZE_AT:
                plate = first.source_background(moving)
                image = np.clip(held * alpha + plate * (1 - alpha), 0, 255).astype(np.uint8)
            else:
                image = moving
            if index in (5, 6, 11, 17, 23):
                frames.append(Image.fromarray(image).resize((270, 480)))
            process.stdin.write(image.tobytes())
        process.stdin.close()
        if process.wait():
            raise RuntimeError(f"Encode failed: {target}")
        controls.append(frames)
    cap.release()
    contact = Image.new("RGB", (1350, 960))
    for row, frames in enumerate(controls):
        for column, frame in enumerate(frames):
            contact.paste(frame, (column * 270, row * 480))
    contact.save(OUT / "refined-contact.jpg", quality=92)
    (OUT / "evidence.json").write_text(json.dumps({
        "source_sha256": hashlib.sha256(first.SOURCE.read_bytes()).hexdigest(),
        "original_mask_sha256": hashlib.sha256(first.MASK_FILE.read_bytes()).hexdigest(),
        "frames": first.FRAMES, "fps": first.FPS,
        "note": "Manual contour is specific to a single held real-footage frame; inspect the full-size matte before reuse.",
    }, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
