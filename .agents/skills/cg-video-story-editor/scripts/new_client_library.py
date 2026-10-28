"""Create a small, non-destructive client video library scaffold."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


README = """# {client} video library

Status: working. Date checked: TODO.

- `brand/`: latest logo and dated source references; record exact font and verified colours.
- `footage/`: a selects ledger with original source, exact in/out, reason, rejected frames, rights and prior use.
- `audio/`: raw cue source, asset ID, licence, project registration and editorial fit.
- `premiere/`: native editable styles/MOGRTs after font and media relink testing.

Keep camera masters and final exports in the client's normal project/archive folders. Promote an item here only after checking its source and reuse status.
"""

INDEX = "asset_id,source_url,local_source,in_seconds,out_seconds,role,selection_reason,reject_before,reject_after,rights,prior_use,status\n"


def create_library(root: Path, client: str) -> Path:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 _.-]{0,79}", client):
        raise ValueError("Use a short client folder name with letters, numbers, spaces, dots, underscores or hyphens")
    folder = root.resolve() / client
    for name in ("brand", "footage", "audio", "premiere"):
        (folder / name).mkdir(parents=True, exist_ok=True)
    files = {
        folder / "README.md": README.format(client=client),
        folder / "footage" / "selects.csv": INDEX,
        folder / "brand" / "BRAND_REFERENCE.md": "# Brand reference\n\nSource links, verification date, exact font, logo and colour values: TODO.\n",
        folder / "audio" / "AUDIO_INDEX.md": "# Audio index\n\nLicensed source, asset ID, project registration and fit: TODO.\n",
        folder / "premiere" / "PREMIERE_SETUP.md": "# Premiere setup\n\nSequence format, native styles, MOGRTs, font install and relink test: TODO.\n",
    }
    for path, content in files.items():
        if not path.exists():
            path.write_text(content, encoding="utf-8")
    return folder


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("client", help="Client folder name, for example 'PSG'")
    parser.add_argument("--root", type=Path, required=True, help="Parent Client-Libraries directory")
    args = parser.parse_args()
    print(create_library(args.root, args.client))
