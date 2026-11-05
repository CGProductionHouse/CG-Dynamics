"""Make landscape and centred 9:16 contact frames plus a source review ledger.

Usage: python screen_sources.py <input-folder> <output-folder> [--limit N]
Requires ffmpeg and ffprobe on PATH. Contact frames are triage aids; watch clips.
"""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
from pathlib import Path

FIELDS = [
    "source", "duration_s", "width", "height", "landscape_frames", "portrait_frames",
    "observed_content", "project_identity", "rights", "prior_use", "story_role",
    "usable_in_s", "usable_out_s", "review_notes",
]


def probe(path: Path) -> tuple[float, int, int]:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height",
         "-select_streams", "v:0", "-of", "json", str(path)],
        check=True, capture_output=True, text=True,
    )
    data = json.loads(result.stdout)
    stream = data["streams"][0]
    return float(data["format"]["duration"]), int(stream["width"]), int(stream["height"])


def frame(path: Path, moment: float, output: Path, *, portrait: bool) -> None:
    filt = (r"crop=trunc(min(iw\,ih*9/16)/2)*2:trunc(min(ih\,iw*16/9)/2)*2:"
            r"(iw-out_w)/2:(ih-out_h)/2,scale=360:640"
            if portrait else "scale=640:-2")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{moment:.3f}", "-i", str(path),
         "-frames:v", "1", "-vf", filt, str(output)], check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_folder", type=Path)
    parser.add_argument("output_folder", type=Path)
    parser.add_argument("--limit", type=int, default=0, help="Maximum clips to screen; 0 is all")
    args = parser.parse_args()
    sources = sorted(p for p in args.input_folder.iterdir()
                     if p.is_file() and p.suffix.lower() in {".mp4", ".mov", ".m4v"})
    if args.limit:
        sources = sources[:args.limit]
    args.output_folder.mkdir(parents=True, exist_ok=True)
    rows = []
    for source in sources:
        try:
            duration, width, height = probe(source)
            folder = args.output_folder / source.stem
            folder.mkdir(exist_ok=True)
            landscape, portrait = [], []
            for label, fraction in (("early", .15), ("middle", .50), ("late", .85)):
                moment = max(0.0, min(duration - .04, duration * fraction))
                wide = folder / f"{label}_wide.jpg"
                tall = folder / f"{label}_9x16.jpg"
                frame(source, moment, wide, portrait=False)
                frame(source, moment, tall, portrait=True)
                landscape.append(str(wide))
                portrait.append(str(tall))
            rows.append(dict(source=str(source), duration_s=round(duration, 3), width=width,
                             height=height, landscape_frames=" | ".join(landscape),
                             portrait_frames=" | ".join(portrait)))
            print(f"screened {source.name}")
        except (subprocess.CalledProcessError, KeyError, ValueError) as error:
            print(f"skipped {source.name}: {error}")
    with (args.output_folder / "source_screening.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    main()
