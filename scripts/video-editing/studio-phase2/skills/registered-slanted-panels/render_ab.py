"""Three slanted apertures sampling one continuous incoming canvas.

Usage: python render_ab.py --output-dir PRIVATE_DIR
No creator footage, template assets or client media are used.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "media/mixkit-41865-720.mp4"
SHA = "883b71655e2f2448a03b02f6e318eced58b51bac5b74da86c018995f3c817331"
W, H, FPS, COUNT, CUT = 540, 960, 30, 90, 54


def encode(path: Path, frames: list[np.ndarray]) -> None:
    p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                          "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264",
                          "-crf", "18", "-pix_fmt", "yuv420p", str(path)], stdin=subprocess.PIPE)
    for a in frames:
        p.stdin.write(a.tobytes())
    p.stdin.close()
    if p.wait(): raise RuntimeError(path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SHA:
        raise RuntimeError("Licensed original missing/changed")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(SOURCE))
    yy, xx = np.mgrid[:H, :W]
    # A registered common coordinate field; never squeeze the entire shot into each panel.
    field = xx + .12 * (yy - H / 2)
    masks = [(abs(field - center) < 68) & (yy >= 90) & (yy < 870)
             for center in (92, 270, 448)]
    base = np.zeros((H, W, 3), dtype=np.uint8)
    base[:] = (21, 39, 47)
    base[yy % 80 < 1] = (29, 51, 59)
    plain, effect, changed = [], [], []
    registered_pixel_errors = []
    for i in range(COUNT):
        # Same source-time map in all panels and in the final full-frame reveal.
        cap.set(cv2.CAP_PROP_POS_MSEC, (2 + max(0, i-24) / FPS) * 1000)
        ok, source = cap.read()
        if not ok: raise RuntimeError(f"source frame {i}")
        canvas = cv2.cvtColor(cv2.resize(source, (W, H)), cv2.COLOR_BGR2RGB)
        a = base.copy() if i < CUT else canvas.copy()
        b = a.copy()
        for j, mask in enumerate(masks):
            onset = 24 + j * 6
            if onset <= i < CUT:
                if i - onset < 2:
                    b[mask] = (239, 236, 224)
                else:
                    b[mask] = canvas[mask]
                    registered_pixel_errors.append(int(np.max(abs(b[mask].astype(int)-canvas[mask].astype(int)))))
        if np.any(a != b): changed.append(i)
        plain.append(a); effect.append(b)
    cap.release()
    assert changed == list(range(24, 54))
    assert max(registered_pixel_errors) == 0
    assert np.array_equal(plain[CUT], effect[CUT])
    encode(args.output_dir / "plain.mp4", plain)
    encode(args.output_dir / "registered-panels.mp4", effect)
    contact = Image.new("RGB", (W*6, H*2))
    for col, i in enumerate((23, 24, 32, 38, 53, 54)):
        for row, seq in enumerate((plain, effect)):
            contact.paste(Image.fromarray(seq[i]), (col*W, row*H))
    contact.resize((1620, 960)).save(args.output_dir / "contact.jpg", quality=92)
    evidence = {"source_sha256": SHA, "fps": FPS, "frames": COUNT, "cut_frame": CUT,
                "source_map": "2 + max(0, frame-24)/30 seconds", "panel_onsets": [24,30,36],
                "white_hold_frames": 2, "preencode_changed_frames": [min(changed),max(changed)],
                "registered_canvas_max_error": max(registered_pixel_errors),
                "full_reveal_matches_control": True,
                "outputs": {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in args.output_dir.glob('*.mp4')}}
    (args.output_dir / "receipt.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    print(json.dumps(evidence))


if __name__ == "__main__": main()
