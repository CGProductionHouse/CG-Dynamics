"""Short silent A/B: ordinary versus foreground-glove-motivated cut timing."""

from __future__ import annotations

import hashlib
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MEDIA = ROOT / "media" / "fight-practice"
LABEL = ROOT / "output" / "fight-practice" / "stock-practice-label.png"
SOURCES = {
    "40970": "1400ba43a7d715c07c704f23d17fadd83cd7caee5c6ce576dea856f1c9063749",
    "40973": "660fb67d131e9cfa110ab17c955cf870f11371ac5c22b570d0b08aa97039830d",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def segment(folder: Path, index: int, number: str, start: float, frames: int) -> Path:
    output = folder / f"shot-{index}.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-ss", str(start),
        "-i", str(MEDIA / f"{number}.mp4"), "-loop", "1", "-i", str(LABEL),
        "-filter_complex", "[0:v]scale=1080:1920,setsar=1[base];"
        "[base][1:v]overlay=0:0:shortest=1,format=yuv420p[v]",
        "-map", "[v]", "-frames:v", str(frames), "-r", "24000/1001", "-an",
        "-c:v", "libx264", "-preset", "medium", "-crf", "19", str(output),
    ], check=True)
    return output


def render(name: str, first_frames: int) -> None:
    with tempfile.TemporaryDirectory(prefix="fight-glove-handoff-") as temp:
        folder = Path(temp)
        shots = [segment(folder, 0, "40970", 0.65, first_frames),
                 segment(folder, 1, "40973", 0.0, 36 - first_frames)]
        concat = folder / "list.txt"
        concat.write_text("".join(f"file '{p.as_posix()}'\n" for p in shots), encoding="utf-8")
        output = ROOT / f"proof-fight-glove-handoff-{name}.mp4"
        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
            "-i", str(concat), "-c", "copy", str(output),
        ], check=True)
        print(output.name, sha256(output))


def main() -> None:
    for number, expected in SOURCES.items():
        path = MEDIA / f"{number}.mp4"
        if not path.is_file() or sha256(path) != expected:
            raise SystemExit(f"Missing or changed Mixkit #{number}")
    if not LABEL.is_file():
        raise SystemExit("Stock practice watermark missing")
    render("early", 10)
    render("glove", 15)


if __name__ == "__main__":
    main()
