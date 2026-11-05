"""Private Ehrlich November edit recipe. Source paths are local and are never committed."""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\Ehrlich-Nov-2026")
FONT = ROOT / "brand" / "Anton-Regular.ttf"
STOCK = ROOT / "stock"
MAY = ROOT / "source" / "2026_05_MAY"
JULY = ROOT / "source" / "2026_07_JUL"
FEB = ROOT / "source" / "2026_02_FEB"
BRAND = ROOT / "brand"

# R06 protected source-select cut. Stock illustrates cooking; only source/* is Ehrlich.
# The Mixkit #281 music and timing remain PRIVATE placeholders pending qualified listening.
SHOTS = [
    ("fire", STOCK / "mixkit-2780-fire-full-hd.mp4", 1.0, .30, .50, ""),
    ("grill", STOCK / "mixkit-2774-steak-full-hd.mp4", 1.3, .30, .60, ""),
    ("cut", MAY / "199A1367.MP4", 7.45, .35, .50, ""),
    ("pack", JULY / "199A1386.MP4", 5.1, .35, .48, ""),
    ("cut", MAY / "199A1365.MP4", 9.45, .40, .43, ""),
    ("fire", STOCK / "mixkit-2780-fire-full-hd.mp4", 3.7, .30, .50, ""),
    ("cut", MAY / "199A1367.MP4", 7.60, 1.30, .50, "THE BRAAI"),
    ("grill", STOCK / "mixkit-2774-steak-full-hd.mp4", 2.1, 1.20, .60, "STARTS HERE"),
    ("shop", FEB / "0L8A4459.MP4", .25, 1.25, .58, ""),
    ("cut", MAY / "199A1365.MP4", 9.25, 1.40, .43, ""),
    ("pack", JULY / "199A1386.MP4", 5.55, 1.35, .50, "THE HANDS"),
    ("cut", MAY / "199A1367.MP4", 5.9, 1.45, .50, "THE CUT"),
    ("pack", JULY / "199A1387.MP4", 2.3, 1.40, .52, "THE PREP"),
    ("shop", FEB / "0L8A4456.MP4", .20, .75, .55, ""),
    ("grill", STOCK / "adobe-free-385373316.mov", 4.5, 1.65, .50, "THE HEAT"),
    ("fire", STOCK / "mixkit-2780-fire-full-hd.mp4", 8.0, .55, .50, ""),
    ("pack", JULY / "199A1386.MP4", 15.6, 1.65, .53, ""),
    ("cut", MAY / "199A1362.MP4", 3.1, 1.45, .30, ""),
    ("grill", STOCK / "adobe-free-385373316.mov", 7.0, 1.65, .50, ""),
    ("cut", MAY / "199A1367.MP4", 8.55, 1.60, .50, ""),
    ("pack", JULY / "199A1387.MP4", 4.0, 1.50, .52, ""),
    ("fire", STOCK / "mixkit-2780-fire-full-hd.mp4", 9.0, .85, .50, ""),
    ("cut", MAY / "199A1365.MP4", 9.7, 1.50, .43, "YOUR NEXT BRAAI\\nSTARTS AT EHRLICH"),
    ("grill", STOCK / "adobe-free-385373316.mov", 11.0, 1.35, .50, ""),
]


