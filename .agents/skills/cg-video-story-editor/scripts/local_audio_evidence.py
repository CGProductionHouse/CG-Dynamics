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
import subprocess
import sys

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


def gpu_budget(torch_free, driver_free_mib):
    """WDDM CUDA free can omit graphics allocations; use the smaller reading."""
    try:
        driver = int(driver_free_mib.strip()) * 1024 ** 2
    except (ValueError, AttributeError) as exc:
        raise ValueError("Cannot verify physical GPU headroom") from exc
    if driver <= 0 or torch_free <= 0:
        raise ValueError("Invalid GPU headroom")
    return min(int(torch_free), driver)


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
    device = args.device
    if device == "cuda":
        if not torch.cuda.is_available():
            raise ValueError("No local CUDA device; acoustic probe not started")
        driver = subprocess.run(["nvidia-smi", "--id=0", "--query-gpu=memory.free",
                                 "--format=csv,noheader,nounits"], capture_output=True,
                                text=True, check=True, timeout=10)
        if gpu_budget(torch.cuda.mem_get_info()[0], driver.stdout) < 4 * 1024 ** 3:
            raise ValueError("Preserve staff GPU headroom; acoustic probe not started")
        torch.cuda.set_per_process_memory_fraction(.20)
    elif device != "cpu":
        raise ValueError("Unsupported acoustic device")
    model = ClapModel.from_pretrained(str(model_dir), local_files_only=True, trust_remote_code=False,
                                      use_safetensors=True).to(device).eval()
    processor = ClapProcessor.from_pretrained(str(model_dir), local_files_only=True, trust_remote_code=False)
    audio, sr = sf.read(args.audio, dtype="float32", always_2d=True)
    if device == "cpu" and len(audio) / sr > 60:
        raise ValueError("CPU acoustic proof is limited to 60 seconds per input")
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
                            padding=True, return_tensors="pt").to(device)
            with torch.inference_mode():
                output = model(**inp)
            cosines = (output.audio_embeds @ output.text_embeds.T)[0].float().cpu().tolist()
            row.update(classify(cosines), cosines=cosines)
        rows.append(row)
    return {"role": "acoustic_grounding", "model_revision": receipt.get("revision"),
            "weights_sha256": digest(weights), "labels": LABELS, "groups": GROUPS,
            "duration": len(audio) / sr, "device": device, "windows": rows,
            "qualification": "Bounded evidence only; mixed-speech failure is retained. ASR must independently guard speech. No music-fit approval from tags."}


def voice(args):
    import numpy as np
    from faster_whisper import WhisperModel
    model = WhisperModel(str(Path(args.model).resolve(strict=True)), device="cpu", compute_type="int8",
                         cpu_threads=4, num_workers=1, local_files_only=True)
    # Supply decoded PCM directly. The installed PyAV and faster-whisper versions
    # disagree on av.open(metadata_errors=...), so passing a path fails before
    # inference. FFmpeg is already required by the shared workflow; its explicit
    # decode avoids adding soundfile/scipy to the separate voice environment.
    decoded = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", args.audio, "-vn", "-ac", "1",
         "-ar", "16000", "-f", "f32le", "pipe:1"],
        capture_output=True, check=True, timeout=180,
    )
    mono_16k = np.frombuffer(decoded.stdout, dtype="<f4").copy()
    if not len(mono_16k):
        raise ValueError("Voice guard decoded no audio samples")
    segments, _ = model.transcribe(mono_16k, beam_size=1, language="en", vad_filter=True,
                                   condition_on_previous_text=False)
    rows = [{"text": s.text, "avg_logprob": s.avg_logprob, "no_speech_prob": s.no_speech_prob} for s in segments]
    credible = [s for s in rows if len(s["text"].split()) >= 3 and s["avg_logprob"] > -.8 and s["no_speech_prob"] < .5]
    return {"role": "speech_guard", "model": str(Path(args.model).resolve()), "segments": rows,
            "speech_detected": bool(credible), "meaning": "Words/voice evidence only. No timestamps, singing absence, full audio quality, or creative approval."}


def character_qualification(path):
    record = json.loads(Path(path).read_text(encoding="utf-8"))
    if record.get("role") != "music_character" or record.get("status") != "passed":
        raise ValueError("Missing passed music-character qualification; broad reviewer failures cannot qualify it")
    if hashlib.sha256(record.get("prompt", "").encode()).hexdigest() != record.get("prompt_sha256"):
        raise ValueError("Music-character prompt changed")
    bindings = [record.get("declaration")]
    observations = record.get("observations", [])
    if len(observations) < 2 or len({r.get("id") for r in observations}) != len(observations):
        raise ValueError("Missing distinct music-character controls")
    for row in observations:
        if row.get("passed") is not True:
            raise ValueError("Unpassed music-character control")
        bindings.extend([row.get("input"), row.get("raw_observation")])
    for binding in bindings:
        if not isinstance(binding, dict) or not binding.get("path") or digest(binding["path"]) != binding.get("sha256"):
            raise ValueError("Music-character calibration artifact changed")
    return record


