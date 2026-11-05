"""Rebuild Kevin's source-led insert with a local human matte and full torso.

Source-specific treatment. The ONNX model and all client frames remain private.
"""
from pathlib import Path
import subprocess
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\TBS-Nov-2026-Goods-Transit")
SRC = ROOT / "source"
OUT = ROOT / "film-r08-private"
OUT.mkdir(exist_ok=True)
FRAMES = OUT / "kevin-frames"
FRAMES.mkdir(exist_ok=True)
PLATE = ROOT / "film-r06-private" / "03-tbs-sign.mp4"
KEVIN = ROOT / "kevin-motion-r08" / "kevin-u2net.png"
FONT = SRC / "Raleway-wght.ttf"
W, H, N = 1920, 1080, 75
OLIVE = (158, 175, 31, 255)


def ease(v: float) -> float:
    v = max(0.0, min(1.0, v))
    return 1 - (1 - v) ** 3


def font(size: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT), size)
    f.set_variation_by_axes([900])
    return f


def make_frame(bg: Image.Image, person: Image.Image, n: int) -> Image.Image:
    t = n / 30
    bg = bg.filter(ImageFilter.GaussianBlur(3.2))
    bg = ImageEnhance.Brightness(bg).enhance(0.52).convert("RGBA")
    shade = Image.new("RGBA", (W, H))
    sd = ImageDraw.Draw(shade)
    for x in range(0, 1070, 5):
        a = round(122 * (1 - x / 1070))
        sd.rectangle((x, 0, x + 5, H), fill=(7, 21, 22, a))
    bg.alpha_composite(shade)

    # The source camera truncates the left forearm near its lower edge. Keep
    # only the clean upper body and let the torso leave through the frame edge.
    entrance = ease((t - 0.08) / 0.58)
    x = round(1940 - 920 * entrance + 7 * max(0, t - 0.72))
    y = 246
    shadow = Image.new("RGBA", person.size, (0, 0, 0, 0))
    shadow.putalpha(person.getchannel("A").point(lambda a: round(a * 0.40)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(13))
    bg.alpha_composite(shadow, (x + 14, y + 11))
    bg.alpha_composite(person, (x, y))

    # Masked left-to-right reveal, sharp hold, then a smaller identity cue.
    lines = [
        ("LOCAL ADVICE", 117, 290, 108, (255, 255, 255, 255), 0.27),
        ("FOR THE LOAD", 117, 423, 94, OLIVE, 0.57),
        ("AHEAD", 117, 533, 148, (255, 255, 255, 255), 0.86),
    ]
    for words, px, py, size, color, start in lines:
        f = font(size)
        layer = Image.new("RGBA", (W, H))
        ld = ImageDraw.Draw(layer)
        ld.text((px, py), words, font=f, fill=color)
        width = ld.textbbox((px, py), words, font=f)[2] - px
        shown = round(width * ease((t - start) / 0.34))
        if shown:
            bg.alpha_composite(layer.crop((px, py, px + shown, H)), (px, py))
    if t > 1.09:
        ident = Image.new("RGBA", (W, H))
        d = ImageDraw.Draw(ident)
        a = round(255 * ease((t - 1.09) / 0.25))
        d.text((120, 825), "KEVIN", font=font(81), fill=(255, 255, 255, a))
        d.text((125, 921), "TBS BROKERS", font=font(37), fill=(158, 175, 31, a))
        bg.alpha_composite(ident)
    return bg.convert("RGB")


def main() -> None:
    cap = cv2.VideoCapture(str(PLATE))
    assert cap.isOpened(), PLATE
    original = Image.open(KEVIN).convert("RGBA").crop((0, 0, 1080, 950))
    person = original.resize((950, 836), Image.Resampling.LANCZOS)
    # Pull the alpha one pixel inward to remove the light source-background
    # fringe around Kevin's hair and shirt, then soften only the subpixel edge.
    rgba = np.array(person)
    alpha = cv2.erode(rgba[:, :, 3], np.ones((3, 3), np.uint8), iterations=1)
    rgba[:, :, 3] = cv2.GaussianBlur(alpha, (0, 0), 0.45)
    person = Image.fromarray(rgba, "RGBA")
    for n in range(N):
        ok, frame = cap.read()
        assert ok, f"missing background frame {n}"
        bg = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        make_frame(bg, person, n).save(FRAMES / f"frame-{n:04d}.jpg",
                                       quality=95, subsampling=0)
    cap.release()
    target = OUT / "03-kevin-motion.mp4"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-framerate", "30", "-i", str(FRAMES / "frame-%04d.jpg"),
                    "-c:v", "libx264", "-crf", "18", "-preset", "fast",
                    "-vf", "scale=in_range=pc:out_range=tv,format=yuv420p",
                    "-color_range", "tv", "-r", "30", str(target)], check=True)
    print(target)


if __name__ == "__main__":
    main()
