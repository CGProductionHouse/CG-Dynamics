"""Source-matched, separable sound pass for the TBS R06 beat recut."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\TBS-Nov-2026-Goods-Transit")
SRC = ROOT / "source"
OUT = ROOT / "film-r06-private"
TBS = Path(r"C:\Users\chris\Videos\CG-AI-Editing\TBS-Nov-2026\restart-source")
DUR = 28.966667


def run(*args: object) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def make_cue(name: str, path: Path, source_in: float, seconds: float,
             timeline_in: float, volume: float, fade_in: float, fade_out: float) -> Path:
    output = OUT / f"cue-{name}.wav"
    delay = round(timeline_in * 1000)
    filters = (
        f"aresample=48000,aformat=channel_layouts=stereo,"
        f"atrim=0:{seconds:.3f},asetpts=PTS-STARTPTS,volume={volume:.3f},"
        f"afade=t=in:st=0:d={fade_in:.3f},"
        f"afade=t=out:st={max(0,seconds-fade_out):.3f}:d={fade_out:.3f},"
        f"adelay={delay}|{delay},apad=whole_dur={DUR:.6f},atrim=0:{DUR:.6f}"
    )
    run("-ss", source_in, "-i", path, "-af", filters, "-ar", 48000,
        "-ac", 2, "-c:a", "pcm_s16le", output)
    return output


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    music = OUT / "music-stem.wav"
    run("-i", SRC / "mixkit-motivating-mornings-candidate.mp3", "-t", DUR,
        "-af", f"aresample=48000,volume=0.52,afade=t=in:st=0:d=0.45,"
               f"afade=t=out:st=27.3:d=1.6667",
        "-ar", 48000, "-ac", 2, "-c:a", "pcm_s16le", music)

    cues = [
        ("door", SRC / "mixkit-heavy-sliding-door-1523.wav", 0.0, 2.70, 0.0, 0.26, 0.02, 0.38),
        ("scan", SRC / "mixkit-shop-scanner-beeps-1073.wav", 0.0, 0.38, 2.50, 0.14, 0.01, 0.12),
        ("pallet-slide", TBS / "mixkit-transition-slide-3120.wav", 0.0, 0.70, 6.93, 0.10, 0.03, 0.24),
        ("road-bed", SRC / "mixkit-truck-driving-steady-1621.wav", 0.6, 5.60, 10.0, 0.15, 0.40, 0.70),
        ("truck-pass", SRC / "mixkit-truck-highway-pass-1627.wav", 1.0, 3.10, 12.65, 0.18, 0.35, 0.60),
    ]
    paths = [make_cue(*c) for c in cues]
    sfx = OUT / "sfx-stem.wav"
    inputs = []
    for p in paths:
        inputs += ["-i", p]
    run(*inputs, "-filter_complex", f"amix=inputs={len(paths)}:duration=longest:normalize=0,"
        "alimiter=limit=0.90", "-t", DUR, "-c:a", "pcm_s16le", sfx)

    mix = OUT / "mix-stem.wav"
    run("-i", music, "-i", sfx,
        "-filter_complex", "[0:a][1:a]amix=inputs=2:duration=longest:normalize=0,"
        "alimiter=limit=0.84,aresample=48000[a]", "-map", "[a]", "-t", DUR,
        "-c:a", "pcm_s16le", mix)
    output = OUT / "TBS_FESTIVE_TRANSIT_R06_PRIVATE_MIX.mp4"
    run("-i", OUT / "TBS_FESTIVE_TRANSIT_R06_PRIVATE_PICTURE.mp4", "-i", mix,
        "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac",
        "-af", "loudnorm=I=-16:TP=-2:LRA=11", "-b:a", "256k", "-ac", 2, "-ar", 48000, "-shortest",
        "-movflags", "+faststart", output)
    (OUT / "sound-ledger.json").write_text(json.dumps([
        {"cue": name, "source": str(path), "source_in_s": source_in,
         "timeline_in_s": timeline_in, "duration_s": seconds, "gain": volume}
        for name, path, source_in, seconds, timeline_in, volume, _, _ in cues
    ], indent=2), encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
