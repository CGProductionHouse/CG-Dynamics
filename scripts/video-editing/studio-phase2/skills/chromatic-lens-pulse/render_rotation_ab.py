"""Source-motivated rotational optics; reuse the existing bounded proof encoder.

No scene synthesis, edge reflection, new engine, client media or audio.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw

W, H, FPS, COUNT = 540, 960, 30, 90
SHA = 'f56f0c5adbb6d1d7e7f3792ad6707b0fd14f0068d8b2348d96a61cfe52c27dd3'
spec = importlib.util.spec_from_file_location('existing_lens', Path(__file__).with_name('render_ab.py'))
recipe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recipe)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--output-dir', type=Path, required=True)
    args = p.parse_args()
    assert hashlib.sha256(args.source.read_bytes()).hexdigest() == SHA, 'Source identity changed'
    args.output_dir.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(args.source))
    sw, sh = int(cap.get(3)), int(cap.get(4))
    yy, xx = np.mgrid[:H, :W].astype(np.float32)
    dx, dy = (xx-W/2)*sh/H, (yy-H/2)*sh/H
    radius = np.sqrt((dx/(sh/2))**2+(dy/(sh/2))**2)
    edge = np.clip((radius-.22)/.85, 0, 1)**2
    versions = {k: [] for k in ('plain', 'zoom-only', 'rotation-sharp', 'rotation-shutter')}
    changed = {k: [] for k in versions if k != 'plain'}
    bounds, rotations = [], []
    for i in range(COUNT):
        cap.set(cv2.CAP_PROP_POS_MSEC, (6+i/FPS)*1000)
        ok, source = cap.read()
        assert ok
        source = cv2.cvtColor(source, cv2.COLOR_BGR2RGB)
        pulse = float(np.sin(np.pi*(i-23)/13)**2) if 24 <= i <= 35 else 0.
        rotations.append(-8*pulse)
        for name in versions:
            if name == 'plain' or not pulse:
                mx, my = sw/2+dx, sh/2+dy
                result = cv2.remap(source, mx, my, cv2.INTER_LINEAR)
            else:
                zoom = 1+.18*pulse
                total = np.zeros((H, W, 3), np.float32)
                samples = 31 if name == 'rotation-shutter' else 1
                for offset in np.linspace(-1, 1, samples) if samples > 1 else [0]:
                    # Inverse sampling: positive map angle gives negative picture rotation.
                    # This follows the measured negative source roll during the attack.
                    theta = (np.deg2rad((8+offset*1.5)*pulse)*edge).astype(np.float32) if name != 'zoom-only' else np.zeros_like(edge)
                    mx = (sw/2+(np.cos(theta)*dx-np.sin(theta)*dy)/zoom).astype(np.float32)
                    my = (sh/2+(np.sin(theta)*dx+np.cos(theta)*dy)/zoom).astype(np.float32)
                    assert mx.min() >= 0 and mx.max() <= sw-1 and my.min() >= 0 and my.max() <= sh-1, 'Out-of-source sample'
                    bounds.append([float(mx.min()),float(mx.max()),float(my.min()),float(my.max())])
                    total += cv2.remap(source, mx, my, cv2.INTER_LINEAR)/samples
                result = np.rint(total).clip(0,255).astype(np.uint8)
            versions[name].append(result)
            if name != 'plain' and not np.array_equal(result, versions['plain'][-1]):
                changed[name].append(i)
        # Centre is protected from rotation; only the common zoom affects it.
        protected = edge == 0
        assert np.array_equal(versions['rotation-sharp'][-1][protected], versions['zoom-only'][-1][protected])
    cap.release()
    assert all(x == list(range(24,36)) for x in changed.values())
    for name, frames in versions.items():
        recipe.encode(args.output_dir/f'{name}.mp4', frames)
    picks = [23,25,29,33,36]
    contact = Image.new('RGB',(270*len(picks),500*len(versions)), '#111111')
    d = ImageDraw.Draw(contact)
    for row,(name,frames) in enumerate(versions.items()):
        for col,f in enumerate(picks):
            contact.paste(Image.fromarray(frames[f]).resize((270,480)),(col*270,row*500+20))
            d.text((col*270+3,row*500+3),f'{name} f{f}',fill='white')
    contact.save(args.output_dir/'contact.jpg', quality=94)
    for name in versions:
        Image.fromarray(versions[name][29]).save(args.output_dir/f'{name}-peak.png')
    evidence = {'source_sha256': SHA,'source_in':6,'source_out':9,'fps':FPS,'frames':COUNT,
        'source_url':'https://mixkit.co/free-stock-video/view-of-tall-trees-and-clear-sky-561/',
        'rights':'Mixkit Stock Video Free License; public source page and official licence read 28 October 2026',
        'reference':'Wanderlust558-567, inherited inspected ledger; no fresh creator-video viewing claimed on office PC',
        'source_camera_roll_degrees_approx':-13.0558,'roll_estimate_scope':'RANSAC feature affine over selected90-frame span, no generated frames',
        'rotation_degrees':rotations,'zoom_peak':1.18,'edge_radius_start':.22,'edge_radius_width':.85,
        'shutter_samples':31,'shutter_half_angle_degrees':1.5,'changed_frames':changed,
        'all_samples_within_source':True,'protected_centre_equals_zoom_preencode':True,
        'source_dimensions':[sw,sh],'sample_bounds':[min(x[0] for x in bounds),max(x[1] for x in bounds),min(x[2] for x in bounds),max(x[3] for x in bounds)],
        'audio':'silent; no hearing/beat claim','scope':'one rotating upward-looking shot; bounded lens twist, not two-shot whip or exact template',
        'outputs':{n:hashlib.sha256((args.output_dir/f'{n}.mp4').read_bytes()).hexdigest() for n in versions}}
    (args.output_dir/'evidence.json').write_text(json.dumps(evidence,indent=2))
    print(json.dumps({k:v for k,v in evidence.items() if k not in ('rotation_degrees','changed_frames')}))

if __name__ == '__main__':
    main()
