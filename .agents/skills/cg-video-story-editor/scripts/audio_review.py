#!/usr/bin/env python3
"""Local-only audio review packets and a fail-closed owner-handoff check.

Uses existing ffmpeg/ffprobe; no network, provider key, Premiere mutation or send.
Run with --help. Client packets/feedback must stay outside the repository.
"""
import argparse
from array import array
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import sys
import wave

AREAS = ("entrance", "continuity", "transitions", "ending", "mood")


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def run(args):
    result = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300)
    if result.returncode:
        raise ValueError(f"{args[0]} failed: {result.stderr[-1500:]}")
    return result


def new_directory(path):
    target = Path(path).resolve()
    # Reports contain private paths and feedback; never create them in a checkout.
    if any((p / ".git").exists() for p in (target, *target.parents)):
        raise ValueError("Choose a private output outside a Git checkout")
    target.mkdir(parents=True, exist_ok=False)
    return target


def context_files(kit):
    kit = Path(kit).resolve(strict=True)
    paths = set()
    for pattern in ("LATEST-EDIT.*", "*feedback*.json", "*FEEDBACK*.md", "REVISION-BASELINE*.md",
                    "brand/BRAND_REFERENCE.md", "audio/AUDIO_INDEX.md"):
        paths.update(p for p in kit.glob(pattern) if p.is_file())
    return sorted(paths)


def snapshot_context(kit, output):
    files = context_files(kit)
    if not any(p.name.startswith("LATEST-EDIT.") for p in files):
        raise ValueError("Client kit needs LATEST-EDIT.md or .json; populate it from verified context first")
    entries = [{"path": str(p), "sha256": digest(p), "text": p.read_text(encoding="utf-8-sig")} for p in files]
    target = new_directory(output)
    write_json(target / "context.json", {"schema": 1, "created_at": utc_now(), "client_kit": str(Path(kit).resolve()), "files": entries})
    (target / "READ-BEFORE-EDIT.md").write_text(
        "# Current client feedback and baseline\n\nPrivate context; do not upload this to Gemini.\n\n" +
        "\n\n".join(f"## {Path(e['path']).name}\n\n{e['text']}" for e in entries), encoding="utf-8")
    return target


def context_errors(context):
    errors = []
    actual = context_files(context["client_kit"])
    recorded = {entry["path"] for entry in context["files"]}
    if {str(p) for p in actual} != recorded:
        errors.append("Client feedback file set changed; retrieve context again")
    for entry in context["files"]:
        p = Path(entry["path"])
        if not p.is_file() or digest(p) != entry["sha256"]:
            errors.append(f"Client context changed: {p.name}")
    return errors


def validate_intent(intent, duration):
    for field in ("buyer", "message", "music_fit", "opening_design", "ending_design", "feedback_applied"):
        if not isinstance(intent.get(field), str) or not intent[field].strip():
            raise ValueError(f"Audio intent needs {field}")
    for item in intent.get("allowed_silence", []):
        start, end = float(item["start"]), float(item["end"])
        if not 0 <= start < end <= duration + .1 or not item.get("reason", "").strip():
            raise ValueError("Intentional silence needs valid start/end and a story reason")


def parse_measurements(log, duration):
    metrics = re.findall(r'\{\s*"input_i".*?\}', log, re.S)
    if not metrics:
        raise ValueError("No loudness measurement returned")
    loudness = json.loads(metrics[-1])
    silences, start = [], None
    for match in re.finditer(r"silence_(start|end):\s*(-?[\d.]+)", log):
        when = max(0, float(match[2]))
        if match[1] == "start":
            start = when
        elif start is not None:
            silences.append({"start": start, "end": min(duration, when)})
            start = None
    if start is not None:
        silences.append({"start": start, "end": duration})
    return {"integrated_lufs": float(loudness["input_i"]),
            "true_peak_dbtp": float(loudness["input_tp"]), "silences": silences}


