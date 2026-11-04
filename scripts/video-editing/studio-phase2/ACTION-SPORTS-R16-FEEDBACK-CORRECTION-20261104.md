# Action Sports R16 — exact screenshot correction (4 November 2026)

Status: **delivered for internal review only**. R16 supersedes the 09:59 R15 package. At 10:57 SAST, the owner replied to the existing 08:46 screenshot: “You missed this comment. Making the video black and white behind the text. The rest is a massive improvement.” This is positive feedback on the other changes, **not** formal client/public approval.

## What R15 missed

The screenshot shows the held-ball athlete and `ONE SECOND TO DECIDE` at about 2 seconds. R15 had mistakenly applied stronger monochrome to the **later** `MOVE TOGETHER` sequence (frames 377–418). That later effect remains an intentional part of the film, but it did not satisfy the screenshot. The mistake was a feedback-target mapping failure, not an absent filter.

The protected R16 recipe at `C:\Users\chris\Videos\CG-AI-Editing\Bloem-Action-Sports-Planning-20261103\build_action_r16.py` changes **only picture frames 46–83** (1.533–2.800 seconds): the moving athlete, ball and court become higher-contrast black and white, while the existing client-green title plate and white copy remain. Full-size before/after samples at 1.6, 2.0, 2.4 and 2.7 seconds, plus the 2.9-second return to colour, were inspected in `r16\held-ball-bw-comparison.jpg`. The sampled 270×480 mean absolute picture difference is about 19.5–20.4 levels inside the target versus 1.5–2.6 outside from re-encoding. These checks do not replace full-speed phone review.

R16 is 793 H.264 frames, 1080×1920, 30 fps, 26.433333 seconds with a clean full decode. Automated freeze ≥0.22 seconds and silence ≥0.25 seconds checks found no events at the recorded thresholds. Its AAC audio stream was **copied unchanged** from R15: both extracted stream SHA-256 values are `d4f76617a0cbb25b7352878a7fc68c7e243ff8c315bf818ea830c1212297b353`. The earlier R15 objective mix result remains −13.9 LUFS / −1.1 dBFS true peak; no new creative listening claim is made.

## Internal handoff

At 11:02 SAST, the exact **CG Nolan Approvals** group received `2026_11_ACTION_SPORTS_VIDEO_01_NETBALL.mp4` (33,142,146 bytes, SHA-256 `9e4447403f30e86aee8e820d2598e77175e7a082531ba66784ca0daffcd2285b`) as a document with **only** the same complete proposed post caption. The unchanged `2026_11_ACTION_SPORTS_VIDEO_01_NETBALL_COVER_HD.png` followed alone with a blank caption and **HD quality selected**. Both showed **Delivered**. A separate 11:03 Nolan note acknowledged that R15 targeted the wrong passage, identifies the corrected title and explicitly supersedes the 09:59 package; it also showed **Delivered** in a later check.

Open gates: independent normal-speed picture/sound and phone review of the exact R16, source-audio creative/crew check, participant and posted-picture clearance, and staff-editable handover. No client/public send, permission change, spend, external client-media AI upload, production project edit or client-media Git commit occurred. Retain R14/R15, the missed feedback evidence and corrected R16 together; do not silently rewrite the failure as if R15 had passed.
