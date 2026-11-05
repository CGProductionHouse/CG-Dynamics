"""Photo-led private cover from the real Ehrlich shop footage."""
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\Ehrlich-Nov-2026")
source = ROOT / "source" / "2026_07_JUL" / "199A1386.MP4"
frame = ROOT / "screen" / "cover-source.png"
out = ROOT / "EHRLICH-NOVEMBER-private-cover-r02.png"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "6.4", "-i", str(source),
                "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
                "-frames:v", "1", str(frame)], check=True)
img = Image.open(frame).convert("RGBA")
shade = Image.new("RGBA", img.size, (0, 0, 0, 0))
px = shade.load()
for y in range(img.height):
    a = int(225 * max(0, min(1, (y - 690) / 880)))
    for x in range(img.width):
        px[x, y] = (0, 0, 0, a)
img = Image.alpha_composite(img, shade)
logo = Image.open(ROOT / "brand" / "Ehrlich park slaghuis.png").convert("RGBA")
logo.thumbnail((230, 230))
mask = Image.new("L", logo.size, 0)
ImageDraw.Draw(mask).ellipse((0, 0, logo.width - 1, logo.height - 1), fill=255)
logo.putalpha(mask)
img.alpha_composite(logo, (80, 115))
d = ImageDraw.Draw(img)
font = str(ROOT / "brand" / "Anton-Regular.ttf")
large = ImageFont.truetype(font, 132)
small = ImageFont.truetype(font, 48)
d.rectangle((75, 1290, 1005, 1305), fill=(198, 43, 45, 255))
d.text((78, 1340), "THE BRAAI", font=large, fill=(250, 249, 246, 255))
d.text((78, 1490), "STARTS HERE", font=large, fill=(218, 55, 52, 255))
d.text((82, 1710), "EHRLICH PARK SLAGHUIS", font=small, fill=(250, 249, 246, 255))
img.convert("RGB").save(out, quality=94)
print(out)
