"""Protected Daisy R03: store-led November thank-you cut from verified private sources.

This is a one-off edit recipe. Client media and renders stay outside Git.
"""
from __future__ import annotations

import math
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

import render as base

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Daisy-Nov-2026")
SOURCE = ROOT / "source-general"
OUT = ROOT / "private-repurpose-v3" / "r03-cut"
OUT.mkdir(parents=True, exist_ok=True)
base.OUT = OUT
FPS = 30
MARKS = [0, 52, 145, 222, 290, 365, 441, 517, 591, 668, 744]


def ff(*args: object) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def real_source(name: str) -> Path:
    path = SOURCE / f"{name}.MP4"
    assert path.is_file(), path
    return path


def prep(name: str, rotate: int, frames: int, start: float = 0, speed: float = 1) -> Path:
    """Orient and conform one screened take; slow changes stay within 12%."""
    path = real_source(name)
    out = OUT / f"prep-{name}.mp4"
    ff("-ss", start, "-i", path, "-an", "-vf",
       f"transpose={rotate},setpts={1/speed:.6f}*(PTS-STARTPTS),fps=30,"
       "scale=1080:1920:flags=lanczos,setsar=1,eq=saturation=1.06",
       "-frames:v", frames, "-c:v", "libx264", "-preset", "fast", "-crf", 18,
       "-pix_fmt", "yuv420p", out)
    return out


def intro() -> Path:
    """Real storefront sign assembles along its photographed cladding seams."""
    source = real_source("199A5417")
    cap = cv2.VideoCapture(str(source))
    temp = OUT / "intro-panel-temp.mp4"
    writer = cv2.VideoWriter(str(temp), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (1080, 1920))
    bands = [(0, 340), (340, 670), (670, 1000), (1000, 1400), (1400, 1920)]
    white = (255, 250, 241)
    yellow = (248, 226, 26)
    for f in range(52):
        cap.set(cv2.CAP_PROP_POS_MSEC, (0.10 + f / FPS) * 1000)
        ok, raw = cap.read()
        if not ok:
            raise RuntimeError(f"Sign source ended at intro frame {f}")
        frame = cv2.resize(cv2.rotate(raw, cv2.ROTATE_90_CLOCKWISE), (1080, 1920))
        canvas = np.zeros_like(frame)
        canvas[:] = (18, 20, 24)
        progress = min(1, max(0, f / 13))
        for k, (y0, y1) in enumerate(bands):
            displacement = int((1 - progress) ** 2 * (780 if k % 2 else -780))
            sx0, sx1 = max(0, -displacement), min(1080, 1080 - displacement)
            dx0, dx1 = sx0 + displacement, sx1 + displacement
            if sx1 > sx0:
                canvas[y0:y1, dx0:dx1] = frame[y0:y1, sx0:sx1]
        im = Image.fromarray(cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)).convert("RGBA")
        # The lower gradient gives the headline contrast without putting a black border on type.
        overlay = Image.new("RGBA", im.size)
        draw = ImageDraw.Draw(overlay)
        for y in range(1190, 1810, 5):
            alpha = int(122 * math.sin(math.pi * (y - 1190) / 620) ** 1.2)
            draw.rectangle((0, y, 1080, y + 5), fill=(12, 12, 14, alpha))
        im = Image.alpha_composite(im, overlay)
        d = ImageDraw.Draw(im)
        p1 = min(1, max(0, (f - 16) / 8))
        p2 = min(1, max(0, (f - 28) / 8))
        if p1:
            line = "WIE VERDIEN"
            font = base.font(76)
            box = d.textbbox((0, 0), line, font=font)
            x = (1080 - (box[2] - box[0])) // 2
            d.text((x, 1370 + int((1-p1)*54)), line, font=font, fill=(*white, int(255*p1)))
        if p2:
            line = "JOU DANKIE?"
            font = base.font(104)
            box = d.textbbox((0, 0), line, font=font)
            x = (1080 - (box[2] - box[0])) // 2
            d.text((x, 1480 + int((1-p2)*74)), line, font=font, fill=(*yellow, int(255*p2)))
        writer.write(cv2.cvtColor(np.asarray(im.convert("RGB")), cv2.COLOR_RGB2BGR))
    cap.release()
    writer.release()
    out = OUT / "01-sign-panel-intro.mp4"
    ff("-i", temp, "-an", "-frames:v", 52, "-c:v", "libx264", "-preset", "fast",
       "-crf", 18, "-pix_fmt", "yuv420p", out)
    return out


