"""Read-only audio intake/QC for one local media file; never rates creative sound."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import subprocess
import sys
from pathlib import Path

import numpy as np


def run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, text=True, capture_output=True, check=True)


def decimal(value: object, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def dbfs(amplitude: float) -> float | None:
    return round(20 * math.log10(amplitude), 3) if amplitude > 0 else None


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def inspect(path: Path) -> dict[str, object]:
    probe = json.loads(
        run(
            "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)
        ).stdout
    )
    streams = probe.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
    report: dict[str, object] = {
        "file": str(path.resolve()),
        "sha256": digest(path),
        "duration_sec": decimal(probe.get("format", {}).get("duration")),
        "video_start_sec": decimal(video.get("start_time")) if video else None,
        "audio_present": audio is not None,
    }
    if audio is None:
        report["status"] = "NO_AUDIO_STREAM"
        return report

    sample_rate = int(audio["sample_rate"])
    channels = int(audio["channels"])
    audio_start = decimal(audio.get("start_time"))
    relative_start = audio_start - decimal(video.get("start_time")) if video else audio_start
    window_frames = max(1, round(sample_rate / 100))  # approximately 10 ms
    window_bytes = window_frames * channels * 4
    decoder = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", str(path), "-map", "0:a:0", "-f", "f32le", "-acodec", "pcm_f32le", "-"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert decoder.stdout is not None
    total_samples = 0
    sum_squares = 0.0
    maximum = 0.0
    near_full_scale = 0
    quiet_windows = 0
    windows = 0
    loudest_rms = 0.0
    loudest_start = 0.0
    last_rms = 0.0
    while chunk := decoder.stdout.read(window_bytes):
        decoded = np.frombuffer(chunk, dtype="<f4")
        if decoded.size == 0:
            break
        if not np.all(np.isfinite(decoded)):
            decoder.kill()
            raise ValueError("Decoded audio contains non-finite samples")
        absolute = np.abs(decoded)
        maximum = max(maximum, float(np.max(absolute)))
        near_full_scale += int(np.count_nonzero(absolute >= 0.999))
        squared = np.square(decoded.astype(np.float64))
        sum_squares += float(np.sum(squared))
        window_rms = math.sqrt(float(np.mean(squared)))
        if window_rms < 10 ** (-45 / 20):
            quiet_windows += 1
        if window_rms > loudest_rms:
            loudest_rms = window_rms
            loudest_start = total_samples / channels / sample_rate
        last_rms = window_rms
        total_samples += decoded.size
        windows += 1
    decoder.stdout.close()
    stderr = decoder.stderr.read().decode("utf-8", errors="replace") if decoder.stderr else ""
    if decoder.wait() != 0:
        raise RuntimeError(f"FFmpeg audio decode failed: {stderr[-500:]}")

    true_peak_run = run(
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-map", "0:a:0",
        "-af", "ebur128=peak=true", "-f", "null", "NUL" if sys.platform == "win32" else "/dev/null"
    )
    peak_matches = re.findall(r"Peak:\s*([-+]?\d+(?:\.\d+)?)\s*dBFS", true_peak_run.stderr)
    true_peak = float(peak_matches[-1]) if peak_matches else None
    rms = math.sqrt(sum_squares / total_samples) if total_samples else 0.0
    report.update(
        status="MEASURED_NOT_HEARD",
        codec=audio.get("codec_name"),
        sample_rate=sample_rate,
        channels=channels,
        audio_start_sec=round(audio_start, 6),
        audio_start_relative_to_video_sec=round(relative_start, 6),
        decoded_samples_per_channel=total_samples // channels,
        decoded_sample_peak=round(maximum, 6),
        decoded_sample_peak_dbfs=dbfs(maximum),
        decoded_samples_at_or_above_0_999=near_full_scale,
        rms_dbfs=dbfs(rms),
        approximately_10ms_windows_below_minus45_dbfs=quiet_windows,
        approximately_10ms_window_count=windows,
        loudest_window_source_audio_sec=round(loudest_start, 4),
        loudest_window_video_timeline_sec=round(loudest_start + relative_start, 4),
        loudest_window_rms_dbfs=dbfs(loudest_rms),
        final_window_rms_dbfs=dbfs(last_rms),
        true_peak_dbtp=true_peak,
        flags={
            "near_silence_by_window": windows > 0 and quiet_windows / windows > 0.9,
            "decoded_near_full_scale": near_full_scale > 0,
            "true_peak_above_minus1_dbtp": true_peak is not None and true_peak > -1.0,
            "audio_start_offset_over_20ms": abs(relative_start) > 0.02,
        },
    )
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("media", type=Path, help="Local video or audio file; never uploaded")
    args = parser.parse_args()
    if not args.media.is_file():
        parser.error(f"File does not exist: {args.media}")
    try:
        report = inspect(args.media)
    except (subprocess.CalledProcessError, RuntimeError, ValueError, KeyError) as exc:
        print(json.dumps({"status": "ERROR", "message": str(exc)}, indent=2), file=sys.stderr)
        return 1
    print(json.dumps(report, indent=2))
    return 0 if report["audio_present"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
