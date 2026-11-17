"""Generate disposable, client-free media for the CapCut compatibility probe."""

from pathlib import Path
import math
import subprocess
import sys
import wave

from PIL import Image, ImageDraw


def main(out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    colors = ("0x14213D", "0x176B87", "0xD95D39")
    for index, color in enumerate(colors, 1):
        subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-f", "lavfi", "-i", f"color=c={color}:s=720x1280:r=25:d=4",
                "-vf", "drawbox=x=90:y=400:w=540:h=480:color=white@0.11:t=fill",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", str(out / f"scene-{index}.mp4"),
            ],
            check=True,
        )

    # A graphic human silhouette is deliberately synthetic and transparent.
    image = Image.new("RGBA", (720, 1280), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    fill = (16, 27, 37, 255)
    draw.ellipse((264, 408, 456, 600), fill=fill)
    draw.rounded_rectangle((204, 570, 516, 1080), radius=120, fill=fill)
    draw.polygon([(224, 700), (90, 1000), (210, 1050), (310, 740)], fill=fill)
    draw.polygon([(496, 700), (630, 1000), (510, 1050), (410, 740)], fill=fill)
    image.save(out / "synthetic-person.png")

    sample_rate = 48000
    with wave.open(str(out / "synthetic-tone.wav"), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(sample_rate)
        samples = bytearray()
        for sample in range(sample_rate * 12):
            t = sample / sample_rate
            envelope = min(1.0, t / 0.15, (12 - t) / 0.3)
            pulse = 0.35 + 0.65 * max(0.0, math.sin(math.pi * t)) ** 8
            value = int(4500 * envelope * pulse * math.sin(2 * math.pi * 220 * t))
            samples.extend(value.to_bytes(2, "little", signed=True))
        audio.writeframes(samples)


if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else "scratch/assets"))
