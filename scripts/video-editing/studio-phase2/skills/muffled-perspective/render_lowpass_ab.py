"""Bounded dry/low-pass synthetic-speech proof; not a client mix.

Usage: python render_lowpass_ab.py INPUT_WAV OUTPUT_DIR
The source is a local SAPI voice, not a client recording or a tutorial soundtrack.
"""

import argparse
import json
import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfiltfilt, welch


def read_mono_pcm16(path: Path):
    with wave.open(str(path), "rb") as wav:
        if wav.getnchannels() != 1 or wav.getsampwidth() != 2:
            raise ValueError("Expected mono PCM16 WAV")
        rate = wav.getframerate()
        data = np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2")
    return rate, data.astype(np.float64) / 32768.0


def save_wav(path: Path, rate: int, samples: np.ndarray):
    clipped = np.clip(samples, -1, 1 - 1 / 32768)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(np.round(clipped * 32768).astype("<i2").tobytes())


def encode(wav: Path, out: Path):
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav),
         "-ar", "48000", "-ac", "2", "-c:a", "aac", "-b:a", "192k", str(out)],
        check=True,
    )


def high_band_power(samples, rate, start, end):
    section = samples[int(start * rate):int(end * rate)]
    freq, power = welch(section, rate, nperseg=2048)
    return float(np.trapezoid(power[freq >= 2500], freq[freq >= 2500]))


def main(source: Path, output: Path):
    output.mkdir(parents=True, exist_ok=True)
    rate, dry = read_mono_pcm16(source)
    # This is an intentionally obvious muffled perspective, not a voice repair.
    filtered = sosfiltfilt(butter(2, 1600, btype="lowpass", fs=rate, output="sos"), dry)
    t = np.arange(len(dry)) / rate
    # 90 ms ramps avoid a hard filter-state switch; source time and duration stay fixed.
    envelope = np.clip((t - 0.30) / 0.09, 0, 1) * np.clip((2.25 - t) / 0.09, 0, 1)
    window = dry * (1 - envelope) + filtered * envelope

    for name, values in (("dry", dry), ("filtered", filtered), ("window", window)):
        path = output / f"synthetic-{name}.wav"
        save_wav(path, rate, values)
        encode(path, output / f"synthetic-{name}.m4a")

    dry_hi = high_band_power(dry, rate, 0.55, 1.95)
    wet_hi = high_band_power(filtered, rate, 0.55, 1.95)
    receipt = {
        "source": str(source),
        "sample_rate": rate,
        "samples": len(dry),
        "duration_seconds": len(dry) / rate,
        "lowpass_hz": 1600,
        "order": 2,
        "window_ramp_seconds": 0.09,
        "window_start_seconds": 0.30,
        "window_end_seconds": 2.25,
        "dry_high_band_power_ge_2500_hz": dry_hi,
        "filtered_high_band_power_ge_2500_hz": wet_hi,
        "high_band_reduction_db": 10 * np.log10(wet_hi / dry_hi),
        "dry_peak_dbfs": 20 * np.log10(np.max(np.abs(dry))),
        "window_peak_dbfs": 20 * np.log10(np.max(np.abs(window))),
    }
    (output / "receipt.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    main(args.source, args.output)
