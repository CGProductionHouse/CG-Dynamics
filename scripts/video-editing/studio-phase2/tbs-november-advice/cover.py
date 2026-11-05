"""Create the photo-led TBS review cover from a private frame and approved logo."""
from pathlib import Path
import argparse

from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1080, 1920
FONT = r"C:\Windows\Fonts\bahnschrift.ttf"
OLIVE = (158, 175, 31, 255)
TAUPE = (120, 102, 80, 255)
WHITE = (255, 255, 255, 255)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=Path, required=True)
    args = ap.parse_args()
    root = args.root
    work = root / "work" / "advice-v1"
    source = work / "f18.3.jpg"  # A clean, forward-facing frame from the June shoot.
    logo_path = root / "brand" / "TBS_TRANSPARENT_LOGO.png"
    out = work / "2026_11_TBS_VIDEO_01_WHICH_COVER_FITS_YOUR_LIFE_COVER.png"

    canvas = Image.open(source).convert("RGBA")
    assert canvas.size == (W, H), canvas.size
    # Warm depth behind the words; the approved palette and real shoot remain visible.
    veil = Image.new("RGBA", (W, H))
    px = veil.load()
    for y in range(H):
        bottom = max(0, 1 - abs(y - 1240) / 480)
        alpha = round(125 * bottom)
        for x in range(W):
            px[x, y] = (36, 30, 23, alpha)
    canvas = Image.alpha_composite(canvas, veil)
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle((85, 997, 238, 1008), radius=5, fill=OLIVE)
    f1 = ImageFont.truetype(FONT, 70)
    f2 = ImageFont.truetype(FONT, 110)
    d.text((85, 1020), "COVER THAT", font=f1, fill=WHITE)
    d.text((81, 1105), "FITS YOUR", font=f2, fill=OLIVE)
    d.text((81, 1215), "LIFE", font=f2, fill=WHITE)

    logo = Image.open(logo_path).convert("RGBA")
    logo = logo.crop(logo.getbbox())
    logo.thumbnail((292, 110), Image.Resampling.LANCZOS)
    panel = (78, 1360, 420, 1482)
    shadow = Image.new("RGBA", (W, H))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((panel[0] + 8, panel[1] + 10, panel[2] + 8, panel[3] + 10), radius=25, fill=(0, 0, 0, 70))
    canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(10)))
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle(panel, radius=25, fill=(251, 250, 246, 246))
    canvas.alpha_composite(logo, (panel[0] + (panel[2] - panel[0] - logo.width) // 2,
                                  panel[1] + (panel[3] - panel[1] - logo.height) // 2))
    image = canvas.convert("RGB")
    image.save(out, quality=95)
    for name, y0, y1 in (("4x5", 285, 1635), ("3x4", 240, 1680), ("square", 420, 1500)):
        image.crop((0, y0, W, y1)).save(work / f"cover-preview-{name}.png")
    print(out)


if __name__ == "__main__":
    main()
