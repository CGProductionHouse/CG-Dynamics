"""Read-only local Premiere/interchange audit; optionally copy a project for a pilot.

Standard library only. Does not launch Premiere, execute vendor code, install a
bridge, edit project internals or upload media. Output contains private paths;
keep it outside the repository. A saved .prproj is inspected, never rewritten.
"""
from __future__ import annotations

import argparse
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import time
import urllib.parse
import xml.etree.ElementTree as ET


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def duplicate_project(source: Path, destination: Path) -> dict:
    source, destination = source.resolve(strict=True), destination.resolve()
    if source.suffix.lower() != '.prproj' or destination.suffix.lower() != '.prproj':
        raise ValueError('Only .prproj copies are supported')
    if source == destination or destination.exists():
        raise ValueError('Destination must be new; originals/previous pilots cannot be overwritten')
    before = digest(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation also prevents overwrite if a destination appears after validation.
    with source.open('rb') as src, destination.open('xb') as dst:
        shutil.copyfileobj(src, dst)
    copied, after = digest(destination), digest(source)
    if before != after or before != copied:
        raise RuntimeError('Copy integrity/original-unchanged check failed')
    return {'source_sha256': before, 'copy_sha256': copied,
            'original_unchanged': True, 'duplicate': str(destination),
            'note': 'Project copy references the same media; it is not a media backup.'}


def inspect_project(path: Path) -> dict:
    raw = path.read_bytes()
    if raw[:2] == b'\x1f\x8b':
        raw = gzip.decompress(raw)
    root = ET.fromstring(raw)
    paths = sorted({e.text for e in root.iter()
                    if e.tag in ('FilePath', 'ActualMediaFilePath') and e.text})
    # Observed native Basic Title media uses a numeric identifier in both path
    # tags, with Title=Graphic and Infinite=true. Keep that evidence visible;
    # a generated-media candidate is not an offline camera file or proof of
    # portable graphics. Internal project XML is not a public schema contract.
    generated = sorted({n.findtext('FilePath') for n in root.iter('Media')
                        if n.findtext('Title') == 'Graphic'
                        and n.findtext('Infinite') == 'true'
                        and n.findtext('FilePath', '').isdecimal()
                        and n.findtext('FilePath') == n.findtext('ActualMediaFilePath')})
    counts = Counter(e.tag for e in root.iter())
    return {'sha256': digest(path), 'bytes': path.stat().st_size,
            'xml_root': root.tag,
            'media_count': len(paths),
            'filesystem_media_count': len(set(paths) - set(generated)),
            'generated_reference_candidates': generated,
            'missing_media': [p for p in paths if p not in generated and not Path(p).exists()],
            'tag_counts': {k: v for k, v in counts.items()
                           if any(s in k.lower() for s in ('filter', 'component', 'keyframe', 'sequence'))},
            'warning': 'Internal XML counts/generated-reference candidates are diagnostics, not host readback or proof of editability/portability.'}


def decode_file_url(url: str) -> Path:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != 'file':
        raise ValueError('Interchange contains a non-local media URL')
    if parsed.netloc not in ('', 'localhost'):
        raise ValueError('UNC/non-local media requires a separate verified handover')
    path = urllib.parse.unquote(parsed.path)
    if len(path) > 3 and path[0] == '/' and path[2] == ':':
        path = path[1:]
    return Path(path)


def inspect_interchange(path: Path) -> dict:
    root = ET.parse(path).getroot()
    sequences = []
    for seq in root.findall('.//sequence'):
        video_tracks = seq.findall('./media/video/track')
        audio_tracks = seq.findall('./media/audio/track')
        refs = [e.text for e in seq.findall('.//file/pathurl') if e.text]
        paths = [decode_file_url(ref) for ref in refs]
        fmt = seq.find('./media/video/format/samplecharacteristics')
        dimensions = None if fmt is None else [int(fmt.findtext('width', '0')),
                                               int(fmt.findtext('height', '0'))]
        clips = seq.findall('.//clipitem')
        sequences.append({'name': seq.findtext('name'), 'dimensions': dimensions,
                          'frames': seq.findtext('duration'),
                          'timebase': seq.findtext('./rate/timebase'),
                          'video_tracks': len(video_tracks), 'audio_tracks': len(audio_tracks),
                          'clip_items': len(clips), 'filter_nodes': len(seq.findall('.//filter')),
                          'transition_nodes': len(seq.findall('.//transitionitem')),
                          'keyframe_nodes': len(seq.findall('.//keyframe')),
                          'rendered_title_refs': sum(p.suffix.lower() in ('.mov', '.png') for p in paths),
                          'media_references': [str(p) for p in paths],
                          'missing_media': [str(p) for p in paths if not p.exists()]})
    return {'format': root.tag, 'version': root.get('version'), 'sequences': sequences}


def inspect_builder(path: Path) -> dict:
    body = path.read_text(encoding='utf-8-sig')
    groups = {'external_render': ['ffmpeg', 'ImageDraw', 'qtrle'],
              'interchange': ['xmeml', 'fcp_xml', 'opentimelineio'],
              'host_api_or_bridge_mentions': ['evalScript', 'premierepro', 'CSInterface', 'enableQE']}
    evidence = {key: [{'line': i, 'marker': marker} for i, line in enumerate(body.splitlines(), 1)
                      for marker in markers if marker in line]
                for key, markers in groups.items()}
    return {'file': str(path), 'sha256': digest(path), 'evidence': evidence,
            'warning': 'Text matches locate evidence; absence is not a complete dependency audit.'}


def validate_output(path: Path, repo: Path, inputs: list[Path]) -> None:
    target = path.resolve()
    if target.is_relative_to(repo.resolve()):
        raise ValueError('Private inventory must be written outside the repository')
    if target in {p.resolve() for p in inputs} or target.exists():
        raise ValueError('Private output must be new and cannot overwrite any input or pilot')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, required=True)
    parser.add_argument('--interchange', type=Path, required=True)
    parser.add_argument('--builder', type=Path, action='append', default=[])
    parser.add_argument('--duplicate-project', type=Path)
    parser.add_argument('--private-output', type=Path, required=True)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[2]
    inputs = [args.project, args.interchange, *args.builder]
    if args.duplicate_project:
        inputs.append(args.duplicate_project)
    try:
        validate_output(args.private_output, repo, inputs)
    except ValueError as error:
        parser.error(str(error))
    start = time.perf_counter()
    result = {'project': inspect_project(args.project),
              'interchange': inspect_interchange(args.interchange),
              'builders': [inspect_builder(p) for p in args.builder]}
    if args.duplicate_project:
        result['duplicate'] = duplicate_project(args.project, args.duplicate_project)
    result['elapsed_seconds'] = round(time.perf_counter() - start, 3)
    result['host_api_operations_executed'] = 0
    result['installation_or_network_changes'] = False
    args.private_output.parent.mkdir(parents=True, exist_ok=True)
    with args.private_output.open('x', encoding='utf-8') as report:
        report.write(json.dumps(result, indent=2))
    print(json.dumps({'private_report_written': True, 'seconds': result['elapsed_seconds'],
                      'duplicate_verified': result.get('duplicate', {}).get('original_unchanged', False),
                      'host_api_operations_executed': 0}))


if __name__ == '__main__':
    main()
