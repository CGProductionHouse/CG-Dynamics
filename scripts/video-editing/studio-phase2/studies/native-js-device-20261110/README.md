# Nolan native JavaScript motion study

A self-contained original motion composition, built in normal ChatGPT to investigate the owner's “Claude without plugins” reference. This is an additive, isolated research package, not a new client-rendering engine.

## Open the composition

Open `demo/composition.html` in a browser. It runs offline. Use **Play study** or scrub the timeline. The file contains all graphics and animation code; it does not load external fonts, libraries, images, videos or account services. The generic laptop is drawn from original geometry, not a licensed Apple product model. The preview has no audio.

## Existing Nolan integration

The composition exposes the same `window.seek(seconds)` clock used by Nolan BC's current browser adapter. Use that adapter's existing configuration and technical-study contract. Keep its story, quality, sound and client-release gates intact. Do not replace the running runtime or bulk-install a new skill while another worker is active.

`tests/render_study.py` is an isolated proof harness. It uses already-installed Playwright, Chromium and FFmpeg; it never installs them or attaches to a user browser profile.

```sh
python tests/render_study.py --tests-only --chromium /path/to/chromium --ffmpeg /path/to/ffmpeg
python tests/render_study.py --chromium /path/to/chromium --ffmpeg /path/to/ffmpeg --output /new/output/NOLAN-MOTION-STUDY.mp4
```

Use a **new** output filename per revision. On Windows, pass the existing Chrome and FFmpeg executables. Do not assume Linux and Windows system fonts are pixel-identical. Scene dimensions are 1920×1080, 30fps, 18s/540 frames.

## Files

- `SKILL.md`: reference-to-composition workflow and acceptance boundaries
- `REFERENCE.json`: exact TikTok identity and honest access status
- `DIRECTOR-BRIEF.json`: scene jobs, palette, motion and exclusions
- `RESEARCH.md`: platform findings, primary sources and limitations
- `demo/composition.html`: offline single-file animation
- `tests/render_study.py`: deterministic seeking, negative controls, preserved earlier frames, text bounds and MP4 validation
- `evidence/QA-REPORT.json`: actual local test/export receipt when generated

The initial WebGL route was unavailable; Canvas 2D perspective geometry was used without altering browser policy. A rejected test also caught JavaScript global redeclaration during document replacement; the scene is now closure-scoped. Failed experiments are not passed-off as successful production.

## Status

The HTML is a technical visual study. It is silent, uses system type rather than approved CG brand fonts, and has not been approved as a client advert. Native source editability means HTML/JavaScript here, not an After Effects or Premiere project. A draft branch or downloaded skill does not automatically activate the skill in every future chat or computer.
