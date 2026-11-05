"""Ehrlich R16: protected one-shot replacement on the owner-approved R14 film.

R14's static, shaky fridge staff select is replaced by a deliberately framed
butcher-at-work moment. All other picture segments and the approved R14 mix
are reused byte-for-byte at stream level. The replacement receives a
two-pass translation stabilization after a face-free, portrait knife-action crop.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\Ehrlich-Nov-2026")
R14 = ROOT / "segments-final-r14"
WORK = ROOT / "segments-final-r16"
SOURCE = ROOT / "source" / "2026_05_MAY" / "199A1356.MP4"
BASE_FILM = ROOT / "EHRLICH-NOVEMBER-private-r14.mp4"
OUT = ROOT / "EHRLICH-NOVEMBER-private-r16.mp4"
START, DURATION = 1.50, 1.14


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, cwd=WORK)


def main() -> None:
    WORK.mkdir(exist_ok=True)
    if not SOURCE.exists() or not BASE_FILM.exists():
        raise FileNotFoundError("Expected verified local R14 film and source")
    raw = WORK / "source-select.mp4"
    transforms = WORK / "stabilize.trf"
    replacement = WORK / "08.mp4"
    # The source camera was physically portrait but recorded landscape without
    # orientation metadata. Rotate first; motion estimation uses the upright
    # 1.14-second select, never unrelated frames outside it.
    run(["ffmpeg", "-v", "error", "-y", "-ss", str(START), "-t", str(DURATION),
         "-i", str(SOURCE), "-an", "-vf", "transpose=2,crop=1316:2340:422:1500,fps=30",
         "-c:v", "libx264", "-preset", "fast", "-crf", "16", str(raw)])
    run(["ffmpeg", "-v", "error", "-y", "-i", str(raw),
         "-vf", "vidstabdetect=shakiness=5:accuracy=15:result=stabilize.trf",
         "-f", "null", "NUL"])
    vf = ("vidstabtransform=input=stabilize.trf:smoothing=10:"
          "optzoom=1:interpol=bicubic,"
          "scale=1080:1920:force_original_aspect_ratio=increase,"
          "crop=1080:1920:(in_w-out_w)*0.5:0,setsar=1,"
          "fps=30,eq=contrast=1.075:saturation=.90,format=yuv420p")
    run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-an", "-vf", vf,
         "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", "30",
         str(replacement)])
    # Keep the precise R14 cut order, including the two bounded effects.
    parts = [R14 / "opening.mp4"]
    for n in range(12):
        parts.append(replacement if n == 8 else R14 / f"{n:02d}.mp4")
        if n == 2:
            parts.append(R14 / "blade-flicker.mp4")
        if n == 5:
            parts.append(R14 / "heat-transition.mp4")
    parts.append(R14 / "logo.mp4")
    for part in parts:
        if not part.exists():
            raise FileNotFoundError(part)
    concat = WORK / "concat.txt"
    concat.write_text("\n".join(f"file '{p.as_posix()}'" for p in parts), encoding="utf-8")
    picture = WORK / "picture.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
         "-i", str(concat), "-c", "copy", str(picture)])
    run(["ffmpeg", "-v", "error", "-y", "-i", str(picture), "-i", str(BASE_FILM),
         "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-movflags", "+faststart",
         str(OUT)])
    print(OUT)


if __name__ == "__main__":
    main()

