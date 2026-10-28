"""One-frame colour-invert A/B on licensed stock contact; not a client trailer."""

from hashlib import sha256
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "media/fight-practice/40969.mp4"
EXPECTED = "5d417cfd997899890a199c7f5ed3ab5fa7d7592e96a5bfeb511eb24349667298"
OUT = ROOT / "output/fight-color-invert"
PROOF = ROOT / "proof-fight-color-invert-ab.mp4"
FONT = ROOT / "scene/assets/SpaceGrotesk.ttf"


def run(*args: str) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def main() -> None:
    if not SOURCE.exists() or sha256(SOURCE.read_bytes()).hexdigest() != EXPECTED:
        raise SystemExit("Missing or changed licensed Mixkit #40969 practice source")
    OUT.mkdir(parents=True, exist_ok=True)
    common = "fps=24000/1001,crop=404:720:300:0,scale=540:960:flags=lanczos,setsar=1"
    for name, vf in (
        ("control", common),
        ("one-frame-invert", common + ",negate=enable='eq(n,8)'"),
    ):
        run("-i", str(SOURCE), "-vf", vf, "-frames:v", "48", "-an", "-c:v", "libx264",
            "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", str(OUT / f"{name}.mp4"))

    overlay = Image.new("RGBA", (1080, 960), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font = ImageFont.truetype(str(FONT), 26)
    small = ImageFont.truetype(str(FONT), 19)
    draw.rectangle((0, 0, 1080, 63), fill=(0, 0, 0, 182))
    draw.text((24, 15), "CONTROL", font=font, fill="white")
    draw.text((564, 15), "ONE FRAME INVERT", font=font, fill="white")
    draw.rectangle((0, 914, 1080, 960), fill=(0, 0, 0, 190))
    draw.text((24, 925), "STOCK PRACTICE • SILENT • NOT STAFFY", font=small, fill="white")
    overlay_path = OUT / "labels.png"
    overlay.save(overlay_path)
    run("-i", str(OUT / "control.mp4"), "-i", str(OUT / "one-frame-invert.mp4"),
        "-loop", "1", "-i", str(overlay_path),
        "-filter_complex", "[0:v][1:v]hstack=inputs=2[ab];[ab][2:v]overlay=shortest=1[v]",
        "-map", "[v]", "-frames:v", "48", "-an", "-c:v", "libx264", "-crf", "18",
        "-preset", "medium", "-pix_fmt", "yuv420p", str(PROOF))
    print(PROOF)


if __name__ == "__main__":
    main()