def run(args: list[str]) -> None:
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()
    width, height = (540, 960) if args.preview else (1080, 1920)
    out = ROOT / ("EHRLICH-NOVEMBER-private-preview-r06.mp4" if args.preview else "EHRLICH-NOVEMBER-private-r06.mp4")
    work = ROOT / ("segments-preview-r06" if args.preview else "segments-final-r06")
    work.mkdir(exist_ok=True)
    segments: list[Path] = []
    for n, (kind, src, start, dur, xpos, title) in enumerate(SHOTS):
        if not src.exists():
            raise FileNotFoundError(src)
        segment = work / f"{n:02d}.mp4"
        rotate = "transpose=2," if kind == "shop" else ""
        vf = (f"{rotate}scale={width}:{height}:force_original_aspect_ratio=increase,"
              f"crop={width}:{height}:(in_w-out_w)*{xpos}:0,setsar=1,"
              f"fps=30,eq=contrast=1.075:saturation=.90,format=yuv420p")
        if title:
            vf += (f",drawbox=x={int(width*.08)}:y={int(height*.71)}:"
                   f"w={int(width*.84)}:h={max(4,int(height*.004))}:color=0xC62B2D@.96:t=fill")
            lines = title.split("\\n")
            for j, line in enumerate(lines):
                color = "0xF5F3F0" if j == 0 else "0xB52B2B"
                y = int(height * (.53 + .085 * j))
                font_path = FONT.as_posix().replace(":", r"\:")
                vf += (f",drawtext=fontfile='{font_path}':text='{line}':"
                       f"fontsize={int(width * (.168 if len(line) < 13 else .098))}:"
                       f"fontcolor={color}:x=(w-text_w)/2:y='{y}+{int(height*.04)}*exp(-t*9)':"
                       f"alpha='min(1,t*7)':"
                       f"shadowcolor=black@.65:shadowx=2:shadowy=3")
        run(["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-t", str(dur),
             "-i", str(src), "-an", "-vf", vf, "-c:v", "libx264", "-preset", "veryfast" if args.preview else "medium", "-crf", "24" if args.preview else "18", "-r", "30", str(segment)])
        segments.append(segment)
    # Only the official resolved-logo tail; original logo audio is discarded.
    logo = work / "logo.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-ss", "4.8", "-t", "2.50", "-i", str(BRAND / "Forged Titanium Intro_1080p.mp4"),
         "-an", "-vf", f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},fps=30,format=yuv420p",
         "-c:v", "libx264", "-preset", "veryfast" if args.preview else "medium", "-crf", "24" if args.preview else "18", "-r", "30", str(logo)])
    segments.append(logo)
    concat = work / "concat.txt"
    concat.write_text("\n".join(f"file '{p.as_posix()}'" for p in segments), encoding="utf-8")
    silent = work / "picture.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", str(silent)])
    duration = sum(s[3] for s in SHOTS) + 2.5
    music = ROOT / "music" / "mixkit-281-complicated.mp3"
    fire = ROOT / "music" / "mixkit-1330-campfire-crackles.wav"
    whoosh = ROOT / "music" / "mixkit-1492-cinematic-whoosh.wav"
    sizzle = ROOT / "music" / "mixkit-frying-fish-on-a-hot-pan-123.wav"
    run(["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(music), "-stream_loop", "1", "-i", str(fire), "-i", str(whoosh), "-i", str(sizzle),
         "-filter_complex", (f"[1:a]atrim=0:{duration:.3f},asetpts=N/SR/TB,"
                             f"volume='if(between(t,15,17),0.30,0.55)':eval=frame,afade=t=in:st=0:d=0.25,"
                             f"afade=t=out:st={duration-1.2:.3f}:d=1.2[m];"
                             f"[2:a]atrim=0:{duration:.3f},asetpts=N/SR/TB,"
                             f"volume='if(lt(t,3),0.18,if(between(t,15,21),0.11,if(gt(t,27),0.07,0.015)))':eval=frame,"
                             f"afade=t=out:st={duration-1.2:.3f}:d=1.2[s];"
                             f"[3:a]volume=0.18,adelay=2700|2700[w];"
                             f"[4:a]atrim=0:4,asetpts=N/SR/TB,volume=0.14,asplit=2[si1][si2];"
                             f"[si1]adelay=10800|10800[sl1];[si2]adelay=15400|15400[sl2];"
                             f"[m][s][w][sl1][sl2]amix=inputs=5:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=8,alimiter=limit=0.89,volume=0.80[a]"),
         "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", str(out)])
    print(f"{out}\n{duration:.3f} seconds")


if __name__ == "__main__":
    main()
