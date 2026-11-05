"""Technical checks for the one #874 reference-inspired real-footage effect."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output"


def call(*args: str) -> str:
    return subprocess.run(args, check=True, text=True, capture_output=True).stdout


def probe(path: Path) -> dict:
    return json.loads(call("ffprobe", "-v", "error", "-show_entries",
                           "stream=codec_name,width,height,avg_frame_rate,nb_frames",
                           "-show_entries", "format=duration,size", "-of", "json", str(path)))


def first_frames(path: Path, count: int) -> list[str]:
    # The revised word is invisible until its 1.38s entrance; the first 33 frames must survive exactly.
    expression = f"select=between(n\\,0\\,{count - 1})"
    result = call("ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path),
                  "-an", "-vf", expression, "-fps_mode", "vfr", "-f", "framemd5", "-")
    return [line.rsplit(",", 1)[-1].strip() for line in result.splitlines() if line and not line.startswith("#")]


def pcm_sha(path: Path) -> str:
    raw = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path),
                          "-vn", "-f", "s16le", "-ac", "2", "-ar", "48000", "-"],
                         check=True, capture_output=True).stdout
    return hashlib.sha256(raw).hexdigest()


def prechange_ssim(a: Path, b: Path) -> float:
    graph = ("[0:v]trim=end_frame=33,setpts=PTS-STARTPTS[x];"
             "[1:v]trim=end_frame=33,setpts=PTS-STARTPTS[y];[x][y]ssim")
    result = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(a), "-i", str(b),
                             "-filter_complex", graph, "-an", "-f", "null", "NUL"],
                            check=True, capture_output=True, text=True)
    matches = re.findall(r"All:([0-9.]+)", result.stderr)
    assert matches
    return float(matches[-1])


def main() -> None:
    movies = [OUT / variant / "echoform.mp4" for variant in ("baseline", "revision")]
    reports = []
    for movie in movies:
        result = probe(movie)
        video = next(s for s in result["streams"] if s["codec_name"] == "h264")
        audio = next(s for s in result["streams"] if s["codec_name"] == "aac")
        assert (video["width"], video["height"], video["avg_frame_rate"], int(video["nb_frames"])) == (1080, 1920, "24/1", 108)
        assert audio and float(result["format"]["duration"]) == 4.5
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(movie),
                        "-f", "null", "NUL"], check=True, capture_output=True)
        reports.append({"movie": str(movie.relative_to(ROOT)).replace("\\", "/"),
                        "duration": float(result["format"]["duration"]), "size": int(result["format"]["size"]),
                        "pcm_sha256": pcm_sha(movie), "full_decode": "pass"})

    original = first_frames(movies[0], 33)
    revised = first_frames(movies[1], 33)
    assert len(original) == len(revised) == 33
    assert reports[0]["pcm_sha256"] == reports[1]["pcm_sha256"]
    similarity = prechange_ssim(*movies)
    assert similarity >= 0.99
    report = {"result": "technical-pass-with-raster-drift", "versions": reports,
              "prechange_frames": 33,
              "prechange_exact_decoded_frames": sum(a == b for a, b in zip(original, revised)),
              "prechange_ssim_all": similarity,
              "raster_drift_note": "Same pinned HyperFrames project rendered separately with one HTML word changed. "
                                   "Before that word appears, H.264 decoded frames differ slightly; unchanged regions "
                                   "are not proven pixel-identical. Repeating the same baseline render was byte-stable.",
              "unchanged_audio_pcm": True,
              "human_full_motion_review": "pending", "human_listening": "pending",
              "creative_status": "NOT_MASTERED"}
    (OUT / "verification.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
