---
name: nolan-depth-type-experimental
description: Build and compare foreground-over-type experiments on cleared moving footage using the tested keyed-code or native on-device mask route; keep human and client acceptance separate.
---

# Depth typography on moving human footage — rendered, not mastered

## 29 October office background screen: runner across fixed word

[Licensed natural-runner screen](../../RUNNER-DEPTH-TYPE-SCREEN-20261029.md) compares an identical silent 72-frame shot with no title, type in front, and type behind a moving human. The first 24 decoded frames stay pixel-identical. R02's feathered GrabCut matte **fails** on source frames 148–151 because a connected path strip is pulled in front of the word. R03 repairs those four mattes and retains the protected opening; decoded contacts at five crossing phases and full-size frames 36/40 show readable text and the runner above it. This is one source-specific landscape/code-rendered mechanism, not generic natural segmentation, native editability, physical-phone judgement or client approval. Preserve the failed R02 and full-motion/hair/feet checks before adapting to a story.

## 28 October extension: split-tone changing words and full-motion edge repair

`python render_split_tone_ab.py --output-dir PRIVATE_DIR` adds a90-frame/3s540×960 front-versus-behind layer-order control inspired by Wanderlust frames125–209. It reuses the existing licensed Mixkit28306 dancer, source3–6s, SHA256 `80e0bf3d84faf6e2b0efabfc9001aeadde09e1ce56d0530360ceff5b9be596a5`, existing Space Grotesk OFL font and original seeded texture. FIND/YOUR/FLOW change each second; restrained blue/gold split material is separate from the gold-bevel proof. It is fictional practice, not a new client palette.

**First version rejected:** a400px-wide foreground layer pasted into a540px canvas cut the moving arm at its internal right edge. The source reaches that edge on frames13–89. Anchoring left/bottom alone was insufficient; sparse early frames missed it. Preserve private `rejected-internal-right-edge-*` outputs. Repair expands the permitted original crop to1642×2160 at x1312, scales to540×710 and places it at(0,250). Both horizontal crop edges now coincide with frame edges, torso meets frame-bottom, and the internal top edge is transparent throughout the source interval. No painted/fabricated extension.

The repaired front/behind exports fully decode90 frames. Full/reduced contacts including late frames45/60/75/89 were inspected; opaque foreground stays in front, with minimum91.42% glyph visibility across this particular word/path combination. Behind SHA256 `ead6ed2a5c14444f2abafbca592347e5e963f9bde6b1f374808818ab4e17874d`. Private outputs and JSON: `C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Practice\wanderlust-diaries\proofs\split-tone-depth`. Green-screen hair/spill limitations remain. This does not establish natural segmentation, kinetic fragmentation from the reference, full-speed/physical-phone approval, heard sound or native editable handoff. Audit **every internal layer boundary through the whole motion**, not only the opening pose.

**Category:** text / compositing / sound sync. **Lifecycle:** researched → local code rendered and revised → **human motion/audio review pending** → CG use untested → mastered **NO**.

Use this card when a story calls for a human crossing in front of purposeful typography and the editor has cleared footage with a verified usable matte. The independent code below assumes a clean green-screen take; the native on-device route below has one bounded natural-scene proof. Read the [source manifest and reproducibility notes](../../README.md) before using it. This effect is not a general person-segmentation model and is distinct from the now-viewed owner TikTok, which shows footage *inside* text via an alpha track matte. It is not automatically suitable for PSG.

## Working implementation

- HTML/GSAP source: `../../scene/index.html`; exact source-only word correction: `../../revision.json`.
- Pinned dependencies: local `hyperframes@0.8.183` (Apache-2.0), `gsap@3.14.2` (GSAP no-charge standard licence), `npm ci --ignore-scripts`; FFmpeg 8.1.1. Vendor JS stays in ignored `node_modules`/render output. Typeface: Space Grotesk SIL OFL file and notice in `../../scene/assets/`.
- FFmpeg `chromakey` then `despill` foreground overlay; cuts/fps/audio mix are in `../../render.py`. The renderer sets process-only telemetry opt-out. Source stock licences and hashes are in `../../project.json`.
- Render: run `python render.py baseline`, `python render.py revision`, `python verify.py` from the phase-2 folder after stocking ignored `media/` with matching rights-cleared files. Use the ignored `output/<variant>/scene/index.html` as the generated editable source and receipts as render history.
- Actual example: 4.5 s 1080×1920 real Mixkit moving performer, [moving A/B](../../proof-motion-ab.mp4), [baseline](../../proof-baseline.mp4), [revision](../../proof-revision.mp4), [2 fps contact](../../proof-contact.png), [A/B text frame](../../proof-ab.png) and exact receipts. Audio is licensed Mixkit music + whoosh, not AI-generated.

