"""Bounded Daisy intro comparison from one licensed friendship take.

This is a protected picture test, not the approval film. Outputs stay outside Git.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Daisy-Nov-2026")
SRC = ROOT / "stock-november-v1" / "41225-720.mp4"
OUT = ROOT / "private-repurpose-v2"
OUT.mkdir(exist_ok=True)


def run(*args: str) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def main() -> None:
    # The same conversation supplies both halves: a gesture near 1.3 s and
    # its cheerful response near 5.0 s. The comparison makes no claim that
    # two unrelated events happened together.
    common = ["-filter_complex"]
    framing = "fps=30,scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960,setsar=1"
    run("-ss", "0.55", "-i", str(SRC), "-ss", "4.30", "-i", str(SRC),
        *common,
        f"[0:v]{framing},trim=duration=2.3,setpts=PTS-STARTPTS[top];"
        f"[1:v]{framing},trim=duration=2.3,setpts=PTS-STARTPTS[bottom];"
        "[top][bottom]vstack=inputs=2,drawbox=x=0:y=952:w=1080:h=16:color=0xf8e21a:t=fill[v]",
        "-map", "[v]", "-frames:v", "69", "-an", "-c:v", "libx264", "-crf", "18",
        "-pix_fmt", "yuv420p", str(OUT / "daisy-intro-split-test.mp4"))
    run("-ss", "0.55", "-i", str(SRC), "-ss", "4.30", "-i", str(SRC),
        *common,
        "[0:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,trim=duration=1.15,setpts=PTS-STARTPTS[a];"
        "[1:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,trim=duration=1.15,setpts=PTS-STARTPTS[b];"
        "[a][b]concat=n=2:v=1:a=0[v]",
        "-map", "[v]", "-frames:v", "69", "-an", "-c:v", "libx264", "-crf", "18",
        "-pix_fmt", "yuv420p", str(OUT / "daisy-intro-sequential-control.mp4"))


if __name__ == "__main__":
    main()
