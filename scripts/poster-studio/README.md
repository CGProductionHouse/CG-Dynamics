# Poster Studio proof engine

This local-only engine renders a versioned JSON scene graph to:

- an editable SVG with live text and independently addressed layers;
- a deterministic PNG review preview;
- a manifest containing source-asset, scene, layer and output SHA-256 hashes; and
- an amendment receipt proving exactly which stable layer IDs changed.

It deliberately does not upload assets, call a paid API or flatten an image and call it editable. The SVG is the portable interim production document. Photoshop/UXP is the preferred PSD finishing path once its local round trip is verified.

The companion headless tools are:

- `creative-ledger.mjs` — image fingerprints plus source/shoot/person/product/service/branch/concept/headline/mechanism repetition checks for both human and AI work;
- `month-plan.mjs` — validates a proposed monthly strategy board against package, Brand Pack and future-schedule safety gates;
- `month-board.mjs` — renders the complete proposal as a responsive, printable local review board.
- `source-history-audit.py` — compares selected exact photo sources against local Canva poster previews using SIFT features and geometric verification. Requires the existing OpenCV runtime; it creates no face identities. Matches require visual review, and negative results never certify that a source is unused.

They are designed for a future normal-company-ChatGPT tool wrapper and do not require routine desktop takeover.

## Commands

```powershell
node scripts/poster-studio/poster-studio.mjs render C:\private\job\scene-v1.json --out C:\private\job\output
node scripts/poster-studio/poster-studio.mjs compare C:\private\job\scene-v1.json C:\private\job\scene-v2.json --out C:\private\job\amendment.json
```

Chrome is used headlessly for the local preview. Set `CHROME_PATH` only if Chrome is not installed in its normal Windows location. `--no-preview` emits SVG and the manifest without PNG rendering.

```powershell
node scripts/poster-studio/creative-ledger.mjs fingerprint <image>
node scripts/poster-studio/creative-ledger.mjs check <ledger.json> <candidate.json> --out <receipt.json>
node scripts/poster-studio/month-plan.mjs <month-plan.json> <brand-pack-index.json>
node scripts/poster-studio/month-board.mjs <month-plan.json> <private-output.html>
python scripts/poster-studio/source-history-audit.py --source <original.jpg> --history <private-thumbnail-directory> --out <private-report.json>
```

The history matcher records every preview hash and decode error. Its controlled test places a resized source inside a poster and checks that an unrelated texture is rejected. Small, heavily overlaid, edited, same-shoot or missing historical content still needs visual/history review; do not promote a candidate automatically from this report.

## Privacy and provenance

Scene files and client assets stay outside Git. Image layers embed the exact source bytes as data URLs so the SVG remains portable across Affinity, browsers and another workstation; the manifest records each original path, size and digest. The engine never mutates a source asset.

## Supported layer types

`image`, `text`, `rect`, `ellipse`, `path` and nested `group` layers are supported, alongside gradients, clip paths and explicit SVG filters. Layer IDs must remain stable across versions so a change receipt can prove isolated amendments.
