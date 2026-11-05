"""One-off private TBS goods-in-transit opening study.

This is a source-specific editorial recipe, not a general rendering engine.
No client footage or rendered output is written into Git. Run with --source-dir
pointing at privately downloaded, licensed stock and --tbs-sign at the protected
TBS camera original. The result is a study, never an approval export.
"""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
TAUPE, OLIVE, WHITE = (120, 102, 80), (158, 175, 31), (255, 255, 255)
FONT = Path(r"C:\Windows\Fonts\bahnschrift.ttf")


def ff(*args: object) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def type_art(path: Path, word: str, *, y: int, colour: tuple[int, int, int], size: int,
             panel: bool = False, hook_panel: bool = False) -> None:
    im = Image.new("RGBA", (W, H))
    draw = ImageDraw.Draw(im)
    if panel:
        draw.rounded_rectangle((50, 1280, 1030, 1690), radius=28, fill=(*TAUPE, 205))
    if hook_panel:
        draw.rounded_rectangle((48, 1210, 1032, 1750), radius=26, fill=(*TAUPE, 205))
    font = ImageFont.truetype(str(FONT), size)
    while draw.textbbox((0, 0), word, font=font)[2] > 910:
        size -= 3
        font = ImageFont.truetype(str(FONT), size)
    draw.text((85, y), word, font=font, fill=(*colour, 255))
    im.save(path)


def route_art(path: Path, stage: int) -> None:
    """A graphic question map, never a claim that insurance is active."""
    im = Image.new("RGBA", (W, H))
    dr = ImageDraw.Draw(im)
    dr.rounded_rectangle((65, 112, 1015, 372), radius=27, fill=(*WHITE, 240))
    small = ImageFont.truetype(str(FONT), 45)
    dr.text((115, 142), "WHERE DOES YOUR STOCK GO?", font=small, fill=(*TAUPE, 255))
    xs = [180, 540, 900]
    labels = ["PACK", "MOVE", "DELIVER"]
    for i in range(2):
        dr.line((xs[i]+28, 272, xs[i+1]-28, 272), fill=(*OLIVE, 230) if i < stage else (*TAUPE, 80), width=10)
    for i, x in enumerate(xs):
        colour = OLIVE if i <= stage else TAUPE
        dr.ellipse((x-28, 244, x+28, 300), fill=(*colour, 255))
        width = dr.textbbox((0, 0), labels[i], font=small)[2]
        dr.text((x-width/2, 315), labels[i], font=small, fill=(*TAUPE, 255))
    im.save(path)


