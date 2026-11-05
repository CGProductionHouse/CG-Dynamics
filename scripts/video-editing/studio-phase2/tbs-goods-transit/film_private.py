"""One-off protected TBS goods-in-transit film cut; private review only.

Uses locally licensed stock, protected TBS originals and the existing official
outro. This recipe deliberately has no stock downloader or general editor API.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from intro_proof import FPS, H, OLIVE, TAUPE, W, WHITE, ff, scene, type_art

FONT = Path(r"C:\Windows\Fonts\bahnschrift.ttf")
SW, SH = 540, 960


def ui_video(path: Path, seconds: float, mode: str) -> None:
    """Render a source-specific explanatory card with real frame motion."""
    n = round(seconds * FPS)
    proc = subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
         "-pix_fmt", "rgb24", "-s", f"{SW}x{SH}", "-r", str(FPS), "-i", "-",
         "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18",
         "-pix_fmt", "yuv420p", "-vf", "scale=1080:1920", str(path)],
        stdin=subprocess.PIPE,
    )
    assert proc.stdin is not None
    big = ImageFont.truetype(str(FONT), 58)
    med = ImageFont.truetype(str(FONT), 36)
    small = ImageFont.truetype(str(FONT), 25)
    for frame in range(n):
        t = frame / FPS
        im = Image.new("RGB", (SW, SH), (36, 42, 42))
        d = ImageDraw.Draw(im)
        # Oversized crop bands move gently; movement is not a spinning mockup.
        for j in range(12):
            x = ((j * 81 + t * 11) % 750) - 100
            d.line((x, 0, x + 290, SH), fill=(43, 49, 47), width=3)
        if mode == "route":
            d.text((48, 92), "AFTER DISPATCH", font=small, fill=OLIVE)
            d.text((48, 135), "The journey", font=big, fill=WHITE)
            d.text((48, 202), "still matters", font=big, fill=WHITE)
            ys = (385, 510, 635)
            labels = ("PACKED", "IN TRANSIT", "DELIVERED")
            stage = min(2, int(t / 1.65))
            d.line((120, ys[0], 120, ys[-1]), fill=(90, 96, 84), width=8)
            progress = min(1, max(0, (t - .3) / (seconds - .8)))
            d.line((120, ys[0], 120, int(ys[0] + (ys[-1]-ys[0])*progress)), fill=OLIVE, width=10)
            for k, (y, label) in enumerate(zip(ys, labels)):
                active = t >= .3 + k*1.55
                d.ellipse((103, y-17, 137, y+17), fill=OLIVE if active else (91, 97, 91))
                d.text((175, y-22), label, font=med, fill=WHITE if active else (154, 159, 153))
            d.rounded_rectangle((40, 763, 500, 855), radius=13, fill=(116, 102, 80))
            d.text((61, 786), "Is your stock covered", font=med, fill=WHITE)
            d.text((61, 824), "along the way?", font=small, fill=WHITE)
        else:
            d.text((45, 128), "TBS BROKERS", font=small, fill=OLIVE)
            d.text((45, 232), "Goods in", font=big, fill=WHITE)
            d.text((45, 300), "transit", font=big, fill=WHITE)
            d.text((45, 368), "deserves a look", font=med, fill=WHITE)
            d.line((45, 450, 495, 450), fill=OLIVE, width=7)
            reveal = min(1.0, max(0.0, (t - .75) / .45))
            d.rounded_rectangle((45, 550, 495, 712), radius=18, fill=TAUPE)
            if reveal:
                d.text((72, 581), "Ask for a", font=med, fill=WHITE)
                d.text((72, 628), "cover review", font=big, fill=WHITE)
            # Small travelling olive strip signals the call to action.
            d.rounded_rectangle((45, 795, 45+int(450*min(1,t/seconds)), 811), radius=8, fill=OLIVE)
        proc.stdin.write(im.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError("UI render failed")


def main() -> None:
    ap = argparse.ArgumentParser()
    for name in ("source-dir", "tbs-dir", "outro", "music", "click", "whoosh", "output-dir"):
        ap.add_argument("--"+name, required=True, type=Path)
    a = ap.parse_args()
    out = a.output_dir
    out.mkdir(parents=True, exist_ok=True)
    art = out / "art"
    art.mkdir(exist_ok=True)

    # The first two sections retain the independently screened opening action.
    hook = []
    for idx, (word, y, colour, size, reveal) in enumerate([
        ("PACKED", 1255, WHITE, 136, .116),
        ("SENT", 1405, OLIVE, 136, .697),
        ("COVERED?", 1555, WHITE, 124, 1.834),
    ]):
        p = art / f"hook-{idx}.png"
        type_art(p, word, y=y, colour=colour, size=size, hook_panel=(idx == 0))
        hook.append((p, reveal))
    scene(out / "01-pack.mp4", a.source_dir / "mixkit-42131-box-tape.mp4", 4.7, 2.4,
          "inset:440", hook)
    p = art / "inventory.png"
    type_art(p, "STOCK ON THE MOVE", y=1380, colour=WHITE, size=96, panel=True)
    scene(out / "02-stock.mp4", a.source_dir / "mixkit-4705-inventory-1080.mp4", 1.2, 2.3,
          "crop=608:1080:770:0,scale=1080:1920:flags=lanczos,eq=contrast=1.07:saturation=0.84",
          [(p, .52)])
    p = art / "sealing.png"
    type_art(p, "READY TO LEAVE", y=1430, colour=WHITE, size=107, panel=True)
    scene(out / "03-seal.mp4", a.source_dir / "pixabay-8686-box-taper.mp4", 2.0, 2.3,
          "inset:445", [(p, .55)])

    ui_video(out / "04-route.mp4", 6.8, "route")
    p = art / "local.png"
    type_art(p, "LET'S TALK COVER", y=1390, colour=WHITE, size=101, panel=True)
    scene(out / "05-premises.mp4", a.tbs_dir / "199A0525.MP4", 0, 2.2,
          "inset:440", [(p, .45)])
    p = art / "broker.png"
    type_art(p, "TBS BROKERS", y=1400, colour=WHITE, size=114, panel=True)
    scene(out / "06-sign.mp4", a.tbs_dir / "199A0531.MP4", .2, 2.3,
          "inset:440", [(p, .45)])
    ui_video(out / "07-review.mp4", 4.3, "cta")
    # 2.4 + 2.3 + 2.3 + 6.8 + 2.2 + 2.3 + 4.3 + 3.2 = 25.8 s.
    parts = [out / f"{i:02d}-{name}.mp4" for i, name in enumerate(
        ("pack", "stock", "seal", "route", "premises", "sign", "review"), 1)]
    parts.append(a.outro)
    concat = out / "concat.txt"
    concat.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
    ff("-f", "concat", "-safe", "0", "-i", concat, "-c:v", "libx264", "-preset", "fast",
       "-crf", 18, "-pix_fmt", "yuv420p", "-an", out / "picture.mp4")

    # Separable candidate score, UI cues and motivated route transition. All
    # camera sound is excluded: none depicts this illustrative goods route.
    duration = 25.8
    ff("-i", a.music, "-af", f"atrim=0:{duration},asetpts=PTS-STARTPTS,"
       "afade=t=in:st=0:d=0.15,afade=t=out:st=25.4:d=0.4,volume=0.85",
       "-ar", 48000, "-c:a", "pcm_s24le", out / "music-stem.wav")
    graph = (
        "[0:a]atrim=0:25.8,asetpts=PTS-STARTPTS,volume=0.86[m];"
        "[1:a]atrim=0:0.32,asetpts=PTS-STARTPTS,volume=0.25,adelay=697|697[c1];"
        "[1:a]atrim=0:0.32,asetpts=PTS-STARTPTS,volume=0.22,adelay=1834|1834[c2];"
        "[1:a]atrim=0:0.32,asetpts=PTS-STARTPTS,volume=0.20,adelay=7000|7000[c3];"
        "[2:a]atrim=0:0.8,asetpts=PTS-STARTPTS,volume=0.18,adelay=6810|6810[w];"
        "[m][c1][c2][c3][w]amix=inputs=5:duration=longest:normalize=0,"
        "alimiter=limit=0.82:level=disabled[a]"
    )
    ff("-i", out / "music-stem.wav", "-i", a.click, "-i", a.whoosh,
       "-filter_complex", graph, "-map", "[a]", "-ar", 48000,
       "-c:a", "pcm_s24le", out / "candidate-mix.wav")
    ff("-i", out / "picture.mp4", "-i", out / "candidate-mix.wav", "-map", "0:v",
       "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
       "-shortest", out / "TBS_GOODS_TRANSIT_R01_PRIVATE_REVIEW.mp4")
    (out / "manifest.json").write_text(json.dumps({
        "status": "private_review_not_approved", "duration_target": duration,
        "source_roles": {"stock": ["Mixkit 42131", "Mixkit 4705", "Pixabay 8686"],
                         "client": ["199A0525.MP4 premises", "199A0531.MP4 wall sign"],
                         "graphic": "illustrated route and cover-review CTA"},
        "pending": ["independent normal-speed picture/sound", "public picture match",
                    "music originality and creative fit", "phone review"],
    }, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
