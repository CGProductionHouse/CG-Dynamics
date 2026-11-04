# Real runner trail — landscape source and matte repair

29 October 2026. This background-only office test advances the existing motion-trail clone card with a single real runner moving across a static wide frame. It provides actual plain/trail outputs and a protected timing revision. **Landscape mechanism is bounded; social-portrait and creative acceptance remain open.**

## Source and rights

The exact [Mixkit #4831 park runner](https://mixkit.co/free-stock-video/view-of-a-park-while-a-girl-runs-across-4831/) item page states the Mixkit Stock Video Free License for commercial/personal use and labels the shot static. Private 720p download SHA-256 `66A9EFC3CD5F2F09D81207D6731F0297F95439A0711DD1F9A4EC128C9FB1BED6`; actual media is 1280 × 720, 24000/1001 fps, 198 frames, 8.258 s, silent. Frames 0–72 contain an empty path. The same runner then travels left-to-right; full-size source frames 136, 152 and 168 have separated positions and visible shoes on the path. The dog/log source was separately rejected for trail work because its positions overlap and disappear behind the log.

## Matte gate and controlled outputs

Private source, masks, scripts, decoded outputs/stills and JSON receipts are under `work/research-continue/motion-trail-runner/`; no media or mask enters Git. A bounded GrabCut mask uses the same-shot empty frame 48 plus three source-specific boxes and torso/head seeds. The **first mask fails**: all three held positions lose lower legs/shoes (first bounding bottoms 443, 443 and 410 while the real shoes reach roughly 465–470). Full-size source/overlay crops expose the detached feet. Additional definite-foreground shoe/leg strokes repair the three connected components to bounding bottoms 467, 471 and 471. Full-size overlays then keep shoe/path contact, although backlit hair edges and the source's chromatic rim remain imperfect. No general segmentation model or reusable mask preset is claimed.

All four H.264 videos decode completely at 1280 × 720, 24000/1001 fps, 72 frames, no black frames. They share source frames 120–191. The plain control remains the continuous original. The other three place held cutouts from source frames 136 and 152 over that **same live shot**, with the live runner on top. The three outputs share 32/32 decoded opening frames pixel for pixel.

| Private output | SHA-256 | Difference and decision |
| --- | --- | --- |
| `plain.mp4` | `39480d9ea81966676a32d8e78184dffb627b3dbe9ef7714f0ddf8884bbf83b06` | Continuous action; no added clone. |
| `trail-r01.mp4` | `9ec03c8a59f240c3f7f9e643d6b0de58c72a9f0b0ff680f2c2699e2a390c2b4b` | Hard masks appear at live source 152/168 and remain through exit; abrupt emergence/ending rejected. |
| `trail-r02.mp4` | `620c1713cf30b77261f6c63a16128b698be43fa0eb32fd7da648c85424488024` | Feather 0.8 px, four-frame clone fade-in and 12-frame fade-out. At source 168 the middle clone is still faint while live runner nears right edge. |
| `trail-r03.mp4` | `8fa4f56179290b6e0441020561c85927bfaf4fb1a244d0bd40bf5f5c54c09670` | Protected R02 timing revision: second clone begins four frames earlier, at live source 164. R02/R03 decoded frames 0–43 match exactly; 28 later frames differ. Full-size decoded frame 48 shows three clearly separated positions before the live runner reaches the tree. |

The decoded contact sheet and full-size frames 48/56/68 were inspected without opening playback windows. Frame 48 of R03 keeps the two held feet on the path and the live runner fully in frame. Frame 56 shows the live runner nearing the tree; R03 then fades the held positions as the original exits. Numeric ROI difference against plain verifies an actual visible change, but does not score composition. The held clones do not reproduce full moving shadows; bright backlight and fine hair may still reveal mask edges. No normal-speed or physical-phone comfort test was performed, and source audio is absent.

## Format and editability decision

The full-width landscape example is a useful **bounded mechanism proof** for separated positions and repaired grounding, not a mastered effect. An actual centre 405 × 720 crop of R03 frame 48 cuts the live runner and the middle figure; it fails a 9:16 Reel. Reframing cannot fit all three positions while keeping each legible at this scale. Use a different upright capture or a purpose-built portrait composition before a client Reel. No native editor save/reopen/export, second-PC relink, beat/audio or creative story approval is claimed from these baked silent MP4s.

Next gate: rights-cleared portrait action with three grounded positions and a clean moving matte, then plain/trail at full speed with heard sound and physical-phone review; build an actually editable native layered version for staff handover.