def scene(out: Path, source: Path, start: float, duration: float, transform: str,
          overlays: list[tuple[Path, float]]) -> None:
    args: list[object] = ["-ss", f"{start:.3f}", "-i", source]
    for path, _ in overlays:
        args += ["-loop", "1", "-framerate", FPS, "-i", path]
    if transform.startswith("inset:"):
        y = int(transform.removeprefix("inset:"))
        graph = [
            f"[0:v]fps={FPS},split=2[bg0][fg0]",
            "[bg0]scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,"
            "crop=1080:1920,boxblur=25:1,eq=brightness=-0.22:saturation=0.55[bg]",
            "[fg0]scale=1080:608:flags=lanczos,setsar=1[fg]",
            f"[bg][fg]overlay=0:{y}:shortest=1,format=yuv420p[v0]",
        ]
    else:
        graph = [f"[0:v]fps={FPS},{transform},setsar=1,format=yuv420p[v0]"]
    previous = "v0"
    for idx, (_, reveal) in enumerate(overlays, 1):
        nxt = f"v{idx}"
        graph.append(f"[{idx}:v]format=rgba,fade=t=in:st={reveal:.3f}:d=0.10:alpha=1[a{idx}]")
        graph.append(f"[{previous}][a{idx}]overlay=x='if(lt(t,{reveal+.20:.3f}),"
                     f"52*pow(1-max(0,t-{reveal:.3f})/.20,2),0)':y=0:"
                     f"eval=frame:shortest=1[{nxt}]")
        previous = nxt
    ff(*args, "-filter_complex", ";".join(graph), "-map", f"[{previous}]", "-an",
       "-frames:v", round(duration * FPS), "-r", FPS, "-c:v", "libx264",
       "-preset", "fast", "-crf", 18, "-pix_fmt", "yuv420p", out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-dir", required=True, type=Path)
    ap.add_argument("--tbs-sign", required=True, type=Path)
    ap.add_argument("--click", required=True, type=Path)
    ap.add_argument("--music", required=True, type=Path)
    ap.add_argument("--output-dir", required=True, type=Path)
    a = ap.parse_args()
    out = a.output_dir
    out.mkdir(parents=True, exist_ok=True)
    art = out / "art"
    art.mkdir(exist_ok=True)

    # Full landscape action stays in a deliberate inset. A 720p landscape crop
    # stretched to 1080x1920 would fail the owner's quality/orientation gate.
    titles = [
        ("PACKED", 1255, WHITE, 136, 0.116),
        ("SENT", 1405, OLIVE, 136, 0.697),
        ("COVERED?", 1555, WHITE, 124, 1.834),
    ]
    hook_arts = []
    for idx, (word, y, colour, size, reveal) in enumerate(titles):
        path = art / f"hook-{idx}.png"
        type_art(path, word, y=y, colour=colour, size=size, hook_panel=(idx == 0))
        hook_arts.append((path, reveal))
    scene(out / "01-hook.mp4", a.source_dir / "mixkit-42131-box-tape.mp4", 4.7, 2.40,
          "inset:440", hook_arts)

    p = art / "inventory.png"
    type_art(p, "WHAT MOVES", y=1350, colour=WHITE, size=111, panel=True)
    q = art / "inventory-sub.png"
    type_art(q, "WITH YOUR BUSINESS?", y=1495, colour=OLIVE, size=80)
    scene(out / "02-inventory.mp4", a.source_dir / "mixkit-4705-inventory-1080.mp4", 1.2, 2.30,
          "crop=608:1080:770:0,scale=1080:1920:flags=lanczos,"
          "eq=contrast=1.07:saturation=0.84", [(p, .57), (q, 1.15)])

    p = art / "service.png"
    type_art(p, "GOODS IN TRANSIT", y=1320, colour=WHITE, size=96, panel=True)
    q = art / "identity.png"
    type_art(q, "ASK TBS BROKERS", y=1470, colour=OLIVE, size=86)
    route = []
    for stage, reveal in enumerate((.02, .58, 1.16)):
        r = art / f"route-{stage}.png"
        route_art(r, stage)
        route.append((r, reveal))
    scene(out / "03-tbs.mp4", a.tbs_sign, .2, 2.30,
          "inset:415", route + [(p, .57), (q, 1.70)])

    parts = [out / f"0{i}-{name}.mp4" for i, name in [(1, "hook"), (2, "inventory"), (3, "tbs")]]
    concat = out / "concat.txt"
    concat.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
    ff("-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", out / "picture.mp4")
    # Two restrained UI clicks follow graphic word reveals. Their own tails are
    # retained; this is not a fabricated location sound or a final creative mix.
    graph = ("[0:a]atrim=0:7.00,asetpts=PTS-STARTPTS,volume=0.92,"
             "afade=t=in:st=0:d=0.12,afade=t=out:st=6.76:d=0.24[m];"
             "[1:a]atrim=0:0.32,asetpts=PTS-STARTPTS,volume=0.33,"
             "adelay=697|697[c1];"
             "[1:a]atrim=0:0.32,asetpts=PTS-STARTPTS,volume=0.27,"
             "adelay=1834|1834[c2];"
             "[m][c1][c2]amix=inputs=3:duration=longest:normalize=0,"
             "alimiter=limit=0.88:level=disabled[a]")
    ff("-i", a.music, "-i", a.click, "-filter_complex", graph, "-map", "[a]",
       "-ar", 48000, "-c:a", "pcm_s24le", out / "mix.wav")
    ff("-i", out / "picture.mp4", "-i", out / "mix.wav", "-map", "0:v", "-map", "1:a",
       "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", out / "TBS_GOODS_TRANSIT_PRIVATE_OPENING_STUDY.mp4")
    (out / "manifest.json").write_text(json.dumps({
        "status": "private_study_not_approval_export",
        "story_question": "Packed. Sent. Covered?",
        "stock": ["Mixkit 42131, Free License, 4.7–6.9 s", "Mixkit 4705, Free License, 1.2–3.55 s"],
        "client": "199A0531.MP4, 0.2–2.75 s, office sign identity beat only",
        "music": "Mixkit Close Up 1167, Free Music License, candidate only",
        "sfx": "Mixkit interface click 2577, licensed source in protected TBS kit",
        "creative_audio_review": "pending",
        "public_picture_review": "pending",
    }, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
