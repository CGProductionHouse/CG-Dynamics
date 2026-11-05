"""Read-only verification of the private office research handover archives.

Does not download, extract, install, overwrite files or execute archive contents.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import stat
import zipfile
from pathlib import Path, PurePosixPath


def digest(stream) -> str:
    h = hashlib.sha256()
    while block := stream.read(1024*1024):
        h.update(block)
    return h.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, default=Path(__file__).with_name('NOLAN-OFFICE-RESEARCH-ASSET-MANIFEST-20261028.json'))
    parser.add_argument('--archive-dir', type=Path, required=True)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding='utf-8'))
    total = 0
    for archive in manifest['archives']:
        path = args.archive_dir / archive['name']
        if path.stat().st_size != archive['bytes']:
            raise ValueError(f'Archive size mismatch: {path.name}')
        with path.open('rb') as stream:
            if digest(stream) != archive['sha256']:
                raise ValueError(f'Archive SHA-256 mismatch: {path.name}')
        with zipfile.ZipFile(path) as bundle:
            names = bundle.namelist()
            if len(names) != len(set(names)):
                raise ValueError('Duplicate ZIP entries')
            for info in bundle.infolist():
                name = info.filename
                if PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or '\\' in name or ':' in name:
                    raise ValueError(f'Unsafe ZIP member: {name}')
                if stat.S_ISLNK(info.external_attr >> 16):
                    raise ValueError(f'Unexpected symlink: {name}')
            inner = json.loads(bundle.read('ASSET-MANIFEST.json'))
            entries = inner['files']
            if len(entries) != archive['file_count']:
                raise ValueError('Manifest count mismatch')
            expected = {e['path'] for e in entries} | {'READ-FIRST.txt', 'ASSET-MANIFEST.json'}
            if set(names) != expected:
                raise ValueError('Unmanifested or missing ZIP entries')
            for item in entries:
                if bundle.getinfo(item['path']).file_size != item['bytes']:
                    raise ValueError(f'Member size mismatch: {item["path"]}')
                with bundle.open(item['path']) as stream:
                    if digest(stream) != item['sha256']:
                        raise ValueError(f'Member SHA-256 mismatch: {item["path"]}')
            total += len(entries)
        print(f'VERIFIED {path.name}: {archive["file_count"]} files')
    print(f'VERIFIED {len(manifest["archives"])} archives / {total} practice evidence and input files; no extraction performed')


if __name__ == '__main__':
    main()
