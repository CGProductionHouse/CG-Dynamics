"""Render one stock-only Fight Night trailer cold-open A/B with existing FFmpeg.

The labelled proof is for editorial timing practice, never a Staffy source shot.
"""

from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
MEDIA = ROOT / "media" / "fight-practice"
OUTPUT = ROOT / "output" / "fight-practice"
VIDEO = MEDIA / "40974.mp4"
PUNCH = MEDIA / "mixkit-2165-face-punch.wav"
VIDEO_SHA256 = "938bba8c5c586d700be40e2cabf628713dcc440caefb931d8229d1e99f1ce634"
PUNCH_SHA256 = "540617d4b9f5b2b55527ac148edfdf1eaecb31d1d781ee515b6fbba8b740ce05"
FPS = "24000/1001"
FRAMES = 24  # 1.001 s impact beat; the first 3 s candidate lingered past the useful reaction.
DURATION = FRAMES * 1001 / 24000
CUE_ONSET_MS = 342  # WAV peak at 0.0328 s; peak lands near local frame 9 / 0.375 s.


def run(*args: str) -> None:
    subprocess.run(args, cwd=ROOT, check=True)


def digest(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            sha.update(chunk)
    return sha.hexdigest()


def main() -> None:
    for path, expected in ((VIDEO, VIDEO_SHA256), (PUNCH, PUNCH_SHA256)):
        if not path.is_file() or digest(path).lower() != expected:
            raise SystemExit(f"Missing or changed licensed practice asset: {path}")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    label = OUTPUT / "stock-practice-label.png"
    canvas = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(str(ROOT / "scene" / "assets" / "SpaceGrotesk.ttf"), 39)
    draw.rounded_rectangle((70, 206, 530, 275), radius=12, fill=(8, 13, 17, 220))
    draw.text((91, 219), "STOCK PRACTICE", font=font, fill=(255, 244, 230, 255))
    canvas.save(label)

    picture = OUTPUT / "scene1-picture.mp4"
    run(
        "ffmpeg", "-y", "-loglevel", "error", "-ss", "5", "-i", str(VIDEO),
        "-loop", "1", "-i", str(label), "-filter_complex",
        "[0:v]scale=1080:1920,setsar=1[base];[base][1:v]overlay=0:0:shortest=1,format=yuv420p[v]",
        "-map", "[v]", "-frames:v", str(FRAMES), "-r", FPS,
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "19", str(picture),
    )
    dry = ROOT / "proof-fight-scene1-dry.mp4"
    designed = ROOT / "proof-fight-scene1-impact.mp4"
    run(
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(picture),
        "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-map", "0:v:0", "-map", "1:a:0", "-t", f"{DURATION:.6f}",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", str(dry),
    )
    run(
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(picture), "-i", str(PUNCH),
        "-filter_complex",
        f"[1:a]volume=0.4,adelay={CUE_ONSET_MS}|{CUE_ONSET_MS},"
        f"apad,atrim=duration={DURATION:.6f}[a]",
        "-map", "0:v:0", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", str(designed),
    )
    for path in (dry, designed):
        print(path.name, path.stat().st_size, digest(path))


if __name__ == "__main__":
    main()
