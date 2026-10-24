"""Small original typography proof using the existing Pillow/FFmpeg toolchain."""

from __future__ import annotations

import hashlib
import json
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output" / "staggered-type"
W, H, FPS, DURATION = 1080, 1920, 24, 4.5
WORDS = (("MAKE", 0.18), ("THE", 0.72), ("MOMENT", 1.26))


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ease_out(t: float) -> float:
    u = max(0.0, min(1.0, t))
    return 1 - (1 - u) ** 3


def main() -> None:
    project = json.loads((ROOT / "project.json").read_text(encoding="utf-8"))
    music = ROOT / project["music"]["path"]
    if sha(music).lower() != project["music"]["sha256"].lower():
        raise RuntimeError(f"Music missing or changed: {music}")
    face = ROOT / "scene" / "assets" / "SpaceGrotesk.ttf"
    font = ImageFont.truetype(str(face), 166)
    font.set_variation_by_name("Bold")
    small = ImageFont.truetype(str(face), 40)
    OUT.mkdir(parents=True, exist_ok=True)
    frames = OUT / "frames"
    frames.mkdir(exist_ok=True)

    for n in range(round(DURATION * FPS)):
        t = n / FPS
        frame = Image.new("RGB", (W, H), "#10151a")
        draw = ImageDraw.Draw(frame)
        # Original abstract backing; all message-bearing type stays inside
        # the conservative 108px side / 250px top / 350px bottom bounds.
        draw.rounded_rectangle((108, 260, 972, 915), radius=36, fill="#193843")
        draw.line((108, 982, 972, 982), fill="#c8ff55", width=6)
        pulse = 0.5 + 0.5 * math.sin(2 * math.pi * t / 2.0)
        r = round(130 + 25 * pulse)
        draw.ellipse((540 - r, 1320 - r, 540 + r, 1320 + r), outline="#355763", width=16)
        draw.ellipse((455, 1235, 625, 1405), fill="#c8ff55")
        for i, (word, start) in enumerate(WORDS):
            progress = ease_out((t - start) / 0.28)
            if progress == 0:
                continue
            x = 160 + round((1 - progress) * 120)
            y = 310 + i * 186 + round((1 - progress) * 40)
            # Text is drawn on a separate layer so its entrance opacity can
            # change without fading the stationary backing or earlier words.
            layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ink = ImageDraw.Draw(layer)
            colour = (200, 255, 85, round(255 * progress)) if i == 2 else (242, 241, 232, round(255 * progress))
            ink.text((x, y), word, font=font, fill=colour)
            frame = Image.alpha_composite(frame.convert("RGBA"), layer).convert("RGB")
        draw = ImageDraw.Draw(frame)
        draw.text((160, 1050), "ONE IDEA. THREE BEATS.", font=small, fill="#f2f1e8")
        frame.save(frames / f"{n:04d}.png", optimize=True)

    contact = Image.new("RGB", (810, 960))
    for i, n in enumerate((0, 12, 24, 36, 48, 96)):
        with Image.open(frames / f"{n:04d}.png") as sample:
            contact.paste(sample.resize((270, 480)), ((i % 3) * 270, (i // 3) * 480))
    contact.save(OUT / "contact.png")

    result = OUT / "staggered-type.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-framerate", str(FPS),
         "-i", str(frames / "%04d.png"), "-ss", str(project["music"]["source_in_seconds"]),
         "-i", str(music), "-filter_complex",
         "[1:a]atrim=duration=4.5,asetpts=PTS-STARTPTS,volume=0.72,"
         "afade=t=in:st=0:d=0.08,afade=t=out:st=4.1:d=0.4[a]",
         "-map", "0:v", "-map", "[a]", "-t", str(DURATION), "-c:v", "libx264",
         "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", str(result)], check=True
    )
    print(json.dumps({"path": str(result), "sha256": sha(result), "bytes": result.stat().st_size}))


if __name__ == "__main__":
    main()
