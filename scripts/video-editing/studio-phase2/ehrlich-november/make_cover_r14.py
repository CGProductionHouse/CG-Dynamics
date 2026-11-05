"""Upright, client-shot in-store cover with grid-safe official logo."""
from pathlib import Path

import cv2
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\Ehrlich-Nov-2026")
source = ROOT / "source" / "2026_02_FEB" / "0L8A4459.MP4"
out = ROOT / "EHRLICH-NOVEMBER-private-cover-r14.jpg"

cap = cv2.VideoCapture(str(source))
cap.set(cv2.CAP_PROP_POS_MSEC, 1000)
ok, frame = cap.read()
cap.release()
if not ok:
    raise RuntimeError("Ehrlich source frame unavailable")

# Camera was portrait in the operator's hands but saved landscape without
# rotation metadata. Rotate the staff/store shot upright.
frame = cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)
img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).resize((1440, 2560), Image.Resampling.LANCZOS)
img = ImageEnhance.Contrast(img).enhance(1.09)
img = ImageEnhance.Color(img).enhance(1.04)
img = img.convert("RGBA")

logo = Image.open(ROOT / "brand" / "Ehrlich park slaghuis.png").convert("RGBA")
logo.thumbnail((347, 347), Image.Resampling.LANCZOS)
round_mask = Image.new("L", logo.size, 0)
ImageDraw.Draw(round_mask).ellipse((0, 0, logo.width-1, logo.height-1), fill=255)
logo.putalpha(round_mask)
badge = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
shadow = Image.new("RGBA", badge.size, (0, 0, 0, 0))
ImageDraw.Draw(shadow).ellipse((19, 19, 381, 381), fill=(0, 0, 0, 155))
badge = Image.alpha_composite(badge, shadow.filter(ImageFilter.GaussianBlur(17)))
ImageDraw.Draw(badge).ellipse((13, 13, 387, 387), fill=(250, 249, 246, 255))
badge.alpha_composite(logo, ((400-logo.width)//2, (400-logo.height)//2))

# Put the logo inside the centred Instagram grid crop without covering the staff.
img.alpha_composite(badge, (93, 1400))
img.convert("RGB").save(out, quality=95, subsampling=0)
print(out)