def cut() -> Path:
    clips = [intro()]
    # These are alternate raw moments from Franco's September shop folder, not frames
    # lifted from the distributed September presenter/range reel.
    footage = [
        # A half-beat picture cut avoids the raw 5421 camera roll after 1.6 s.
        ("02a", "199A5421", 1, 46, .0, 1, "DANKIE", "KAN", 1190, "slide"),
        ("02b", "199A5419", 1, 47, .0, 1, "BAIE VORME", "HÊ", 1190, "rise"),
        ("04", "199A5279", 2, 68, .18, 1, "IETS OM", "TE SKRYF", 1160, "rise"),
        ("05", "199A5403", 1, 75, .22, 1, "IETS SOETS", "OM TE DEEL", 1250, "slide"),
        ("06", "199A5416", 1, 76, .35, 1, "IETS VIR", "ELKE DAG", 1160, "rise"),
        ("07", "199A5344", 2, 76, .12, 1, "IETS VOL", "KLEUR", 1190, "slide"),
        ("08", "199A5360", 2, 74, .25, 1, "KIES WAT", "BY HULLE PAS", 1200, "rise"),
        ("10", "199A5418", 1, 76, .0, .88, "KOM LOER IN", "PRELLER SQUARE", 1210, "slide"),
    ]
    prepared = {n: prep(n, rot, frames, start, speed)
                for _, n, rot, frames, start, speed, *_ in footage}
    clips.append(base.shot("02a", prepared["199A5421"], 0, 46,
                           "DANKIE", "KAN", y=1190, treatment="slide"))
    clips.append(base.shot("02b", prepared["199A5419"], 0, 47,
                           "BAIE VORME", "HÊ", y=1190, treatment="rise"))
    clips.append(base.shot("03", ROOT / "stock-november-v1" / "99909-720.mp4", 2.45, 77,
                           "BEGIN MET", "'N GEDAGTE", y=1210, treatment="rise"))
    for slot, name, _, frames, _, _, lead, accent, y, treatment in footage[2:7]:
        clips.append(base.shot(slot, prepared[name], 0, frames, lead, accent,
                               y=y, treatment=treatment))
    clips.append(base.shot("09", ROOT / "stock-november-v1" / "12130-720.mp4", 1.10, 77,
                           "SÊ DIT", "MET HART", y=960, treatment="slide"))
    clips.append(base.shot("10", prepared["199A5418"], 0, 76,
                           "KOM LOER IN", "PRELLER SQUARE", y=1210, treatment="slide"))
    logo = OUT / "11-official-logo.mp4"
    ff("-ss", 2.0, "-i", base.LOGO, "-an", "-t", 5.06,
       "-vf", "fps=30,scale=1080:1920,format=yuv420p", "-c:v", "libx264",
       "-preset", "fast", "-crf", 19, logo)
    playlist = OUT / "shots.txt"
    playlist.write_text("".join(f"file '{p.as_posix()}'\n" for p in [*clips, logo]), encoding="utf-8")
    picture = OUT / "r03-picture.mp4"
    ff("-f", "concat", "-safe", "0", "-i", playlist, "-c", "copy", picture)
    return picture


def mix(picture: Path) -> Path:
    film = OUT / "2026_11_DAISY_VIDEO_01_SE_DANKIE_R03_PRIVATE.mp4"
    # No original camera audio; the raw sources contain production sound, not usable story audio.
    # Effects are tied to the panel lock, window cut and two picture/category changes.
    ff("-i", picture, "-ss", 7.639, "-i", base.MUSIC,
       "-i", base.PAPER, "-i", base.WHOOSH,
       "-filter_complex",
       "[1:a]volume=0.53,afade=t=out:st=28.98:d=0.90[m];"
       "[2:a]volume=0.075,adelay=430:all=1[p];"
       "[3:a]volume=0.050,adelay=1730:all=1[w1];"
       "[3:a]volume=0.026,adelay=3260:all=1[w0];"
       "[3:a]volume=0.032,adelay=9650:all=1[w2];"
       "[3:a]volume=0.030,adelay=17220:all=1[w3];"
       "[m][p][w1][w0][w2][w3]amix=inputs=6:duration=first:normalize=0,"
       "alimiter=limit=0.89[a]",
       "-map", "0:v", "-map", "[a]", "-t", 29.88,
       "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", film)
    return film


def contact(film: Path) -> None:
    cap = cv2.VideoCapture(str(film))
    canvas = Image.new("RGB", (5 * 235, 6 * 440), "#202020")
    d = ImageDraw.Draw(canvas)
    for i in range(30):
        cap.set(cv2.CAP_PROP_POS_MSEC, (i + .28) * 1000)
        ok, frame = cap.read()
        if not ok:
            continue
        thumb = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).resize((225, 400))
        x, y = (i % 5) * 235, (i // 5) * 440
        canvas.paste(thumb, (x, y))
        d.text((x + 5, y + 405), f"{i + .28:.2f}s", fill="white")
    cap.release()
    canvas.save(OUT / "r03-contact.jpg", quality=88)


if __name__ == "__main__":
    result = mix(cut())
    contact(result)
    print(result)
