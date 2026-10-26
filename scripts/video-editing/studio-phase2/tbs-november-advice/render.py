"""One-off TBS adviser film assembly from private, verified source copies.

This keeps the source/timing ledger explicit and uses the existing FFmpeg workflow.
No media is stored in Git. Run with --root pointing at the private TBS-Nov-2026 kit.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
TAUPE = (120, 102, 80)
OLIVE = (158, 175, 31)
WHITE = (255, 255, 255)
FONT = Path(r"C:\Windows\Fonts\bahnschrift.ttf")


def ff(*args: object) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def label(path: Path, lines: list[tuple[str, tuple[int, int, int]]], *, top: int = 1260) -> None:
    im = Image.new("RGBA", (W, H))
    dr = ImageDraw.Draw(im)
    # A soft brand-colour field, never a black outline around the approved type.
    for y in range(top - 80, min(H, top + 330)):
        u = (y - (top - 80)) / 410
        alpha = round(140 * math.sin(math.pi * u) ** 1.3)
        dr.line((0, y, W, y), fill=(*TAUPE, alpha))
    dr.rounded_rectangle((90, top - 25, 215, top - 17), radius=4, fill=(*OLIVE, 255))
    y = top
    for text, color in lines:
        size = 81 if len(text) < 19 else 66
        font = ImageFont.truetype(str(FONT), size)
        while dr.textbbox((0, 0), text, font=font)[2] > 890:
            size -= 2
            font = ImageFont.truetype(str(FONT), size)
        dr.text((90, y), text, font=font, fill=(*color, 255))
        y += size + 18
    im.save(path)


def shot(out: Path, source: Path, start: float, duration: float, transform: str,
         overlays: list[tuple[Path, float, float]]) -> None:
    args: list[object] = ["-ss", f"{start:.3f}", "-i", source]
    for path, _, _ in overlays:
        args.extend(["-loop", "1", "-framerate", FPS, "-i", path])
    base = f"[0:v]fps={FPS},{transform},setsar=1,format=yuv420p[base]"
    graph = [base]
    previous = "base"
    for i, (_, reveal, end) in enumerate(overlays, 1):
        art = f"art{i}"
        nxt = f"v{i}"
        graph.append(f"[{i}:v]format=rgba,fade=t=in:st={reveal:.3f}:d=0.16:alpha=1,"
                     f"fade=t=out:st={end:.3f}:d=0.18:alpha=1[{art}]")
        graph.append(f"[{previous}][{art}]overlay=x='if(lt(t,{reveal+.26:.3f}),"
                     f"55*pow(1-max(0,t-{reveal:.3f})/.26,2),0)':y=0:"
                     f"eval=frame:shortest=1[{nxt}]")
        previous = nxt
    graph.append(f"[{previous}]format=yuv420p[v]")
    frames = round(duration * FPS)
    ff(*args, "-filter_complex", ";".join(graph), "-map", "[v]", "-an",
       "-frames:v", frames, "-r", FPS, "-c:v", "libx264", "-preset", "fast",
       "-crf", 18, "-pix_fmt", "yuv420p", out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=Path, required=True, help="Private TBS-Nov-2026 media kit")
    args = ap.parse_args()
    root = args.root
    src = root / "restart-source"
    work = root / "work" / "advice-v1"
    work.mkdir(parents=True, exist_ok=True)
    protected = root / "work"
    outro = protected / "tbs-official-outro-picture-only-3p2s.mp4"
    names = [
        ("01-intro", protected / "tbs-advisor-opening-original-sound-v3-tight.mp4", 0, 4,
         "scale=1080:1920:flags=lanczos,eq=contrast=1.035:saturation=1.04",
         [("INSURANCE CAN BE", WHITE, "OVERWHELMING", OLIVE, .05, 3.78)]),
        ("02-family", src / "199A0496.MP4", 3.20, 3.00,
         "crop=1215:2160:2300:0,scale=1080:1920:flags=lanczos,eq=gamma=1.24:contrast=1.06:saturation=1.08",
         [("WHAT MATTERS", WHITE, "YOUR FAMILY", OLIVE, 1.12, 2.80)]),
        ("03-vehicle", src / "pexels-car-key-4513068.mp4", .80, 1.50,
         "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,eq=gamma=0.93:contrast=1.04:saturation=1.02",
         [("YOUR VEHICLE", WHITE, "", OLIVE, .02, 1.30)]),
        ("04-home", src / "pexels-home-key-8292925.mp4", 4.15, 1.50,
         "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,eq=contrast=1.05:saturation=1.04",
         [("YOUR HOME", WHITE, "", OLIVE, .02, 1.30)]),
        ("05-business", src / "mixkit-business-42652.mp4", .65, 1.50,
         "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,eq=contrast=1.04:saturation=1.04",
         [("YOUR BUSINESS", WHITE, "", OLIVE, .02, 1.30)]),
        ("06-question", src / "199A0474.MP4", 14.15, 3.75,
         "transpose=2,scale=1080:1920:flags=lanczos,eq=contrast=1.035:saturation=1.04",
         [("NOT WHICH POLICY", WHITE, "LOOKS GOOD", OLIVE, .35, 3.55)]),
        ("07-answer", src / "199A0474.MP4", 17.90, 3.00,
         "transpose=2,crop=1500:2667:330:550,scale=1080:1920:flags=lanczos,eq=contrast=1.035:saturation=1.04",
         [("WHICH COVER", WHITE, "FITS YOUR LIFE", OLIVE, .18, 2.80)]),
        ("08-cta", protected / "tbs-advisor-cta-original-sound-v1.mp4", 0, 4,
         "scale=1080:1920:flags=lanczos,eq=contrast=1.035:saturation=1.04",
         [("SPEAK TO", WHITE, "TBS BROKERS", OLIVE, 2.0, 3.78)]),
        ("09-logo", outro, 0, 3.20,
         "scale=1080:1920:flags=lanczos",
         []),
    ]
    parts = []
    ledger = []
    cursor = 0.0
    for name, source, start, duration, transform, titles in names:
        assert source.exists(), source
        ovs = []
        for j, (first, fc, second, sc, reveal, end) in enumerate(titles):
            path = work / f"{name}-title-{j}.png"
            lines = [(first, fc)] + ([(second, sc)] if second else [])
            label(path, lines)
            ovs.append((path, reveal, end))
        out = work / f"{name}.mp4"
        shot(out, source, start, duration, transform, ovs)
        parts.append(out)
        ledger.append(dict(scene=name, source=str(source), source_in=start, duration=duration,
                           timeline_in=round(cursor, 3), captions=[t[0:4:2] for t in titles]))
        cursor += duration
    concat = work / "concat.txt"
    concat.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
    picture = work / "picture.mp4"
    ff("-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", picture)
    # Four isolated dialogue performances retain source sync. The cropped VIDEO 2
    # speaker is audio-only because the source chops off his forehead.
    dialogue = work / "dialogue.wav"
    graph = (
        "[0:a]atrim=0:4,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.02,afade=t=out:st=3.86:d=0.12[a0];"
        "[1:a]atrim=0:6.75,asetpts=PTS-STARTPTS,volume=0.78,afade=t=in:st=0:d=0.03,"
        "afade=t=out:st=6.58:d=0.12,adelay=4000|4000[a1];"
        "[2:a]atrim=start=14.15:end=20.90,asetpts=PTS-STARTPTS,volume=0.74,"
        "afade=t=in:st=0:d=0.08,afade=t=out:st=6.60:d=0.12,adelay=11500|11500[a2];"
        "[3:a]atrim=0:4,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.03,"
        "afade=t=out:st=3.86:d=0.12,adelay=18250|18250[a3];"
        "[a0][a1][a2][a3]amix=inputs=4:duration=longest:normalize=0,"
        "aresample=48000,apad=pad_dur=3.2,atrim=0:25.45[a]"
    )
    ff("-i", protected / "tbs-advisor-opening-original-sound-v3-tight.mp4",
       "-i", src / "199A0504.MP4", "-i", src / "199A0474.MP4",
       "-i", protected / "tbs-advisor-cta-original-sound-v1.mp4",
       "-filter_complex", graph, "-map", "[a]", "-c:a", "pcm_s24le", dialogue)
    music = src / "mixkit-curiosity-480.mp3"
    door_key = src / "mixkit-door-key-in-door-lock-2842.wav"
    assert door_key.exists(), door_key
    final = work / "2026_11_TBS_VIDEO_01_WHICH_COVER_FITS_YOUR_LIFE_D1_REVIEW.mp4"
    # Music begins quietly, supports speech, then rises gently beneath the
    # picture-only official logo. A tiny one-shot at the montage entrance is
    # action-tied; no unrelated trailer effects or baked logo sound.
    mix = (
        "[1:a]volume=0.78[voice];"
        "[2:a]atrim=0:25.27,asetpts=PTS-STARTPTS,volume=0.13,"
        "afade=t=in:st=0:d=0.25,afade=t=out:st=23.8:d=1.47,"
        "adelay=180|180[music];"
        "[3:a]atrim=start=3.20:end=6.20,asetpts=PTS-STARTPTS,"
        "highpass=f=120,lowpass=f=6500,volume=0.10,"
        "afade=t=in:st=0:d=0.08,afade=t=out:st=2.72:d=0.25,"
        "adelay=4000|4000[photo];"
        "[4:a]atrim=0:1.12,asetpts=PTS-STARTPTS,volume=0.09,"
        "afade=t=in:st=0:d=0.05,afade=t=out:st=0.87:d=0.23,"
        "adelay=8650|8650[door];"
        "[voice][music][photo][door]amix=inputs=4:duration=longest:normalize=0,"
        "alimiter=limit=0.88,aresample=48000[a]"
    )
    ff("-i", picture, "-i", dialogue, "-i", music,
       "-i", src / "199A0496.MP4", "-i", door_key, "-filter_complex", mix,
       "-map", "0:v:0", "-map", "[a]", "-c:v", "copy", "-c:a", "aac",
       "-b:a", "256k", "-movflags", "+faststart", "-t", "25.45", final)
    (work / "source-ledger.json").write_text(json.dumps(ledger, indent=2), encoding="utf-8")
    print(final)


if __name__ == "__main__":
    main()
