"""Private raster-overlay preflight for declared protected design regions.

Checks alpha coverage at the actual placement, not font glyphs, taste or actual
Canva stacking. Never rasterises text, edits sources, uploads or approves artwork.
Temporary manually marked face/hand/photo-feature boxes may require strict graphic
clearance; this does not identify people or create a biometric database.
"""
import argparse
import json
import math
from pathlib import Path

from PIL import Image


def rect(value, label):
    if not isinstance(value, list) or len(value) != 4:
        raise ValueError(f"{label} requires [left, top, width, height]")
    if any(isinstance(n, bool) or not isinstance(n, (int, float)) or not math.isfinite(n) for n in value):
        raise ValueError(f"{label} requires four finite numbers")
    if value[2] <= 0 or value[3] <= 0:
        raise ValueError(f"{label} dimensions must be positive")
    return tuple(value)


def audit(manifest, base_path=Path('.')):
    if manifest.get('schemaVersion') != 1:
        raise ValueError('schemaVersion 1 is required')
    canvas = manifest.get('canvas', {})
    width, height = canvas.get('width'), canvas.get('height')
    if any(isinstance(n, bool) or not isinstance(n, int) or not 1 <= n <= 8192 for n in (width, height)):
        raise ValueError('canvas dimensions must be integers from 1 to 8192')
    regions = manifest.get('regions')
    overlays = manifest.get('overlays')
    if not isinstance(regions, list) or not isinstance(overlays, list):
        raise ValueError('regions[] and overlays[] are required')
    ids = set()
    for region in regions:
        if not isinstance(region.get('id'), str) or not region['id'].strip() or region['id'] in ids or not isinstance(region.get('pageId'), str) or not region['pageId'].strip():
            raise ValueError('regions require unique ids and exact pageIds')
        ids.add(region['id'])
        rect(region.get('rect'), 'region.rect')
        if not isinstance(region.get('strictClearance', False), bool):
            raise ValueError('strictClearance must be boolean')
    findings, measured, skipped = [], 0, 0
    overlay_ids = set()
    for overlay in overlays:
        if not isinstance(overlay.get('id'), str) or not overlay['id'].strip() or overlay['id'] in overlay_ids or not isinstance(overlay.get('pageId'), str) or not overlay['pageId'].strip():
            raise ValueError('overlays require unique ids and exact pageIds')
        overlay_ids.add(overlay['id'])
        left, top, ow, oh = rect(overlay.get('rect'), 'overlay.rect')
        if ow > 16384 or oh > 16384:
            raise ValueError('overlay dimensions exceed bounded local preflight')
        order = overlay.get('declaredOrder')
        if order not in ('above-existing-content', 'background-plane'):
            raise ValueError('declaredOrder must explicitly identify overlay stacking')
        # Native API does not expose z-order; background placement is an explicit
        # input assertion, never a positive machine verification of stacking.
        if order == 'background-plane':
            skipped += 1
            continue
        opacity = overlay.get('opacity', 1)
        if isinstance(opacity, bool) or not isinstance(opacity, (int, float)) or not math.isfinite(opacity) or not 0 <= opacity <= 1:
            raise ValueError('opacity must be between 0 and 1')
        path = Path(overlay['path'])
        if not path.is_absolute():
            path = Path(base_path) / path
        with Image.open(path) as image:
            alpha = image.convert('RGBA').getchannel('A').resize((max(1, round(ow)), max(1, round(oh))), Image.Resampling.NEAREST)
        alpha = alpha.point(lambda a: round(a * opacity))
        placed = Image.new('L', (width, height))
        placed.paste(alpha, (round(left), round(top)))
        exceptions = overlay.get('reviewedOcclusions', {})
        if not isinstance(exceptions, dict) or any(k not in ids or not isinstance(v, str) or len(v.strip()) < 24 for k, v in exceptions.items()):
            raise ValueError('reviewedOcclusions must name exact region ids and a substantive review reason')
        for region in regions:
            if region['pageId'] != overlay['pageId']:
                continue
            x, y, rw, rh = rect(region['rect'], 'region.rect')
            box = (max(0, math.floor(x)), max(0, math.floor(y)), min(width, math.ceil(x + rw)), min(height, math.ceil(y + rh)))
            if box[2] <= box[0] or box[3] <= box[1]:
                continue
            histogram = placed.crop(box).histogram()
            total = sum(histogram)
            opaque = sum(histogram[200:]) / total
            tint = sum(histogram[64:]) / total
            visible = sum(histogram[32:]) / total
            measured += 1
            strict = region.get('strictClearance', False)
            severity = 'blocker' if (strict and visible > 0) or opaque >= .20 or tint >= .65 else 'review' if visible >= .15 else None
            if not severity:
                continue
            reason = exceptions.get(region['id'])
            findings.append({
                'overlayId': overlay['id'], 'regionId': region['id'], 'pageId': region['pageId'],
                'severity': 'reviewed-occlusion' if reason else severity,
                'unreviewedSeverity': severity, 'opaqueCoverage': round(opaque, 4),
                'tintCoverage': round(tint, 4), 'visibleCoverage': round(visible, 4),
                'strictClearance': strict,
                'reviewReason': reason,
            })
    return {
        'schemaVersion': 1, 'blockerCount': sum(f['severity'] == 'blocker' for f in findings),
        'reviewCount': sum(f['severity'] == 'review' for f in findings),
        'reviewedOcclusionCount': sum(f['severity'] == 'reviewed-occlusion' for f in findings),
        'measuredPairs': measured, 'declaredBackgroundPlanesNotChecked': skipped,
        'findings': findings,
        'meaning': 'Declared front-layer alpha coverage of region boxes only. No glyph, native z-order, font, taste, factual accuracy or human creative approval claim.',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    result = audit(json.loads(args.manifest.read_text(encoding='utf-8-sig')), args.manifest.parent)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k != 'findings'}))
    return 2 if result['blockerCount'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
