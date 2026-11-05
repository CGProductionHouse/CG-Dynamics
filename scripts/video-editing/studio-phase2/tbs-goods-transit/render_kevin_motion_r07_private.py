"""One source-specific TBS adviser depth/type insert from a screened Kevin frame."""
from pathlib import Path
import math
import subprocess
import cv2
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\TBS-Nov-2026-Goods-Transit")
SRC = ROOT / "source"
PROOF = ROOT / "kevin-motion-r07"
OUT = ROOT / "film-r07-private"
OUT.mkdir(parents=True, exist_ok=True)
FRAMES = OUT / "kevin-frames"
FRAMES.mkdir(exist_ok=True)
FONT = SRC / "Raleway-wght.ttf"
W, H, N = 1920, 1080, 75
OLIVE = (158, 175, 31)
PLATE = ROOT / "film-r06-private" / "03-tbs-sign.mp4"


def ease(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def font(px: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT), px)
    f.set_variation_by_axes([900])
    return f


def reveal_text(canvas: Image.Image, words: str, xy: tuple[int, int],
                f: ImageFont.FreeTypeFont, color: tuple[int, int, int], progress: float) -> None:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.text(xy, words, font=f, fill=(*color, 255))
    width = d.textbbox(xy, words, font=f)[2] - xy[0]
    visible = int(width * ease(progress))
    if visible > 0:
        canvas.alpha_composite(layer.crop((xy[0], xy[1], xy[0] + visible, H)), (xy[0], xy[1]))


def main() -> None:
    cap = cv2.VideoCapture(str(PLATE))
    assert cap.isOpened(), PLATE
    kevin = Image.open(PROOF / "kevin-bust-cutout.png").convert("RGBA")
    target_w = 880
    target_h = round(kevin.height * target_w / kevin.width)
    kevin = kevin.resize((target_w, target_h), Image.Resampling.LANCZOS)
    shadow = Image.new("RGBA", kevin.size, (0, 0, 0, 0))
    shadow.putalpha(kevin.getchannel("A"))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    # The actual shirt and face are the foreground; the lower source crop is
    # deliberately aligned with the bottom of the film frame throughout.
    for n in range(N):
        ok, frame = cap.read()
        assert ok, f"missing background frame {n}"
        bg = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).convert("RGBA")
        bg = bg.filter(ImageFilter.GaussianBlur(5.5))
        bg = ImageEnhance.Brightness(bg).enhance(0.53)
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        shade = ImageDraw.Draw(overlay)
        shade.polygon([(0, 0), (1150, 0), (760, H), (0, H)], fill=(10, 24, 21, 112))
        # Two layer entrances, then a small held depth drift, not a frozen card.
        t = n / 30
        enter = ease((t - 0.10) / 0.48)
        x = round(1930 - 900 * enter)
        y = H - target_h
        overlay.alpha_composite(shadow, (x + 12, y + 10))
        overlay.alpha_composite(kevin, (x, y))
        bg.alpha_composite(overlay)
        reveal_text(bg, "LOCAL ADVICE", (118, 347), font(114), (255, 255, 255), (t - 0.30) / 0.37)
        reveal_text(bg, "FOR THE LOAD", (118, 478), font(92), OLIVE, (t - 0.64) / 0.37)
        reveal_text(bg, "AHEAD", (118, 583), font(150), (255, 255, 255), (t - 0.81) / 0.37)
        if t > 1.02:
            label = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            d = ImageDraw.Draw(label)
            d.text((121, 913), "KEVIN  |  TBS BROKERS", font=font(40), fill=(255, 255, 255, 245))
            label.putalpha(label.getchannel("A").point(lambda a: int(a * min(1, (t - 1.02) / 0.26))))
            bg.alpha_composite(label)
        bg.convert("RGB").save(FRAMES / f"frame-{n:04d}.jpg", quality=95, subsampling=0)
    cap.release()
    out = OUT / "03-kevin-motion.mp4"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", "30",
                    "-i", str(FRAMES / "frame-%04d.jpg"), "-c:v", "libx264", "-crf", "18",
                    "-preset", "fast", "-vf", "scale=in_range=pc:out_range=tv,format=yuv420p",
                    "-color_range", "tv", "-pix_fmt", "yuv420p", "-r", "30", str(out)], check=True)
    print(out)


if __name__ == "__main__":
    main()
