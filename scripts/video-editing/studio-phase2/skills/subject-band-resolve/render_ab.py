"""Source-isolated horizontal displacement and stepped pale silhouette resolve.

Reuses the corrected keyed source coverage and existing prelap encode/stage recipe.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import subprocess
import wave
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'media/mixkit-28306-2160.mp4'
SHA = '80e0bf3d84faf6e2b0efabfc9001aeadde09e1ce56d0530360ceff5b9be596a5'
W, H, FPS, COUNT = 540, 960, 30, 90
SHIFTS = {30: 18, 31: -12, 32: 24, 33: -12, 34: 8, 35: 0}
FILL_BOTTOM = {32: 500, 33: 640, 34: H, 35: H}
spec = importlib.util.spec_from_file_location('prelap_recipe', ROOT/'skills/subject-silhouette-prelap/render_ab.py')
recipe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recipe)


def over(background: np.ndarray, foreground: np.ndarray) -> np.ndarray:
    alpha = foreground[:, :, 3:4].astype(float) / 255
    return np.rint(background*(1-alpha)+foreground[:, :, :3]*alpha).astype(np.uint8)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=SOURCE)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    if hashlib.sha256(args.source.read_bytes()).hexdigest() != SHA:
        raise RuntimeError('Licensed source identity changed')
    args.output_dir.mkdir(parents=True, exist_ok=True)
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', '3', '-i', str(args.source), '-t', '3',
        '-vf', 'crop=1642:2160:1312:0,scale=540:710,fps=30,chromakey=0x56ee00:0.13:0.09,'
               'despill=type=green:mix=0.7:expand=0.05,format=rgba',
        '-frames:v', str(COUNT), '-pix_fmt', 'rgba', '-f', 'rawvideo', '-'])
    subject = np.frombuffer(raw, np.uint8).reshape(COUNT, 710, W, 4)
    assert not np.any(subject[:, :5, :, 3]), 'Internal top edge must be transparent'
    yy, xx = np.mgrid[:H, :W].astype(np.float32)
    # Keep the outer80px unwarped: a displaced cropped limb must not float inside the canvas.
    edge_weight = np.minimum(np.clip((xx-80)/40, 0, 1), np.clip((W-81-xx)/40, 0, 1))
    bands = (((yy >= 620) & (yy < 648)).astype(np.float32)
             - .7*((yy >= 780) & (yy < 820)).astype(np.float32))
    versions = {n: [] for n in ('plain', 'displacement', 'stepped-resolve')}
    changed = {n: [] for n in versions if n != 'plain'}
    for i in range(COUNT):
        background = recipe.stage(i, False)
        fg = np.zeros((H, W, 4), dtype=np.uint8)
        fg[250:] = subject[i]
        plain = over(background, fg)
        warped = fg.copy()
        if i in SHIFTS:
            mx = (xx-bands*edge_weight*SHIFTS[i]).astype(np.float32)
            assert mx.min() >= 0 and mx.max() <= W-1
            warped = cv2.remap(fg, mx, yy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
            assert np.array_equal(warped[:, :80], fg[:, :80]) and np.array_equal(warped[:, -80:], fg[:, -80:])
        displacement = over(background, warped)
        assert np.array_equal(displacement[:580], plain[:580]), 'Clothing bands must not tear this subject face'
        resolve_fg = warped.copy()
        if i in FILL_BOTTOM:
            resolve_fg[:FILL_BOTTOM[i], :, :3] = (242, 239, 227)
        resolve = over(background, resolve_fg)
        for name, frame in [('plain', plain), ('displacement', displacement), ('stepped-resolve', resolve)]:
            versions[name].append(frame)
            if name != 'plain' and np.any(frame != plain):
                changed[name].append(i)
    assert changed['displacement'] == [30, 31, 32, 33, 34]
    assert changed['stepped-resolve'] == list(range(30, 36))
    for name, frames in versions.items():
        recipe.encode(args.output_dir/f'{name}.mp4', frames)
    # One original removable texture with three attacks tied to the visible steps.
    # This is an objective placement test; it has not been perceptually heard.
    rate = 48000
    audio = np.zeros(COUNT*rate//FPS)
    rng = np.random.default_rng(87530)
    attacks = (30, 32, 34)
    for frame, gain in zip(attacks, (.07, .09, .11)):
        n = round(.05*rate)
        noise = rng.normal(size=n)
        noise = np.r_[0, np.diff(noise)]
        noise /= abs(noise).max()
        envelope = np.sin(np.linspace(0, np.pi, n))**2
        start = frame*rate//FPS
        audio[start:start+n] += noise*envelope*gain
    with wave.open(str(args.output_dir/'step-texture.wav'), 'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(rate)
        f.writeframes(np.rint(audio*32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(args.output_dir/'stepped-resolve.mp4'),
        '-i', str(args.output_dir/'step-texture.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '160k', '-shortest', str(args.output_dir/'stepped-resolve-sound.mp4')], check=True)
    picks = (29, 30, 32, 33, 34, 36)
    contact = Image.new('RGB', (W*len(picks), (H+20)*3), '#141414')
    draw = ImageDraw.Draw(contact)
    for row, (name, frames) in enumerate(versions.items()):
        for col, i in enumerate(picks):
            contact.paste(Image.fromarray(frames[i]), (col*W, row*(H+20)+20))
            draw.text((col*W+3, row*(H+20)+3), f'{name} f{i}', fill='white')
    contact.resize((1620, 1470)).save(args.output_dir/'contact.jpg', quality=94)
    for name in versions:
        Image.fromarray(versions[name][33]).save(args.output_dir/f'{name}-step.png')
    receipt = {'source_sha256': SHA, 'source_in': 3, 'fps': FPS, 'frames': COUNT,
        'shifts_px': SHIFTS, 'fill_bottom_y': FILL_BOTTOM, 'bands_y': [[620,648],[780,820]],
        'protected_outer_px': 80, 'changed_preencode_frames': changed,
        'face_region_unchanged_in_displacement': [0, 580],
        'scope': 'source-isolated bands plus stepped pale alpha fill; clean original stage, not natural scene extraction',
        'sound': {'original_noise_attacks_frames': attacks, 'duration_each_s': .05, 'heard': False},
        'outputs': {n: hashlib.sha256((args.output_dir/f'{n}.mp4').read_bytes()).hexdigest()
                    for n in [*versions, 'stepped-resolve-sound']}}
    (args.output_dir/'evidence.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
