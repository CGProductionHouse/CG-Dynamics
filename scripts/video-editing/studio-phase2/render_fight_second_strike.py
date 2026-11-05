"""Compare a hard cut with a four-frame blurred entry on stock boxing shots."""

from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MEDIA = ROOT / "media" / "fight-practice"
FIRST = ROOT / "output" / "fight-practice" / "scene1-picture.mp4"
SECOND = MEDIA / "40969.mp4"
LABEL = ROOT / "output" / "fight-practice" / "stock-practice-label.png"
SECOND_SHA256 = "5d417cfd997899890a199c7f5ed3ab5fa7d7592e96a5bfeb511eb24349667298"


def digest(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            sha.update(chunk)
    return sha.hexdigest()


def render(blur: bool) -> Path:
    # The second stock shot is 16:9. x=300 preserves both the face and incoming glove.
    incoming = "[1:v]trim=start_frame=0:end_frame=24,setpts=PTS-STARTPTS,"
    incoming += "crop=405:720:300:0,scale=1080:1920,setsar=1"
    if blur:
        incoming += ",boxblur=luma_radius=8:luma_power=1:chroma_radius=8:chroma_power=1:enable='lt(t,0.167)'"
    incoming += "[b];[b][2:v]overlay=0:0:shortest=1,format=yuv420p[c];"
    graph = "[0:v]setpts=PTS-STARTPTS[a];" + incoming + "[a][c]concat=n=2:v=1:a=0[v]"
    name = "proof-fight-scene2-blurred-entry.mp4" if blur else "proof-fight-scene2-hard-cut.mp4"
    out = ROOT / name
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(FIRST), "-i", str(SECOND),
         "-loop", "1", "-i", str(LABEL), "-filter_complex", graph,
         "-map", "[v]", "-frames:v", "48", "-r", "24000/1001", "-an",
         "-c:v", "libx264", "-preset", "medium", "-crf", "19", str(out)],
        cwd=ROOT, check=True,
    )
    print(name, out.stat().st_size, digest(out))
    return out


def main() -> None:
    if not FIRST.is_file() or not LABEL.is_file():
        raise SystemExit("Run render_fight_impact_scene.py first to prepare scene 1 and its label")
    if not SECOND.is_file() or digest(SECOND).lower() != SECOND_SHA256:
        raise SystemExit("Missing or changed licensed Mixkit #40969 practice shot")
    render(False)
    render(True)


if __name__ == "__main__":
    main()
