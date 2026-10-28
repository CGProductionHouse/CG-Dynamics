"""Silent A/B of restrained cool-shadow, warm-highlight boxing coverage."""

from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "media" / "fight-practice" / "40970.mp4"
LABEL = ROOT / "output" / "fight-practice" / "stock-practice-label.png"
EXPECTED = "1400ba43a7d715c07c704f23d17fadd83cd7caee5c6ce576dea856f1c9063749"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render(name: str, grade: bool) -> None:
    treatment = (
        "eq=contrast=1.08:brightness=-0.01:saturation=0.90,"
        "colorbalance=rs=-0.025:bs=0.055:rh=0.025:bh=-0.02,"
        if grade else ""
    )
    graph = (
        f"[0:v]scale=1080:1920,{treatment}setsar=1[base];"
        "[base][1:v]overlay=0:0:shortest=1,format=yuv420p[v]"
    )
    output = ROOT / f"proof-fight-grade-{name}.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-ss", "0.1", "-i", str(SOURCE),
        "-loop", "1", "-i", str(LABEL), "-filter_complex", graph,
        "-map", "[v]", "-frames:v", "48", "-r", "24000/1001", "-an",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", str(output),
    ], check=True)
    print(output.name, sha256(output))


def main() -> None:
    if not SOURCE.is_file() or sha256(SOURCE) != EXPECTED or not LABEL.is_file():
        raise SystemExit("Practice source or watermark missing/changed")
    render("control", False)
    render("cool-shadow", True)


if __name__ == "__main__":
    main()