## Adjustable inputs

`scene/index.html`: font, visual hierarchy, palette, word entrance times/easing, halo movement/perspective, title positions and CTA. `revision.json`: exact expected old and new word. `project.json` + `render.py`: licensed clip, shot in-point, source checksums, 9:16 crop/scale/placement, chroma tolerance/despill, score in-point, effects level and mix. For a new scene, do not merely replace a word: check the actual person's path and readable negative space frame by frame.

## Known failure cases and review gates

The Mixkit green-screen take has visible fine hair/arm edge spill; plain real-world footage requires a separately tested natural-background mask. **Check the entire moving cutout for a floating edge:** extend the source beyond the frame boundary or hide its cut edge with a plausible scene object. Do not let a keyed torso, product or vehicle terminate against empty background without visual support. Large type can become unreadable when the figure covers too much of a word. Small top/bottom labels are not in conservative social UI safe areas. Chromium/GSAP/H.264 output shows pre-change raster drift when the HTML word changes (0/33 first decoded frames byte-identical, SSIM 0.994555); audio PCM is identical. This is a **precise source edit with approximate unchanged visuals**, not protected pixel identity. Human listening, full-speed phone review, 4K performance and real CG brand suitability remain open. The owner-reference comparison is complete: this is a separate effect family.

A later [dark-backdrop mug proof](../../DARK-BACKDROP-DEPTH.md) adds one real-camera, non-green-screen foreground example. A naive black key leaked type through the dark green mug; a shot-specific color/brightness mask preserved the mug and hands in sampled frames. The mask and title fade are tied to that nearly black background. It does not establish general foreground extraction, perspective tracking or natural-office-shot compatibility. Inspect the complete moving result before reuse.

A [natural boxing-gym source screen](../../FIGHT-NATURAL-DEPTH-SOURCE-SCREEN.md) tried a narrow GrabCut glove/forearm foreground at three action phases. The body stayed anchored at the frame edge, but the bag and glove obscured nearly all of `HIT`; only fragments remained. **Reject the shot/word placement before refining the mask.** A technically plausible foreground layer does not rescue unreadable typography.

Use when the occlusion advances a verified narrative and an editor can review its edges and rhythm. Avoid when claims, client identity, licence, source availability, hair matte quality or platform readability are uncertain. Promote to `mastered` only after successful work on appropriate real CG footage plus explicit CG creative approval; a successful render or installed skill alone does not qualify.

Portability: pass `--source ABSOLUTE_LOCAL_ORIGINAL` on another PC instead of copying the MSI directory layout. The exact recorded SHA-256 remains mandatory. Use a private output directory; reacquire only the permitted source, never client/reference media from an external service.

## Office natural foreground / native alternative28October2026

[Actual90-frame natural-mask study](../../OFFICE-NATURAL-MASK-STUDY-20261028.md) uses cleared Mixkit4825 on installed Premiere26.5 Object Mask, not a green screen. Track the selected subject, drag the Unassigned Mask to Opacity, keep original pictureV1/native titleV2/masked duplicateV3. Compare exact title in front versus behind and inspect the whole moving mask separately over black. The latter diagnostic MP4 is not alpha media. OUTSIDE lost too much wording and was rejected; MAKE/SPACE opens away from the subject with editable position/opacity keys. Natural hair retains some fuzz/softness; no arbitrary matte mastery.

Actual saved native R02 close/reopen/export90/90 decoded frames equal. SPACE→TIME native revision exports with keys preserved; encoded protected regions are not pixel-identical. **Handover must include the untouched corresponding `[project name] Masks` folder (`.prmf`), `.prproj`, original media and fonts.** Native Save As created separate version folders here; second-PC relocation/staff relink remains a required test. The full study has source/output hashes, exact title controls, GPU/observed tracking indicator, UI failure/recovery and inspection limits. This landscape silent proof does not clear vertical platform layout, hearing, physical phone or creative/client acceptance.
