"""Protected R05: replace only the owner-rejected upside-down second shot.

Reuses R04's other picture segments and exact compressed audio stream. Originals,
client media and review exports remain in the private Daisy workspace.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

import render as base
import render_r04 as r04

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Daisy-Nov-2026")
R04 = ROOT / "private-repurpose-v4" / "r04-cut"
OUT = ROOT / "private-repurpose-v5" / "r05-cut"
OUT.mkdir(parents=True, exist_ok=True)
r04.OUT = OUT
base.OUT = OUT


def ff(*args: object) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def main() -> None:
    # The shot's shelf and cups are unambiguously upright at source 0.10-1.63 s.
    # The original is preserved; the stabilised select stays linked in OUT.
    replacement = r04.prep("199A5251", 2, 46, .10, 1)
    new_second = base.shot("02a", replacement, 0, 46,
                           "DANKIE", "KAN", y=1190, treatment="slide")
    names = ["01-sign-panel-intro", "02a", "02b", "03", "04", "05", "06", "07", "08", "09", "10", "11-official-logo"]
    segments = [new_second if name == "02a" else R04 / f"{name}.mp4" for name in names]
    for p in segments:
        if not p.is_file():
            raise FileNotFoundError(p)
    playlist = OUT / "shots.txt"
    playlist.write_text("".join(f"file '{p.as_posix()}'\n" for p in segments), encoding="utf-8")
    picture = OUT / "r05-picture.mp4"
    ff("-f", "concat", "-safe", "0", "-i", playlist, "-c", "copy", picture)
    prior = R04 / "2026_11_DAISY_VIDEO_01_SE_DANKIE_R04_PRIVATE.mp4"
    film = OUT / "2026_11_DAISY_VIDEO_01_SE_DANKIE_R05_PRIVATE.mp4"
    ff("-i", picture, "-i", prior, "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", film)
    print(film)


if __name__ == "__main__":
    main()
