"""Rebuild the TBS cover at a WhatsApp HD-selectable size from its 4K original."""
from pathlib import Path
import subprocess
from PIL import Image, ImageEnhance, ImageDraw

root = Path(r"C:\Users\chris\Videos\CG-AI-Editing\TBS-Nov-2026")
out = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\TBS-Nov-2026-Goods-Transit\review-package-r06")
out.mkdir(parents=True, exist_ok=True)
frame = out / "cover-premises-frame.png"
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", "1.0",
                "-i", str(root / "restart-source" / "199A0525.MP4"), "-frames:v", "1",
                str(frame)], check=True)
image = Image.open(frame).convert("RGB")
w, h = image.size
crop_w = round(h * 9 / 16)
image = image.crop(((w-crop_w)//2, 0, (w+crop_w)//2, h)).resize((1440, 2560), Image.Resampling.LANCZOS)
image = ImageEnhance.Contrast(image).enhance(1.07)
logo = Image.open(root / "brand" / "TBS_TRANSPARENT_LOGO.png").convert("RGBA")
logo.thumbnail((920, 920), Image.Resampling.LANCZOS)
wash = Image.new("RGBA", (1440, 2560), (255, 255, 255, 0))
draw = ImageDraw.Draw(wash)
for row in range(987, 2187):
    alpha = int(185 * max(0, 1 - abs(row-1587)/600) ** 0.6)
    draw.line((0, row, 1440, row), fill=(255, 255, 255, alpha))
canvas = image.convert("RGBA")
canvas.alpha_composite(wash)
canvas.alpha_composite(logo, ((1440-logo.width)//2, 1280))
target = out / "2026_11_TBS_VIDEO_02_FESTIVE_TRANSIT_R01_COVER_HD_1440.jpg"
canvas.convert("RGB").save(target, quality=95, subsampling=0)
print(target)
