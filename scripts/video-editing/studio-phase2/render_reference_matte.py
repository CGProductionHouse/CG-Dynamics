"""Bounded local proof of the owner's footage-inside-type reference (no client assets)."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output" / "reference-matte"
FPS = 24
FRAMES = 108
W, H = 1080, 1920


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(*args: str) -> None:
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args], check=True)


def main() -> None:
    project = json.loads((ROOT / "project.json").read_text(encoding="utf-8"))
    for kind in ("picture", "music", "effect"):
        asset = ROOT / project[kind]["path"]
        if sha(asset).lower() != project[kind]["sha256"].lower():
            raise RuntimeError(f"Source missing or changed: {asset}")
    OUT.mkdir(parents=True, exist_ok=True)
    frames = OUT / "mask"
    frames.mkdir(exist_ok=True)
    face = ROOT / "scene" / "assets" / "SpaceGrotesk.ttf"
    base = ImageFont.truetype(str(face), 264)
    base.set_variation_by_name("Bold")
    # Push through an opaque stroke of M; the hollow centre of O goes black.
    anchor_x = base.getlength("M") * 0.09
    anchor_y = (base.getbbox("MOVE")[1] + base.getbbox("MOVE")[3]) / 2
    for n in range(FRAMES):
        t = n / FPS
        u = max(0.0, min(1.0, (t - 1.05) / 2.35))
        eased = 1 - (1 - u) ** 3
        scale = 1 + 7 * eased
        font = ImageFont.truetype(str(face), round(264 * scale))
        font.set_variation_by_name("Bold")
        mask = Image.new("L", (W, H), 0)
        draw = ImageDraw.Draw(mask)
        centred_x = (W - base.getlength("MOVE") * scale) / 2
        stroke_x = W / 2 - anchor_x * scale
        x = centred_x * (1 - eased) + stroke_x * eased
        draw.text((x, H / 2 - anchor_y * scale), "MOVE", font=font, fill=255)
        if t >= 1.8:
            # Dissolve the enlarged letter edge into the moving scene.
            fade = min(1.0, (t - 1.8) / 1.6)
            mask = Image.blend(mask, Image.new("L", (W, H), 255), fade)
        mask.save(frames / f"{n:04d}.png", optimize=True)

    stock = ROOT / project["picture"]["path"]
    music = ROOT / project["music"]["path"]
    whoosh = ROOT / project["effect"]["path"]
    result = OUT / "move-through-type.mp4"
    graph = (
        "color=c=0x143448:s=1080x1920:r=24:d=4.5[bg];"
        "[0:v]trim=start=3:duration=4.5,setpts=PTS-STARTPTS,crop=1215:2160:1312:0,"
        "scale=900:1600,chromakey=0x56ee00:0.13:0.09,"
        "despill=type=green:mix=0.7:expand=0.05,format=yuva420p[person];"
        # Push the keyed source below the canvas so its hard lower boundary
        # is hidden by the actual frame edge rather than floating in shot.
        "[bg][person]overlay=x=180:y=430:format=auto,format=rgb24[scene];"
        "[1:v]format=gray[matte];[scene]format=rgba[picture];"
        "[picture][matte]alphamerge[aperture];"
        "color=c=0x06090c:s=1080x1920:r=24:d=4.5[black];"
        "[black][aperture]overlay=0:0:format=auto,format=yuv420p[v];"
        "[2:a]atrim=start=10.425:duration=4.5,asetpts=PTS-STARTPTS,volume=0.72,"
        "afade=t=in:st=0:d=0.08,afade=t=out:st=4.1:d=0.4[m];"
        "[3:a]atrim=duration=1.2,asetpts=PTS-STARTPTS,volume=0.12,"
        "adelay=1050|1050[s];"
        "[m][s]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.92[a]"
    )
    run("-i", str(stock), "-framerate", str(FPS), "-i", str(frames / "%04d.png"),
        "-i", str(music), "-i", str(whoosh), "-filter_complex", graph,
        "-map", "[v]", "-map", "[a]", "-t", "4.5", "-r", str(FPS),
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", str(result))
    print(json.dumps({"path": str(result), "sha256": sha(result), "bytes": result.stat().st_size}))


if __name__ == "__main__":
    main()
