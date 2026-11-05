"""Protected R08 sound: source-linked cues with no fabricated scanner beep."""
from pathlib import Path
import json
import subprocess

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\TBS-Nov-2026-Goods-Transit")
R06 = ROOT / "film-r06-private"
R08 = ROOT / "film-r08-private"
TBS = Path(r"C:\Users\chris\Videos\CG-AI-Editing\TBS-Nov-2026\restart-source")
DUR = 28.966667


def run(*args: object) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    *map(str, args)], check=True)


def main() -> None:
    slide = R08 / "kevin-slide-cue.wav"
    run("-i", TBS / "mixkit-transition-slide-3120.wav", "-af",
        f"aresample=48000,aformat=channel_layouts=stereo,atrim=0:0.70,asetpts=PTS-STARTPTS,"
        f"volume=0.14,afade=t=in:st=0:d=0.03,afade=t=out:st=0.43:d=0.27,"
        f"adelay=4430|4430,apad=whole_dur={DUR:.6f},atrim=0:{DUR:.6f}",
        "-ar", 48000, "-ac", 2, "-c:a", "pcm_s16le", slide)
    # The phone never visibly scans the parcel's QR code. The scanner beep in
    # R06/R07 implied an action the camera did not show, so it is excluded.
    cues = [R06 / f"cue-{name}.wav" for name in
            ("door", "road-bed", "truck-pass")]
    cues.append(slide)
    sfx = R08 / "sfx-stem.wav"
    run(*sum((["-i", p] for p in cues), []), "-filter_complex",
        f"amix=inputs={len(cues)}:duration=longest:normalize=0,alimiter=limit=0.90",
        "-t", DUR, "-c:a", "pcm_s16le", sfx)
    mix = R08 / "mix-stem.wav"
    run("-i", R06 / "music-stem.wav", "-i", sfx, "-filter_complex",
        "[0:a][1:a]amix=inputs=2:duration=longest:normalize=0,"
        "alimiter=limit=0.84,aresample=48000[a]", "-map", "[a]", "-t", DUR,
        "-c:a", "pcm_s16le", mix)
    target = R08 / "TBS_FESTIVE_TRANSIT_R08_PRIVATE_MIX.mp4"
    run("-i", R08 / "TBS_FESTIVE_TRANSIT_R08_PRIVATE_PICTURE.mp4",
        "-i", mix, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
        "-c:a", "aac", "-af", "loudnorm=I=-16:TP=-2:LRA=11", "-b:a", "256k",
        "-ac", 2, "-ar", 48000, "-shortest", "-movflags", "+faststart", target)
    (R08 / "sound-change.json").write_text(json.dumps({
        "removed": "scanner beep over a phone that never visibly scans; old pallet slide",
        "added": "licensed slide cue begins at 4.43s, leads Kevin visual entrance at 4.50s",
        "road": "truck pass overlaps the road-to-depot perspective push",
        "music": "unchanged R06 Mixkit Motivating Mornings bed over picture-only logo",
        "client_camera_audio": "muted; Kevin is a single closed-mouth source frame",
    }, indent=2), encoding="utf-8")
    print(target)


if __name__ == "__main__":
    main()
