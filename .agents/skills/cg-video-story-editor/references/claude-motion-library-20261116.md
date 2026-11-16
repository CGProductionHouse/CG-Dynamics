# Claude motion library — merged into Nolan, 16 November 2026

**What this is.** Between 10 and 12 November CA asked Claude for a "skill library for motion graphics and video editing" that learns from feedback across brands. Claude first kept it in a private Claude artifact called *CG Motion Library*; that page is **retired**. CA then chose one system for every agent (11 November) and on 16 November asked for everything Claude built and used to live in the official Nolan system. This file is that merge. It adds evidence and techniques to the existing library; it is **not** a second tracker, registry or rendering engine.

Where each part now lives:

| Part | Canonical home |
|---|---|
| Status, assignment, review, brand rules | CG Dynamics (Video Pipeline; brand rules panel tables `client_brand_profiles` / `client_brand_rules`) |
| Working files, renders, one file per feedback round | Company Drive `CG Video Editing System / Projects / <client> / <video>` |
| Shared standards and onboarding | Drive `00_START_HERE — CG Video Editing System` (both tabs) |
| Techniques, code, case studies | This repository (PR910 library); this file and the links below |
| Claude-lane router | The `nolan-video-editor` skill (thin router to the above) |

## The route Claude actually used: authored motion graphics in a seekable page

This is the same deterministic browser route recorded in [the 10 November browser-motion upgrade](../../../../docs/ops/NOLAN-BROWSER-MOTION-UPGRADE-2026-11-10.md) and draft PR982 (`window.seek(t)`, explicit frame seeking, FFmpeg encode). That note was itself built from a Claude transcript. What is new here is **two actual owner-reviewed productions** made with it, their code and their feedback. It is the right route for graphics-led films with no filmed footage (website/app showcases, listing videos built from stills, explainers); footage-led client edits stay on the existing source-bound editors.

1. A Python generator writes one self-contained HTML page: images base64-embedded, fonts local, no network. All motion is CSS keyframes and/or a JavaScript `tick(t)` that rebuilds SVG from time alone.
2. `window.seek(t)` pauses every CSS animation at `t` (`document.getAnimations()` → `pause(); currentTime=t*1000`) and calls `tick(t)`. `window.__ready` is set only after `document.fonts.ready` and every image `decode()`, after fit-to-width headlines are measured.
3. [`render_scene.py`](../../../../scripts/video-editing/studio-phase2/studies/claude-browser-motion-20261111/render_scene.py) seeks each frame (`frame/fps`), screenshots JPEG q92 at the output size and pipes to FFmpeg (libx264 CRF18 `-preset veryfast`, yuv420p, 30 fps). One file per scene, written to a `.tmp.mp4` and renamed only on exit 0. Scenes join with the concat demuxer and `-c copy`.
4. [`contact_sheet.py`](../../../../scripts/video-editing/studio-phase2/studies/claude-browser-motion-20261111/contact_sheet.py) draws the busiest moments **before** the full render. Inspect the full-size stills, not only the sheet: R06's ghost strip above "IS NEXT" was only visible at full size.
5. Probe the joined file (size, fps, decoded frame count, duration) and decode spot frames from the actual MP4.

Measured on the 2-CPU cloud workspace: about 0.45 s per 1080p frame, about 0.6 s per 1080×1920 frame with SVG rebuilds and glass blur. Three scene renders in parallel keep each call under the shell's 5-minute limit.

**Honest limits.** Claude cannot hear: both films are silent and need licensed music chosen by a person. Picture review was by decoded stills and contact sheets, not normal-speed viewing. Device frames and 3D buildings are authored drawings, not licensed photoreal models. Upscaled 320-pixel thumbnails stay small on screen.

## Read next

- [CG Production House house brief](cg-production-house-house-brand.md) — CG's own brand, live Dynamics rules and what CA liked and rejected.
- [CG websites video case study, R01–R06](cg-websites-video-case-study.md)
- [Property Gain Wilgehof listing case study, R01–R02](property-gain-wilgehof-case-study.md)
- Technique cards (same 53-family library, four new documented families):
  [device screen showcase](../../../../scripts/video-editing/studio-phase2/skills/device-screen-showcase/SKILL.md),
  [photo-anchored 3D build](../../../../scripts/video-editing/studio-phase2/skills/photo-anchored-3d-build/SKILL.md),
  [designed area map](../../../../scripts/video-editing/studio-phase2/skills/designed-area-map/SKILL.md),
  [brand-mark window reveal](../../../../scripts/video-editing/studio-phase2/skills/brand-mark-window-reveal/SKILL.md).
- Study code and receipts: [claude-browser-motion-20261111](../../../../scripts/video-editing/studio-phase2/studies/claude-browser-motion-20261111/README.md)

## Practical lessons from the two jobs

- Ask the format (16:9 / 9:16) and any missing contact detail **before** the first render; both cost a re-render when found late.
- Use the client's real screenshots and photos. Ask for full-size originals: listing sites hand out 320-pixel thumbnails.
- Never present a guessed location. Wikipedia's Wilgehof coordinate was about 1.3 km from OpenStreetMap's; OSM matched published distances.
- Keep text and devices in separate zones; centre headlines vertically; size headlines from measured glyph width.
- Gradient text through a mask must be painted once, on the moving element. Painting it on the wrapper too leaves a ghost copy outside the mask.
- Italic display type needs right padding inside overflow masks or the last glyph ("?") is clipped.
- A ring or glow that starts at full opacity is visible before its trigger time when the animation uses `both` fill; start keyframes at opacity 0.
- Delivery from the Claude app adds a C2PA content-credentials `uuid` box (5,875 bytes in both files) to the copy sent to the user. Picture data is unchanged; record hashes from the pre-delivery file.
