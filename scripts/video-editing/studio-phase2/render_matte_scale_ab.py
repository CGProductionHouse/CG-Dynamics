"""One-second opening-scale A/B for the existing footage-in-type proof."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
PRIVATE = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\matte-scale-20261027")
SOURCE = ROOT / "media/mixkit-28306-2160.mp4"
FONT = ROOT / "scene/assets/SpaceGrotesk.ttf"
W, H, FPS, FRAMES = 1080, 1920, 24, 24


def run(*args: str) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def main() -> None:
    project = json.loads((ROOT / "project.json").read_text(encoding="utf-8"))
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != project["picture"]["sha256"]:
        raise SystemExit("Changed or missing licensed practice source")
    PRIVATE.mkdir(parents=True, exist_ok=True)
    mask_dirs = {}
    for name, size in (("control", 264), ("large", 396)):
        masks = PRIVATE / f"{name}-mask"
        masks.mkdir(exist_ok=True)
        mask_dirs[name] = masks
        font = ImageFont.truetype(str(FONT), size)
        font.set_variation_by_name("Bold")
        mask = Image.new("L", (W, H), 0)
        draw = ImageDraw.Draw(mask)
        box = draw.textbbox((0, 0), "MOVE", font=font)
        x = (W - (box[2] - box[0])) / 2 - box[0]
        y = (H - (box[3] - box[1])) / 2 - box[1]
        draw.text((round(x), round(y)), "MOVE", font=font, fill=255)
        for n in range(FRAMES):
            mask.save(masks / f"{n:04d}.png")

    graph = (
        "color=c=0x143448:s=1080x1920:r=24:d=1[bg];"
        "[0:v]trim=start=3:duration=1,setpts=PTS-STARTPTS,crop=1215:2160:1312:0,"
        "scale=900:1600,chromakey=0x56ee00:0.13:0.09,"
        "despill=type=green:mix=0.7:expand=0.05,format=yuva420p[person];"
        "[bg][person]overlay=x=180:y=430:format=auto,format=rgb24[scene];"
        "[1:v]format=gray[matte];[scene]format=rgba[picture];"
        "[picture][matte]alphamerge[aperture];"
        "color=c=0x06090c:s=1080x1920:r=24:d=1[black];"
        "[black][aperture]overlay=0:0:format=auto,format=yuv420p[v]"
    )
    for name, mask_dir in mask_dirs.items():
        run("-i", str(SOURCE), "-framerate", str(FPS), "-i", str(mask_dir / "%04d.png"),
            "-filter_complex", graph, "-map", "[v]", "-frames:v", str(FRAMES), "-an",
            "-c:v", "libx264", "-crf", "19", "-preset", "fast", "-pix_fmt", "yuv420p",
            str(PRIVATE / f"{name}.mp4"))

    # The same source frame, two masks; show multiple moments at phone scale.
    import cv2

    rows = []
    for name in ("control", "large"):
        capture = cv2.VideoCapture(str(PRIVATE / f"{name}.mp4"))
        frames = []
        for i in range(FRAMES):
            ok, frame = capture.read()
            if not ok:
                raise RuntimeError(f"Missing {name} frame {i}")
            if i in (0, 6, 12, 18, 23):
                frames.append(Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).resize((270, 480)))
        capture.release()
        rows.append(frames)
    contact = Image.new("RGB", (5 * 270, 2 * 480), "black")
    for row, frames in enumerate(rows):
        for col, frame in enumerate(frames):
            contact.paste(frame, (col * 270, row * 480))
    contact.save(PRIVATE / "phone-contact.jpg", quality=93)
    print(PRIVATE)


if __name__ == "__main__":
    main()
