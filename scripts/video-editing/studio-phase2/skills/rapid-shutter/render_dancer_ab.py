"""Two-second plain/shutter jump-cut comparison on one licensed moving dancer shot."""
from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

import cv2
from PIL import Image, ImageDraw

SOURCE = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\freeze-frame-refined-20261027\mixkit-1038-720.mp4")
OUT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\rapid-shutter-real-20261027")
SHA256 = "0678de048ee448ed7c363b41ed80ccc67f42975a2afadf167f5042946de2fd17"
W, H, FPS = 1280, 720, 24


def main() -> None:
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SHA256:
        raise RuntimeError("Practice source changed")
    OUT.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(SOURCE))

    def frame_at(seconds: float):
        cap.set(cv2.CAP_PROP_POS_MSEC, seconds * 1000)
        good, bgr = cap.read()
        if not good or bgr.shape[:2] != (H, W):
            raise RuntimeError(f"Missing frame at {seconds:.3f}s")
        return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

    outgoing = [frame_at(8.6 + i / FPS) for i in range(24)]
    incoming = [frame_at(10.6 + i / FPS) for i in range(25)]
    cap.release()
    plain = outgoing + incoming[:24]
    shutter = [f.copy() for f in plain]
    shutter[22] = cv2.GaussianBlur(incoming[0], (1, 19), 0)
    shutter[23] = cv2.GaussianBlur(outgoing[-1], (1, 19), 0)
    forward = outgoing + incoming[1:]
    # Keep the two-frame directional accent but advance monotonically from
    # source pose to destination pose; never flash destination then return.
    forward[22] = cv2.GaussianBlur(outgoing[22], (1, 19), 0)
    forward[23] = cv2.GaussianBlur(incoming[0], (1, 19), 0)

    for name, frames in (("dancer-plain", plain), ("dancer-shutter", shutter),
                         ("dancer-forward-shutter", forward)):
        command = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                   "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0", "-an",
                   "-c:v", "libx264", "-crf", "19", "-pix_fmt", "yuv420p", str(OUT / f"{name}.mp4")]
        process = subprocess.Popen(command, stdin=subprocess.PIPE)
        assert process.stdin
        for frame in frames:
            process.stdin.write(frame.tobytes())
        process.stdin.close()
        if process.wait():
            raise RuntimeError(f"Encode failed: {name}")

    sheet = Image.new("RGB", (8 * 230, 3 * 155), "white")
    draw = ImageDraw.Draw(sheet)
    for row, frames in enumerate((plain, shutter, forward)):
        for column, index in enumerate(range(20, 28)):
            x, y = column * 230, row * 155
            sheet.paste(Image.fromarray(frames[index]).resize((230, 130)), (x, y))
            draw.text((x + 3, y + 133), f"{('plain', 'return', 'forward')[row]} {index}", fill="black")
    sheet.save(OUT / "dancer-contact.jpg", quality=92)

    # Preview the centre portrait crop at a small physical-phone-like size.
    phone = Image.new("RGB", (8 * 180, 3 * 320), "white")
    for row, frames in enumerate((plain, shutter, forward)):
        for col, index in enumerate(range(20, 28)):
            crop = Image.fromarray(frames[index]).crop((438, 0, 843, 720))
            phone.paste(crop.resize((180, 320)), (col * 180, row * 320))
    phone.save(OUT / "dancer-phone-contact.jpg", quality=92)


if __name__ == "__main__":
    main()
