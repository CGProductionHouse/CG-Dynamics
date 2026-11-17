"""One bounded synthetic Nolan Studio proof. FFmpeg is the renderer; this is not an NLE."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import time
import wave
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "output"


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def run(*args: object) -> None:
    subprocess.run([str(value) for value in args], check=True, stdout=subprocess.DEVNULL)


def font_path(project: dict) -> Path:
    path = Path(os.path.expandvars(project["brand"]["font"]["source"].replace("/", os.sep)))
    if not path.is_file():
        raise FileNotFoundError(f"Required local font unavailable: {path.name}")
    return path


def project_for(variant: str) -> tuple[dict, dict | None]:
    project = json.loads((ROOT / "project.json").read_text(encoding="utf-8"))
    revision = None
    if variant == "revision":
        revision = json.loads((ROOT / "revision.json").read_text(encoding="utf-8"))
        for change in revision["changes"]:
            scene = next(s for s in project["scenes"] if s["id"] == change["scene_id"])
            assert scene[change["field"]] == change["from"], "Revision base does not match"
            assert not scene["protected"], "Protected scene cannot be revised"
            scene[change["field"]] = change["to"]
        assert [s["id"] for s in project["scenes"] if s["protected"]] == revision["protected_scene_ids"]
    ids = [scene["id"] for scene in project["scenes"]]
    assert len(ids) == len(set(ids)) and all(scene["frames"] > 0 for scene in project["scenes"])
    assert project["format"]["width"] == 2160 and project["format"]["height"] == 3840
    return project, revision


def background(kind: str, width: int, height: int, palette: dict[str, str]) -> Image.Image:
    ink, cream, coral, ice = (palette[key] for key in ("ink", "cream", "coral", "ice"))
    light = kind in ("detail", "end")
    im = Image.new("RGB", (width, height), cream if light else ink)
    d = ImageDraw.Draw(im)
    u = width / 2160
    def p(x: int, y: int) -> tuple[int, int]:
        return round(x * u), round(y * u)
    def rect(box: tuple[int, int, int, int], fill: str) -> None:
        d.rectangle((*p(box[0], box[1]), *p(box[2], box[3])), fill=fill)
    def ellipse(box: tuple[int, int, int, int], outline: str, stroke: int = 10) -> None:
        d.ellipse((*p(box[0], box[1]), *p(box[2], box[3])), outline=outline, width=round(stroke * u))
    if kind == "line":
        d.line([p(170, -80), p(170, 780), p(1390, 780), p(1390, 1420)], fill=coral, width=round(44*u), joint="curve")
        ellipse((600, 2050, 2420, 3870), ice, 15)
        ellipse((835, 2285, 2185, 3635), coral, 5)
        rect((170, 3320, 760, 3340), coral)
    elif kind == "detail":
        ellipse((-430, -340, 2300, 2390), ink, 35)
        ellipse((140, 230, 1740, 1830), coral, 14)
        d.polygon([p(1550, 250), p(2160, 0), p(2160, 1480), p(1680, 1680)], fill=ink)
        rect((170, 3300, 1980, 3340), ink)
        rect((170, 3340, 1260, 3380), coral)
    elif kind == "person":
        rect((170, 260, 1990, 3250), "#263949")
        rect((170, 260, 1985, 285), ice)
        ellipse((290, 365, 1870, 1945), coral, 15)
        rect((175, 3390, 1980, 3415), ice)
    elif kind == "turn":
        im.paste(coral, (0, 0, width, height))
        d.polygon([p(0, 0), p(1510, 0), p(500, 3840), p(0, 3840)], fill=ink)
        d.line([p(1260, 0), p(270, 3840)], fill=cream, width=round(18*u))
        ellipse((880, 1220, 2320, 2660), cream, 25)
    elif kind == "glow":
        ellipse((-120, 560, 2280, 2960), ice, 80)
        ellipse((190, 870, 1970, 2650), coral, 12)
        ellipse((480, 1160, 1680, 2360), cream, 90)
        rect((170, 3420, 1990, 3440), coral)
    elif kind == "end":
        ellipse((440, 330, 1720, 1610), ink, 65)
        d.line([p(1080, 320), p(1850, 1100)], fill=coral, width=round(74*u))
        rect((180, 2870, 1980, 2900), ink)
        rect((180, 2900, 1040, 2925), coral)
    else:
        raise ValueError(kind)
    return im


def title_art(scene: dict, project: dict, font: Path) -> Image.Image:
    width, height = project["format"]["width"], project["format"]["height"]
    scale = width / 2160
    im = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    kind = scene["kind"]
    y = {"line": 1500, "detail": 2500, "person": 1850, "turn": 1720, "glow": 1970, "end": 1900}[kind]
    color = project["brand"]["palette"]["ink" if kind in ("detail", "end") else "cream"]
    if kind == "turn":
        color = project["brand"]["palette"]["cream"]
    if kind == "glow":
        color = project["brand"]["palette"]["coral"]
    for index, line in enumerate(scene["title"]):
        size = 202 if index == 0 else 225
        if kind == "end" and index == 1:
            size = 124
        face = ImageFont.truetype(str(font), round(size * scale))
        while d.textbbox((0, 0), line, font=face)[2] > width - round(460 * scale):
            size -= 4
            face = ImageFont.truetype(str(font), round(size * scale))
        d.text((round(260 * scale), round((y + index * 300) * scale)), line, font=face, fill=color)
    return im


def foreground(project: dict) -> Image.Image:
    width, height = project["format"]["width"], project["format"]["height"]
    u = width / 2160
    im = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    def p(x: int, y: int) -> tuple[int, int]:
        return round(x*u), round(y*u)
    ink = project["brand"]["palette"]["ink"]
    coral = project["brand"]["palette"]["coral"]
    d.ellipse((*p(1260, 1320), *p(1700, 1950)), fill=ink, outline=coral, width=round(11*u))
    d.polygon([p(1300, 1880), p(1660, 1870), p(2030, 3130), p(1050, 3130)], fill=ink)
    d.line([p(1050, 3130), p(1300, 1880)], fill=coral, width=round(12*u))
    return im


def synth_scene_audio(scene: dict, project: dict, scene_number: int, folder: Path) -> dict[str, Path]:
    sr, fps = project["format"]["audio_hz"], project["format"]["fps"]
    samples = scene["frames"] * sr // fps
    t = np.arange(samples, dtype=np.float64) / sr
    base = [110.0, 146.83, 164.81, 130.81, 174.61, 110.0][scene_number]
    envelope = np.minimum(1.0, np.minimum(t / .12, (samples / sr - t) / .25))
    score = .065 * envelope * (np.sin(2*np.pi*base*t) + .28*np.sin(2*np.pi*base*1.5*t))
    pulse = np.exp(-t*17) * np.sin(2*np.pi*(570 - 230*t)*t) * .18
    pulse += .07 * np.exp(-np.maximum(0, t-.55)*15) * np.sin(2*np.pi*330*t) * (t >= .55)
    out = {}
    for name, mono in (("score", score), ("effects", pulse)):
        path = folder / f"{name}.wav"
        stereo = np.clip(np.column_stack((mono, mono)), -1, 1)
        with wave.open(str(path), "wb") as wav:
            wav.setnchannels(2)
            wav.setsampwidth(2)
            wav.setframerate(sr)
            wav.writeframes((stereo * 32767).astype("<i2").tobytes())
        out[name] = path
    return out


def render_scene(scene: dict, project: dict, scene_number: int, font: Path, cache: Path) -> dict:
    signature = {"scene": scene, "format": project["format"], "palette": project["brand"]["palette"],
                 "font_sha256": digest(font), "renderer_sha256": digest(Path(__file__))}
    key = hashlib.sha256(json.dumps(signature, sort_keys=True).encode()).hexdigest()[:16]
    folder = cache / f"{scene['id']}-{key}"
    folder.mkdir(parents=True, exist_ok=True)
    movie = folder / "picture.mp4"
    assets = {"background": folder / "background.png", "title": folder / "title.png"}
    if not movie.exists():
        background(scene["kind"], project["format"]["width"], project["format"]["height"], project["brand"]["palette"]).save(assets["background"])
        title_art(scene, project, font).save(assets["title"])
        if scene["kind"] == "person":
            assets["foreground"] = folder / "foreground.png"
            foreground(project).save(assets["foreground"])
        fps = project["format"]["fps"]
        command = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-threads", "2"]
        for file in assets.values():
            command += ["-loop", "1", "-framerate", str(fps), "-i", str(file)]
        width, height = project["format"]["width"], project["format"]["height"]
        # Small camera push on generated geometry; independent typography drifts more slowly.
        filters = (f"[0:v]zoompan=z='1+0.0004*on':x='(iw-iw/zoom)/2':"
                   f"y='(ih-ih/zoom)/2':d=1:s={width}x{height}:fps={fps}[bg];"
                   "[bg][1:v]overlay=x='-96+60*t':y=0:format=auto[v1]")
        if "foreground" in assets:
            filters += ";[v1][2:v]overlay=x=0:y=0:format=auto,format=yuv420p[v]"
        else:
            filters += ";[v1]format=yuv420p[v]"
        command += ["-filter_complex", filters, "-map", "[v]", "-frames:v", str(scene["frames"]),
                    "-an", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-r", str(fps),
                    "-video_track_timescale", "24000", str(movie)]
        run(*command)
    if not (folder / "score.wav").exists() or not (folder / "effects.wav").exists():
        synth_scene_audio(scene, project, scene_number, folder)
    return {"id": scene["id"], "key": key, "frames": scene["frames"], "picture": movie,
            "score": folder / "score.wav", "effects": folder / "effects.wav", "assets": assets}


def join_audio(items: list[dict], name: str, destination: Path) -> None:
    with wave.open(str(destination), "wb") as target:
        target.setparams((2, 2, 48000, 0, "NONE", "not compressed"))
        for item in items:
            with wave.open(str(item[name]), "rb") as source:
                assert source.getparams()[:3] == (2, 2, 48000)
                target.writeframes(source.readframes(source.getnframes()))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("variant", choices=("baseline", "revision"))
    args = parser.parse_args()
    started = time.monotonic()
    project, revision = project_for(args.variant)
    font = font_path(project)
    cache = OUTPUT / "cache"
    result = OUTPUT / args.variant
    cache.mkdir(parents=True, exist_ok=True)
    result.mkdir(parents=True, exist_ok=True)
    items = [render_scene(scene, project, n, font, cache) for n, scene in enumerate(project["scenes"])]
    scene_dir = result / "scenes"
    scene_dir.mkdir(exist_ok=True)
    for item in items:
        shutil.copy2(item["picture"], scene_dir / f"{item['id']}.mp4")
    listing = result / "concat.txt"
    listing.write_text("".join(f"file '{(scene_dir / (item['id'] + '.mp4')).as_posix()}'\n" for item in items), encoding="utf-8")
    picture = result / "picture.mp4"
    run("ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listing, "-c", "copy", picture)
    score, effects, mix = (result / f"{name}.wav" for name in ("score", "effects", "mix"))
    join_audio(items, "score", score)
    join_audio(items, "effects", effects)
    with wave.open(str(score), "rb") as a, wave.open(str(effects), "rb") as b:
        left = np.frombuffer(a.readframes(a.getnframes()), dtype="<i2").astype(np.int32)
        right = np.frombuffer(b.readframes(b.getnframes()), dtype="<i2").astype(np.int32)
    assert len(left) == len(right)
    with wave.open(str(mix), "wb") as target:
        target.setparams((2, 2, 48000, 0, "NONE", "not compressed"))
        target.writeframes(np.clip(left + right, -32768, 32767).astype("<i2").tobytes())
    movie = result / f"studio_871_{args.variant}_4k.mp4"
    run("ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", picture, "-i", mix,
        "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", "-shortest", movie)
    start_frame = 0
    scene_rows = []
    for item in items:
        row = {"id": item["id"], "start_frame": start_frame, "end_frame_exclusive": start_frame + item["frames"],
               "duration_frames": item["frames"], "cache_key": item["key"],
               "picture_sha256": digest(item["picture"]), "score_sha256": digest(item["score"]),
               "effects_sha256": digest(item["effects"]),
               "sources": {name: {"path": str(path.relative_to(ROOT)).replace('\\', '/'), "sha256": digest(path)}
                           for name, path in item["assets"].items()}}
        scene_rows.append(row)
        start_frame += item["frames"]
    receipt = {"job_id": project["job_id"], "variant": args.variant,
               "rendered_at_utc": datetime.now(timezone.utc).isoformat(),
               "elapsed_seconds": round(time.monotonic()-started, 2),
               "format": project["format"], "total_frames": start_frame,
               "duration_seconds": start_frame / project["format"]["fps"],
               "project_sha256": digest(ROOT / "project.json"), "revision_sha256": digest(ROOT / "revision.json") if revision else None,
               "renderer_sha256": digest(Path(__file__)),
               "font": {"family": project["brand"]["font"]["family"], "source": project["brand"]["font"]["source"],
                        "licence": project["brand"]["font"]["licence"], "sha256": digest(font)},
               "scenes": scene_rows,
               "audio": {name: {"path": f"{name}.wav", "sha256": digest(result / f"{name}.wav")}
                         for name in ("score", "effects", "mix")},
               "movie": {"path": movie.name, "sha256": digest(movie), "bytes": movie.stat().st_size}}
    (result / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"variant": args.variant, "movie": str(movie), "frames": start_frame,
                      "seconds": receipt["duration_seconds"], "sha256": receipt["movie"]["sha256"],
                      "elapsed_seconds": receipt["elapsed_seconds"]}))


if __name__ == "__main__":
    main()
