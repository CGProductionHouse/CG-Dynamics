"""Seek a timeline to chosen times and save full-size stills plus one contact sheet.

    python contact_sheet.py PAGE.html WIDTHxHEIGHT T1 T2 ... [--cols 3]

Writes full_<i>.jpg (inspect these at full size: end words, clipping, ghosts)
and sheet.png (reduced overview). Inspecting stills is not normal-speed review.
"""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('page'); ap.add_argument('size'); ap.add_argument('times', nargs='+', type=float)
ap.add_argument('--cols', type=int, default=3)
a = ap.parse_args()
W, H = map(int, a.size.lower().split('x'))
ims = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H})
    pg.goto(Path(a.page).resolve().as_uri() + '?record=1')
    pg.wait_for_function('window.__ready===true', timeout=60000)
    for i, t in enumerate(a.times):
        pg.evaluate(f'seek({t})'); path = f'full_{i}.jpg'
        pg.screenshot(path=path, type='jpeg', quality=88); ims.append(Image.open(path).convert('RGB'))
    b.close()
tw = 640 if W >= H else 360; th = round(tw * H / W)
cols = min(a.cols, len(ims)); rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (tw * cols, th * rows))
for i, im in enumerate(ims):
    sheet.paste(im.resize((tw, th)), ((i % cols) * tw, (i // cols) * th))
sheet.save('sheet.png'); print('sheet.png', len(ims), 'frames')
