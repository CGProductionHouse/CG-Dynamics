"""Synthetic too-hot transient versus whole-track gain and master limiter.

Usage: python render_peak_ab.py SOURCE_PCM16_WAV OUTPUT_DIR
No client media, music, or creative sound approval is involved.
"""

import argparse
import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy.io import wavfile


def read_voice(path: Path):
    with wave.open(str(path), "rb") as wav:
        if wav.getnchannels() != 1 or wav.getsampwidth() != 2:
            raise ValueError("Expected mono PCM16 voice")
        rate = wav.getframerate()
        values = np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2")
    return rate, values.astype(np.float64) / 32768.0


def encode(source: Path, destination: Path, filter_graph: str):
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
         "-af", filter_graph, "-ar", "48000", "-ac", "2", "-c:a", "aac", "-b:a",
         "192k", str(destination)],
        check=True,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    rate, voice = read_voice(args.source)
    first, last = int(0.6 * rate), int(2.5 * rate)
    centre = first + int(np.argmax(np.abs(voice[first:last])))
    t = (np.arange(len(voice)) - centre) / rate
    sign = np.sign(voice[centre]) or 1.0
    spike = 0.95 * np.exp(-((t / 0.006) ** 2)) * np.cos(2 * np.pi * 900 * t) * sign
    hot = voice + spike
    float_source = args.output / "synthetic-hot-float.wav"
    wavfile.write(float_source, rate, hot.astype("<f4"))
    print(f"Source peak {np.max(np.abs(voice)):.4f}; hot float peak {np.max(np.abs(hot)):.4f}; transient at {centre/rate:.4f}s")
    encode(float_source, args.output / "synthetic-hot-raw.m4a", "aresample=48000")
    encode(float_source, args.output / "synthetic-hot-gain.m4a",
           "aresample=48000,volume=-7dB")
    encode(float_source, args.output / "synthetic-hot-limited.m4a",
           "aresample=48000,alimiter=limit=0.65:attack=5:release=60:level=0:latency=1")
