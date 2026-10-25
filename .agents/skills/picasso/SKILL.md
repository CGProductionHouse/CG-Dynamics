---
name: picasso
description: Run private local JPEG photography culling and conservative first-pass finishing for CG Production House from ChatGPT Work. Use for approved shoot folders, review previews, and job status; never publish galleries.
---

# PICASSO

Use this skill in a **local ChatGPT Work chat on the MSI Windows host**. Ask for the exact approved input folder and a separate private job folder. Use the installed skill's `scripts/picasso.py`, or the repository's `scripts/picasso/picasso.py` when working in the checkout. Do not send originals or previews to a cloud tool. In the ChatGPT desktop app, local skills and local shell access must be enabled for the task. If those controls are absent, report the blocker and use the host's supported local Work setup, not a hosted photo app.

## Local workflow

1. Confirm the folder is approved for this test. Existing CG Pixieset libraries are approved as example sources, but the selected photos must first be exported locally through Pixieset's normal owner download. A prior Chrome attempt was blocked by `ERR_BLOCKED_BY_CLIENT`; never bypass that browser protection or code against Pixieset's internal request URLs. Inspect only filenames/count and disk space initially.
2. Start or resume with `python <picasso.py path> run --input "<approved JPEG folder>" --job "<private job folder>" --limit 25`. The runner reads originals, writes `output/`, `previews/`, `contact-sheet.jpg`, and `manifest.json` in the job folder, and records failures without deleting files. Resume by repeating the same command and folders. For status, use `python <picasso.py path> status --job "<private job folder>"`.
3. Show the contact sheet and selected before/after previews to the human reviewer through local file preview. Review all `REVIEW` and `ALTERNATE` items; preserve important moments even if technically weaker. Do not present heuristic face or focus scores as verified eyes-open or expression judgments. Manual classification edits in the manifest must remain reversible and auditable.
4. For portraits needing subtle blemish work, use the licensed Photoshop on a **duplicate output** with the person's approval. Record which output was retouched and its settings. No identity reshaping, permanent feature removal, artificial smooth skin, generative restyling, or automatic claims of blemish detection.
5. Human approval is required before any Pixieset upload. Use staff's normal approved browser upload into a private review collection, or the official Lightroom Classic publishing plugin only when locally installed and configured. Verify the target collection and storage availability. Never auto-publish, share, scrape, or invent a Pixieset API. The Pixieset Photo Editor requires separate authorization and may require Pro or generative credits; do not assume it satisfies R0.

## Editor choice

The host audit in `docs/ops/PICASSO-LOCAL-EDITOR-2026-10-25.md` is the current baseline. Prefer Lightroom Classic Assisted Culling, saved presets, masking, and batch export **when the host actually has Lightroom Classic and a staff-approved catalog**. As of the baseline, this MSI has Photoshop 2026 but no Lightroom Classic, digiKam, or darktable. The bundled Python/OpenCV/Pillow runner is a narrow local first pass using installed libraries, not a replacement for Lightroom's review controls. Do not install multiple editors or LightCraft speculatively. `digiKam` culling and `darktable-cli` are optional mature free paths only after a specific quality gap is established and their Windows builds are reviewed.

## Quality and privacy gates

- Only existing JPEGs. Preserve original bytes, dimensions and orientation; output one sRGB-tagged JPEG encode at high quality. An untagged input is **assumed** sRGB and flagged for review.
- Exposure, face luminance, clipping, cast, and focus are heuristics. Never promise recovery of clipped JPEG data. Keep warm atmosphere and natural skin. The first pass does no automatic skin retouch and does not detect open eyes or expression.
- The job manifest, previews, originals, client names, and EXIF stay in private local storage. The exported JPEGs omit source EXIF/GPS. Do not commit or paste client media or private file paths into GitHub.
- Stop at the 25 approved-sample human quality gate. Run 100 and then 1,000 only after the reviewer approves the smaller batch. Report measured time, versions, errors, quality findings, and R0 incremental spend. Never claim everyday ChatGPT invocation until a user actually runs this skill from ChatGPT Work.
