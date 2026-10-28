"""Bounded local audio-model control test; never sends media off this machine."""

import argparse
import base64
from hashlib import sha256
import io
import json
import math
from pathlib import Path
import subprocess
import urllib.request
import wave

ROOT = Path(__file__).resolve().parent
CUE = ROOT / "proof-fight-bag-sound-one-cue.mp4"
CUE_SHA = "59b6f0989dd9adacd4bbc1ce22e0433a6841ed2cdd36c8a89a97142eda2085a4"
ENDPOINT = "http://127.0.0.1:11434/v1/chat/completions"
RATE = 16000
PROMPT = (
    "Classify this audio as silence, a steady electronic tone, a percussive hit, "
    "speech, music, or other. Describe only audible evidence in one sentence. "
    "If uncertain, say uncertain; do not invent a scene."
)


def make_wav(samples: list[int]) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(RATE)
        stream.writeframes(b"".join(sample.to_bytes(2, "little", signed=True) for sample in samples))
    return buffer.getvalue()


def ask(model: str, label: str, audio: bytes) -> dict:
    message = {
        "role": "user",
        "content": [
            {"type": "input_audio", "input_audio": {"data": base64.b64encode(audio).decode(), "format": "wav"}},
            {"type": "text", "text": PROMPT},
        ],
    }
    body = json.dumps({
        "model": model,
        "messages": [message],
        "temperature": 0,
        "max_tokens": 100,
        "reasoning_effort": "none",
    }).encode()
    request = urllib.request.Request(ENDPOINT, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=300) as response:
        result = json.load(response)
    return {
        "label": label,
        "audio_sha256": sha256(audio).hexdigest(),
        "answer": result["choices"][0]["message"]["content"],
        "prompt_tokens": result["usage"]["prompt_tokens"],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="gemma4:e4b")
    args = parser.parse_args()
    if not CUE.exists() or sha256(CUE.read_bytes()).hexdigest() != CUE_SHA:
        raise SystemExit("Pinned practice cue is missing or changed")
    silence = make_wav([0] * RATE)
    tone = make_wav([int(8000 * math.sin(2 * math.pi * 440 * i / RATE)) for i in range(RATE)])
    cue = subprocess.check_output([
        "ffmpeg", "-v", "error", "-i", str(CUE), "-map", "0:a:0", "-ac", "1", "-ar", str(RATE),
        "-acodec", "pcm_s16le", "-f", "wav", "-",
    ])
    for label, audio in (("silence", silence), ("steady_440hz_tone", tone), ("bag_contact_candidate", cue)):
        print(json.dumps(ask(args.model, label, audio), ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
