"""Protected Daisy November re-edit using older footage in a new editorial role.

Sources and exports live outside Git. This is a one-off edit recipe, not an engine.
"""
from __future__ import annotations

import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Daisy-Nov-2026")
OUT = ROOT / "private-repurpose-v1"
OUT.mkdir(parents=True, exist_ok=True)
FONT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Client-Libraries\PSG\brand\fonts\Montserrat-wght.ttf")
MUSIC = ROOT / "audio" / "Daisy_MUSIC_Romantic_03_754.mp3"
LOGO = ROOT / "brand" / "Daleo Logo Reveal (1).mp4"
PAPER = ROOT / "audio" / "sfx" / "Daisy_Paper_Slide.wav"
WHOOSH = ROOT / "audio" / "sfx" / "Daisy_Whoosh_1492.wav"
FPS, W, H = 30, 1080, 1920
YELLOW, WHITE = (248, 226, 26), (255, 250, 241)


def run(*args: object) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def font(size: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT), size)
    f.set_variation_by_name("Bold")
    return f


def word_layer(name: str, content: str, y: int, colour: tuple[int, int, int], size: int, tag: str) -> Path:
    im = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(im)
    while d.textbbox((0, 0), content, font=font(size))[2] > 930:
        size -= 2
    f = font(size)
    box = d.textbbox((0, 0), content, font=f)
    x = (W - box[2] + box[0]) // 2 - box[0]
    d.text((x, y - box[1]), content, font=f, fill=(*colour, 255))
    p = OUT / f"{name}-{tag}.png"
    im.save(p)
    return p


def field_layer(name: str, y: int, treatment: str) -> Path:
    im = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(im)
    lo, hi = max(0, y-115), min(H, y+285)
    for yy in range(lo, hi):
        z = (yy-lo) / max(1, hi-lo)
        alpha = int(143 * math.sin(math.pi*z)**1.55)
        d.line((0, yy, W, yy), fill=(14, 14, 14, alpha))
    if treatment == "slide":
        d.line(((95, y-30), (95, y-68), (143, y-68)), fill=(*YELLOW, 255), width=5)
        d.line(((985, y+218), (985, y+256), (937, y+256)), fill=(*YELLOW, 255), width=5)
    else:
        d.rounded_rectangle((490, y+216, 590, y+224), radius=4, fill=(*YELLOW, 255))
    p = OUT / f"{name}-field.png"
    im.save(p)
    return p


def shot(name: str, source: Path, start: float, frames: int, lead: str, accent: str,
         *, rotate: str = "", image: bool = False, y: int = 1200, crop_x: float = .5,
         treatment: str = "rise") -> Path:
    assert source.exists(), source
    field = field_layer(name, y, treatment)
    first = word_layer(name, lead, y, WHITE, 54, "lead")
    second = word_layer(name, accent, y+90, YELLOW, 87, "accent")
    args: list[object] = []
    if image:
        args += ["-loop", "1", "-framerate", FPS, "-i", source]
    else:
        args += ["-ss", start, "-i", source]
    for p in (field, first, second):
        args += ["-loop", "1", "-framerate", FPS, "-i", p]
    if image:
        base = (f"scale=1220:2169:force_original_aspect_ratio=increase,"
                f"crop=1220:2169,zoompan=z='min(zoom+0.00030,1.06)':d=1:s={W}x{H}:fps={FPS}")
    else:
        pace = "setpts=1.5*(PTS-STARTPTS)," if name == "07" else ""
        base = (f"{rotate + ',' if rotate else ''}{pace}fps={FPS},"
                f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,"
                f"crop={W}:{H}:x='(iw-ow)*{crop_x}':y=(ih-oh)/2,setsar=1")
    duration = frames / FPS
    if treatment == "slide":
        lead_x = "if(lt(t,0.23),-90*pow(1-t/0.23,2),0)"
        accent_x = "if(lt(t,0.45),95*pow(1-t/0.45,2),0)"
        lead_y, accent_y = "0", "0"
    else:
        lead_x = accent_x = "0"
        lead_y = "if(lt(t,0.25),48*pow(1-t/0.25,2),0)"
        accent_y = "if(lt(t,0.45),67*pow(1-t/0.45,2),0)"
    fade_out = max(.2, duration-.20)
    graph = (f"[0:v]{base},format=yuv420p[b];"
             f"[1:v]format=rgba,fade=t=in:st=0:d=0.13:alpha=1,fade=t=out:st={fade_out:.3f}:d=0.18:alpha=1[f];"
             f"[2:v]format=rgba,fade=t=in:st=0.04:d=0.17:alpha=1,fade=t=out:st={fade_out:.3f}:d=0.18:alpha=1[l];"
             f"[3:v]format=rgba,fade=t=in:st=0.19:d=0.18:alpha=1,fade=t=out:st={fade_out:.3f}:d=0.18:alpha=1[a];"
             f"[b][f]overlay=shortest=1[v1];"
             f"[v1][l]overlay=x='{lead_x}':y='{lead_y}':eval=frame:shortest=1[v2];"
             f"[v2][a]overlay=x='{accent_x}':y='{accent_y}':eval=frame:shortest=1,format=yuv420p[v]")
    out = OUT / f"{name}.mp4"
    run(*args, "-filter_complex", graph, "-map", "[v]", "-frames:v", frames, "-an", "-r", FPS,
        "-c:v", "libx264", "-preset", "fast", "-crf", 19, "-pix_fmt", "yuv420p", out)
    return out


