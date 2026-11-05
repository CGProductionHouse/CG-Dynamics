"""Protected R12 Ehrlich staff photo cover; no client image enters Git."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\Ehrlich-Nov-2026")
source = ROOT / "photo-screen" / "199A1405.JPG"
out = ROOT / "EHRLICH-NOVEMBER-private-cover-r12.jpg"
raw = ImageOps.exif_transpose(Image.open(source)).convert("RGB")
width = round(raw.height * 1080 / 1920)
left = (raw.width - width) // 2
img = raw.crop((left, 0, left + width, raw.height)).resize((1080, 1920)).convert("RGBA")
shade = Image.new("RGBA", img.size, (0, 0, 0, 0))
px = shade.load()
for y in range(img.height):
    a = int(210 * max(0, min(1, (y - 850) / 720)))
    for x in range(img.width):
        px[x, y] = (0, 0, 0, a)
img = Image.alpha_composite(img, shade)
logo = Image.open(ROOT / "brand" / "Ehrlich park slaghuis.png").convert("RGBA")
logo.thumbnail((185, 185))
mask = Image.new("L", logo.size, 0)
ImageDraw.Draw(mask).ellipse((0, 0, logo.width - 1, logo.height - 1), fill=255)
logo.putalpha(mask)
img.alpha_composite(logo, (82, 120))
d = ImageDraw.Draw(img)
font = str(ROOT / "brand" / "Anton-Regular.ttf")
large = ImageFont.truetype(font, 118)
small = ImageFont.truetype(font, 43)
d.rectangle((80, 1310, 1000, 1323), fill=(198, 43, 45, 255))
d.text((80, 1350), "THE BRAAI", font=large, fill=(250, 249, 246, 255))
d.text((80, 1485), "STARTS HERE", font=large, fill=(218, 55, 52, 255))
d.text((84, 1665), "EHRLICH PARK BUTCHERY", font=small, fill=(250, 249, 246, 255))
img.convert("RGB").save(out, quality=94)
print(out)
