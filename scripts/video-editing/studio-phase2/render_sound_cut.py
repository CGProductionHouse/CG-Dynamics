"""One protected picture edit, with a music-only and an SFX revision."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output" / "sound-cut"
MANIFEST = ROOT / "sound-cut-study.json"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def checked(item: dict) -> Path:
    path = ROOT / item["path"]
    if not path.is_file() or sha(path).lower() != item["sha256"]:
        raise RuntimeError(f"Missing or changed source: {path}")
    return path


def source_frames(path: Path) -> int:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=nb_frames", "-of", "default=nw=1:nk=1", str(path)],
        check=True, capture_output=True, text=True,
    )
    return int(result.stdout.strip())


def run(*args: str) -> None:
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args], check=True)


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    sources = [checked(item) for item in manifest["sources"]]
    for item, path in zip(manifest["sources"], sources):
        requested_end = item["start_frame"] + item["frame_count"]
        if requested_end > source_frames(path):
            raise RuntimeError(f"Requested source frame {requested_end} past end of {path}")
    music = checked(manifest["music"])
    sip = checked(manifest["sip"])
    OUT.mkdir(parents=True, exist_ok=True)
    picture = OUT / "picture.mp4"
    fps = manifest["format"]["fps"]
    count = sum(item["frame_count"] for item in manifest["sources"])
    duration = count * 1001 / 24000
    picture_filters = []
    for i, item in enumerate(manifest["sources"]):
        start = item["start_frame"]
        end = start + item["frame_count"]
        picture_filters.append(
            f"[{i}:v]trim=start_frame={start}:end_frame={end},"
            f"setpts=N/(({fps})*TB),scale=720:1280:flags=lanczos,setsar=1[v{i}]"
        )
    picture_filters.append("".join(f"[v{i}]" for i in range(len(sources))) +
                           f"concat=n={len(sources)}:v=1:a=0[v]")
    run(*(arg for path in sources for arg in ("-i", str(path))),
        "-filter_complex", ";".join(picture_filters), "-map", "[v]", "-frames:v", str(count),
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        "-r", fps, str(picture))

    outputs = {}
    for variant in ("dry", "sip-revision"):
        target = OUT / f"{variant}.mp4"
        # Both variants re-use the exact encoded picture stream; only audio
        # changes. This protects the visual cut while testing one sound choice.
        music_filter = (
            f"[1:a]atrim=start={manifest['music']['source_in_seconds']}:"
            f"duration={duration:.6f},asetpts=PTS-STARTPTS,aresample=48000,"
            f"volume=0.72,afade=t=in:st=0:d=0.08,"
            f"afade=t=out:st={duration-0.35:.6f}:d=0.35[m]"
        )
        if variant == "dry":
            filters = music_filter
            audio_map = "[m]"
            inputs = ("-i", str(picture), "-i", str(music))
        else:
            onset_ms = round(manifest["sip"]["timeline_onset_seconds"] * 1000)
            filters = music_filter + (
                f";[2:a]atrim=duration=0.85,asetpts=PTS-STARTPTS,aresample=48000,"
                f"volume=0.60,afade=t=out:st=0.65:d=0.2,"
                f"adelay={onset_ms}|{onset_ms}[s];[m][s]amix=inputs=2:duration=first:normalize=0[a]"
            )
            audio_map = "[a]"
            inputs = ("-i", str(picture), "-i", str(music), "-i", str(sip))
        run(*inputs, "-filter_complex", filters, "-map", "0:v:0", "-map", audio_map,
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{duration:.6f}", str(target))
        outputs[variant] = {"path": str(target), "sha256": sha(target), "bytes": target.stat().st_size}
    print(json.dumps({"frames": count, "duration_seconds": duration, "outputs": outputs}, indent=2))


if __name__ == "__main__":
    main()
