"""Protected Daisy R02 picture candidate; never overwrites R01 or client originals."""
from __future__ import annotations

import subprocess
from pathlib import Path

import render as base
import cv2
from PIL import Image, ImageDraw

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Daisy-Nov-2026")
OUT = ROOT / "private-repurpose-v2" / "r02-cut"
OUT.mkdir(parents=True, exist_ok=True)
base.OUT = OUT
FPS = 30


def ff(*args: object) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def intro() -> Path:
    source = ROOT / "private-repurpose-v2" / "daisy-intro-split-test.mp4"
    # Type sits across the common edge; both faces and their gestures remain visible.
    first = base.word_layer("intro", "WIE HET JOU JAAR", 725, base.WHITE, 62, "lead")
    second = base.word_layer("intro", "LIGTER GEMAAK", 810, base.YELLOW, 79, "accent")
    out = OUT / "01-split-intro.mp4"
    ff("-i", source, "-loop", "1", "-framerate", FPS, "-i", first,
       "-loop", "1", "-framerate", FPS, "-i", second,
       "-filter_complex",
       "[0:v]fps=30,format=yuv420p[b];"
       "[1:v]format=rgba,fade=t=in:st=0.12:d=0.20:alpha=1[t];"
       "[2:v]format=rgba,fade=t=in:st=0.42:d=0.20:alpha=1[a];"
       "[b][t]overlay=shortest=1[x];[x][a]overlay=shortest=1,format=yuv420p[v]",
       "-map", "[v]", "-frames:v", 52, "-an", "-c:v", "libx264", "-preset", "fast",
       "-crf", 18, "-pix_fmt", "yuv420p", out)
    return out


def sign() -> Path:
    source = ROOT / "private-repurpose-v2" / "sign-push-test.mp4"
    first = base.word_layer("sign", "KOM LOER IN", 1200, base.WHITE, 61, "lead")
    second = base.word_layer("sign", "PRELLER SQUARE", 1300, base.YELLOW, 75, "accent")
    out = OUT / "05-sign.mp4"
    ff("-i", source, "-loop", "1", "-framerate", FPS, "-i", first,
       "-loop", "1", "-framerate", FPS, "-i", second,
       "-filter_complex",
       "[0:v]fps=30,format=yuv420p[b];"
       "[1:v]format=rgba,fade=t=in:st=0.12:d=0.18:alpha=1[t];"
       "[2:v]format=rgba,fade=t=in:st=0.36:d=0.18:alpha=1[a];"
       "[b][t]overlay=shortest=1[x];[x][a]overlay=shortest=1,format=yuv420p[v]",
       "-map", "[v]", "-frames:v", 90, "-an", "-c:v", "libx264", "-preset", "fast",
       "-crf", 18, "-pix_fmt", "yuv420p", out)
    return out


def main() -> None:
    stock = ROOT / "stock-november-v1"
    clips = [
        intro(),
        base.shot("02", stock / "99909-720.mp4", 2.45, 93,
                  "DIE EEN WAT", "ALTYD LUISTER", y=1210, treatment="rise"),
        base.shot("03", stock / "12130-720.mp4", 1.10, 77,
                  "EN ALTYD", "OPDAAG", y=960, treatment="slide"),
        base.shot("04", ROOT / "private-repurpose-v2" / "1083-stabilized.mp4", .15, 68,
                  "SÊ DANKIE", "OP JOU MANIER", y=1210, treatment="rise"),
        sign(),
    ]
    logo = OUT / "06-official-logo.mp4"
    ff("-ss", 2.0, "-i", base.LOGO, "-an", "-t", 5.06,
       "-vf", "fps=30,scale=1080:1920,format=yuv420p", "-c:v", "libx264",
       "-preset", "fast", "-crf", 19, logo)
    playlist = OUT / "shots.txt"
    playlist.write_text("".join(f"file '{p.as_posix()}'\n" for p in [*clips, logo]), encoding="utf-8")
    picture = OUT / "r02-picture.mp4"
    ff("-f", "concat", "-safe", "0", "-i", playlist, "-c", "copy", picture)
    film = OUT / "2026_11_DAISY_VIDEO_01_SE_DANKIE_R02_PRIVATE.mp4"
    ff("-i", picture, "-ss", 7.639, "-i", base.MUSIC,
       "-i", base.PAPER, "-i", base.WHOOSH,
       "-filter_complex", "[1:a]volume=0.53,afade=t=out:st=16.35:d=0.85[m];"
       "[2:a]volume=0.09,adelay=1730:all=1[p];"
       "[3:a]volume=0.045,adelay=9670:all=1[w];"
       "[m][p][w]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.89[a]",
       "-map", "0:v", "-map", "[a]",
       "-t", 17.20, "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
       "-movflags", "+faststart", film)
    cap = cv2.VideoCapture(str(film))
    contact = Image.new("RGB", (5 * 230, 4 * 445), "#202020")
    label = ImageDraw.Draw(contact)
    for second in range(17):
        cap.set(cv2.CAP_PROP_POS_MSEC, (second + .30) * 1000)
        ok, frame = cap.read()
        if not ok:
            continue
        thumb = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).resize((225, 400))
        x, y = (second % 5) * 230, (second // 5) * 445
        contact.paste(thumb, (x, y))
        label.text((x + 6, y + 406), f"{second + .30:.2f} s", fill="white")
    cap.release()
    contact.save(OUT / "r02-contact.jpg", quality=88)
    print(film)


if __name__ == "__main__":
    main()
