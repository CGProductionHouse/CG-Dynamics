"""Protected R08 photo cover, arranged for centered square and feed crops."""
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\Ehrlich-Nov-2026")
source = ROOT / "source" / "2026_07_JUL" / "199A1386.MP4"
frame = ROOT / "screen" / "cover-source.png"
out = ROOT / "EHRLICH-NOVEMBER-private-cover-r08.png"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "6.4", "-i", str(source),
                "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
                "-frames:v", "1", str(frame)], check=True)
img = Image.open(frame).convert("RGBA")
shade = Image.new("RGBA", img.size, (0, 0, 0, 0))
px = shade.load()
for y in range(img.height):
    a = int(218 * max(0, min(1, (y - 700) / 820)))
    for x in range(img.width):
        px[x, y] = (0, 0, 0, a)
img = Image.alpha_composite(img, shade)
logo = Image.open(ROOT / "brand" / "Ehrlich park slaghuis.png").convert("RGBA")
logo.thumbnail((185, 185))
mask = Image.new("L", logo.size, 0)
ImageDraw.Draw(mask).ellipse((0, 0, logo.width - 1, logo.height - 1), fill=255)
logo.putalpha(mask)
img.alpha_composite(logo, (82, 455))
d = ImageDraw.Draw(img)
font = str(ROOT / "brand" / "Anton-Regular.ttf")
large = ImageFont.truetype(font, 118)
small = ImageFont.truetype(font, 43)
d.rectangle((80, 1040, 1000, 1053), fill=(198, 43, 45, 255))
d.text((80, 1080), "THE BRAAI", font=large, fill=(250, 249, 246, 255))
d.text((80, 1215), "STARTS HERE", font=large, fill=(218, 55, 52, 255))
d.text((84, 1405), "EHRLICH PARK BUTCHERY", font=small, fill=(250, 249, 246, 255))
img.convert("RGB").save(out, quality=94)
print(out)
