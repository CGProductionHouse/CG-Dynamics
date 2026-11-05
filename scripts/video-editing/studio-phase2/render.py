"""Render one isolated real-footage typography proof and its precise text revision."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output"


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def run(args: list[str], *, cwd: Path | None = None, env: dict | None = None) -> None:
    subprocess.run(args, cwd=cwd, env=env, check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("variant", choices=["baseline", "revision"])
    args = parser.parse_args()
    started = time.monotonic()
    project = json.loads((ROOT / "project.json").read_text(encoding="utf-8"))
    revision = json.loads((ROOT / "revision.json").read_text(encoding="utf-8"))
    for item in ("picture", "music", "effect"):
        source = project[item]
        actual = ROOT / source["path"]
        if not actual.is_file() or sha(actual).lower() != source["sha256"].lower():
            raise RuntimeError(f"Missing or changed {item} asset: {actual}")
    reference = ROOT / project["reference"]["local_path"]
    if reference.is_file() and sha(reference).lower() != project["reference"]["sha256"].lower():
        raise RuntimeError(f"Changed optional reference asset: {reference}")

    base_html = (ROOT / "scene" / "index.html").read_text(encoding="utf-8")
    token = f'id="{revision["target"]}">{revision["from"]}</div>'
    assert base_html.count(token) == 1, "Revision base text mismatch"
    if args.variant == "revision":
        html = base_html.replace(token, f'id="{revision["target"]}">{revision["to"]}</div>')
    else:
        html = base_html

    result = OUT / args.variant
    built = result / "scene"
    assets = built / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    (built / "index.html").write_text(html, encoding="utf-8")
    shutil.copy2(ROOT / "scene" / "assets" / "SpaceGrotesk.ttf", assets / "SpaceGrotesk.ttf")
    gsap = ROOT / "node_modules" / "gsap" / "dist" / "gsap.min.js"
    if not gsap.is_file():
        raise FileNotFoundError("Run npm ci --ignore-scripts locally first")
    shutil.copy2(gsap, assets / "gsap.min.js")
    hyperframes = ROOT / "node_modules" / ".bin" / ("hyperframes.cmd" if os.name == "nt" else "hyperframes")
    environment = dict(os.environ, HYPERFRAMES_NO_TELEMETRY="1", DO_NOT_TRACK="1")
    type_movie = result / "type.mp4"
    run([str(hyperframes), "render", "--fps", "24", "--quality", "looks", "--workers", "1", "--no-browser-gpu",
         "--output", str(type_movie)], cwd=built, env=environment)

    fg = ("[1:v]trim=start=3:duration=4.5,setpts=PTS-STARTPTS,"
          "crop=1215:2160:1312:0,scale=900:1600,"
          "chromakey=0x56ee00:0.13:0.09,despill=type=green:mix=0.7:expand=0.05,"
          "format=yuva420p[person];"
          "[0:v][person]overlay=360:320:format=auto,format=yuv420p[v];")
    sound = ("[2:a]atrim=start=10.425:duration=4.5,asetpts=PTS-STARTPTS,volume=0.72,"
             "afade=t=in:st=0:d=0.08,afade=t=out:st=4.1:d=0.4[m];"
             "[3:a]atrim=duration=1.2,asetpts=PTS-STARTPTS,volume=0.12,"
             "adelay=1380|1380[s];"
             "[m][s]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.92[a]")
    movie = result / "echoform.mp4"
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(type_movie),
         "-i", str(ROOT / project["picture"]["path"]),
         "-i", str(ROOT / project["music"]["path"]),
         "-i", str(ROOT / project["effect"]["path"]),
         "-filter_complex", fg + sound, "-map", "[v]", "-map", "[a]", "-t", "4.5", "-r", "24",
         "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", str(movie)], env=environment)
    receipt = {
        "variant": args.variant,
        "source_html_sha256": sha(built / "index.html"),
        "project_sha256": sha(ROOT / "project.json"),
        "revision_sha256": sha(ROOT / "revision.json") if args.variant == "revision" else None,
        "type_movie_sha256": sha(type_movie),
        "movie_sha256": sha(movie),
        "movie_bytes": movie.stat().st_size,
        "elapsed_seconds": round(time.monotonic() - started, 2),
    }
    (result / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt))


if __name__ == "__main__":
    main()
