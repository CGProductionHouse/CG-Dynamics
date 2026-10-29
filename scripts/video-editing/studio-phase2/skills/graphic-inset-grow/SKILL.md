---
name: nolan-graphic-inset-grow
description: Grow a deliberately graphic moving-picture card into the same full-frame footage, comparing linear and eased motion with a removable velocity-shaped cue.
---

# Graphic inset grow — separate from a filmed phone

28 October 2026. [Wanderlust frames298–306](../../WANDERLUST-DIARIES-STUDY-20261028.md) show graphic inset growth. This proof covers scaling/easing and sound-envelope construction; pale-picture alternation is not included. It does **not** clear the failed [physical window-grow](../window-grow/SKILL.md) or [filmed last-frame](../filmed-last-frame/SKILL.md) examples. There is no fake phone, holder or tracking claim.

`python render_ab.py --output-dir PRIVATE_DIR` uses existing Python/OpenCV/NumPy/Pillow and FFmpeg. Same licensed [Mixkit #134 source and hash](../chromatic-lens-pulse/SKILL.md),9–12s, with existing manual portrait crop anchors. Private proof directory: `C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Practice\wanderlust-diaries\proofs\graphic-inset`. No new engine or dependency.

Three90-frame,30fps,540×960 silent versions compare a50%-size moving card followed by a hard reveal, linear growth and quintic smootherstep growth. The grow runs frames18–42,50%→100%, centered on an original teal stage. Actual source time advances inside the card and continues after reveal; no duplicate frozen ending or invented second location. Integer-rounded box sizes stay within the frame and grow monotonically. Pre-encode versions are identical through18 and from42 onwards. Full midpoint and reduced contacts inspected: the picture is an intentional rectangle, while the person remains part of that picture rather than an isolated floating cutout.

`eased-sound.mp4` stream-copies the eased picture and adds one original seeded250–5500Hz noise stem. Its envelope follows the derivative of scale, rather than a generic cue on every cut: mathematical motion interval0.6–1.4s, encoded activity above−50dBFS0.64042–1.35125s, sample peak0.94177s/−18.72dBFS;10ms RMS envelope correlates0.99727 with scale velocity. This cue is deliberately mono. Dry/wet decoded picture hash is identical: `def8c6fc4e5328a6259283097d8690fbc241a0bf5a9a3a95ff1cbf0bbb9fcd22`. All four exports fully decode,90 frames each. These are timing/channel/codec measurements, **not a heard sound-quality verdict**.

Eased output SHA256 `e01df9c2df48ce2e0b589f5420a44e7b6f1486736b1ad569e69933e07991a8ad`; with cue `17a173c050fb63090212600d1f573b5980039e0d046f7fbe43051a9abde3dc11`. Receipt records all bounds/hashes. Next: appropriate story context, normal-speed comparison, heard sound at matched level, physical-phone and native editable scale/mask/stem reopening. The graphics are revisable through source parameters; the MP4 is baked. **Mechanics tested; not mastered.**

Portability: pass `--source ABSOLUTE_LOCAL_ORIGINAL` on another PC instead of copying the MSI directory layout. The exact recorded SHA-256 remains mandatory. Use a private output directory; reacquire only the permitted source, never client/reference media from an external service.


##29October native Scale/easing extension

[Native inset study](../../OFFICE-NATIVE-INSET-STUDY-20261029.md) proves actual Premiere Motion50→100%/linear/EaseOut-EaseIn over cleared moving coffee48–119. Eight NEW72-frame outputs plus reusedplain; three72/72actual reopen pairs. Later-onset R04inherits incoming28.5429tangent, shrinks360pxwide hold to346px/only1protected frame: rejected. R05native incoming EaseIn zeros tangent, restores steady50%and19/19protected frames; ONLYScale97changes. Fractional encoded-source sampling resolves rounded-bound matcher70/72 ambiguity to72/72consecutive original frames, MSE≤2.071. R03gentler easing is the source's mechanical candidate; R05laterhold withholds product longer. Encoded tail0/30exact; one-PC native controls do not establish client/independent full-speed/phone/heard/second-PC/mastery. Blackstage/cubicnativecurve differ from earlier teal/quintic/noisecue proof; no filmedphone/physicalcapture claim.
