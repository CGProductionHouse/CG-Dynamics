"""Photo-led private Daisy cover from a frame selected for the new November role."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Daisy-Nov-2026")
OUT = ROOT / "private-repurpose-v1"
im = Image.open(OUT / "cover-source-hd.jpg").convert("RGBA")
W, H = im.size
scale = W / 1080
def px(n: int) -> int:
    return round(n * scale)
shade = Image.new("RGBA", (W, H))
draw = ImageDraw.Draw(shade)
for y in range(H):
    # Keep the real face bright; reserve contrast only behind the title.
    a = int(190 * max(0, min(1, (y - px(860)) / px(750))))
    draw.line((0, y, W, y), fill=(12, 13, 10, a))
im = Image.alpha_composite(im, shade)
d = ImageDraw.Draw(im)
font_path = r"C:\Users\chris\Videos\CG-AI-Editing\Client-Libraries\PSG\brand\fonts\Montserrat-wght.ttf"
small = ImageFont.truetype(font_path, px(53))
big = ImageFont.truetype(font_path, px(112))
small.set_variation_by_name("Bold")
big.set_variation_by_name("Bold")
for value, y, f, col in [("HIERDIE NOVEMBER", px(1130), small, (255, 250, 241)),
                         ("SÊ DANKIE", px(1224), big, (248, 226, 26))]:
    bb = d.textbbox((0, 0), value, font=f)
    x = (W - (bb[2]-bb[0]))//2 - bb[0]
    d.text((x, y-bb[1]), value, font=f, fill=(*col, 255))
d.rounded_rectangle((px(452), px(1380), px(628), px(1388)), radius=px(4), fill=(248, 226, 26, 255))
logo = Image.open(ROOT / "brand" / "Daisy & Co Marketing.png").convert("RGBA")
bbox = logo.getchannel("A").getbbox() or (0, 0, logo.width, logo.height)
logo = logo.crop(bbox)
pix = logo.load()
for y in range(logo.height):
    for x in range(logo.width):
        r, g, b, a = pix[x, y]
        if r < 18 and g < 18 and b < 18:
            pix[x, y] = (r, g, b, 0)
logo.thumbnail((px(170), px(170)), Image.Resampling.LANCZOS)
im.alpha_composite(logo, (W - logo.width - px(70), px(500)))
dest = OUT / "2026_11_DAISY_CO_VIDEO_01_COVER_PRIVATE_REVIEW.jpg"
im.convert("RGB").save(dest, quality=95, subsampling=0)
for label, top, height in [("square", px(420), px(1080)), ("4x5", px(285), px(1350)), ("3x4", px(240), px(1440))]:
    im.crop((0, top, W, top+height)).convert("RGB").save(OUT / f"cover-{label}.jpg", quality=92)
print(dest)
