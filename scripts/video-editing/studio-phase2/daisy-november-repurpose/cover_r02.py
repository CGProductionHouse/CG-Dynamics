"""Protected photo-led R02 cover with a checked central feed crop."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Daisy-Nov-2026")
OUT = ROOT / "private-repurpose-v2" / "r02-cut"
source = Image.open(OUT / "cover-source-41225.jpg").convert("RGB")
W, H = 1440, 2560
bg = source.resize((W, H), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(60)).convert("RGBA")
dark = Image.new("RGBA", (W, H), (10, 16, 12, 135))
im = Image.alpha_composite(bg, dark)
d = ImageDraw.Draw(im)
# The complete two-person interaction remains legible in 9:16, 4:5 and centre-square.
photo = source.resize((W-96, 756), Image.Resampling.LANCZOS).convert("RGBA")
d.rounded_rectangle((37, 672, W-37, 1450), radius=18, fill=(255, 250, 241, 255))
im.alpha_composite(photo, (48, 683))
d = ImageDraw.Draw(im)
font_path = r"C:\Users\chris\Videos\CG-AI-Editing\Client-Libraries\PSG\brand\fonts\Montserrat-wght.ttf"
small = ImageFont.truetype(font_path, 69)
big = ImageFont.truetype(font_path, 151)
small.set_variation_by_name("Bold")
big.set_variation_by_name("Bold")
for text, y, f, fill in [
    ("HIERDIE NOVEMBER", 1497, small, (255, 250, 241)),
    ("SÊ DANKIE", 1598, big, (248, 226, 26)),
]:
    box = d.textbbox((0, 0), text, font=f)
    d.text(((W-(box[2]-box[0]))//2-box[0], y-box[1]), text, font=f, fill=(*fill, 255))
logo = Image.open(ROOT / "brand" / "Daisy & Co Marketing.png").convert("RGBA")
logo = logo.crop(logo.getchannel("A").getbbox())
logo.thumbnail((190, 190), Image.Resampling.LANCZOS)
im.alpha_composite(logo, (240, 1225))
path = OUT / "2026_11_DAISY_VIDEO_01_SE_DANKIE_R02_COVER_PRIVATE.jpg"
im.convert("RGB").save(path, quality=95, subsampling=0)
im.crop((180, 740, 1260, 1820)).convert("RGB").save(OUT / "cover-square-check.jpg", quality=92)
im.crop((0, 440, 1440, 2240)).convert("RGB").save(OUT / "cover-4x5-check.jpg", quality=92)
print(path)
