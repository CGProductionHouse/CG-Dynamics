"""Bounded local depth-flash reconstruction; not a video rendering engine.

Run in an isolated CPU torch/transformers environment. No downloads or remote code.
Inputs must be the pinned licensed walker, cue and Small model from the skill card.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import wave
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw
from transformers import AutoImageProcessor, AutoModelForDepthEstimation

W, H, FPS, COUNT = 640, 360, 24, 48
PULSES = (24, 25)
HASHES = {
    "source": "de17d355543cda1f396361d2e217ae115c9be5eb60efe22cce0fc6a3d517d54d",
    "cue": "02b8cd40b3761288d54f4d6706983a2f8c110182b669ae2cdf9aab02935a4e7a",
    "config.json": "c56698d3643dde1f83ea2212759e6b31a22b8f827246a36dd007ee8a22b3ff75",
    "preprocessor_config.json": "d41175c0d889477ca8fc67191e540faef14baf6275157b3fdecf78469e6bbf84",
    "model.safetensors": "3152477ce0d8d6978d76b995120de97cb5b928701fd0f817769f59e249a16b70",
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(*args: str) -> bytes:
    return subprocess.check_output(["ffmpeg", "-v", "error", *map(str, args)])


def encode(path: Path, frames: np.ndarray) -> None:
    subprocess.run([
        "ffmpeg", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
        "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264", "-g", "1", "-qp", "18",
        "-pix_fmt", "yuv420p", str(path),
    ], input=frames.tobytes(), check=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, required=True)
    ap.add_argument("--cue", type=Path, required=True)
    ap.add_argument("--model-dir", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    args = ap.parse_args()
    for name in HASHES:
        path = getattr(args, name) if name in ("source", "cue") else args.model_dir / name
        if sha(path) != HASHES[name]:
            raise ValueError(f"Changed or wrong pinned input: {name}")
    args.output_dir.mkdir(parents=True, exist_ok=False)
    torch.set_num_threads(2)
    torch.set_num_interop_threads(1)
    plain = np.frombuffer(run(
        "-ss", "2", "-i", args.source, "-vf", f"fps={FPS},scale={W}:{H}", "-frames:v", str(COUNT),
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
    ), dtype=np.uint8).reshape(COUNT, H, W, 3)
    processor = AutoImageProcessor.from_pretrained(args.model_dir, local_files_only=True)
    model = AutoModelForDepthEstimation.from_pretrained(
        args.model_dir, local_files_only=True, use_safetensors=True,
    ).cpu().eval()
    depths = []
    with torch.inference_mode():
        for n in PULSES:
            inputs = processor(images=Image.fromarray(plain[n]), return_tensors="pt")
            pred = model(**inputs).predicted_depth[:, None]
            depths.append(torch.nn.functional.interpolate(
                pred, size=(H, W), mode="bicubic", align_corners=False,
            )[0, 0].numpy())
    # One range over the tested pair; independent per-frame normalisation can pump.
    lo, hi = float(np.min(depths)), float(np.max(depths))
    normal = np.clip((np.asarray(depths) - lo) / max(hi - lo, 1e-8), 0, 1)
    versions = {name: plain.copy() for name in ("plain", "luminance", "flat-mask", "depth")}
    for j, n in enumerate(PULSES):
        lum = np.rint(plain[n] @ np.array([.2126, .7152, .0722])).astype(np.uint8)
        dep = np.rint(normal[j] * 255).astype(np.uint8)
        flat = np.where(normal[j] > .55, 244, 16).astype(np.uint8)
        # Opposite-polarity pair is a lab reconstruction, not a default client flash.
        for name, layer in (("luminance", lum), ("flat-mask", flat), ("depth", dep)):
            if j == 1:
                layer = 255 - layer
            versions[name][n] = np.repeat(layer[:, :, None], 3, axis=2)
    receipt = {"source_sha256": HASHES["source"], "cue_sha256": HASHES["cue"],
               "model_hashes": {k:v for k,v in HASHES.items() if k not in ("source", "cue")},
               "frames": COUNT, "fps": FPS, "pulse_frames": list(PULSES),
               "depth_range": [lo, hi], "device": "cpu", "torch": torch.__version__,
               "review": "mechanical controls only; unreviewed normal-speed comfort/sound"}
    for name, frames in versions.items():
        encode(args.output_dir / f"{name}.mp4", frames)
    contact = Image.new("RGB", (W * 2, (H + 22) * 4))
    draw = ImageDraw.Draw(contact)
    for row, (name, frames) in enumerate(versions.items()):
        for col, n in enumerate(PULSES):
            x, y = col * W, row * (H + 22)
            contact.paste(Image.fromarray(frames[n]), (x, y + 22))
            draw.text((x + 4, y + 4), f"{name} f{n}", fill="white")
    contact.save(args.output_dir / "controls.jpg", quality=94)
    contact.resize((640, 764)).save(args.output_dir / "small-controls.jpg", quality=94)

    cue = np.frombuffer(run("-i", args.cue, "-ar", "48000", "-ac", "2", "-f", "f32le", "-"),
                        dtype="<f4").reshape(-1, 2)
    energy = np.mean(cue.astype(float) ** 2, axis=1)
    window = np.convolve(energy, np.ones(480) / 480, mode="same")
    cue_peak = int(np.argmax(window))
    # Short source window around its real energy peak; do not carry a whole
    # long whoosh merely because the graphic itself occupies two frames.
    source_lo = max(0, cue_peak - 8640)
    source_hi = min(len(cue), cue_peak + 8640)
    cue_window = cue[source_lo:source_hi].copy()
    fade = min(384, len(cue_window) // 2)
    cue_window[:fade] *= np.linspace(0, 1, fade)[:, None]
    cue_window[-fade:] *= np.linspace(1, 0, fade)[:, None]
    start = 48000 - (cue_peak - source_lo)
    full = np.zeros((96000, 2), dtype=np.float32)
    src_lo, dst_lo = max(0, -start), max(0, start)
    count = min(len(cue_window) - src_lo, len(full) - dst_lo)
    full[dst_lo:dst_lo+count] = cue_window[src_lo:src_lo+count]
    full *= 10 ** (-16 / 20) / max(float(np.max(np.abs(full))), 1e-9)
    wav = args.output_dir / "transition-cue.wav"
    with wave.open(str(wav), "wb") as w:
        w.setparams((2, 2, 48000, 0, "NONE", "not compressed"))
        w.writeframes(np.rint(full * 32767).astype("<i2").tobytes())
    for name in ("plain", "depth"):
        run("-i", args.output_dir/f"{name}.mp4", "-i", wav, "-c:v", "copy", "-c:a", "aac",
            "-b:a", "192k", "-t", "2", args.output_dir/f"{name}-cue.mp4")
    receipt["cue_10ms_energy_peak_target_seconds"] = 1.0
    receipt["cue_source_start_sample"] = start
    receipt["cue_original_source_window"] = [source_lo, source_hi]
    receipt["cue_edge_fade_samples"] = fade
    receipt["cue_source_trimmed_lead_samples"] = src_lo
    receipt["outputs"] = {f.name: sha(f) for f in args.output_dir.glob("*.mp4")}
    (args.output_dir / "receipt.json").write_text(json.dumps(receipt, indent=2), encoding="utf8")
    print(json.dumps({"outputs": len(receipt["outputs"]), "pulse_frames": list(PULSES), "device": "cpu"}))


if __name__ == "__main__":
    main()
