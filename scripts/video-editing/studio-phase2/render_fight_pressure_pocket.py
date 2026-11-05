"""Technical audio A/B: continuous licensed drums versus a brief pre-contact duck."""

from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VIDEO = ROOT / "media" / "fight-practice" / "40974.mp4"
MUSIC = ROOT / "media" / "fight-practice" / "mixkit-676-epical-drums-01.mp3"
LABEL = ROOT / "output" / "fight-practice" / "stock-practice-label.png"
VIDEO_SHA = "938bba8c5c586d700be40e2cabf628713dcc440caefb931d8229d1e99f1ce634"
MUSIC_SHA = "47182a9547cbbbbf7d833e60c06fcdc08c7b064d084f4802b1b68557cba5780b"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render(duck: bool) -> None:
    # Local picture contact is about 1.175 s. A 0.55–1.15 s music descent/low
    # pocket precedes it; the 1.15–1.35 s return follows it. No fake punch cue.
    audio = "[1:a]atrim=0:3,asetpts=PTS-STARTPTS,volume=0.4"
    if duck:
        envelope = (
            "if(lt(t\\,0.55)\\,1\\,"
            "if(lt(t\\,0.80)\\,1-0.82*(t-0.55)/0.25\\,"
            "if(lt(t\\,1.15)\\,0.18\\,"
            "if(lt(t\\,1.35)\\,0.18+0.82*(t-1.15)/0.20\\,1))))"
        )
        audio += f",volume='{envelope}':eval=frame"
    audio += "[a]"
    graph = (
        "[0:v]crop=720:1280:0:0,scale=1080:1920,setsar=1[base];"
        "[base][2:v]overlay=0:0:shortest=1,format=yuv420p[v];" + audio
    )
    name = "proof-fight-pocket-duck.mp4" if duck else "proof-fight-pocket-control.mp4"
    output = ROOT / name
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "4.2", "-t", "3.003",
                    "-i", str(VIDEO), "-ss", "20", "-t", "3.003", "-i", str(MUSIC),
                    "-loop", "1", "-i", str(LABEL), "-filter_complex", graph,
                    "-map", "[v]", "-map", "[a]", "-frames:v", "72", "-r", "24000/1001",
                    "-c:v", "libx264", "-crf", "19", "-preset", "medium",
                    "-c:a", "aac", "-b:a", "192k", str(output)], check=True)
    print(name, sha256(output))


if __name__ == "__main__":
    if not VIDEO.is_file() or sha256(VIDEO) != VIDEO_SHA:
        raise SystemExit("Missing or changed Mixkit #40974 video")
    if not MUSIC.is_file() or sha256(MUSIC) != MUSIC_SHA:
        raise SystemExit("Missing or changed Mixkit #676 music")
    if not LABEL.is_file():
        raise SystemExit("Run render_fight_impact_scene.py first for the stock label")
    render(False)
    render(True)
