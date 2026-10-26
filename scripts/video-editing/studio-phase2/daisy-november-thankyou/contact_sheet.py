"""Private sampled contact sheet; never used as a full-speed review substitute."""
from pathlib import Path

import cv2
from PIL import Image, ImageDraw, ImageFont

root = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Daisy-Nov-2026\private-thankyou-v1")
source = root / "2026_11_DAISY_VIDEO_01_DANKIE_PRIVATE_REVIEW.mp4"
cap = cv2.VideoCapture(str(source))
font = ImageFont.load_default()
sheet = Image.new("RGB", (5 * 230, 6 * 445), "#202020")
draw = ImageDraw.Draw(sheet)
for second in range(30):
    cap.set(cv2.CAP_PROP_POS_MSEC, (second + 0.25) * 1000)
    ok, frame = cap.read()
    if not ok:
        continue
    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    thumb = Image.fromarray(frame).resize((225, 400))
    x, y = second % 5 * 230, second // 5 * 445
    sheet.paste(thumb, (x, y))
    draw.text((x + 6, y + 406), f"{second + .25:.2f} s", font=font, fill="white")
cap.release()
out = root / "full-contact-sheet.jpg"
sheet.save(out, quality=88)
print(out)
