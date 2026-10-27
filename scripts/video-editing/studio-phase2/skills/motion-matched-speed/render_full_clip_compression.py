"""Bounded full-clip time compression and manual portrait reframe study."""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

SOURCE = Path.home() / "Videos/CG-AI-Editing/Nolan-Skill-Proofs/cinematic-travel-20261027/mixkit-134-720.mp4"
OUT = Path.home() / "Videos/CG-AI-Editing/Nolan-Skill-Proofs/full-clip-compression-20261027"
SHA = "de17d355543cda1f396361d2e217ae115c9be5eb60efe22cce0fc6a3d517d54d"
FPS = 24


def encode(path: Path, frames: list[np.ndarray]) -> None:
    height, width = frames[0].shape[:2]
    process = subprocess.Popen([
        "ffmpeg", "-nostdin", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{width}x{height}", "-r", str(FPS), "-i", "pipe:0", "-an",
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
    normal_wide, fast = [], []
    for index in range(360):
        cap.set(cv2.CAP_PROP_POS_MSEC, (9 + index / FPS) * 1000)
        ok, frame = cap.read()
        if not ok:
            raise RuntimeError(index)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        normal_wide.append(cv2.resize(rgb, (640, 360)))
        if index % 3 == 0:
            fast.append(rgb)
    cap.release()
    assert len(fast) == 120
    fast_wide = [cv2.resize(frame, (640, 360)) for frame in fast]
    assert all(np.array_equal(frame, normal_wide[index * 3]) for index, frame in enumerate(fast_wide))
    # Observed subject positions, manually keyed rather than an automatic tracker.
    times = 9 + np.array([0, 15, 30, 45, 60, 75, 90, 105, 119], dtype=float) * 3 / FPS
    centres = np.array([750, 670, 680, 600, 610, 690, 760, 710, 590], dtype=float)
    fixed, reframed, crop_centres = [], [], []
    for index, frame in enumerate(fast):
        source_time = 9 + index * 3 / FPS
        segment = min(len(times) - 2, max(0, int(np.searchsorted(times, source_time, side="right") - 1)))
        u = (source_time - times[segment]) / (times[segment + 1] - times[segment])
        eased = u * u * (3 - 2 * u)
        centre = centres[segment] * (1 - eased) + centres[segment + 1] * eased
        left = round(np.clip(centre - 202.5, 0, 875))
        crop_centres.append(float(centre))
        fixed.append(cv2.resize(frame[:, 438:843], (270, 480)))
        reframed.append(cv2.resize(frame[:, left:left + 405], (270, 480)))
    encode(OUT / "normal-wide-15s.mp4", normal_wide)
    encode(OUT / "compressed-wide-5s.mp4", fast_wide)
    encode(OUT / "compressed-fixed-portrait.mp4", fixed)
    encode(OUT / "compressed-manual-portrait.mp4", reframed)
    picks = (0, 15, 30, 45, 60, 75, 90, 105, 119)
    contact = Image.new("RGB", (9 * 180, 2 * 340), "#101010")
    draw = ImageDraw.Draw(contact)
    for row, (name, frames) in enumerate((("fixed", fixed), ("manual", reframed))):
        for col, index in enumerate(picks):
            contact.paste(Image.fromarray(frames[index]).resize((180, 320)), (col * 180, row * 340 + 20))
            draw.text((col * 180 + 3, row * 340 + 3), f"{name} {index}", fill="white")
    contact.save(OUT / "portrait-contact.jpg", quality=93)
    grid = Image.new("RGB", (1920, 1140), "#101010")
    for tile, index in enumerate(picks):
        panel = Image.fromarray(fast[index]).resize((640, 360))
        draw_panel = ImageDraw.Draw(panel)
        for x in range(400, 1000, 100):
            draw_panel.line((x / 2, 0, x / 2, 360), fill="#a0a040")
            draw_panel.text((x / 2 + 2, 5), str(x), fill="white")
        x, y = tile % 3 * 640, tile // 3 * 380
        grid.paste(panel, (x, y + 20))
        ImageDraw.Draw(grid).text((x + 4, y + 3), f"output {index} / source {9 + index * 3 / FPS:.3f}s", fill="white")
    grid.save(OUT / "source-anchor-grid.jpg", quality=93)
    (OUT / "source-map.json").write_text(json.dumps({
        "source": str(SOURCE), "source_sha256": SHA, "source_span": [9, 24],
        "normal_frames": 360, "compressed_frames": 120, "fps": FPS,
        "compressed_source_index_step": 3, "manual_centres": crop_centres,
        "wide_compression_pixel_matches_every_third_normal_frame_preencode": True,
        "manual_anchor_times": times.tolist(), "manual_anchor_x": centres.tolist(),
        "audio": "source absent; no sound added",
    }, indent=2), encoding="utf-8")
    print(OUT)


if __name__ == "__main__":
    main()
