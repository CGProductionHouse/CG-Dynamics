"""Global negative versus background-only negative on the same keyed subject.

Bounded reference construction, not automatic impact punctuation.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'media/mixkit-28306-2160.mp4'
SHA = '80e0bf3d84faf6e2b0efabfc9001aeadde09e1ce56d0530360ceff5b9be596a5'
W, H, FPS, COUNT = 540, 960, 30, 90
PULSES = (36, 37, 40, 41)
spec = importlib.util.spec_from_file_location('prelap_recipe', ROOT / 'skills/subject-silhouette-prelap/render_ab.py')
recipe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recipe)


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
    assert not np.any(subject[:, :5, :, 3]), 'Internal top crop must remain transparent'
    versions = {n: [] for n in ('plain', 'global-negative', 'background-negative')}
    changed = {n: [] for n in versions if n != 'plain'}
    jumps = {n: [] for n in versions}
    subject_mae = {n: [] for n in changed}
    for i in range(COUNT):
        background = recipe.stage(i, False)
        alpha = np.zeros((H, W, 1), dtype=float)
        alpha[250:] = subject[i, :, :, 3:4] / 255
        foreground = np.zeros((H, W, 3), dtype=np.uint8)
        foreground[250:] = subject[i, :, :, :3]
        plain = np.rint(background * (1-alpha) + foreground * alpha).astype(np.uint8)
        global_negative = 255-plain if i in PULSES else plain.copy()
        background_negative = np.rint((255-background) * (1-alpha) + foreground * alpha).astype(np.uint8) if i in PULSES else plain.copy()
        for name, frame in [('plain', plain), ('global-negative', global_negative), ('background-negative', background_negative)]:
            if versions[name]:
                jumps[name].append(float(abs(frame.mean()-versions[name][-1].mean())))
            versions[name].append(frame)
            if name != 'plain' and np.any(frame != plain):
                changed[name].append(i)
                opaque = alpha[:, :, 0] == 1
                subject_mae[name].append(float(np.abs(frame.astype(float)-plain.astype(float))[opaque].mean()))
                if name == 'background-negative':
                    assert np.array_equal(frame[opaque], plain[opaque])
    assert all(v == list(PULSES) for v in changed.values())
    for name, frames in versions.items():
        recipe.encode(args.output_dir / f'{name}.mp4', frames)
    picks = (35, 36, 37, 38, 40, 42)
    contact = Image.new('RGB', (W*len(picks), (H+20)*len(versions)), '#141414')
    draw = ImageDraw.Draw(contact)
    for row, (name, frames) in enumerate(versions.items()):
        for col, i in enumerate(picks):
            contact.paste(Image.fromarray(frames[i]), (col*W, row*(H+20)+20))
            draw.text((col*W+3, row*(H+20)+3), f'{name} f{i}', fill='white')
    contact.resize((1620, 1470)).save(args.output_dir / 'contact.jpg', quality=94)
    for name in versions:
        Image.fromarray(versions[name][36]).save(args.output_dir / f'{name}-pulse.png')
    receipt = {'source_sha256': SHA, 'source_in': 3, 'fps': FPS, 'frames': COUNT,
        'pulse_frames': PULSES, 'changed_preencode_frames': changed,
        'max_mean_rgb_frame_jump': {n: max(v) for n, v in jumps.items()},
        'opaque_subject_mae_during_pulses': subject_mae,
        'scope': 'green-screen foreground and original stage; not natural masking or reference exact settings',
        'sound': 'none', 'outputs': {n: hashlib.sha256((args.output_dir/f'{n}.mp4').read_bytes()).hexdigest() for n in versions}}
    (args.output_dir / 'evidence.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
