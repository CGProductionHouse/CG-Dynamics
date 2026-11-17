---
name: nolan-native-js-motion-study
description: Study a reference motion video and author a deterministic HTML/JavaScript motion composition for Nolan through normal ChatGPT. Use for requests about Claude-like native motion graphics, browser-generated device showcases, camera-directed typography, or building a reusable capability from a supplied video link. Extend the existing Nolan browser-motion workflow; never replace its production guard or client libraries.
---

# Native JavaScript motion, within Nolan

This is an additive research skill. It does not declare the reference replicated, install itself in all ChatGPT conversations, or approve a client film. Use the current canonical Nolan entrypoint and the exact client's existing assets and decisions first. Code generation, local execution, export, native editor handoff and creative acceptance are separate capabilities.

## Ownership and isolation

Check the latest PR #910 head and current worker ownership. Create a new branch and clean worktree for a concurrent study. Do not switch another worker's branch, force-sync its skill directory, edit its runtime, alter lockfiles or connect to its employee browser profile. Keep private references and client media outside Git. Make an additive draft PR for reconciliation into the existing library, not a second client registry or automatic worker.

## Reference intake

Record exact submitted URL, canonical URL, creator, public description, supplied screenshots, and access results. Distinguish: observed frame; observed motion; heard sound; public creator claim; inference; unknown. A TikTok comment claiming “Claude alone” is not implementation evidence. Stop at access controls. An inaccessible video cannot yield a verified frame-by-frame breakdown; use supplied frames as visual inspiration and mark timing/audio unverified. Do not treat a public study source as licensed client music or stock.

## Director brief, before effects

Write one short scene contract: subject, first visible action, visual hierarchy, camera journey, words and hold time, light/material treatment, transition logic, sound intention, payoff, and explicit omissions. Bind it to actual assets, not a list of plugin names. Choose a render route on purpose:

- HTML/CSS/SVG/Canvas: motion typography, original vector geometry, interface explainers and self-contained scenes
- Installed GSAP/Three.js: richer keyframe sequencing, actual 3D materials and camera geometry when the device supports them
- Existing footage/native editor: source-led action, real people, precise tracking and client-amendment work

No requirement to use a laptop, panels, grid or chrome text on every film. The supplied demo is one reference-inspired device study, not a global visual template. A study can remain graphics-only; a client film cannot silently inherit an unreviewed or missing soundtrack.

## Deterministic browser contract

Use the existing Nolan `window.seek(seconds)` interface. All scene state must be reconstructible from that time, with a seeded or fixed visual field. Interactive playback may use `requestAnimationFrame`, but export must seek explicitly to `frame / fps`. Pause animation before capture. Every scene transition, camera pose, mask and material state must reset correctly when seeking backwards.

Expose `window.NOLAN_READY`, scene metadata, and measurable text bounds. Reject non-finite time values. Keep source geometry and text separate. Do not infer typography rights from screenshots; a study's system font is not the client's brand font. Keep actual footage upright and source-bound. Avoid recreating interfaces or hardware while claiming they are actual screenshots or a photoreal licensed model.

## Two execution routes

**Minimum dependency demonstration:** `demo/composition.html` is one offline HTML file. It contains original JavaScript perspective geometry, Canvas rendering, dynamic screen typography, lighting approximations and mirrored geometry. It needs no third-party runtime script, network call, external font file, plugin, subscription or generative-video API. It is a generic authored device, not a manufacturer-accurate model. Canvas 2D is used because WebGL was unavailable in this sandbox; no browser policy was changed to force WebGL.

**Existing Nolan production adapter:** the composition implements `seek(t)` and can be passed to Nolan BC's installed `render.mjs` after its normal configuration and contract checks. Do not modify or bypass `motion_contract.py`, story preflight, pipeline quality, brand intake, audio review or release gating. Portable `tests/render_study.py` is an isolated proof harness, not a replacement production renderer. The composition has zero runtime libraries; the MP4 export uses existing Playwright/Chromium and FFmpeg. These are rendering tools, not a video-generation API.

## Required validation

1. Parse and execute the actual HTML in an isolated browser context. Block outside requests and record console/page errors.
2. Compare captures at A → B → A. The two A frames must match exactly, and B must differ. Verify negative controls, not only success paths.
3. Change late copy only and compare protected earlier frames. Preserve earlier versions.
4. Test all declared main-title bounds across the entire frame clock, then visually inspect full/reduced-size frames and motion. Bounds alone do not prove contrast, hierarchy or artistic quality.
5. Render at native size with explicit frame count. Probe and fully decode the exact MP4. Do not upscale a thumbnail and call it native 1080p.
6. Separately establish sound rights, voice quality, cue timing, listening and owner approval. Silence must be explicitly marked as a visual study, not a finished advert.
7. Retain source hash, environment, output hash, failed experiments and capability limits in the evidence receipt. A passing test is not “mastery.”

## Reuse and handoff

Keep the reference record, director brief, standalone composition, tests and limitations together. Publish to a separate draft branch while another Nolan worker is active; let the shared owner reconcile it. Link the evidence from the existing reference/skill queue rather than writing a duplicate global catalogue. Cross-device use requires a new environment/control render. A saved `.codex` skill does not automatically load into an arbitrary normal ChatGPT chat; the appropriate Project instructions or current handover must route the conversation to this skill.