def envelope(path):
    values = []
    with wave.open(str(path), "rb") as source:
        frames = source.getframerate() // 10
        at = 0
        while block := source.readframes(frames):
            samples = array("h", block)
            if sys.byteorder != "little":
                samples.byteswap()
            rms = math.sqrt(sum(v * v for v in samples) / len(samples)) / 32768
            values.append({"start": round(at, 3), "rms_dbfs": round(20 * math.log10(max(rms, 1e-9)), 2)})
            at += len(samples) / source.getnchannels() / source.getframerate()
    return values, at


def technical_errors(signal, intent):
    errors = []
    for field in ("integrated_lufs", "true_peak_dbtp"):
        if not math.isfinite(signal[field]):
            errors.append(f"Invalid or silent mix: {field}")
    if signal["true_peak_dbtp"] >= 0:
        errors.append("True peak at/above 0 dBTP; inspect clipping")
    if signal["pcm_duration"] < signal["duration"] - .08:
        errors.append("Audio stream ends before picture")
    for silence in signal["silences"]:
        if not any(float(s["start"]) <= silence["start"] + .03 and
                   float(s["end"]) >= silence["end"] - .03 for s in intent.get("allowed_silence", [])):
            errors.append(f"Unexplained silence {silence['start']:.2f}-{silence['end']:.2f}s")
    return errors


def prepare(video, intent_path, context_path, output):
    video, intent_path, context_path = (Path(p).resolve(strict=True) for p in (video, intent_path, context_path))
    video_hash = digest(video)
    context, intent = read_json(context_path), read_json(intent_path)
    errors = context_errors(context)
    if errors:
        raise ValueError("; ".join(errors))
    probe = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)]).stdout)
    picture = next((s for s in probe["streams"] if s["codec_type"] == "video"), None)
    if picture is None or not any(s["codec_type"] == "audio" for s in probe["streams"]):
        raise ValueError("Final export must have picture and audio")
    duration = float(picture.get("duration") or probe["format"]["duration"])
    if not 0 < duration <= 600:
        raise ValueError("This bounded social-film helper supports up to 600 seconds")
    validate_intent(intent, duration)
    target = new_directory(output)
    wav, mp3 = target / "local-analysis.wav", target / "Mix.mp3"
    # Decode exact rendered mix, never rebuild the soundtrack from timeline sources.
    run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(video), "-map", "0:a:0", "-vn", "-map_metadata", "-1",
         "-ac", "2", "-ar", "24000", "-c:a", "pcm_s16le", "-n", str(wav)])
    run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(wav), "-map_metadata", "-1", "-c:a", "libmp3lame", "-q:a", "2", "-n", str(mp3)])
    measured = run(["ffmpeg", "-nostdin", "-hide_banner", "-i", str(video), "-map", "0:a:0", "-vn",
                    "-af", "silencedetect=noise=-50dB:d=0.35,loudnorm=print_format=json", "-f", "null", "-"])
    signal = parse_measurements(measured.stderr, duration)
    bins, pcm_duration = envelope(wav)
    signal.update({"duration": duration, "pcm_duration": pcm_duration, "rms_100ms": bins})
    # JSON never contains Infinity/NaN; silent mixes remain explicit failures.
    failures = technical_errors(signal, intent)
    for key in ("integrated_lufs", "true_peak_dbtp"):
        if not math.isfinite(signal[key]):
            signal[key] = None
    signal["failures"] = failures
    write_json(target / "signal.json", signal)
    if digest(video) != video_hash:
        raise ValueError("Export changed during analysis; use a completed, uniquely named render")
    packet = {"schema": 1, "created_at": utc_now(), "video": str(video), "video_sha256": video_hash,
              "audio": str(mp3), "audio_sha256": digest(mp3), "intent": intent,
              "context": context, "context_source": str(context_path), "signal": signal,
              "status": "TECHNICAL_FAILURE" if failures else "GEMINI_REVIEW_REQUIRED"}
    write_json(target / "packet.json", packet)
    prompt = """Listen to the attached final mix. First confirm you can consume its actual audio; if not, stop.
Describe the first audible sounds and entrance, music continuity/resets/dropouts, SFX balance and tails,
the ending/fade, vocal-like distractions, and musical fit for the buyer/message below. Do not imagine video
or claim picture-sync/client approval. Give approximate timestamps and confidence. Separate observation
from taste. Say when uncertain; no invented instruments/beat times. Return at most three actionable issues.
Do not browse. First describe what you actually hear, then compare it with this stated creative intent:
""" + json.dumps({k: intent[k] for k in ("buyer", "message", "music_fit", "opening_design", "ending_design")}, indent=2)
    (target / "gemini-prompt.txt").write_text(prompt + "\n", encoding="utf-8")
    write_json(target / "review.json", {"audio_sha256": packet["audio_sha256"], "provider": "Google AI Studio",
        "model": "", "audio_received": False, "response_path": "gemini-response.txt", "response_sha256": "",
        "verdict": "pending", "reviewed_at": "", "editor": "", "checks": {
            area: {"status": "pending", "evidence": ""} for area in AREAS},
        "findings": [], "human_listening": "not_recorded"})
    return target


