"""Clean, client-shot product-action cover with grid-safe official logo."""
from pathlib import Path

import cv2
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\Ehrlich-Nov-2026")
source = ROOT / "source" / "2026_07_JUL" / "199A1387.MP4"
out = ROOT / "EHRLICH-NOVEMBER-private-cover-r13.jpg"

cap = cv2.VideoCapture(str(source))
cap.set(cv2.CAP_PROP_POS_MSEC, 3500)
ok, frame = cap.read()
cap.release()
if not ok:
    raise RuntimeError("Ehrlich source frame unavailable")

# Camera was portrait in the operator's hands but saved landscape without
# rotation metadata. The label, bag and hands must read upright.
frame = cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)
img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).resize((1080, 1920))
img = ImageEnhance.Contrast(img).enhance(1.09)
img = ImageEnhance.Color(img).enhance(1.04)
img = img.convert("RGBA")

logo = Image.open(ROOT / "brand" / "Ehrlich park slaghuis.png").convert("RGBA")
logo.thumbnail((260, 260), Image.Resampling.LANCZOS)
round_mask = Image.new("L", logo.size, 0)
ImageDraw.Draw(round_mask).ellipse((0, 0, logo.width-1, logo.height-1), fill=255)
logo.putalpha(round_mask)
badge = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
shadow = Image.new("RGBA", badge.size, (0, 0, 0, 0))
ImageDraw.Draw(shadow).ellipse((14, 14, 286, 286), fill=(0, 0, 0, 155))
badge = Image.alpha_composite(badge, shadow.filter(ImageFilter.GaussianBlur(13)))
ImageDraw.Draw(badge).ellipse((10, 10, 290, 290), fill=(250, 249, 246, 255))
badge.alpha_composite(logo, ((300-logo.width)//2, (300-logo.height)//2))

# Both the logo and the hands/product survive the centred square and 4:5 grid
# crops; there is no cover headline because the owner requested a clean frame.
img.alpha_composite(badge, (720, 1060))
img.convert("RGB").save(out, quality=95, subsampling=0)
print(out)
