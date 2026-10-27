"""Render a photo-led Reel cover and its central crop previews.

Run: python make_reel_cover.py path/to/cover-config.json
Choose the actual photo and visual idea after inspecting the client's cover
history. This script only places the approved source frame, a short optional
headline, and a small existing logo. It does not invent brand graphics.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFont

W, H = 1080, 1920
POST_TOP, POST_BOTTOM = 285, 1635  # centered 1080 × 1350 Instagram post area
SQUARE_TOP, SQUARE_BOTTOM = 420, 1500


def rgb(value: str) -> tuple[int, int, int]:
    value = value.removeprefix('#')
    if len(value) != 6:
        raise ValueError(f'Expected six-digit colour: {value}')
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def transparent_logo(path: Path, max_width: int) -> Image.Image:
    """Lift a supplied logo from a white export canvas; preserve its colours."""
    source = Image.open(path).convert('RGB')
    box = ImageChops.difference(source, Image.new('RGB', source.size, 'white')).getbbox()
    if not box:
        raise ValueError('Logo has no visible mark')
    source = source.crop(box)
    source.thumbnail((max_width, 130), Image.Resampling.LANCZOS)
    pixels = np.asarray(source, dtype=np.uint8)
    opacity = np.clip(np.max(255 - pixels.astype(np.int16), axis=2) * 1.25, 0, 255).astype('uint8')
    mark = source.convert('RGBA')
    mark.putalpha(Image.fromarray(opacity, 'L'))
    return mark


def make(config_path: Path, strict: bool = False) -> Path:
    cfg = json.loads(config_path.read_text(encoding='utf-8'))
    if strict:
        review = cfg.get('cover_review') or {}
        required = ('client_offering', 'dominant_subject', 'source_identity',
                    'nearest_prior_cover', 'visible_difference')
        missing = [key for key in required if not str(review.get(key, '')).strip()]
        if missing:
            raise ValueError(f'Cover editorial review is incomplete: {", ".join(missing)}')
        if review.get('grid_size_approved') is not True:
            raise ValueError('Inspect 3:4 and square crops at grid size before final approval')
        if review.get('client_relevance_approved') is not True:
            raise ValueError('Cover subject must visibly identify the client offering')
    output = Path(cfg['output'])
    output.parent.mkdir(parents=True, exist_ok=True)
    photo = Image.open(cfg['source_frame']).convert('RGB')
    if photo.size != (W, H):
        raise ValueError(f'Source frame must be 1080 × 1920, got {photo.size}')
    image = photo.copy()
    draw = ImageDraw.Draw(image)

    headline = cfg.get('headline', '').strip()
    if headline:
        if len(headline.split()) > 4:
            raise ValueError('Keep a photo cover headline to four words or fewer')
        font = ImageFont.truetype(cfg['font'], int(cfg.get('headline_size', 68)))
        if hasattr(font, 'set_variation_by_name'):
            font.set_variation_by_name('Bold')
        x, y = map(int, cfg['headline_xy'])
        box = draw.textbbox((x, y), headline, font=font, anchor='lt')
        if box[0] < 54 or box[2] > W - 54:
            raise ValueError('Headline exceeds horizontal safe margin')
        safe_top, safe_bottom = (SQUARE_TOP, SQUARE_BOTTOM) if strict else (POST_TOP, POST_BOTTOM)
        if box[1] < safe_top or box[3] > safe_bottom:
            raise ValueError('Headline extends beyond centered grid-safe area')
        draw.text((x, y), headline, font=font, fill=rgb(cfg['headline_colour']), anchor='lt')

    mark = transparent_logo(Path(cfg['logo']), int(cfg.get('logo_width', 230)))
    lx, ly = map(int, cfg['logo_xy'])
    safe_top, safe_bottom = (SQUARE_TOP, SQUARE_BOTTOM) if strict else (POST_TOP, POST_BOTTOM)
    if lx < 54 or lx + mark.width > W - 54 or ly < safe_top or ly + mark.height > safe_bottom:
        raise ValueError('Logo extends beyond centered grid-safe area')
    image.paste(mark, (lx, ly), mark)
    image.save(output, optimize=True)

    qa_dir = Path(cfg.get('qa_dir', output.parent / 'cover_qa'))
    qa_dir.mkdir(parents=True, exist_ok=True)
    for label, height in [('grid_3x4', 1440), ('post_4x5', 1350), ('square', 1080)]:
        top = (H - height) // 2
        image.crop((0, top, W, top + height)).save(
            qa_dir / f'{output.stem}_{label}.jpg', quality=92, subsampling=0)
    return output


if __name__ == '__main__':
    if len(sys.argv) not in (2, 3) or (len(sys.argv) == 3 and sys.argv[2] != '--strict'):
        raise SystemExit('Usage: python make_reel_cover.py cover-config.json [--strict]')
    print(make(Path(sys.argv[1]), strict=len(sys.argv) == 3))
