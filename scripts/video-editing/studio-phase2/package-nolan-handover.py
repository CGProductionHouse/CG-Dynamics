"""Package the tracked Nolan text/code library, with per-file integrity evidence.

No media, credentials, model weights, dependencies or installed device state.
Run after commit; an archive is a dated snapshot, never the latest-branch authority.
"""
from pathlib import Path, PurePosixPath
import argparse, hashlib, json, subprocess, zipfile

ROOT = Path(__file__).resolve().parents[3]
SUFFIXES = {'.md', '.py', '.ps1', '.json', '.txt', '.csv', '.yml', '.yaml', '.js', '.ts', '.tsx'}
ROOT_FILES = {'NOLAN-START-HERE.md', 'AGENTS.md', 'CONTINUE-HERE.md', 'README.md'}
PREFIXES = ('.agents/skills/cg-video-story-editor/', 'scripts/video-editing/studio-phase2/',
            'docs/ops/', 'docs/ai-workforce/', 'docs/vision/')

def sha(data):
    return hashlib.sha256(data).hexdigest()

def verify(path):
    with zipfile.ZipFile(path) as archive:
        manifest = json.loads(archive.read('NOLAN-PACKAGE-MANIFEST.json'))
        expected = {row['path'] for row in manifest['files']}
        names = archive.namelist()
        if len(names) != len(set(names)) or set(names) != expected | {'NOLAN-PACKAGE-MANIFEST.json'}:
            raise ValueError('Missing, duplicate or unexpected archive members')
        for row in manifest['files']:
            p = PurePosixPath(row['path'])
            if p.is_absolute() or '..' in p.parts or ':' in str(p) or '\\' in str(p):
                raise ValueError('Unsafe archive path')
            data = archive.read(row['path'])
            if len(data) != row['bytes'] or sha(data) != row['sha256']:
                raise ValueError('Archive integrity failed: ' + row['path'])
        if 'NOLAN-START-HERE.md' not in expected:
            raise ValueError('Current entry point missing')
        return manifest

def package(output):
    def git(*args):
        return subprocess.check_output(['git', '-C', str(ROOT), *args]).decode('utf8').strip()
    if git('diff', '--name-only', 'HEAD'):
        raise ValueError('Commit reviewed tracked changes before making a provenance-bound snapshot')
    output = Path(output).resolve()
    if output.is_relative_to(ROOT):
        raise ValueError('Keep the distributed archive outside the repository')
    files = [p for p in git('ls-files').splitlines()
             if p in ROOT_FILES or (p.startswith(PREFIXES) and Path(p).suffix.lower() in SUFFIXES)]
    payload = [(name, (ROOT / name).read_bytes()) for name in files]
    manifest = dict(repository='CGProductionHouse/CG-Dynamics', source_commit=git('rev-parse', 'HEAD'),
                    source_branch=git('branch', '--show-current'), authority='Live PR910 head, not this dated snapshot',
                    device_installation='Not established by this package',
                    files=[dict(path=n, bytes=len(data), sha256=sha(data)) for n, data in payload])
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, data in payload:
            archive.writestr(name, data)
        archive.writestr('NOLAN-PACKAGE-MANIFEST.json', json.dumps(manifest, indent=2))
    verify(output)
    return dict(path=str(output), bytes=output.stat().st_size, sha256=sha(output.read_bytes()),
                source_commit=manifest['source_commit'], files=len(payload))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output')
    parser.add_argument('--verify')
    args = parser.parse_args()
    if bool(args.output) == bool(args.verify):
        parser.error('Choose --output or --verify')
    result = package(args.output) if args.output else verify(args.verify)
    print(json.dumps(result if args.output else dict(verified=True, source_commit=result['source_commit'], files=len(result['files'])), indent=2))
