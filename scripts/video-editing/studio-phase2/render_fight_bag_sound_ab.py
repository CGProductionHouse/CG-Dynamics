"""Dry versus one bag-contact cue on exactly the same licensed practice picture."""

from hashlib import sha256
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent
PICTURE = ROOT / "proof-fight-contact-retime-constant.mp4"
SFX = ROOT / "media/fight-practice/mixkit-2113-bag-training.wav"
VIDEO_SHA = "0a69bcee8585b62d17a46014557f5be0079bc0723e7306697076745ede93af6a"
SFX_SHA = "1ba422886da9dc4aaf44baa3a0f4799e8654e5df43a85bc3cd5b7500c6d11afc"
DURATION = "1.25125"


def run(*args: str) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def main() -> None:
    for path, expected in ((PICTURE, VIDEO_SHA), (SFX, SFX_SHA)):
        if not path.exists() or sha256(path.read_bytes()).hexdigest() != expected:
            raise SystemExit(f"Missing or changed practice source: {path}")

    dry = ROOT / "proof-fight-bag-sound-dry.mp4"
    cue = ROOT / "proof-fight-bag-sound-one-cue.mp4"
    # The silent stock video has no camera track; an explicit silent AAC stream
    # keeps both review files structurally comparable without pretending source sound.
    run("-i", str(PICTURE), "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac",
        "-b:a", "192k", "-t", DURATION, str(dry))
    # In the 23.5 s bag recording the isolated hit begins near 17.65 s;
    # trimming from 17.15 s aligns its first energy with video t≈0.50 s.
    run("-i", str(PICTURE), "-i", str(SFX), "-filter_complex",
        "[1:a]atrim=start=17.15:duration=1.25125,asetpts=PTS-STARTPTS,"
        "volume=0.75,afade=t=out:st=1.05:d=0.20125[a]",
        "-map", "0:v:0", "-map", "[a]", "-c:v", "copy", "-c:a", "aac",
        "-b:a", "192k", "-t", DURATION, str(cue))
    print(dry)
    print(cue)


if __name__ == "__main__":
    main()
