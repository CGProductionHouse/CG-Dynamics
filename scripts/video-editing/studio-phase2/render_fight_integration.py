"""One stock-only 10 s trailer sequence, with equal-picture music/design A/B."""

from __future__ import annotations

import hashlib
import subprocess
import tempfile
from pathlib import Path

from render_fight_title_safe import frame as title_frame

ROOT = Path(__file__).resolve().parent
MEDIA = ROOT / "media" / "fight-practice"
LABEL = ROOT / "output" / "fight-practice" / "stock-practice-label.png"
MUSIC = MEDIA / "mixkit-676-epical-drums-01.mp3"
PUNCH = MEDIA / "mixkit-2165-face-punch.wav"
RATE = "24000/1001"

SOURCES = {
    "40968": "1a8186f3b7bb178a7da237bdffd19c8f855275c615688e00476f4395924015e8",
    "40969": "5d417cfd997899890a199c7f5ed3ab5fa7d7592e96a5bfeb511eb24349667298",
    "40970": "1400ba43a7d715c07c704f23d17fadd83cd7caee5c6ce576dea856f1c9063749",
    "40973": "660fb67d131e9cfa110ab17c955cf870f11371ac5c22b570d0b08aa97039830d",
    "40974": "938bba8c5c586d700be40e2cabf628713dcc440caefb931d8229d1e99f1ce634",
}
SHOTS = [
    # The two actual contact clips appear once each. Other shots show setup/energy.
    ("40974", 4.75, 36, "portrait"),
    ("40973", 1.00, 36, "portrait"),
    ("40968", 5.25, 18, "square"),
    ("40970", 0.25, 24, "portrait"),
    ("40969", 0.00, 48, "face_crop"),
    ("40973", 5.25, 42, "portrait"),
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def verify_sources() -> None:
    for number, expected in SOURCES.items():
        path = MEDIA / f"{number}.mp4"
        if not path.is_file() or sha256(path) != expected:
            raise SystemExit(f"Missing or changed Mixkit #{number}")
    for path, expected in [
        (MUSIC, "47182a9547cbbbbf7d833e60c06fcdc08c7b064d084f4802b1b68557cba5780b"),
        (PUNCH, "540617d4b9f5b2b55527ac148edfdf1eaecb31d1d781ee515b6fbba8b740ce05"),
    ]:
        if not path.is_file() or sha256(path) != expected:
            raise SystemExit(f"Missing or changed practice audio: {path.name}")
    if not LABEL.is_file():
        raise SystemExit("Run render_fight_impact_scene.py first for the stock label")


def render_shot(folder: Path, index: int, shot: tuple[str, float, int, str]) -> Path:
    number, start, count, layout = shot
    path = folder / f"shot-{index:02}.mp4"
    if layout == "square":
        graph = (
            "[0:v]split[fg0][bg0];"
            "[fg0]crop=720:720:160:0,scale=1080:1080,setsar=1[fg];"
            "[bg0]scale=1080:1920:force_original_aspect_ratio=increase,"
            "crop=1080:1920,gblur=sigma=28[bg];"
            "[bg][fg]overlay=0:420[base];"
            "[base][1:v]overlay=0:0:shortest=1,format=yuv420p[v]"
        )
    else:
        vf = "crop=405:720:300:0,scale=1080:1920" if layout == "face_crop" else "scale=1080:1920"
        graph = f"[0:v]{vf},setsar=1[base];[base][1:v]overlay=0:0:shortest=1,format=yuv420p[v]"
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-ss", str(start), "-i", str(MEDIA / f"{number}.mp4"),
        "-loop", "1", "-i", str(LABEL), "-filter_complex", graph,
        "-map", "[v]", "-frames:v", str(count), "-r", RATE, "-an",
        "-c:v", "libx264", "-preset", "medium", "-crf", "19", str(path),
    ], check=True)
    return path


def render_title(folder: Path) -> Path:
    frames = folder / "title-frames"
    frames.mkdir()
    for i in range(36):
        title_frame(i, False).save(frames / f"frame-{i:03}.png")
    path = folder / "shot-06.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-framerate", RATE,
        "-i", str(frames / "frame-%03d.png"), "-frames:v", "36",
        "-c:v", "libx264", "-preset", "medium", "-crf", "19",
        "-pix_fmt", "yuv420p", str(path),
    ], check=True)
    return path


def render_audio(master: Path, designed: bool) -> Path:
    music = "[1:a]atrim=0:10.01,asetpts=PTS-STARTPTS,volume=0.38"
    if designed:
        # Brief pre-hit reduction ahead of stock clip #40969. Original stock has no ring audio.
        envelope = (
            "if(lt(t\\,4.65)\\,1\\,"
            "if(lt(t\\,4.90)\\,1-0.78*(t-4.65)/0.25\\,"
            "if(lt(t\\,5.20)\\,0.22\\,"
            "if(lt(t\\,5.40)\\,0.22+0.78*(t-5.20)/0.20\\,1))))"
        )
        music += f",volume='{envelope}':eval=frame"
    music += ",afade=t=in:st=0:d=0.08,afade=t=out:st=9.70:d=0.31[m]"
    if designed:
        # #40974 contact ≈0.625 s; #2165's peak follows its onset by 0.0328 s.
        graph = (music + ";[2:a]atrim=0:0.42,asetpts=PTS-STARTPTS,volume=0.28,"
                 "adelay=592|592[s];[m][s]amix=inputs=2:duration=first:dropout_transition=0,"
                 "alimiter=limit=0.9[a]")
    else:
        graph = music.replace("[m]", "[a]")
    name = "proof-fight-integration-designed.mp4" if designed else "proof-fight-integration-control.mp4"
    output = ROOT / name
    args = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(master),
            "-ss", "24.225", "-i", str(MUSIC)]
    if designed:
        args.extend(["-i", str(PUNCH)])
    args.extend(["-filter_complex", graph, "-map", "0:v:0", "-map", "[a]",
                 "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", str(output)])
    subprocess.run(args, check=True)
    print(name, sha256(output))
    return output


def main() -> None:
    verify_sources()
    with tempfile.TemporaryDirectory(prefix="fight-integrated-") as temp:
        folder = Path(temp)
        segments = [render_shot(folder, i, shot) for i, shot in enumerate(SHOTS)]
        segments.append(render_title(folder))
        listfile = folder / "concat.txt"
        listfile.write_text("".join(f"file '{p.as_posix()}'\n" for p in segments), encoding="utf-8")
        master = folder / "picture.mp4"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                        "-i", str(listfile), "-c", "copy", str(master)], check=True)
        render_audio(master, False)
        render_audio(master, True)


if __name__ == "__main__":
    main()
