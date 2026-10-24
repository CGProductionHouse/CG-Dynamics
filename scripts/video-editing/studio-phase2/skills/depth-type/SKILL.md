---
name: nolan-depth-type-experimental
description: Reproduce the isolated ECHOFORM kinetic typography and green-screen human foreground proof for issue 874; use only for rights-cleared local experiments until a CG reviewer approves it.
---

# Depth typography on moving human footage — rendered, not mastered

**Category:** text / compositing / sound sync. **Lifecycle:** researched → local code rendered and revised → **human motion/audio review pending** → CG use untested → mastered **NO**.

Use this card when a story calls for a human crossing in front of purposeful typography and the editor has a permitted, clean green-screen take. Read the [source manifest and reproducibility notes](../../README.md) before using it. This effect is not a general person-segmentation model, not a verified replica of the inaccessible owner TikTok, and not automatically suitable for PSG.

## Working implementation

- HTML/GSAP source: `../../scene/index.html`; exact source-only word correction: `../../revision.json`.
- Pinned dependencies: local `hyperframes@0.8.183` (Apache-2.0), `gsap@3.14.2` (GSAP no-charge standard licence), `npm ci --ignore-scripts`; FFmpeg 8.1.1. Vendor JS stays in ignored `node_modules`/render output. Typeface: Space Grotesk SIL OFL file and notice in `../../scene/assets/`.
- FFmpeg `chromakey` then `despill` foreground overlay; cuts/fps/audio mix are in `../../render.py`. The renderer sets process-only telemetry opt-out. Source stock licences and hashes are in `../../project.json`.
- Render: run `python render.py baseline`, `python render.py revision`, `python verify.py` from the phase-2 folder after stocking ignored `media/` with matching rights-cleared files. Use the ignored `output/<variant>/scene/index.html` as the generated editable source and receipts as render history.
- Actual example: 4.5 s 1080×1920 real Mixkit moving performer, [moving A/B](../../proof-motion-ab.mp4), [baseline](../../proof-baseline.mp4), [revision](../../proof-revision.mp4), [2 fps contact](../../proof-contact.png), [A/B text frame](../../proof-ab.png) and exact receipts. Audio is licensed Mixkit music + whoosh, not AI-generated.

## Adjustable inputs

`scene/index.html`: font, visual hierarchy, palette, word entrance times/easing, halo movement/perspective, title positions and CTA. `revision.json`: exact expected old and new word. `project.json` + `render.py`: licensed clip, shot in-point, source checksums, 9:16 crop/scale/placement, chroma tolerance/despill, score in-point, effects level and mix. For a new scene, do not merely replace a word: check the actual person's path and readable negative space frame by frame.

## Known failure cases and review gates

The Mixkit green-screen take has visible fine hair/arm edge spill; plain real-world footage requires a separately tested natural-background mask. Large type can become unreadable when the figure covers too much of a word. Small top/bottom labels are not in conservative social UI safe areas. Chromium/GSAP/H.264 output shows pre-change raster drift when the HTML word changes (0/33 first decoded frames byte-identical, SSIM 0.994555); audio PCM is identical. This is a **precise source edit with approximate unchanged visuals**, not protected pixel identity. Human listening, full-speed phone review, 4K performance, real CG brand suitability and owner reference comparison remain open.

Use when the occlusion advances a verified narrative and an editor can review its edges and rhythm. Avoid when claims, client identity, licence, source availability, hair matte quality or platform readability are uncertain. Promote to `mastered` only after successful work on appropriate real CG footage plus explicit CG creative approval; a successful render or installed skill alone does not qualify.
