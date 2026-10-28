---
name: nolan-subject-band-resolve
description: Construct a short source-isolated horizontal band displacement followed by stepped pale silhouette fill, keeping a plain control and protecting cropped boundaries.
---

# Subject bands into pale silhouette — bounded reconstruction

28 October2026. Direct inspection of Wanderlust frames312–320 shows several mechanisms: horizontal subject fragments, a pale upper-body region at315 and a fuller pale silhouette at317–319. It is not merely RGB separation or a full-picture glitch. The [reference ledger](../../WANDERLUST-DIARIES-STUDY-20261028.md) separates these observations from unverified native controls.

Run `python render_ab.py --source LOCAL_ORIGINAL --output-dir PRIVATE_DIR`. It reuses the existing prelap encoder/stage recipe and commercially licensed [Mixkit green-screen28306](https://mixkit.co/free-stock-video/girl-dancing-with-her-earphones-on-a-green-background-28306/), source3–6s, SHA256 `80e0bf3d84faf6e2b0efabfc9001aeadde09e1ce56d0530360ceff5b9be596a5`; licence manifest in `../../project.json`. Existing Python/OpenCV/NumPy/Pillow/FFmpeg only. No natural segmentation, creator footage or plugin.

Three90-frame/3s540×960/30fps silent controls: plain; displacement alone; displacement plus stepped pale fill. Source RGB **and alpha** remap together over the original clean stage, never over a duplicate person. Two clothing bands at y620–648 and780–820 shift by at most24px on frames30–34. The outer80px remain unwarped, keeping real source crop edges at the frame boundary; no wraparound, fabricated limb or cut edge moving into empty space. The displacement-only upper580px is byte-identical before compression. Pale fill deliberately changes the upper body on32/33, the whole silhouette on34/35, then returns to the original moving source at36.

**First attempt rejected:** bands410–448 and650–690 sliced the eyes/face and looked like a performance error. Preserved privately as `rejected-face-band-*`. The revised clothing bands protect this selected performer's face. These coordinates are specific to this source/path; do not reuse them on another person without inspecting the complete movement. Pale identity concealment is still an intentional graphic interval, unsuitable over important speech, product proof or a CTA. This is not the same as leaving an accidentally floating cropped body.

Full-size step and reduced comparison contacts inspected. Current displacement SHA256 `c9215cfca3a1666fb88645e708e2d72369e0ee0577761f0a27be2df831cb15c8`; stepped resolve `ca86e064725d63b8e7d68c4e984f472a99a0aea5e8d05d5e78e26a13f897418b`. Private output/contact/receipt: `C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Practice\wanderlust-diaries\proofs\subject-band`. All current exports fully decode90 frames. Source recipes remain editable; MP4s are baked.

An additional stream-copied version adds one original mono noise texture with50ms attacks at picture frames30/32/34. Encoded activity above−50dBFS:1.00444–1.04525s,1.07038–1.11277s,1.13713–1.18008s. Peak−20.79dBFS at1.16096s. Dry/designed decoded picture is identical, SHA256 `eebb70b9eebcd8bc062bc7d6be3208b0b34c6e749588074c5f044ebfdf75e7c3`. WAV is a removable original stem. It has **not been heard**; placement/level checks cannot certify musical or sonic fit.

Next: purposeful outgoing/incoming shot context, normal-speed/comfort and physical-phone review, natural-scene clean foreground/background, heard licensed/original sound and native editable mask/displacement/stem save/reopen/export. **Construction candidate, not mastery or automatic client treatment.**
