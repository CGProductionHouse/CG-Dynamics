"""Protected one-off Daisy November gratitude cut; source media stays outside Git.

The cut deliberately treats stock people as illustrative story context. The Daisy
shop is identified only by its own flower-window take, storefront photograph and
official logo. No pictured older merchandise is offered as current inventory.
"""
from __future__ import annotations

import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Daisy-Nov-2026")
HERE = ROOT / "private-thankyou-v1"
HERE.mkdir(parents=True, exist_ok=True)
FONT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Client-Libraries\PSG\brand\fonts\Montserrat-wght.ttf")
MUSIC = ROOT / "audio" / "Daisy_MUSIC_Romantic_03_754.mp3"
PAPER = ROOT / "audio" / "sfx" / "Daisy_Paper_Slide.wav"
WHOOSH = ROOT / "audio" / "sfx" / "Daisy_Whoosh_1492.wav"
LOGO = ROOT / "brand" / "Daleo Logo Reveal (1).mp4"
FPS, W, H = 30, 1080, 1920
YELLOW, WHITE = (248, 226, 26), (255, 250, 241)


def run(*args: object) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def font(size: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT), size)
    f.set_variation_by_name("Bold")
    return f


def text_layer(name: str, lead: str, emphasis: str, y: int) -> Path:
    im = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(im)
    # Local legibility field, never a full-screen title card.
    for yy in range(y - 90, y + 260):
        a = int(155 * math.sin(math.pi * (yy - (y - 90)) / 350) ** 1.5)
        d.line((0, yy, W, yy), fill=(14, 14, 14, a))
    for text, yy, color, start_size in [(lead, y, WHITE, 56), (emphasis, y + 90, YELLOW, 86)]:
        size = start_size
        while d.textbbox((0, 0), text, font=font(size))[2] > 925:
            size -= 2
        f = font(size)
        bb = d.textbbox((0, 0), text, font=f)
        x = (W - (bb[2] - bb[0])) // 2 - bb[0]
        d.text((x, yy - bb[1]), text, font=f, fill=(*color, 255))
    d.rounded_rectangle((478, y + 215, 602, y + 222), radius=3, fill=(*YELLOW, 255))
    path = HERE / f"{name}-title.png"
    im.save(path)
    return path


def shot(name: str, source: Path, source_start: float, frames: int, lead: str, emphasis: str,
         *, rotate: str = "", image: bool = False, y: int = 1210, crop_x: float = .5) -> Path:
    assert source.exists(), source
    title = text_layer(name, lead, emphasis, y)
    args: list[object] = []
    if image:
        args += ["-loop", "1", "-framerate", FPS, "-i", source]
    else:
        args += ["-ss", source_start, "-i", source]
    args += ["-loop", "1", "-framerate", FPS, "-i", title]
    if image:
        # One gentle move on the real storefront photo, no dated board visible.
        base = f"scale=1220:2169:force_original_aspect_ratio=increase,crop=1220:2169,zoompan=z='min(zoom+0.00025,1.07)':d=1:s={W}x{H}:fps={FPS}"
    else:
        base = (f"{rotate + ',' if rotate else ''}fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,"
                f"crop={W}:{H}:x='(iw-ow)*{crop_x}':y=(ih-oh)/2,setsar=1")
    duration = frames / FPS
    graph = (f"[0:v]{base},format=yuv420p[base];"
             f"[1:v]format=rgba,fade=t=in:st=0.05:d=0.23:alpha=1,"
             f"fade=t=out:st={max(.1,duration-.27):.3f}:d=0.24:alpha=1[title];"
             "[base][title]overlay=x=0:y='if(lt(t,0.34),55*pow(1-t/0.34,2),0)':eval=frame:shortest=1,format=yuv420p[v]")
    out = HERE / f"{name}.mp4"
    run(*args, "-filter_complex", graph, "-map", "[v]", "-frames:v", frames, "-an", "-r", FPS,
        "-c:v", "libx264", "-preset", "fast", "-crf", 19, "-pix_fmt", "yuv420p", out)
    return out


def main() -> None:
    stock = ROOT / "stock-november-v1"
    real = ROOT / "source-general" / "199A5420.MP4"
    sign = ROOT / "research" / "199A9022.JPG"
    # Cut points follow the measured musical attacks from the liked Romantic 03 track.
    marks = [0, 1.73, 4.82, 7.40, 9.65, 12.16, 14.69, 17.22, 19.70, 22.26, 24.77]
    lens = [round((b-a)*FPS) for a,b in zip(marks,marks[1:])]
    spec = [
        ("01", stock / "41225-720.mp4", 1.0, "DAARDIE EEN MENS", "WAT ALTYD OPDAAG", "", False, 1140, .38),
        ("02", stock / "41225-720.mp4", 2.6, "HIERDIE JAAR", "WAS HULLE DAAR", "", False, 1210, .60),
        ("03", stock / "99909-720.mp4", 1.0, "JY WEET", "PRESIES WIE", "", False, 1180, .52),
        ("04", stock / "99909-720.mp4", 3.1, "VOEG EEN DING BY", "JOU LYS", "", False, 1190, .49),
        ("05", stock / "12130-720.mp4", 1.0, "'N REGTE", "DANKIE", "", False, 1170, .50),
        ("06", stock / "12130-720.mp4", 3.3, "VIR DAARDIE", "EEN PERSOON", "", False, 1230, .48),
        ("07", real, 0.25, "MAAK DIT", "PERSOONLIK", "transpose=1", False, 1200, .50),
        ("08", real, 2.72, "'N KLEIN GEBAAR", "BETEKEN BAIE", "transpose=1", False, 1210, .53),
        ("09", sign, 0, "KOM KIES DIT", "BY DAISY & CO", "", True, 1200, .50),
        ("10", sign, 0, "ONS SIEN JOU BY", "PRELLER SQUARE", "", True, 1210, .50),
    ]
    outputs = [shot(n,p,s,frames,lead,em,rotate=rot,image=img,y=y,crop_x=cx)
               for (n,p,s,lead,em,rot,img,y,cx),frames in zip(spec,lens)]
    # Only the official logo picture, from its already-legible section.
    outro = HERE / "11-official-logo.mp4"
    run("-ss", 2.0, "-i", LOGO, "-an", "-t", 5.06, "-vf", f"fps={FPS},format=yuv420p",
        "-c:v", "libx264", "-preset", "fast", "-crf", 19, outro)
    listfile = HERE / "shots.txt"
    listfile.write_text("".join(f"file '{p.as_posix()}'\n" for p in [*outputs,outro]), encoding="utf-8")
    silent = HERE / "daisy-nov-thankyou-picture.mp4"
    run("-f", "concat", "-safe", "0", "-i", listfile, "-c", "copy", silent)
    final = HERE / "2026_11_DAISY_VIDEO_01_DANKIE_PRIVATE_REVIEW.mp4"
    # Keep the approved song across the logo; the logo file's own audio is absent.
    run("-i", silent, "-ss", 7.639, "-i", MUSIC, "-i", PAPER, "-i", WHOOSH, "-filter_complex",
        "[1:a]volume=0.53,afade=t=out:st=28.90:d=0.93[m];"
        "[2:a]volume=0.14,adelay=4820:all=1[p];"
        "[3:a]volume=0.06,adelay=14690:all=1[w];"
        "[m][p][w]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.89[a]",
        "-map", "0:v", "-map", "[a]",
        "-t", 29.83, "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", final)
    print(final)


if __name__ == "__main__":
    main()
