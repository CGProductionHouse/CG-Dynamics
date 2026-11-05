"""Separate an original moving gate matte from a peripheral light leak.

One continuous licensed picture; no film-burn asset, transport or scene-change claim.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path.home()/'Videos/CG-AI-Editing/Nolan-Skill-Proofs/cinematic-travel-20261027/mixkit-134-720.mp4'
SHA = 'de17d355543cda1f396361d2e217ae115c9be5eb60efe22cce0fc6a3d517d54d'
W, H, FPS, COUNT = 540, 960, 30, 90
spec = importlib.util.spec_from_file_location('optics_recipe', ROOT/'skills/chromatic-lens-pulse/render_ab.py')
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
    times = 9+np.array([0,15,30,45,60,75,90,105,119])*3/24
    centres = np.array([750,670,680,600,610,690,760,710,590], dtype=float)
    cap = cv2.VideoCapture(str(args.source))
    yy, xx = np.mgrid[:H, :W]
    versions = {n: [] for n in ('plain', 'gate', 'gate-leak')}
    changed = {n: [] for n in versions if n != 'plain'}
    leak_areas = []
    for i in range(COUNT):
        t = 9+i/FPS
        j = min(len(times)-2, max(0, int(np.searchsorted(times,t,side='right')-1)))
        u = (t-times[j])/(times[j+1]-times[j]); u = u*u*(3-2*u)
        left = round(np.clip(centres[j]*(1-u)+centres[j+1]*u-202.5,0,875))
        cap.set(cv2.CAP_PROP_POS_MSEC, t*1000); ok, frame = cap.read()
        if not ok:
            raise RuntimeError(i)
        plain = cv2.cvtColor(cv2.resize(frame[:,left:left+405],(W,H)),cv2.COLOR_BGR2RGB)
        gate = plain.copy(); effect = plain.copy()
        if 24 <= i <= 35:
            phase = (i-23)/13
            strength = np.sin(np.pi*phase)**2
            # The aperture moves; it samples the same global picture coordinates.
            dx = round(3*np.sin(i*1.7)); dy = round(4*np.cos(i*1.3))
            aperture = Image.new('L',(W,H))
            ImageDraw.Draw(aperture).rounded_rectangle((24+dx,70+dy,W-24+dx,H-70+dy),radius=24,fill=255)
            mask = np.asarray(aperture.filter(ImageFilter.GaussianBlur(1.2)), dtype=float)/255
            opacity = strength*(1-mask)
            gate = np.rint(plain*(1-opacity[...,None])+np.array((8,7,6))*opacity[...,None]).astype(np.uint8)
            # A broad, moving peripheral exposure, not the rejected rigid stripe/full-picture bloom.
            alpha = .65*strength*np.exp(-((xx+25-30*np.sin(phase*np.pi))/170)**2
                                       -((yy-(670-320*phase))/210)**2)
            alpha *= np.clip((150-xx)/90,0,1)**2
            assert not np.any(alpha[:,150:]), 'Keep this source head/central action free of leak'
            leak_areas.append(float(np.mean(alpha>.05)))
            rgb = gate.astype(float)/255
            warm = np.array((1.0,.32,.045))
            effect = np.rint((1-(1-rgb)*(1-alpha[...,None]*warm))*255).clip(0,255).astype(np.uint8)
            if i == 29:
                aperture.save(args.output_dir/'original-aperture.png')
                Image.fromarray(np.rint(alpha*255).astype(np.uint8)).save(args.output_dir/'original-leak-alpha.png')
        for name, result in [('plain',plain),('gate',gate),('gate-leak',effect)]:
            versions[name].append(result)
            if name != 'plain' and np.any(result != plain):
                changed[name].append(i)
    cap.release()
    assert all(v == list(range(24,36)) for v in changed.values())
    for name, frames in versions.items():
        recipe.encode(args.output_dir/f'{name}.mp4',frames)
    picks = (23,25,29,33,36)
    contact = Image.new('RGB',(W*len(picks),(H+20)*3),'#141414')
    draw = ImageDraw.Draw(contact)
    for row,(name,frames) in enumerate(versions.items()):
        for col,i in enumerate(picks):
            contact.paste(Image.fromarray(frames[i]),(col*W,row*(H+20)+20))
            draw.text((col*W+3,row*(H+20)+3),f'{name} f{i}',fill='white')
    contact.resize((1350,1470)).save(args.output_dir/'contact.jpg',quality=94)
    Image.fromarray(versions['gate-leak'][29]).save(args.output_dir/'gate-leak-full.png')
    receipt = {'source_sha256':SHA,'source_in':9,'fps':FPS,'frames':COUNT,
        'changed_preencode_frames':changed,'gate_bounds':[24,70,516,890],'jitter_max_px':[3,4],
        'leak_area_above_alpha_005_max':max(leak_areas),'leak_zero_from_x':150,
        'scope':'original gate matte and peripheral screen blend on a continuous shot; not physical film transport or a scene change',
        'sound':'none; visual mechanism only',
        'outputs':{n:hashlib.sha256((args.output_dir/f'{n}.mp4').read_bytes()).hexdigest() for n in versions}}
    (args.output_dir/'evidence.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