def main() -> None:
    stock = ROOT / "stock-november-v1"
    r = ROOT / "research"
    marks = [0, 1.73, 4.82, 7.40, 9.65, 12.16, 14.69, 17.22, 19.70, 22.26]
    lengths = [round((b-a)*FPS) for a,b in zip(marks,marks[1:])]
    # Different clean action from July's store-discovery final; previous purpose and
    # exact cut comparison are documented in the source ledger.
    specs = [
        ("01", stock/"41225-720.mp4", 1.0, "WIE HET JOU JAAR", "LIGTER GEMAAK", "", False, 1050, .40, "slide"),
        ("02", stock/"99909-720.mp4", 2.4, "DIE RITTE", "EN GESPREKKE", "", False, 1230, .51, "rise"),
        ("03", stock/"12130-720.mp4", 1.0, "DIE MENS", "WAT OPDAAG", "", False, 940, .50, "slide"),
        ("04", r/"0L8A1073.MP4", 0.0, "SÊ HIERDIE", "NOVEMBER DANKIE", "transpose=2", False, 1250, .51, "rise"),
        ("05", ROOT/"source-general"/"199A5420.MP4", .40, "MET TYD", "EN AANDAG", "transpose=2", False, 920, .50, "slide"),
        ("06", r/"0L8A1083.MP4", .20, "KIES IETS", "PERSOONLIKS", "transpose=2", False, 1250, .50, "rise"),
        ("07", r/"0L8A1072.MP4", .06, "VIR DAARDIE", "EEN PERSOON", "transpose=2", False, 940, .53, "slide"),
        ("08", r/"199A9022.JPG", 0, "KOM IN", "BY DAISY & CO", "", True, 1220, .50, "rise"),
        ("09", ROOT/"source-general"/"199A5420.MP4", 2.8, "ONS SIEN JOU BY", "PRELLER SQUARE", "transpose=2", False, 950, .50, "slide"),
    ]
    outputs = [shot(n, p, s, length, lead, accent, rotate=rot, image=im, y=y, crop_x=cx, treatment=t)
               for (n,p,s,lead,accent,rot,im,y,cx,t),length in zip(specs,lengths)]
    outro = OUT / "11-official-logo.mp4"
    run("-ss", 2.0, "-i", LOGO, "-an", "-t", 5.06, "-vf", f"fps={FPS},format=yuv420p",
        "-c:v", "libx264", "-preset", "fast", "-crf", 19, outro)
    listfile = OUT / "shots.txt"
    listfile.write_text("".join(f"file '{p.as_posix()}'\n" for p in [*outputs, outro]), encoding="utf-8")
    picture = OUT / "daisy-nov-repurpose-picture.mp4"
    run("-f", "concat", "-safe", "0", "-i", listfile, "-c", "copy", picture)
    final = OUT / "2026_11_DAISY_CO_VIDEO_01_PRIVATE_REVIEW.mp4"
    run("-i", picture, "-ss", 7.639, "-i", MUSIC, "-i", PAPER, "-i", WHOOSH,
        "-filter_complex",
        "[1:a]volume=0.53,afade=t=out:st=26.39:d=0.93[m];"
        "[2:a]volume=0.11,adelay=7390:all=1[p];"
        "[3:a]volume=0.045,adelay=9650:all=1[w];"
        "[m][p][w]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.89[a]",
        "-map", "0:v", "-map", "[a]", "-t", 27.32, "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
        "-movflags", "+faststart", final)
    print(final)


if __name__ == "__main__":
    main()
