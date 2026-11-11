"""Conservative, source-verified FCP7 XML interchange technical study.

This emits an XMEML v5 timeline reference, NOT an Adobe Premiere project.
All source clips must be independently inspected and licensed. The XML must
be opened, relinked, saved, reopened and exported in the actual host before
any claim of native editor compatibility.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import quote

FRAME_RATE = 30
FRAME_COUNT = 90
WIDTH, HEIGHT = 1920, 1080
ALLOWED_SOURCE_RIGHTS = "CC0_POLYHAVEN_CAMERA01_DERIVATIVE_TECHNICAL_ONLY"

class Blocked(ValueError):
    pass

def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()

def add(parent, tag, value=None, **attributes):
    child = ET.SubElement(parent, tag, attributes)
    if value is not None:
        child.text = str(value)
    return child

def rate(parent):
    r = add(parent, "rate")
    add(r, "timebase", FRAME_RATE)
    add(r, "ntsc", "FALSE")

def media_sample(parent):
    v = add(parent, "video")
    sample = add(v, "samplecharacteristics")
    rate(sample)
    add(sample, "width", WIDTH)
    add(sample, "height", HEIGHT)
    add(sample, "anamorphic", "FALSE")
    add(sample, "pixelaspect", "square")
    add(sample, "fielddominance", "none")
    return v

def file_url(p: Path) -> str:
    p = p.resolve()
    if not p.is_absolute() or not p.drive:
        raise Blocked("Windows-local absolute source path required")
    # FCP7-style file URL only, never a remote URL or imported HTTP media.
    return "file://localhost/" + quote(p.as_posix(), safe="/:")

def probe(path: Path, ffprobe: Path) -> dict:
    cmd = [str(ffprobe), "-v", "error", "-show_streams",
           "-show_format", "-of", "json", str(path)]
    obj = json.loads(subprocess.check_output(cmd, text=True, timeout=40))
    videos = [s for s in obj.get("streams", []) if s.get("codec_type") == "video"]
    if len(videos) != 1:
        raise Blocked("Exactly one video stream required")
    return {"stream": videos[0], "duration": float(obj["format"]["duration"]),
            "has_audio": any(s.get("codec_type") == "audio" for s in obj.get("streams", []))}

def validate(manifest: dict, ffprobe: Path):
    if manifest.get("purpose") != "SILENT_TECHNICAL_INTERCHANGE_ONLY":
        raise Blocked("Client or production export prohibited")
    if manifest.get("source_rights") != ALLOWED_SOURCE_RIGHTS:
        raise Blocked("Actual CC0 source provenance not bound")
    if manifest.get("owner_review_status") != "UNREVIEWED_TECHNICAL_PROOF":
        raise Blocked("Creative approval cannot be inferred")
    if manifest.get("fps") != FRAME_RATE or manifest.get("frames") != FRAME_COUNT:
        raise Blocked("30 fps and 90 exact frames required")
    items = manifest.get("sources")
    if not isinstance(items, dict) or set(items) != {"base", "overlay"}:
        raise Blocked("Exactly two defined sources required")
    if not ffprobe.is_file():
        raise Blocked("Local ffprobe unavailable")
    hashes = set()
    result = {}
    for role in ("base", "overlay"):
        record = items[role]
        if record.get("role") != role or record.get("license") != "CC0":
            raise Blocked(f"Invalid role or rights for {role}")
        if record.get("client_asset") is not False:
            raise Blocked("Any client asset requires the existing release flow")
        p = Path(record["path"])
        if not p.is_file() or not p.is_absolute():
            raise Blocked(f"Source absent: {role}")
        actual = digest(p)
        if actual != record.get("sha256") or actual in hashes:
            raise Blocked("Changed or reused source file")
        hashes.add(actual)
        info = probe(p, ffprobe)
        s = info["stream"]
        if (int(s.get("width", 0)), int(s.get("height", 0))) != (WIDTH, HEIGHT):
            raise Blocked("Unexpected resolution")
        if s.get("avg_frame_rate") != f"{FRAME_RATE}/1":
            raise Blocked("Non-30-fps source")
        if int(s.get("nb_frames", 0)) != FRAME_COUNT:
            raise Blocked("Frame count differs")
        if abs(info["duration"] - FRAME_COUNT / FRAME_RATE) > 0.001:
            raise Blocked("Duration drifts from 90-frame clock")
        if info["has_audio"]:
            raise Blocked("Unreviewed source audio prohibited")
        if role == "base" and (s.get("codec_name") != "h264" or s.get("pix_fmt") != "yuv420p"):
            raise Blocked("Not the validated source base type")
        if role == "overlay" and (s.get("codec_name") != "prores" or not s.get("pix_fmt", "").startswith("yuva")):
            raise Blocked("Transparent ProRes alpha required")
        result[role] = {"path": p, "sha256": actual, "probe": info}
    return result

def xmeml(sources):
    root = ET.Element("xmeml", version="5")
    seq = add(root, "sequence", id="nolan-technical-sequence")
    add(seq, "name", "Nolan M08 - 3s silent source-bound alpha overlay - TECH ONLY")
    add(seq, "duration", FRAME_COUNT)
    rate(seq)
    tc = add(seq, "timecode")
    rate(tc)
    add(tc, "string", "00:00:00:00")
    add(tc, "frame", 0)
    media = add(seq, "media")
    video = add(media, "video")
    fmt = add(video, "format")
    sample = add(fmt, "samplecharacteristics")
    rate(sample)
    for tag, value in (("width", WIDTH), ("height", HEIGHT),
                       ("anamorphic", "FALSE"), ("pixelaspect", "square"),
                       ("fielddominance", "none")):
        add(sample, tag, value)
    for role in ("base", "overlay"):
        track = add(video, "track")
        clip = add(track, "clipitem", id=f"clip-{role}")
        add(clip, "name", sources[role]["path"].name)
        add(clip, "enabled", "TRUE")
        add(clip, "duration", FRAME_COUNT)
        rate(clip)
        for tag, val in (("start", 0), ("end", FRAME_COUNT),
                         ("in", 0), ("out", FRAME_COUNT)):
            add(clip, tag, val)
        f = add(clip, "file", id=f"file-{role}")
        add(f, "name", sources[role]["path"].name)
        add(f, "pathurl", file_url(sources[role]["path"]))
        add(f, "duration", FRAME_COUNT)
        rate(f)
        fm = add(f, "media")
        media_sample(fm)
    ET.indent(root, space="  ")
    return ET.ElementTree(root)

def make_record(sources, path):
    return {"status": "INTERCHANGE_CANDIDATE_HOST_UNVERIFIED",
            "format": "FCP7_XMEML_V5", "duration_frames": FRAME_COUNT,
            "rate": FRAME_RATE, "size": [WIDTH, HEIGHT],
            "xml_path": str(path),
            "xml_sha256": digest(path),
            "sources": {r: {"path": str(s["path"]), "sha256": s["sha256"],
                             "codec": s["probe"]["stream"]["codec_name"],
                             "pix_fmt": s["probe"]["stream"]["pix_fmt"]}
                        for r, s in sources.items()},
            "not_qualified": ["Adobe native Premiere import", "relink", "save",
                              "reopen", "native editable effects", "audio",
                              "phone and creative approval", "client rights"]}

def emit(manifest: dict, ffprobe: Path, output: Path):
    sources = validate(manifest, ffprobe)
    if output.exists():
        raise Blocked("Refuse to silently overwrite an XML handoff")
    output.parent.mkdir(parents=True, exist_ok=True)
    xmeml(sources).write(output, encoding="utf-8", xml_declaration=True)
    return make_record(sources, output)

def render_reference(manifest: dict, ffprobe: Path, ffmpeg: Path, output: Path):
    sources = validate(manifest, ffprobe)
    if output.exists() or not ffmpeg.is_file():
        raise Blocked("Existing output or FFmpeg missing")
    # This is an independent baked visual control, NOT the editable XML host render.
    cmd = [str(ffmpeg), "-hide_banner", "-loglevel", "error", "-nostdin",
           "-threads", "2", "-i", str(sources["base"]["path"]),
           "-i", str(sources["overlay"]["path"]),
           "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]",
           "-map", "[v]", "-frames:v", str(FRAME_COUNT),
           "-r", str(FRAME_RATE), "-fps_mode", "cfr",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(output)]
    subprocess.run(cmd, check=True, timeout=220)
    info = probe(output, ffprobe)
    if (info["stream"].get("nb_frames"), info["stream"].get("avg_frame_rate"),
        info["stream"].get("width"), info["stream"].get("height"), info["has_audio"]) != (
        str(FRAME_COUNT), f"{FRAME_RATE}/1", WIDTH, HEIGHT, False):
        raise Blocked("Output metadata mismatch")
    subprocess.run([str(ffmpeg), "-v", "error", "-nostdin", "-i",
                    str(output), "-f", "null", "NUL"], check=True, timeout=140)
    return {"status": "BAKED_CONTROL_FULL_DECODE", "sha256": digest(output),
            "bytes": output.stat().st_size, "frames": FRAME_COUNT,
            "seconds": info["duration"], "audio": False}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("mode", choices=["emit", "render"])
    p.add_argument("--manifest", type=Path, required=True)
    p.add_argument("--ffprobe", type=Path, required=True)
    p.add_argument("--ffmpeg", type=Path)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    try:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        if args.mode == "emit":
            result = emit(manifest, args.ffprobe, args.output)
        elif args.ffmpeg:
            result = render_reference(manifest, args.ffprobe, args.ffmpeg, args.output)
        else:
            raise Blocked("FFmpeg required for control")
        print(json.dumps(result, indent=2))
    except (KeyError, OSError, ValueError, subprocess.CalledProcessError,
            subprocess.TimeoutExpired) as exc:
        print(json.dumps({"status": "BLOCKED", "error": str(exc)}))
        return 2
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
