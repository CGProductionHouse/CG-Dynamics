"""R07 sound revision: move the slide cue from pallet to Kevin's entrance."""
from pathlib import Path
import json
import subprocess

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\TBS-Nov-2026-Goods-Transit")
R06 = ROOT / "film-r06-private"
OUT = ROOT / "film-r07-private"
TBS = Path(r"C:\Users\chris\Videos\CG-AI-Editing\TBS-Nov-2026\restart-source")
DUR = 28.966667

def run(*args: object) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)

def main() -> None:
    slide = OUT / "kevin-slide-cue.wav"
    run("-i", TBS / "mixkit-transition-slide-3120.wav", "-af",
        f"aresample=48000,aformat=channel_layouts=stereo,atrim=0:0.70,asetpts=PTS-STARTPTS,"
        f"volume=0.14,afade=t=in:st=0:d=0.03,afade=t=out:st=0.43:d=0.27,"
        f"adelay=5000|5000,apad=whole_dur={DUR:.6f},atrim=0:{DUR:.6f}",
        "-ar", 48000, "-ac", 2, "-c:a", "pcm_s16le", slide)
    # Rebuild from the R06 individual action cues, excluding the R06 pallet
    # slide so the same effect is not played twice within two seconds.
    cues = [R06 / f"cue-{name}.wav" for name in
            ("door", "scan", "road-bed", "truck-pass")]
    cues.append(slide)
    inputs = []
    for path in cues:
        assert path.exists(), path
        inputs += ["-i", path]
    sfx = OUT / "sfx-stem.wav"
    run(*inputs, "-filter_complex",
        f"amix=inputs={len(cues)}:duration=longest:normalize=0,alimiter=limit=0.90",
        "-t", DUR, "-c:a", "pcm_s16le", sfx)
    mix = OUT / "mix-stem.wav"
    run("-i", R06 / "music-stem.wav", "-i", sfx,
        "-filter_complex", "[0:a][1:a]amix=inputs=2:duration=longest:normalize=0,"
        "alimiter=limit=0.84,aresample=48000[a]", "-map", "[a]", "-t", DUR,
        "-c:a", "pcm_s16le", mix)
    target = OUT / "TBS_FESTIVE_TRANSIT_R07_PRIVATE_MIX.mp4"
    run("-i", OUT / "TBS_FESTIVE_TRANSIT_R07_PRIVATE_PICTURE.mp4", "-i", mix,
        "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac",
        "-af", "loudnorm=I=-16:TP=-2:LRA=11", "-b:a", "256k", "-ac", 2,
        "-ar", 48000, "-shortest", "-movflags", "+faststart", target)
    (OUT / "sound-change.json").write_text(json.dumps({
        "from": "R06", "removed": "pallet slide at 6.93s",
        "added": "licensed slide cue at Kevin entrance 5.00s",
        "music": "unchanged R06 Mixkit Motivating Mornings music stem",
        "client_camera_audio": "muted; Kevin frame is closed-mouth and static within motion art"
    }, indent=2), encoding="utf-8")
    print(target)

if __name__ == "__main__":
    main()
