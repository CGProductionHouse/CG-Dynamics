# Nolan M07: source-tracked optical lens mask, 11 November 2026

**Status: source-specific technical mechanism qualified on DESKTOP-M1VHEJF only; M07 remains IN_PROGRESS.** This is not a client advert, finished creative style, third-party TikTok/Facebook recreation, real filmed camera, native editor project, or usable music proof.

## Source and mechanism

- **Actual moving source:** prequalified 3-second / 90-frame / 1920x1080 silent Blender animation of **Poly Haven Camera 01**, from the already verified M03 CC0 .blend; exact source SHA256 `0b771891a9313d20e370774810523a0c951097d8bcd7681f20e3b07a7afb0b22`. This is an original render of a legitimate CC0 3D model, **not live-action footage**. Source provenance: https://polyhaven.com/a/Camera_01 ; official CC0 terms: https://polyhaven.com/license ; M03 source digest recorded in prior milestone. Reused the existing source with no new download.
- Feature tracking in `track_lens.py`: manually bound initial actual lens ROI (center 1138,597px, radius117px); downsampled real moving frame data; 43 Shi–Tomasi features; pyramidal Lucas–Kanade forward/backward flow; RANSAC partial affine with per-frame inlier validation; hard bounds, drift, source hash and frame-count gates. Reference: https://docs.opencv.org/5.0/tutorials/others/optical_flow.html .
- Tracking was **measured from the moving image**, not a hard-coded camera movement or a static image: endpoint displacement **53.098px**; minimum source inlier fraction **0.9767** with at least 41 retained tracked points. Frame 44 center (1165.479,654.701px), scale 1.00355; frame 89 center (1103.329,637.216px), scale 0.92710.
- `render_tracked_mask.py` binds a temporally changing, feathered, lens-confined scan/highlight to this track. It protects all pixels outside the raw alpha mask and retains the moving photographic-looking source texture underneath. A no-effect plain and a **deliberately faulty fixed-position mask** were independently encoded as controls.
- Exact scene is only a technical demonstration of one feasible optical-flow compositing mechanism. It cannot infer depth or guarantee edge quality/occlusions on arbitrary people, handheld footage or a real client product. Masks must be manually anchored and source-reviewed before applying elsewhere.

## Actual encoded tests

Three separate `libx264` outputs at **1920x1080, 30fps, 3.000 seconds, 90 frames** each, silent, all fully decoded with local FFmpeg 9 and independently reopened with OpenCV:

| Video | SHA256 | Size (bytes) |
| --- | --- | ---: |
| `NOLAN-M07-MOTION-MASK-TRACKED-1080P.mp4` | `a00fff39ae3fbea15fac9ae943af186fa629ae28b6fbc5a0c691fea7fc960b8c` | 1778860 |
| `NOLAN-M07-MOTION-MASK-PLAIN-1080P.mp4` | `e83fbf83b8bf2167d5a676725b6e716ab5b846d670bb3b768ada794e107f030e` | 1782036 |
| `NOLAN-M07-MOTION-MASK-NEGATIVE_STATIC-1080P.mp4` | `fe46f0128f5b68e4468aee41aac2cdee840a19ed18fa4419782699fd7f51255c` | 1791532 |

**30/30** source, tracking, hash, rights-state, local-bounds, encoded metadata, full decode and positive/negative control tests passed. They include missing/tampered source rejection, blank-frame tracking failure, impossible ROI rejection, protected static far-field, actual output change inside the moving lens, visibly misplaced stationary-mask negative at frame44, and no client/creative/audio promotion. Executed tests: `verify_mask.py`, receipt `output/TEST-RESULTS.json`. The independent `FFMPEG-FULL-DECODE.json` records codec, duration, frames, colour tags and lack of audio. Source `tracking.json` records all 90 actual optical positions.

**Visual inspection:** The nine-panel contact sheet sampled actual independently decoded frames 25,44,70 across PLAIN, TRACKED and NEGATIVE_STATIC. The highlight follows the lens across actual source motion; fixed-position negative visibly detaches as the camera moves. This is subtle and intentionally technical, not approval of a finished modern edit. Original source contains its existing M03 SILENT technical footer; no source originals were modified.

## File handling, tests, release gates

All source edits and actual proofs live under isolated `work/overnight-m07-mask-20261111`, archived in the **existing** OneDrive `Video Editing System/research/2026-11-10-Overall-Nolan-Development/M07-MOTION-MASK-20261111/`. Source-only ZIP contains Python and read-only receipts; no binary fonts, private client files, source-model packages or employer profile data. Actual 3 MP4 proofs, contact and SHA receipt remain separate. The latest shared Nolan queue still holds M07 as IN_PROGRESS and has an exact next action.

Not checked: real-life/action source footage; subject occlusion; multi-object masks; faces; heavy motion blur/rolling shutter; native Premiere/AE editable import, audio/music/qualified listening, physical-phone inspection, client branding/licensing or owner creative approval. The 9 TikTok source videos and Facebook glass reference remain unavailable for actual visual/audio study, as previously recorded. M05 Envato/project licences and M06 perceptual listening remain blocked independently.

**Next bounded M07 action:** source-cleared live-action high-parallax/chroma or tracking test with actual independent footage, manual accurate occlusion ground truth, clean/effect/negative encoded controls, native-size frame review, and existing source/rights approval gates. If approved footage is unavailable, do not claim film-source tracking is solved; instead continue M08 native-editor interchange once independently safe. Preserve existing client plans and do not touch employee UI, client masters, Katana/MSI, WhatsApp or public content.