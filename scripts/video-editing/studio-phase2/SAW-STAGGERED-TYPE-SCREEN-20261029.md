# Office background screen — source-led staggered words, 29 October 2026

**Existing family:** [staggered words](skills/staggered-type/SKILL.md). This is a silent stock-footage layout/timing screen, not client copy or a native staff edit.

## Source and rights

- [Mixkit #39691, carpenter slicing a wooden board](https://mixkit.co/free-stock-video/carpenter-slicing-a-wooden-board-in-a-close-up-shot-39691/) explicitly lists the Stock Video Free License for commercial/personal use. Private original: `work/research-intake/extracted/additional-licensed-inputs/licensed-inputs/mixkit-carpenter-saw-39691.mp4`, SHA-256 `186bc1eb994695af1d7c2312d3f8ea6aac0a4e23767d24727471066e7cceb618`, 720×1280, 24000/1001 fps, 360 frames, no audio stream. The 0–95 selection contains a continuous slow-motion board/saw action.
- The factual practice phrase `WOOD / MEETS / BLADE` sits on the blue torso area, away from the yellow glove and saw in the sampled frames. This stock shot is not assigned CG work and does not establish a client message. Source contact: private `work/research-continue/staggered-saw/source-contact.jpg`.

## Controls and protected revision

`render.py` renders the same 96 source frames four ways at 720×1280/24000/1001 H.264, no audio. A plain control has no lettering; static shows all words from frame 0; R01 reveals them at frames 16/32/52; R02 advances only the third word to frame 42. Each entrance fades and rises 17 px over six frames. Text remains fixed within the source shot rather than pretending to track a physical surface.

| Private output | SHA-256 |
|---|---|
| `saw-stagger-plain.mp4` | `2e7da2f2358cd85f9442d1ec375ce297ee548faa9aa09206e0e7ce0a1b8801e5` |
| `saw-stagger-static.mp4` | `aa6a68b90a39dc588ac9eadef5d26d07407a203268ba4bd67e277b09c4326335` |
| `saw-stagger-r01.mp4` | `e50c6491f26e1144f1601bc2cecb09c1d27181be026c219f14230227ab6aa1a6` |
| `saw-stagger-r02.mp4` | `aa5a2573252bee3e96670871e291eb2de275b39075730b81aa23047e73ea9218` |

All four outputs decode 96/96 frames. R01/R02 protect the first **42 decoded frames exactly**; plain/R02 first 16 frames are also pixel-identical. The changed third-word timing appears at frame 42 and later. Full-size decoded R02 frame 64 and a contact at 0/16/24/32/42/52/64/95 across all four variants were inspected. The word stack stays to the left of the working hand and above the saw in those samples; at 220 px contact width it remains legible. The unchanged blade ROI is not pixel-exact after frame 42 because H.264 prediction changes when earlier type changes; the sampled 600–1100 row mean absolute difference is 0.07–0.62 levels, not proof of a protected tail.

**Failed creative gate:** the continuous slow-motion action has no three distinguishable visible beats for the three words. The static control states the phrase immediately and the stagger hides part of it until later. R02 reduces the lag but still has no source-led reason for this word-by-word sequence. Do not use this as an approved edit or general timing preset. A later test needs approved copy, a source with visible action phases or speech/music attacks, independent full-speed/phone reading and hearing, and second-editor native editability. This study proves a bounded layout/timing mechanism and a protected revision only; it does not prove rhythm, story value, native Premiere editing or client acceptance.
