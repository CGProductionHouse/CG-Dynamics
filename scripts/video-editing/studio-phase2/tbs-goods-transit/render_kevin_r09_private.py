"""Ground Kevin in an edge-to-edge filmed-office panel, without a floating matte."""
from pathlib import Path
import subprocess
import cv2
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\TBS-Nov-2026-Goods-Transit")
SRC = ROOT / "source"
R06 = ROOT / "film-r06-private"
R09 = ROOT / "film-r09-private"
FRAMES = R09 / "kevin-panel-frames"
PHOTO = ROOT / "kevin-motion-r07" / "kevin-neutral-0p08.png"
FONT = SRC / "Raleway-wght.ttf"
W, H, N = 1920, 1080, 75
OLIVE = (158, 175, 31)


def ease(v: float) -> float:
    v = max(0.0, min(1.0, v))
    return 1 - (1 - v) ** 3


def font(size: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT), size)
    f.set_variation_by_axes([900])
    return f


def frame(base: Image.Image, photo: Image.Image, n: int) -> Image.Image:
    t = n / 30
    # The filmed wall mark stays a soft architectural texture here. Its full
    # name must not be accidentally reduced to a prominent lone "TBS".
    bg = ImageEnhance.Brightness(base.filter(ImageFilter.GaussianBlur(18))).enhance(.36).convert("RGBA")
    shade = Image.new("RGBA", (W, H))
    sd = ImageDraw.Draw(shade)
    for x in range(0, 1110, 6):
        sd.rectangle((x, 0, x + 6, H), fill=(8, 21, 20, round(150 * (1 - x / 1110))))
    bg.alpha_composite(shade)

    # The intact office portrait enters as a deliberately bounded, full-height
    # photographed plane. Both its top and bottom resolve at delivery edges.
    entrance = ease((t - .06) / .48)
    divider = round(1925 - 875 * entrance + 8 * max(0, t - .60))
    panel = Image.new("RGBA", (W, H))
    # A slow, small picture drift continues after the panel lands. No face or
    # limb is cut out or silently animated to imply that Kevin is talking.
    py = -35 - round(14 * max(0, t - .55))
    panel.alpha_composite(photo, (divider - 85, py))
    clip = Image.new("L", (W, H))
    dclip = ImageDraw.Draw(clip)
    dclip.polygon([(divider + 45, 0), (W, 0), (W, H), (divider - 40, H)], fill=255)
    panel.putalpha(clip)
    bg.alpha_composite(panel)
    edge = ImageDraw.Draw(bg)
    edge.line([(divider + 45, 0), (divider - 40, H)], fill=(*OLIVE, 255), width=5)

    lines = [
        ("LOCAL ADVICE", 112, 290, 101, (255, 255, 255, 255), .25),
        ("FOR THE LOAD", 112, 417, 92, (*OLIVE, 255), .54),
        ("AHEAD", 112, 530, 145, (255, 255, 255, 255), .83),
    ]
    for words, px, py_text, size, color, start in lines:
        layer = Image.new("RGBA", (W, H))
        ld = ImageDraw.Draw(layer)
        ld.text((px, py_text), words, font=font(size), fill=color)
        width = ld.textbbox((px, py_text), words, font=font(size))[2] - px
        shown = round(width * ease((t - start) / .32))
        if shown:
            bg.alpha_composite(layer.crop((px, py_text, px + shown, H)), (px, py_text))
    if t > 1.06:
        a = round(255 * ease((t - 1.06) / .25))
        ident = Image.new("RGBA", (W, H))
        d = ImageDraw.Draw(ident)
        d.text((117, 823), "KEVIN", font=font(78), fill=(255, 255, 255, a))
        d.text((121, 914), "TBS BROKERS", font=font(36), fill=(*OLIVE, a))
        bg.alpha_composite(ident)
    return bg.convert("RGB")


def main() -> None:
    R09.mkdir(exist_ok=True)
    FRAMES.mkdir(exist_ok=True)
    photo = Image.open(PHOTO).convert("RGBA").crop((0, 420, 1080, 1710))
    photo = photo.resize((980, 1170), Image.Resampling.LANCZOS)
    cap = cv2.VideoCapture(str(R06 / "03-tbs-sign.mp4"))
    assert cap.isOpened()
    for n in range(N):
        ok, bgr = cap.read()
        assert ok, n
        bg = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
        frame(bg, photo, n).save(FRAMES / f"frame-{n:04d}.jpg", quality=95, subsampling=0)
    cap.release()
    target = R09 / "03-kevin-panel.mp4"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-framerate", "30", "-i", str(FRAMES / "frame-%04d.jpg"),
                    "-c:v", "libx264", "-crf", "18", "-preset", "fast",
                    "-vf", "scale=in_range=pc:out_range=tv,format=yuv420p",
                    "-color_range", "tv", "-r", "30", str(target)], check=True)
    print(target)


if __name__ == "__main__":
    main()
