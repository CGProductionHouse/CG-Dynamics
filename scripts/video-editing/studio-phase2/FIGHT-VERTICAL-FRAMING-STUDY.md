# Fight trailer vertical framing: punch evidence versus frame fill

**Decision:** reject both placements as a hero impact for this source. The [portrait fill](proof-fight-framing-fill.mp4) crops a 405-pixel wide strip from a 1280×720 two-fighter shot and loses the left fighter's face and most of the strike path. The [full-width fit](proof-fight-framing-fit.mp4) retains both fighters and the glove approach, but presents action in a 608-pixel tall band inside 1080×1920, with large empty areas. The [270×480 A/B frame](proof-fight-framing-phone-comparison.png) makes the tradeoff visible at a reduced viewing size. This is a source-geometry failure, not a request for a more elaborate zoom effect.

The source is [Mixkit #40968, “Boxer giving a direct hit to his rival”](https://mixkit.co/free-stock-video/boxer-giving-a-direct-hit-to-his-rival-40968/), 1280×720, 24000/1001 fps, 11.011 s, SHA-256 `1a8186f3b7bb178a7da237bdffd19c8f855275c615688e00476f4395924015e8`, under the [free stock-video licence](https://mixkit.co/license/modal/videoFree/). This is stock practice; [contact triage](FIGHT-CONTACT-TRIAGE-STUDY.md) still labels the hit as a likely candidate rather than a certified unguarded head strike. The original source remains ignored and local.

`python render_fight_vertical_framing.py` renders both from identical source 5–6.5 s frames with the existing `STOCK PRACTICE` overlay. Both silent H.264 outputs fully decoded, each with 36 frames, 1080×1920 and 1.5015 s duration. No production sound or actual event footage is involved. The comparison PNG was inspected at native 540×480; normal-speed motion and physical-phone/app viewing remain unreviewed.

| Output | SHA-256 |
|---|---|
| Fill crop | `d82be41cdaa8e892db15d3846c4817a4a341a3325bfcbd267d51e02f4adbc1cd` |
| Full-width fit | `3511b9d8c88a83851f63c22980b51e210d1f5e1669370c35d85a593adfb854d8` |
| Phone-scale comparison PNG | `202d3726411548e3618ffd455c75f7a82b13e9e5dbc73276b407d3346ee4b823` |

**Next gate:** on real event footage, screen impact and reaction first at native framing, then test the intended output aspect ratio before editing. Pick a naturally portrait or closer angle for vertical hero impacts. If a wide source must remain, use it as a brief geography/atmosphere beat or a deliberate layout with approved surrounding design. Do not use automatic subject tracking or a tight crop to conceal the other fighter, contact point or consequence. No manual reframe can place two fighters inside a crop narrower than their separation throughout this shot.