def character(args):
    """One qualified perceptual role, never a full-review fallback."""
    import numpy as np
    import soundfile as sf
    import torch
    from scipy.signal import resample_poly
    from transformers import BitsAndBytesConfig
    if not args.qualification or not args.source_audit or not args.guards:
        raise ValueError("Character review needs qualification, audited source and exact passed input guards")
    qualification = character_qualification(args.qualification)
    guards = json.loads(Path(args.guards).read_text(encoding="utf-8"))
    if guards.get("status") != "REVIEWABLE_INSTRUMENTAL_MIX" or guards.get("analysis_sha256") != digest(args.audio):
        raise ValueError("Music critic cannot receive a failed, unknown or different mix")
    torch.set_num_threads(4)
    torch.set_num_interop_threads(1)
    driver = subprocess.run(["nvidia-smi", "--id=0", "--query-gpu=memory.free", "--format=csv,noheader,nounits"],
                            capture_output=True, text=True, check=True, timeout=10)
    if gpu_budget(torch.cuda.mem_get_info()[0], driver.stdout) < 9 * 1024 ** 3:
        raise ValueError("Insufficient staff GPU headroom for the existing local music critic")
    torch.cuda.set_per_process_memory_fraction(.45)
    source = Path(args.source_audit).resolve(strict=True)
    commit = json.loads((source / "source-commit.json").read_text())["sha"]
    if commit != qualification.get("source_commit"):
        raise ValueError("Music critic source version changed")
    for entry in qualification["source_files"]:
        if digest(source / entry["path"]) != entry["sha256"]:
            raise ValueError("Audited local music-critic source changed")
    weights = Path(args.model).resolve(strict=True)
    manifest = json.loads((weights.parent / "moss-download-receipt.json").read_text())
    if manifest.get("complete") is not True or manifest.get("revision") != qualification.get("model_revision"):
        raise ValueError("Music critic checkpoint differs from calibration")
    for entry in manifest["files"]:
        if digest(weights / entry["name"]) != entry["sha256"]:
            raise ValueError("Pinned music-critic weights changed")
    sys.path.insert(0, str(source))
    from src.modeling_moss_audio import MossAudioModel
    from src.processing_moss_audio import MossAudioProcessor
    if os.name == "nt":
        import ctypes
        ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x4000)
    audio, sr = sf.read(args.audio, dtype="float32", always_2d=True)
    if not 0 < len(audio) / sr <= 30.1:
        raise ValueError("Bounded critic supports up to30s; never truncate longer input")
    import math
    divisor = math.gcd(sr, 16000)
    audio = resample_poly(audio.mean(axis=1), 16000 // divisor, sr // divisor).astype("float32")
    quant = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.bfloat16,
                              llm_int8_skip_modules=["audio_encoder", "audio_adapter", "deepstack_audio_merger_list"])
    model = MossAudioModel.from_pretrained(str(weights), local_files_only=True, trust_remote_code=False,
            use_safetensors=True, torch_dtype=torch.bfloat16, quantization_config=quant,
            device_map={"": 0}, attn_implementation="sdpa").eval()
    processor = MossAudioProcessor.from_pretrained(str(weights), local_files_only=True, enable_time_marker=True)
    inp = processor(text=qualification["prompt"], audios=[audio], return_tensors="pt").to("cuda")
    inp["audio_data"] = inp["audio_data"].to(model.dtype)
    inp["audio_input_mask"] = inp["input_ids"] == processor.audio_token_id
    with torch.inference_mode():
        generated = model.generate(**inp, max_new_tokens=320, do_sample=False, num_beams=1, use_cache=True)
    response = processor.decode(generated[0, inp["input_ids"].shape[1]:], skip_special_tokens=True)
    return {"role": "music_character", "response": response, "audio_received": True,
            "input_samples_16k": len(audio), "model_revision": manifest["revision"], "source_commit": commit,
            "qualification_sha256": digest(args.qualification), "guards_sha256": digest(args.guards),
            "prompt_sha256": qualification["prompt_sha256"],
            "scope": "Texture/drive/emotional character only. Editor must compare actual observations against buyer/pictures and rejected music. Timing, speech, transition/sound-source and final release are separate roles."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("role", choices=("acoustic", "voice", "character"))
    parser.add_argument("--audio", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--weights-sha256")
    parser.add_argument("--device", choices=("cuda", "cpu"), default="cuda",
                        help="Acoustic role only; CPU is explicit and bounded, CUDA remains the default")
    parser.add_argument("--qualification")
    parser.add_argument("--source-audit")
    parser.add_argument("--guards")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    target = Path(args.output).resolve()
    if target.exists() or any((p / ".git").exists() for p in (target.parent, *target.parents)):
        raise ValueError("Use a new private evidence path outside Git")
    original = digest(args.audio)
    os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1",
                      TOKENIZERS_PARALLELISM="false", OMP_NUM_THREADS="4")
    result = {"acoustic": acoustic, "voice": voice, "character": character}[args.role](args)
    if digest(args.audio) != original:
        raise ValueError("Input changed during review")
    result.update(audio=str(Path(args.audio).resolve()), audio_sha256=original,
                  created_at=datetime.now(timezone.utc).isoformat(), human_listening="not_recorded", creative_release=False)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(str(target))


if __name__ == "__main__":
    main()
