"""Photo-led TBS review cover from its own moving premises shot."""
from pathlib import Path
import subprocess
from PIL import Image, ImageEnhance

root = Path(r"C:\Users\chris\Videos\CG-AI-Editing\TBS-Nov-2026")
out = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\TBS-Nov-2026-Goods-Transit\film-r05-private")
frame = out / "cover-premises-frame.png"
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", "1.0",
                "-i", str(root / "restart-source" / "199A0525.MP4"), "-frames:v", "1",
                str(frame)], check=True)
image = Image.open(frame).convert("RGB")
w, h = image.size
crop_w = round(h * 9 / 16)
image = image.crop(((w-crop_w)//2, 0, (w+crop_w)//2, h)).resize((1080, 1920), Image.Resampling.LANCZOS)
image = ImageEnhance.Contrast(image).enhance(1.07)
logo = Image.open(root / "brand" / "TBS_TRANSPARENT_LOGO.png").convert("RGBA")
logo.thumbnail((690, 690), Image.Resampling.LANCZOS)
from PIL import ImageDraw
wash = Image.new("RGBA", (1080, 1920), (255,255,255,0))
d = ImageDraw.Draw(wash)
for row in range(740, 1640):
    distance = abs(row-1190)/450
    alpha = int(185*max(0, 1-distance)**0.6)
    d.line((0,row,1080,row), fill=(255,255,255,alpha))
canvas = image.convert("RGBA")
x = (1080-logo.width)//2
y = 960
canvas.alpha_composite(wash)
canvas.alpha_composite(logo, (x,y))
canvas.convert("RGB").save(out / "2026_11_TBS_VIDEO_02_FESTIVE_TRANSIT_R01_COVER_HD.jpg", quality=95, subsampling=0)
