"""Isolate one visible cup contact and compare a protected audio revision."""

from __future__ import annotations

import json
from pathlib import Path

from render_sound_cut import ROOT, checked, run, sha, source_frames

OUT = ROOT / "output" / "cup-contact"


def main() -> None:
    spec = json.loads((ROOT / "cup-contact-study.json").read_text(encoding="utf-8"))
    picture_source = checked(spec["picture"])
    music = checked(spec["music"])
    effect = checked(spec["contact_sound"])
    start = spec["picture"]["source_start_frame"]
    count = spec["picture"]["frame_count"]
    if start + count > source_frames(picture_source):
        raise RuntimeError("Picture selection exceeds source frames")
    OUT.mkdir(parents=True, exist_ok=True)
    picture = OUT / "picture.mp4"
    run("-i", str(picture_source), "-vf",
        f"trim=start_frame={start}:end_frame={start+count},setpts=N/(24*TB)",
        "-frames:v", str(count), "-an", "-c:v", "libx264", "-preset", "medium",
        "-crf", "18", "-pix_fmt", "yuv420p", "-r", "24", str(picture))

    outputs = {}
    for variant in ("music-only", "contact-candidate"):
        target = OUT / f"{variant}.mp4"
        base = (f"[1:a]atrim=start={spec['music']['source_in_seconds']}:duration=3,"
                "asetpts=PTS-STARTPTS,aresample=48000,volume=1.25,"
                "afade=t=in:st=0:d=0.08,afade=t=out:st=2.7:d=0.3[m]")
        if variant == "music-only":
            inputs = ("-i", str(picture), "-i", str(music))
            graph, audio_map = base, "[m]"
        else:
            delay_ms = round(spec["contact_sound"]["timeline_onset_seconds"] * 1000)
            inputs = ("-i", str(picture), "-i", str(music), "-i", str(effect))
            graph = (base + f";[2:a]atrim=duration=0.36,asetpts=PTS-STARTPTS,"
                     f"aresample=48000,volume=0.32,afade=t=out:st=0.18:d=0.18,"
                     f"adelay={delay_ms}|{delay_ms}[e];"
                     "[m][e]amix=inputs=2:duration=first:normalize=0[a]")
            audio_map = "[a]"
        run(*inputs, "-filter_complex", graph, "-map", "0:v:0", "-map", audio_map,
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", "3", str(target))
        outputs[variant] = {"sha256": sha(target), "bytes": target.stat().st_size}
    print(json.dumps({"frames": count, "duration_seconds": 3, "outputs": outputs}, indent=2))


if __name__ == "__main__":
    main()
