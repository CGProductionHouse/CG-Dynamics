# Nolan M07: actual Lottie-web frame-seek and encoded controls

11 November 2026. Owner-authorised work on **DESKTOP-M1VHEJF** only. M07 remains IN_PROGRESS. This is one independently qualified original SVG/Lottie mechanism, not an all-VFX or client-release qualification.

## Source and mechanism

The original test vector contains three shape layers: a fixed guide circle, a Lottie animated trim-progress arc, and a moving marker. It was self-authored for the CG Nolan study and is not a recreation of the nine inaccessible TikTok videos or the blocked Facebook video. No source footage, copyrighted third-party animation, music, client logo, branded font, or external AI was used.

Source animation: qualification-effect/assets/source.lottie.json, SHA256 **41462940f4268506113da580506a67ae812919df3ea52ccfcf6d3d481bb3c1d2**.

Nolan's existing pinned **lottie-web 5.13.0** runs exclusively from its local runtime through the isolated browser-motion renderer. The SVG is loaded with autoplay and looping disabled. The existing window.seek(t) interface drives goToAndStop(frame,true) after the animation loads, with an exact 30fps frame mapping. The original Nolan renderer and story/music/client release gates were not modified. API semantics were cross-checked against https://github.com/airbnb/lottie-web/wiki/Usage on 11 November 2026.

## Three independent real renders

The same vector source and editorial HTML were used in all three cases. All three outputs independently rendered at **1920x1080, 30fps, 3.000s, 90 frames**, decoded from H.264 MP4, and contain no audio:

| Video in existing private OneDrive research folder | Bytes | Exact SHA256 | Purpose |
| --- | ---: | --- | --- |
| NOLAN-M07-LOTTIE-EFFECT-3S.mp4 | 163194 | 0c3e44577558e56aa7496b4f8ed0ead4ed3d0a94ceef6ad1ae81d194aed234c5 | Intended trim/reveal and marker motion |
| NOLAN-M07-LOTTIE-PLAIN-3S.mp4 | 115558 | ce1444b1abed17e811650aa2a2fe831914edb50c522636192753457e0d796da9 | Same source held at frame zero, clean plain control |
| NOLAN-M07-LOTTIE-LATE-3S.mp4 | 140920 | 2c7b79c4c0bff53cad3ff9a017624766df424aadfe51f8fcf49291c9d6fdf538 | Deliberately delayed animation by 45 frames (negative control) |

The renderer's out-of-order source seek is pixel-identical on all three. Zero page errors, blocked external requests, or type-boundary errors were reported. Independent full-decode tests passed, with actual decoded source frame indices 0, 18, 35, 45, 70, and 89 saved for each version.

## Measured results and honest failures

**20 of 20** source/provenance/negative tests passed, including actual source continuity, JSON frame clock, no external media, no autoplay, original animated parameters, explicit controls, source-bound hashes, and intentionally changed source-hash rejection.

**53 of 53** independent encoded-video tests passed. At frame 35 (~1.17s), effect-vs-plain in the vector region differs 4.920/255 mean RGB while the deliberately delayed-vs-plain is only 0.0003/255, demonstrating the timing failure in the negative control. At frame 70, effect-vs-plain differs 7.9067/255, effect-vs-delayed 5.3854/255, and the unchanged exterior-text region differs just 0.0139/255. Plain frame zero versus frame 70 remains effectively unchanged. These are actual decoded comparisons, not asserted labels or renderer-intention fields.

An independent extraction first FAILED on this FFmpeg build because it used the obsolete -vsync argument. The error was preserved in INITIAL-ENCODED-QA-FAILURE.txt. The checker was corrected to use -fps_mode passthrough and independently rerun. The rendered source files were unaffected. One effect-frame image was inspected visually: the intended partial teal ring and orange moving marker were visible, and generic test typography was legible. Full real-time sound and physical-phone creative review were NOT performed; these deliberately silent outputs are not ads.

## Durable source and limitations

The existing OneDrive research location is CG Production House / Video Editing System / research / 2026-11-10-Overall-Nolan-Development.

Source-only package **Nolan-M07-Lottie-Source-and-Tests-20261111.zip** is 26,030 bytes, 24 independently SHA-checked files; ZIP SHA256 **a3a3264ea73b2e3dd60b81a512e24e399f431f50e035f636b84c23adab7fa6ad**. No media/font/vendor binary is in the ZIP. Three protected playable videos were copied into the same existing folder and SHA-verified against the rendered originals. The dated M07-LOTTIE-RECEIPT-20261111.json records the complete manifest and measured checks.

This qualified **one optional technical effect on Nolan Studio PC**, not a purchased Lottie asset or production template. No native Premiere import/relink/save/reopen, actual client material, real VO/music, creative-taste qualification, manufacturer assets, second-PC install, or reference-video fidelity. No user purchase, subscription, paid credit, cloud AI render, external upload or employee UI takeover occurred.

## Continue the existing queue

M07 remains IN_PROGRESS. Preserve M05's Envato/project-licence block and M06's perceptual/listening block. Next independent M07 mechanism: rights-cleared moving-source motion mask or planar tracking, with plain/effect/negative source-bound renders, moving-boundary review and explicit fail controls. When later integrating a specific client, keep the existing client library, narrative director, brand font, music history, exact final-export sound, owner feedback and creative release gates. This technical animation is not a new house style or mandatory effect.
