"""Protected TBS festive-transit beat recut, using screened local sources.

This is deliberately source-specific. It does not send or certify the film.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\TBS-Nov-2026-Goods-Transit")
SRC = ROOT / "source"
TBS = Path(r"C:\Users\chris\Videos\CG-AI-Editing\TBS-Nov-2026\restart-source")
OUTRO = Path(r"C:\Users\chris\Videos\CG-AI-Editing\TBS-Nov-2026\brand\TBS_OFFICIAL_OUTRO.mp4")
OUT = ROOT / "film-r06-private"
# Raleway Heavy is embedded on page 1 of the client content guide; the OFL
# variable family is stored privately beside the media for complete glyphs.
FONT = SRC / "Raleway-wght.ttf"
FPS = 30
OLIVE = (158, 175, 31, 255)  # approved TBS equipment V11 art
WHITE = (255, 255, 255, 255)

SCENES = [
    # key, path, source in, seconds, headline, accent, text side
    ("01-doors", SRC / "adobe-free-401071959.mov", 0.65, 2.50, "BEFORE YOUR NEXT", "LOAD LEAVES", "slide"),
    ("02-scan", SRC / "adobe-free-415688772.mov", 2.00, 2.00, "IS YOUR COVER", "READY TO GO?", "lift"),
    ("03-tbs-sign", TBS / "199A0531.MP4", 0.20, 2.50, "", "", "none"),
    ("04-pallet", SRC / "adobe-free-520299893.mov", 15.8, 3.00, "GOODS IN", "TRANSIT", "slide"),
    ("05-driver", SRC / "adobe-free-418349905.mov", 0.70, 2.50, "YEAR-END DELIVERIES", "ARE AHEAD", "lift"),
    ("06-road", SRC / "adobe-free-585722385.mov", 0.70, 3.00, "", "", "none"),
    ("07-depot", SRC / "adobe-free-440723678.mov", 0.55, 2.50, "REVIEW YOUR COVER", "BEFORE DISPATCH", "slide"),
    ("08-inventory", SRC / "mixkit-4705-inventory-1080.mp4", 1.20, 3.00, "", "", "none"),
    ("09-seal", SRC / "pixabay-8686-box-taper.mp4", 1.00, 2.50, "ASK TBS", "ABOUT YOUR COVER", "lift"),
    ("10-local", TBS / "199A0525.MP4", 0.0, 2.00, "TBS BROKERS", "BLOEMFONTEIN", "slide"),
]


def run(*args: object) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def title_png(path: Path, lead: str, accent: str) -> None:
    image = Image.new("RGBA", (1700, 330), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    for line, y, colour, initial in ((lead, 25, WHITE, 85), (accent, 133, OLIVE, 168)):
        size = initial
        while size > 56:
            font = ImageFont.truetype(str(FONT), size)
            font.set_variation_by_axes([900])
            if draw.textbbox((0, 0), line, font=font)[2] <= 1660:
                break
            size -= 2
        draw.text((7, y), line, font=font, fill=colour, stroke_width=0)
    image.save(path)


def render_scene(key: str, src: Path, start: float, length: float,
                 lead: str, accent: str, style: str) -> Path:
    assert src.exists(), src
    output = OUT / f"{key}.mp4"
    frames = round(length * FPS)
    base = "fps=30,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,eq=contrast=1.045:saturation=0.92"
    if not lead:
        run("-ss", start, "-i", src, "-frames:v", frames, "-vf", base,
            "-an", "-c:v", "libx264", "-preset", "fast", "-crf", 19,
            "-pix_fmt", "yuv420p", "-r", FPS, output)
        return output

    art = OUT / f"{key}-type.png"
    title_png(art, lead, accent)
    # Full-frame soft side shade supports readability without a UI card.
    shade = OUT / "side-shade.png"
    # Rebuild even on revision renders: the old 1100px shade left the long
    # olive lines unreadable over the bright depot and sealing-machine shots.
    im = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for x in range(1700):
        a = int(185 * (1 - x / 1700) ** 0.8)
        d.line((x, 0, x, 1080), fill=(0, 0, 0, a))
    im.save(shade)
    title_x = "if(lt(t,0.28),-1700+(t/0.28)*1800,100)" if style == "slide" else "100"
    title_y = "670" if style == "slide" else "if(lt(t,0.34),1080-(t/0.34)*410,670)"
    filt = (
        f"[0:v]{base}[v];"
        "[1:v]format=rgba,colorchannelmixer=aa=0.88[shade];"
        "[v][shade]overlay=0:0[vs];"
        "[2:v]format=rgba,fade=t=in:st=0.08:d=0.17:alpha=1,"
        f"fade=t=out:st={max(0.3,length-.22):.3f}:d=0.20:alpha=1[title];"
        f"[vs][title]overlay=x='{title_x}':y='{title_y}':eval=frame[out]"
    )
    run("-ss", start, "-i", src, "-loop", 1, "-i", shade,
        "-loop", 1, "-i", art, "-filter_complex", filt,
        "-map", "[out]", "-frames:v", frames, "-an", "-c:v", "libx264",
        "-preset", "fast", "-crf", 19, "-pix_fmt", "yuv420p", "-r", FPS, output)
    return output


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    parts = [render_scene(*s) for s in SCENES]
    end = OUT / "11-official-logo.mp4"
    # Use only the readable official logo section. Centre-crop its portrait
    # animation to a genuine landscape frame; original logo sound is excluded.
    run("-ss", 2.70, "-i", OUTRO, "-frames:v", round(3.48 * FPS),
        "-vf", "fps=30,crop=1080:608:0:656,scale=1920:1080:flags=lanczos,setsar=1",
        "-an", "-c:v", "libx264", "-preset", "fast", "-crf", 19,
        "-pix_fmt", "yuv420p", "-r", FPS, end)
    parts.append(end)
    concat = OUT / "concat.txt"
    concat.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
    picture = OUT / "TBS_FESTIVE_TRANSIT_R06_PRIVATE_PICTURE.mp4"
    run("-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", "-movflags", "+faststart", picture)
    (OUT / "source-ledger.json").write_text(json.dumps([
        {"scene": k, "source": str(src), "source_in_s": start,
         "duration_s": length, "lead": lead, "accent": accent}
        for k, src, start, length, lead, accent, _ in SCENES
    ], indent=2), encoding="utf-8")
    print(picture)


if __name__ == "__main__":
    main()
