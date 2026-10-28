"""Check ordinary Pixieset owner downloads against a private gallery revision.

No network access, uploading or photographic approval. Before replacing a slot,
verify its download against the last confirmed revision. After processing, verify
a new download against the candidate revision, bound to that before-check.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

VERSION = "0.1.0"


def digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def manifest_item(manifest: Path, filename: str) -> tuple[dict, dict]:
    data = json.loads(manifest.read_text(encoding="utf-8"))
    items = data["items"]
    names = [item["file"] for item in items]
    if data.get("count") != len(items) or len(set(names)) != len(names):
        raise ValueError("Manifest count or filenames are invalid")
    if Path(filename).name != filename or filename not in names:
        raise ValueError("Exact photo filename is absent from the manifest")
    return data, next(item for item in items if item["file"] == filename)


def verify(manifest: Path, filename: str, download: Path, before_proof: Path | None = None) -> dict:
    manifest = manifest.resolve(strict=True)
    download = download.resolve(strict=True)
    data, item = manifest_item(manifest, filename)
    expected = item["output_sha256"].lower()
    actual = digest(download)
    if actual != expected:
        raise ValueError("Downloaded bytes differ from this revision; inspect the live photo before any replacement")
    phase = "before"
    previous = None
    if before_proof is not None:
        phase = "after"
        previous = json.loads(before_proof.read_text(encoding="utf-8"))
        if (previous.get("phase") != "before" or previous.get("state") != "MATCH"
                or previous.get("file") != filename):
            raise ValueError("Before-proof is not a matching check for this photo")
        old_manifest = Path(previous["manifest"])
        old_download = Path(previous["download"])
        if digest(old_manifest) != previous["manifest_sha256"]:
            raise ValueError("Before manifest changed after its check")
        _, old_item = manifest_item(old_manifest, filename)
        if (digest(old_download) != old_item["output_sha256"].lower()
                or previous["download_sha256"] != old_item["output_sha256"].lower()):
            raise ValueError("Before download or proof changed after its check")
        if data.get("revision_from") != previous["manifest_sha256"]:
            raise ValueError("Candidate revision does not descend from the checked before manifest")
        if filename not in data.get("replaced_files", []):
            raise ValueError("Candidate revision does not list this photo as replaced")
        if (item["source_sha256"] != old_item["source_sha256"]
                or item["dimensions"] != old_item["dimensions"]):
            raise ValueError("Replacement changed camera provenance or dimensions")
        if expected == old_item["output_sha256"].lower():
            raise ValueError("Candidate is unchanged; no replacement was established")
    return {
        "version": VERSION, "phase": phase, "state": "MATCH", "file": filename,
        "manifest": str(manifest), "manifest_sha256": digest(manifest),
        "download": str(download), "download_sha256": actual,
        "before_manifest_sha256": previous["manifest_sha256"] if previous else None,
        "photographic_approval": False,
        "scope": "user-supplied owner-download bytes only; no network or gallery ownership attestation",
    }


def save_proof(path: Path, proof: dict) -> None:
    # Never replace another result. Repeating an identical check is safe.
    if path.exists():
        if json.loads(path.read_text(encoding="utf-8")) != proof:
            raise FileExistsError("Proof already exists with different contents")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as stream:
        json.dump(proof, stream, indent=2)
        stream.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", action="version", version=VERSION)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--file", required=True)
    parser.add_argument("--download", type=Path, required=True)
    parser.add_argument("--before-proof", type=Path)
    parser.add_argument("--proof", type=Path, required=True, help="Private local proof JSON; never commit")
    args = parser.parse_args()
    try:
        proof = verify(args.manifest, args.file, args.download, args.before_proof)
        save_proof(args.proof, proof)
    except (ValueError, KeyError, OSError) as error:
        parser.exit(2, f"BLOCKED: {error}\n")
    print(json.dumps({"phase": proof["phase"], "state": proof["state"],
                      "file": proof["file"], "photographic_approval": False}))


if __name__ == "__main__":
    main()
