"""Repeatable technical acceptance for the one synthetic Studio pilot."""

from __future__ import annotations

import hashlib
import json
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "output"


def probe(path: Path) -> dict:
    result = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                             "stream=codec_name,width,height,avg_frame_rate,nb_frames",
                             "-show_entries", "format=duration,size", "-of", "json", str(path)],
                            capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def decoded_frame_hashes(path: Path, start: int, end: int) -> list[str]:
    expression = f"select=between(n\\,{start}\\,{end-1})"
    result = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path),
                             "-an", "-vf", expression, "-fps_mode", "vfr", "-f", "framemd5", "-"],
                            capture_output=True, text=True, check=True)
    return [line.rsplit(",", 1)[-1].strip() for line in result.stdout.splitlines() if line and not line.startswith("#")]


def wav_stats(path: Path) -> dict:
    with wave.open(str(path), "rb") as file:
        assert file.getnchannels() == 2 and file.getframerate() == 48000
        samples = np.frombuffer(file.readframes(file.getnframes()), dtype="<i2").astype(np.float64) / 32768
    return {"seconds": round(len(samples) / (2 * 48000), 3),
            "peak_dbfs": round(float(20 * np.log10(max(np.max(np.abs(samples)), 1e-9))), 2),
            "rms_dbfs": round(float(20 * np.log10(max(np.sqrt(np.mean(samples**2)), 1e-9))), 2)}


def title_bounds(row: dict, total_frames: int) -> dict:
    path = ROOT / row["sources"]["title"]["path"]
    with Image.open(path) as im:
        bounds = im.getchannel("A").getbbox()
    assert bounds is not None
    # render.py moves the full title canvas from -96 to -96+60*t.
    drift = -96 + 60 * (total_frames - 1) / 24
    return {"source_alpha_bbox": bounds, "moving_left_min": bounds[0] - 96,
            "moving_right_max": bounds[2] + drift,
            "within_test_safe_box": bounds[0] - 96 >= 130 and bounds[2] + drift <= 2030
            and bounds[1] >= 300 and bounds[3] <= 3420}


def main() -> None:
    base, revised = (json.loads((OUTPUT / name / "receipt.json").read_text(encoding="utf-8"))
                     for name in ("baseline", "revision"))
    assert [s["id"] for s in base["scenes"]] == [s["id"] for s in revised["scenes"]]
    report = {"baseline": {}, "revision": {}, "scene_comparison": [], "protected_output_pixels_equal": {},
              "listening": "UNVERIFIED: no audio perception input on this agent; owner/staff audition needed"}
    for variant, receipt in (("baseline", base), ("revision", revised)):
        movie = OUTPUT / variant / receipt["movie"]["path"]
        subprocess.run(["ffmpeg", "-v", "error", "-i", str(movie), "-f", "null", "-"],
                       stdout=subprocess.DEVNULL, check=True)
        metadata = probe(movie)
        video = next(stream for stream in metadata["streams"] if stream["codec_name"] == "h264")
        audio = next(stream for stream in metadata["streams"] if stream["codec_name"] == "aac")
        assert (video["width"], video["height"], video["avg_frame_rate"], int(video["nb_frames"])) == (
            2160, 3840, "24/1", receipt["total_frames"])
        assert abs(float(metadata["format"]["duration"]) - receipt["duration_seconds"]) < .02
        report[variant] = {"mp4": receipt["movie"], "probe": metadata,
                           "full_video_audio_decode": "pass", "audio_stream": audio["codec_name"],
                           "stems": {name: wav_stats(OUTPUT / variant / f"{name}.wav")
                                     for name in ("score", "effects", "mix")},
                           "title_bounds": {scene["id"]: title_bounds(scene, scene["duration_frames"])
                                            for scene in receipt["scenes"]}}
        assert all(row["within_test_safe_box"] for row in report[variant]["title_bounds"].values())
    for before, after in zip(base["scenes"], revised["scenes"]):
        protected = before["id"] in ("s01_line", "s02_detail", "s05_glow", "s06_end")
        same = before["picture_sha256"] == after["picture_sha256"]
        audio_same = before["score_sha256"] == after["score_sha256"] and before["effects_sha256"] == after["effects_sha256"]
        if protected:
            assert same and audio_same and before["duration_frames"] == after["duration_frames"]
            base_hashes = decoded_frame_hashes(OUTPUT / "baseline" / base["movie"]["path"],
                                               before["start_frame"], before["end_frame_exclusive"])
            revised_hashes = decoded_frame_hashes(OUTPUT / "revision" / revised["movie"]["path"],
                                                  after["start_frame"], after["end_frame_exclusive"])
            assert len(base_hashes) == before["duration_frames"] and base_hashes == revised_hashes
            report["protected_output_pixels_equal"][before["id"]] = {
                "frames": len(base_hashes), "decoded_frame_md5_list_sha256": hashlib.sha256("\n".join(base_hashes).encode()).hexdigest()}
        report["scene_comparison"].append({"id": before["id"], "protected": protected,
                                           "baseline_start_frame": before["start_frame"],
                                           "revised_start_frame": after["start_frame"],
                                           "baseline_frames": before["duration_frames"],
                                           "revised_frames": after["duration_frames"],
                                           "same_scene_mp4_bytes": same, "same_pcm_stem_bytes": audio_same})
    assert not report["scene_comparison"][2]["same_scene_mp4_bytes"]
    assert report["scene_comparison"][3]["baseline_frames"] - report["scene_comparison"][3]["revised_frames"] == 12
    destination = OUTPUT / "verification.json"
    destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"result": "technical-pass", "protected_scenes": list(report["protected_output_pixels_equal"]),
                      "baseline_seconds": base["duration_seconds"], "revised_seconds": revised["duration_seconds"],
                      "listening": "unverified", "report": str(destination)}))


if __name__ == "__main__":
    main()
