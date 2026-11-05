"""Protected Daisy R03 cover using one real Daisy storefront image."""
from pathlib import Path

import cv2
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Daisy-Nov-2026")
OUT = ROOT / "private-repurpose-v3" / "r03-cut"
src = ROOT / "source-general" / "199A5419.MP4"
cap = cv2.VideoCapture(str(src))
cap.set(cv2.CAP_PROP_POS_MSEC, 680)
ok, frame = cap.read()
cap.release()
if not ok:
    raise RuntimeError("Could not read real Daisy cover frame")
frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
photo = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
W, H = 1440, 2560
im = photo.resize((W, H), Image.Resampling.LANCZOS).convert("RGBA")
veil = Image.new("RGBA", (W, H))
d = ImageDraw.Draw(veil)
for y in range(690, H, 4):
    t = (y - 690) / (H - 690)
    d.rectangle((0, y, W, y + 4), fill=(7, 9, 10, int(150 * t ** .7)))
im = Image.alpha_composite(im, veil)
d = ImageDraw.Draw(im)
font_path = r"C:\Users\chris\Videos\CG-AI-Editing\Client-Libraries\PSG\brand\fonts\Montserrat-wght.ttf"
font = ImageFont.truetype(font_path, 139)
font.set_variation_by_name("Bold")
line = "SÊ DANKIE"
box = d.textbbox((0, 0), line, font=font)
d.text(((W-(box[2]-box[0]))//2-box[0], 1540-box[1]), line, font=font,
       fill=(248, 226, 26, 255))
logo = Image.open(ROOT / "brand" / "Daisy & Co Marketing.png").convert("RGBA")
logo = logo.crop(logo.getchannel("A").getbbox())
logo.thumbnail((170, 170), Image.Resampling.LANCZOS)
im.alpha_composite(logo, ((W-logo.width)//2, 1120))
path = OUT / "2026_11_DAISY_VIDEO_01_SE_DANKIE_R03_COVER_PRIVATE.jpg"
im.convert("RGB").save(path, quality=95, subsampling=0)
im.crop((180, 740, 1260, 1820)).convert("RGB").save(OUT / "r03-cover-square-check.jpg", quality=92)
im.crop((0, 440, 1440, 2240)).convert("RGB").save(OUT / "r03-cover-4x5-check.jpg", quality=92)
print(path)
