"""Bounded visual A/B: natural stock punch versus a two-frame contact hold."""

from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "media" / "fight-practice" / "40969.mp4"
LABEL = ROOT / "output" / "fight-practice" / "stock-practice-label.png"
EXPECTED_SHA256 = "5d417cfd997899890a199c7f5ed3ab5fa7d7592e96a5bfeb511eb24349667298"


def sha256(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            sha.update(block)
    return sha.hexdigest()


def render(hold: bool) -> None:
    first = "[0:v]trim=start_frame=0:end_frame=26,setpts=PTS-STARTPTS,"
    first += "crop=405:720:300:0,scale=1080:1920,setsar=1"
    if hold:
        # Repeat source frame 12 twice, then trim back to 24 output frames.
        first += ",loop=loop=2:size=1:start=12"
    first += ",trim=start_frame=0:end_frame=24,setpts=PTS-STARTPTS[base];"
    graph = first + "[base][1:v]overlay=0:0:shortest=1,format=yuv420p[v]"
    name = "proof-fight-scene3-contact-hold.mp4" if hold else "proof-fight-scene3-natural.mp4"
    path = ROOT / name
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(SOURCE), "-loop", "1", "-i", str(LABEL),
         "-filter_complex", graph, "-map", "[v]", "-frames:v", "24", "-r", "24000/1001",
         "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "19", str(path)],
        cwd=ROOT, check=True,
    )
    print(name, path.stat().st_size, sha256(path))


def main() -> None:
    if not SOURCE.is_file() or sha256(SOURCE).lower() != EXPECTED_SHA256:
        raise SystemExit("Missing or changed licensed Mixkit #40969 stock source")
    if not LABEL.is_file():
        raise SystemExit("Run render_fight_impact_scene.py first for the practice label")
    render(False)
    render(True)


if __name__ == "__main__":
    main()
