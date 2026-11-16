"""Render one time range of a seekable HTML timeline to its own MP4.

    python render_scene.py PAGE.html WIDTHxHEIGHT NAME T0 T1 [--fps 30]

The page must expose window.seek(seconds) and set window.__ready once fonts and
images are decoded. Each frame is seeked explicitly (never wall-clock playback),
captured as JPEG q92 and piped to FFmpeg (libx264 CRF18 veryfast yuv420p).
Output goes to scenes/NAME.tmp.mp4 and is renamed only when FFmpeg exits 0,
so a stopped render never leaves a short file that still plays.
Join scenes afterwards with the concat demuxer and -c copy.
"""
import argparse, os, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('page'); ap.add_argument('size'); ap.add_argument('name')
ap.add_argument('t0', type=float); ap.add_argument('t1', type=float)
ap.add_argument('--fps', type=int, default=30)
a = ap.parse_args()
W, H = map(int, a.size.lower().split('x'))
f0, f1 = round(a.t0 * a.fps), round(a.t1 * a.fps)
os.makedirs('scenes', exist_ok=True)
tmp = f'scenes/{a.name}.tmp.mp4'
ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(a.fps), '-c:v', 'mjpeg',
                       '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
                       '-r', str(a.fps), tmp], stdin=subprocess.PIPE)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H})
    pg.goto(Path(a.page).resolve().as_uri() + '?record=1')
    pg.wait_for_function('window.__ready===true', timeout=60000); pg.wait_for_timeout(300)
    for i in range(f0, f1):
        pg.evaluate(f'seek({i / a.fps})'); ff.stdin.write(pg.screenshot(type='jpeg', quality=92))
    b.close()
ff.stdin.close()
if ff.wait() == 0:
    os.replace(tmp, f'scenes/{a.name}.mp4'); print(a.name, 'ok', f1 - f0, 'frames')
else:
    print(a.name, 'FAILED')
