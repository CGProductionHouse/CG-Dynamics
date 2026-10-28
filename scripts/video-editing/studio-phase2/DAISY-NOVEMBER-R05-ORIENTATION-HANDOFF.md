# Daisy & Co November R05 — final flagged orientation correction

27 October 2026. At 17:48 SAST the owner posted an image of the `DANKIE / KAN` second shot from R04 in CG Nolan Approvals and said it also reads upside down. The owner made orientation a standing rule: do not include an upside-down clip. R04 and originals remain preserved. R05 replaces only that picture segment; it does not reopen the approved story, music, captions, cover or timing.

## Exact picture correction

The rejected R04 segment is `199A5421.MP4`, source about 0–1.53 s, delivered at timeline 1.73–3.27 s. Its shop-window/hanging-decor framing reads inverted to the owner despite the prior technical rotation and early trim. Do not reuse it or attempt to justify it by metadata or correct it with stabilisation.

The protected [R05 recipe](daisy-november-repurpose/render_r05.py) uses local original `199A5251.MP4`, source about 0.10–1.63 s, `transpose=2`, 46 output frames at 30 fps. Its moving camera shows upright animal-print mugs on a horizontal store shelf. The exact first, middle, last source frames and full-size export frames at 1.8, 2.3 and 3.1 s were inspected; no shot roll, upside-down lettering or inverted merchandise appeared. A per-clip vidstab pass with the R04 settings was applied. The last frame cuts into the existing closer flower/window shot at the same timeline frame. The raw source remains local and unchanged. The distributed September reel's sampled ceramics were a different patterned item/setup, but an exhaustive public-history match through November remains unverified.

The R05 playlist reuses every other R04 compressed picture segment unchanged and maps the exact compressed R04 audio stream into the new file. Both R04 and R05 audio stream SHA-256 values are `ec2d7f8e345fe5fdc935b6753c9ebbc47fb8bdcd843b6c3a2870c5dc5afc1027`. Both contain 924 video frames and 1330 AAC frames, with 30.846009 s container duration. R05 is H.264/AAC 1080 × 1920 and fully decodes. Its package MP4 is 20,778,748 bytes, SHA-256 `99A996A936260FC9E5370A99B6CD1052E760F5C9A47D69B41BC08A62BDF4157D`. The unaltered cover is 831,290 bytes, SHA-256 `0FCB0C28F50BD9A31C05499334B685F68741AAF4BFF0213AB9983D9EBAAF0570`. The caption is byte-identical to R04.

Private package: `C:\Users\chris\Videos\CG-AI-Editing\Daisy-Nov-2026\private-repurpose-v5\r05-cut\r05-package\`. The exact outgoing file is `2026_11_DAISY_VIDEO_01_SE_DANKIE_R05.mp4`, with `2026_11_DAISY_VIDEO_01_SE_DANKIE_R05_COVER.jpg` and `proposed-caption.txt`. No media was committed to Git.

At 18:06–18:07 SAST, the exact CG Nolan Approvals group showed the R05 MP4 document with only the proposed post caption, followed by the caption-free cover sent with WhatsApp HD quality 1440 × 2560 selected. A separate Nolan note says R05 supersedes R04. All three rows subsequently showed `Sent` with delivered glyph. Per-recipient delivery/read was not checked; do not call this client/public approval.

## Reusable rule and remaining gates

The canonical `.agents/skills/cg-video-story-editor/SKILL.md` now requires orientation review against recognisable text/objects at the first, middle and last **delivered** frame of each selected span before stabilisation. Set rotation per source, reject rolling/inverted intervals, and check the encoded portrait output. Technical metadata or a single thumbnail does not satisfy this gate.

The soundtrack is unchanged at the compressed stream level, which proves R05 introduces no new audio edit; it does not amount to an independent creative listen. Full-speed independent picture/sound and physical-phone review, complete public-history check, product-currentness and staff-native editability remain unverified. Internal staff/owner final approval is still required before any client forwarding or public use.
