# Action Sports R14: reference-to-edit evidence (4 November 2026)

Status: **delivered for internal review only**, not owner/client/public approved. The protected R12 WhatsApp review was rejected and superseded by R14. Client sources, Canva page thumbnails, reference MP4s, scripts and exports stay outside Git in the private `Bloem-Action-Sports-Planning-20261103` workspace.

## Internal handoff, 4 November 2026

At 08:30 SAST, the exact **CG Nolan Approvals** native WhatsApp group received `2026_11_ACTION_SPORTS_VIDEO_01_NETBALL.mp4` as a **document**, with only the proposed public caption in that document message. WhatsApp displayed two delivery ticks. At 08:32, `2026_11_ACTION_SPORTS_VIDEO_01_NETBALL_COVER_HD.png` was sent alone as a photo with **HD** selected and no caption; it also displayed two delivery ticks. A separate 08:32 Nolan note identified R12 as superseded and requested sound-on internal review. No client/public send occurred.

The exact MP4 is 32,063,331 bytes, SHA-256 `5b00094665be47b7fab7fe23688710103a03272f1b7abbfc6077f618c3260621`. The 2× Lanczos cover sent through WhatsApp is 3,036,668 bytes, SHA-256 `76a371b1cb53f41a75e7e9749bb51b2ebcbf18917a0f1f7163f5bd32258bad3e`. Upscaling enables the HD picker; it does **not** add captured image detail. The real-resolution cover and square/4:5 previews were inspected locally; both crop previews retain the complete `MAKE IT COUNT` title.

Exact export probe: 1080×1920 H.264 at 30 fps, **793 frames / 26.433333 s**, stereo AAC, full decode without errors. Integrated loudness **−14.7 LUFS**, true peak **−2.1 dBFS**; the final five seconds of official-logo picture contain audio (measured mean −15.2 dBFS, max −2.1 dBFS). The logo's own audio was not used. Frame differences confirm six-frame 5-fps pose holds in the decision shot, the two exposure frames, 42 monochrome frames and the runner return. Boundary frames 374–378 and 416–422 were visually checked; the scene cut is 418/419. These checks do not certify musical taste, cue timbre or normal-speed comfort.

## Exact owner references and observed mechanisms

| Reference | What the tutorial or sampled final shows | Reusable boundary |
| --- | --- | --- |
| [Stop motion](https://vt.tiktok.com/ZSp8vhsD4/) | Nest the action and posterize to roughly 4–5 frames per second; film-like ticks make the holds deliberate. | R14 samples the held-ball athlete at 5 fps for 38 frames, returning to 30 fps before the burst. This is a **posterized filmed athlete**, not physically captured stop motion. Seven licensed, low-level clicks are aligned to the pose changes. |
| [Slide shake](https://vt.tiktok.com/ZSp8vo67X/) | A short transform layer alternates horizontal position and grows in scale across a two-clip join; sound helps the directional move land. | R14 spans the actual wide-to-runner cut at frames 418/419 with a six-frame reflected-edge move and a separately licensed whoosh. Keep action legible; do not apply the preset at every cut. |
| [Flash cut](https://vt.tiktok.com/ZSp8vso8g/) | A 2–3-frame brightness/contrast pulse precedes a cut. | R14 tests two exposure frames before a purposeful colour-to-monochrome change, plus a separate click. It must not erase faces or persist as a white screen. |
| [Complete sport edit](https://vt.tiktok.com/ZSp8ceswp/) | Alternates detail, place and movement, with short light punctuation before a readable action reset. | Scene order and an action reset are useful; no creator footage or soundtrack is copied into CG output. |
| [Monochrome edit](https://vt.tiktok.com/ZSp8ccy4S/) | Motion/whip and a light accent introduce black and white; graphic colour can be isolated. | R14 brackets a 42-frame monochrome team passage with the flash and slide; only the graphic green remains coloured. It does not imply that a black and white filter alone makes a transition. |

These are picture and timecode observations from privately retrieved playable references. The original music, sound effects and edit project are unavailable as separately licensed/stemmed assets. The R14 sound reconstruction uses local licensed Mixkit music/cues, **not TikTok audio**. Timing, channel, peaks and export can be measured; creative sound fit has not been heard and cannot be certified from waveforms.

## Bloem Action Sports application

The owner prefers the story pair **ONE SECOND TO DECIDE / MAKE IT COUNT** over the rejected topic-only `NETBALL` heading. Detail feet and ball, pursuit, held-ball decision, six two-frame action flashes, and a longer play reset support that pair. `FIND THE SPACE`, `MOVE TOGETHER`, and `BRING YOUR TEAM` then move from individual choice to collective play and invitation. These are editorial lines, not claims that disjoint shots depict the same scoring play.

The title treatment references the client's recent dark-green split fields, white X marks, rough texture and condensed sporting type from its actual Canva poster pages. The newly typeset Agency Bold is a local **approximation**, not a verified exact brand font; the `BRING YOUR TEAM` glyphs come from the client's existing Canva atlas. Event-only colour balancing cools the yellow cast while keeping the official logo animation's picture unchanged. An exposure flash introduces the monochrome passage; a directional slide returns to colour. Music continues over the picture-only official outro.

Two intended-still camera positions were screened separately for selective stabilization. In a protected two-pass FFmpeg `vidstab` comparison, shot 10's background-motion median/p95 changed from 2.15/12.3 pixels to 0.32/0.8; shot 15 changed from 5.06/13.19 to 2.85/4.69. Full-size midpoint frames show no exposed borders. This does not prove absence of local warp at every frame; intentional moving-camera footage was left alone. The earlier generic deshake on R12 source shots was not used as evidence that every shot needed extra stabilization.

## Acceptance still open

- An independent editor still needs to **hear and see the exact file at normal speed**, on headphones, speakers and a phone. Technical decode, peak measurements and sampled pictures are not that audition.
- The sampled flash/slide boundary frames show no exposed edge or stray title at the cut, but full-speed flash comfort, transition taste and any local warp remain unverified.
- Compare the final source moments against prior published client picture, participant suitability and event context. Reuse only as a new story job, never a lifted prior beat as-is.
- Confirm the chosen track/cue licence records, proposed post caption, correct CG filename and HD cover before an internal WhatsApp send. Internal delivery is not client/public approval.
- For staff editability, preserve original source names/timecodes, title graphics, independent sound cues and build instructions in the private handover; a rendered MP4 alone is not an editable project.

Use [the shared video story skill](../../../.agents/skills/cg-video-story-editor/SKILL.md) and its production standard before applying any of these mechanics to another client. Their successful frame construction does not make the techniques universal defaults.
