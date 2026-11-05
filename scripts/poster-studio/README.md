# Poster Studio proof engine

This local-only engine renders a versioned JSON scene graph to:

- an editable SVG with live text and independently addressed layers;
- a deterministic PNG review preview;
- a manifest containing source-asset, scene, layer and output SHA-256 hashes; and
- an amendment receipt proving exactly which stable layer IDs changed.

It deliberately does not upload assets, call a paid API or flatten an image and call it editable. The SVG is the portable interim production document. Photoshop/UXP is the preferred PSD finishing path once its local round trip is verified.

## Commands

```powershell
node scripts/poster-studio/poster-studio.mjs render C:\private\job\scene-v1.json --out C:\private\job\output
node scripts/poster-studio/poster-studio.mjs compare C:\private\job\scene-v1.json C:\private\job\scene-v2.json --out C:\private\job\amendment.json
```

Chrome is used headlessly for the local preview. Set `CHROME_PATH` only if Chrome is not installed in its normal Windows location. `--no-preview` emits SVG and the manifest without PNG rendering.

## Privacy and provenance

Scene files and client assets stay outside Git. Image layers embed the exact source bytes as data URLs so the SVG remains portable across Affinity, browsers and another workstation; the manifest records each original path, size and digest. The engine never mutates a source asset.

## Supported layer types

`image`, `text`, `rect`, `ellipse`, `path` and nested `group` layers are supported, alongside gradients, clip paths and explicit SVG filters. Layer IDs must remain stable across versions so a change receipt can prove isolated amendments.