def gate(packet_path, review_path):
    packet, review = read_json(packet_path), read_json(review_path)
    errors = []
    for field in ("video", "audio"):
        p = Path(packet[field])
        if not p.is_file() or digest(p) != packet[field + "_sha256"]:
            errors.append(f"Stale or missing {field}; prepare/review the exact current export")
    errors.extend(context_errors(packet["context"]))
    errors.extend(packet["signal"]["failures"])
    if review.get("audio_sha256") != packet["audio_sha256"]:
        errors.append("Review belongs to a different mix")
    if review.get("audio_received") is not True or review.get("verdict") != "no_blocking_issue":
        errors.append("Gemini review missing, unable to review, or needs work")
    for key in ("model", "reviewed_at", "editor"):
        if not isinstance(review.get(key), str) or not review[key].strip():
            errors.append(f"Missing review {key}")
    response = Path(review.get("response_path") or "__missing__")
    if not response.is_absolute():
        response = Path(review_path).resolve().parent / response
    if not response.is_file() or not response.stat().st_size or digest(response) != review.get("response_sha256"):
        errors.append("Original model response missing or changed")
    for area in AREAS:
        check = review.get("checks", {}).get(area, {})
        if check.get("status") != "pass" or not check.get("evidence", "").strip():
            errors.append(f"Unresolved editor audio check: {area}")
    for item in review.get("findings", []):
        if item.get("disposition") not in ("fixed_and_rechecked", "not_reproduced", "intentional") or not item.get("evidence", "").strip():
            errors.append("Unresolved model finding")
    return {"status": "BLOCKED" if errors else "AUDIO_CHECKED_FOR_OWNER_REVIEW",
            "errors": errors, "human_listening": review.get("human_listening", "not_recorded"),
            "client_or_publication_approval": False, "checked_at": utc_now(), "video_sha256": packet["video_sha256"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    ctx = sub.add_parser("context", help="Retrieve current client feedback before planning; private local output")
    ctx.add_argument("--client-kit", required=True)
    ctx.add_argument("--output", required=True)
    prep = sub.add_parser("prepare", help="Extract exact final mix and build review packet; no upload")
    for arg in ("video", "intent", "context", "output"):
        prep.add_argument("--" + arg, required=True)
    check = sub.add_parser("check", help="Refuse stale/incomplete/failed review before owner handoff")
    check.add_argument("--packet", required=True)
    check.add_argument("--review", required=True)
    args = parser.parse_args()
    try:
        if args.command == "context":
            print(snapshot_context(args.client_kit, args.output))
        elif args.command == "prepare":
            print(prepare(args.video, args.intent, args.context, args.output))
        else:
            result = gate(args.packet, args.review)
            print(json.dumps(result, indent=2))
            return 1 if result["errors"] else 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.TimeoutExpired) as exc:
        print(f"AUDIO REVIEW BLOCKED: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
