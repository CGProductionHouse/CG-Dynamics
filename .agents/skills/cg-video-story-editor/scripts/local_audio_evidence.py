#!/usr/bin/env python3
"""Offline acoustic/voice evidence for an exact decoded mix; never release approval.

Run acoustic in the isolated torch/transformers environment and voice in the
existing faster-whisper environment. Models must already exist locally. No
download, installation, playback, account change, network call or send.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path

LABELS = ["A person speaking without music.", "Instrumental music without any speech.",
          "Electronic beeping tones.", "White noise or hissing.",
          "A person speaking over instrumental background music.",
          "Instrumental hard rock with distorted electric guitars and strong drums.",
          "Instrumental funk music with a groovy bass line and syncopated rhythm.",
          "Calm atmospheric ambient music with soft sustained synthesizer textures.",
          "House dance music with an electronic four on the floor beat.",
          "Playful comedy music with bouncy cartoon character.",
          "Children music with playful nursery rhyme character."]
GROUPS = {"speech": [0], "music": [1, 5, 6, 7, 8, 9, 10], "tones": [2], "noise": [3], "mixed": [4]}


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def classify(cosines):
    """Hierarchical comparison, not a calibrated probability or a taste score."""
    if len(cosines) != len(LABELS):
        raise ValueError("Wrong acoustic prototype count")
    import math
    if not all(math.isfinite(float(v)) for v in cosines):
        raise ValueError("Nonfinite acoustic evidence")
    scores = {key: max(float(cosines[i]) for i in indices) for key, indices in GROUPS.items()}
    ranked = sorted(scores, key=scores.get, reverse=True)
    margin = scores[ranked[0]] - scores[ranked[1]]
    return {"kind": ranked[0] if margin >= .02 else "uncertain", "top_kind": ranked[0],
            "margin": margin, "scores": scores,
            "meaning": "Relative prototype similarity only; verify voice independently. Quiet decay, singing, unfamiliar sounds and overlap may be misclassified."}


def acoustic(args):
    import numpy as np
    import soundfile as sf
    import torch
    from scipy.signal import resample_poly
    from transformers import ClapModel, ClapProcessor
    torch.set_num_threads(4)
    torch.set_num_interop_threads(2)
    model_dir = Path(args.model).resolve(strict=True)
    receipt = json.loads((model_dir / "download-receipt.json").read_text())
    if receipt.get("complete") is not True:
        raise ValueError("Public model download has not been verified")
    for entry in receipt["files"]:
        if digest(model_dir / entry["name"]) != entry["sha256"]:
            raise ValueError("Pinned acoustic model source changed")
    weights = model_dir / "model.safetensors"
    if not args.weights_sha256 or digest(weights) != args.weights_sha256:
        raise ValueError("Restricted-conversion safetensors hash is missing or changed")
    if not torch.cuda.is_available() or torch.cuda.mem_get_info()[0] < 4 * 1024 ** 3:
        raise ValueError("Preserve staff GPU headroom; acoustic probe not started")
    torch.cuda.set_per_process_memory_fraction(.20)
    model = ClapModel.from_pretrained(str(model_dir), local_files_only=True, trust_remote_code=False,
                                      use_safetensors=True).to("cuda").eval()
    processor = ClapProcessor.from_pretrained(str(model_dir), local_files_only=True, trust_remote_code=False)
    audio, sr = sf.read(args.audio, dtype="float32", always_2d=True)
    audio = audio.mean(axis=1)
    rows = []
    for first in range(0, len(audio), 4 * sr):
        chunk = audio[first:first + 4 * sr]
        rms = float(np.sqrt(np.mean(chunk ** 2)))
        row = {"start": first / sr, "end": (first + len(chunk)) / sr,
               "rms_dbfs": float(20 * np.log10(max(rms, 1e-12)))}
        if rms < 1e-5:
            row.update(kind="uncertain", reason="Near-zero signal; no semantic music claim")
        else:
            samples = resample_poly(chunk, 48000, sr).astype("float32")
            assert len(samples) <= 4 * 48000  # Never the processor's random long-input truncation.
            inp = processor(text=LABELS, audio=[samples], sampling_rate=48000,
                            padding=True, return_tensors="pt").to("cuda")
            with torch.inference_mode():
                output = model(**inp)
            cosines = (output.audio_embeds @ output.text_embeds.T)[0].float().cpu().tolist()
            row.update(classify(cosines), cosines=cosines)
        rows.append(row)
    return {"role": "acoustic_grounding", "model_revision": receipt.get("revision"),
            "weights_sha256": digest(weights), "labels": LABELS, "groups": GROUPS,
            "duration": len(audio) / sr, "windows": rows,
            "qualification": "Bounded evidence only; mixed-speech failure is retained. ASR must independently guard speech. No music-fit approval from tags."}


def voice(args):
    from faster_whisper import WhisperModel
    model = WhisperModel(str(Path(args.model).resolve(strict=True)), device="cpu", compute_type="int8",
                         cpu_threads=4, num_workers=1, local_files_only=True)
    segments, _ = model.transcribe(args.audio, beam_size=1, language="en", vad_filter=True,
                                   condition_on_previous_text=False)
    rows = [{"text": s.text, "avg_logprob": s.avg_logprob, "no_speech_prob": s.no_speech_prob} for s in segments]
    credible = [s for s in rows if len(s["text"].split()) >= 3 and s["avg_logprob"] > -.8 and s["no_speech_prob"] < .5]
    return {"role": "speech_guard", "model": str(Path(args.model).resolve()), "segments": rows,
            "speech_detected": bool(credible), "meaning": "Words/voice evidence only. No timestamps, singing absence, full audio quality, or creative approval."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("role", choices=("acoustic", "voice"))
    parser.add_argument("--audio", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--weights-sha256")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    target = Path(args.output).resolve()
    if target.exists() or any((p / ".git").exists() for p in (target.parent, *target.parents)):
        raise ValueError("Use a new private evidence path outside Git")
    original = digest(args.audio)
    os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1",
                      TOKENIZERS_PARALLELISM="false", OMP_NUM_THREADS="4")
    result = acoustic(args) if args.role == "acoustic" else voice(args)
    if digest(args.audio) != original:
        raise ValueError("Input changed during review")
    result.update(audio=str(Path(args.audio).resolve()), audio_sha256=original,
                  created_at=datetime.now(timezone.utc).isoformat(), human_listening="not_recorded", creative_release=False)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(str(target))


if __name__ == "__main__":
    main()
