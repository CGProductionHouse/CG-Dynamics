"""Stock action geometry A/B: narrow fill crop versus full-width portrait fit."""

from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "media" / "fight-practice" / "40968.mp4"
LABEL = ROOT / "output" / "fight-practice" / "stock-practice-label.png"
EXPECTED_SHA256 = "1a8186f3b7bb178a7da237bdffd19c8f855275c615688e00476f4395924015e8"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render(fill: bool) -> None:
    vf = "crop=405:720:420:0,scale=1080:1920" if fill else \
         "scale=1080:608,pad=1080:1920:0:656:color=black"
    graph = f"[0:v]{vf},setsar=1[base];[base][1:v]overlay=0:0:shortest=1,format=yuv420p[v]"
    name = "proof-fight-framing-fill.mp4" if fill else "proof-fight-framing-fit.mp4"
    output = ROOT / name
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "5", "-t", "1.5015",
                    "-i", str(SOURCE), "-loop", "1", "-i", str(LABEL),
                    "-filter_complex", graph, "-map", "[v]", "-frames:v", "36",
                    "-r", "24000/1001", "-an", "-c:v", "libx264", "-crf", "19",
                    "-preset", "medium", str(output)], check=True)
    print(name, sha256(output))


if __name__ == "__main__":
    if not SOURCE.is_file() or sha256(SOURCE) != EXPECTED_SHA256:
        raise SystemExit("Missing or changed Mixkit #40968 source")
    if not LABEL.is_file():
        raise SystemExit("Run render_fight_impact_scene.py first for the stock label")
    render(True)
    render(False)
