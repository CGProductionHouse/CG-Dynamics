# Office background screen — moving graphic blur above a real runner, 29 October 2026

**Existing family:** [graphic transform blur](skills/graphic-transform-blur/SKILL.md). This is a source-specific, silent code render that tests a graphic shutter only. The native Premiere Transform proof remains separate; no footage optical-flow or staff-editability claim follows.

## Source, placement and rights

- [Mixkit park runner #4831](https://mixkit.co/free-stock-video/view-of-a-park-while-a-girl-runs-across-4831/) lists the Stock Video Free License for commercial/personal use. Exact private original `work/research-continue/motion-trail-runner/mixkit-4831-720.mp4` SHA-256 `66a9efc3cd5f2f09d81207d6731f0297f95439a0711dd1f9a4ec128c9fb1bed6`, 1280×720, 24000/1001 fps, 198 silent frames. Selection 112–183 is a continuous left-to-right crossing. The no-title control is the **byte-identical reused** `depth-plain.mp4`/runner-hook plain, SHA-256 `4af7f6be0684e118267c0edf1eaa978498976ed519d0523ac89f8b393d798abf`; it is not counted new here.
- A fictional `RUN` word moves 270 px right into the bright sky ahead of the runner, easing from x560 to830 across output frames 12–24; it then holds, fades during frames34–39 and is absent at40. In sampled frames the word remains ahead/above the subject, does not cover the path or feet, and leaves before she reaches that area. This is a stock practice layout, not a client caption or 9:16 Reel.

## Controls, protected revision and inspection

Private `work/research-continue/graphic-blur-runner/render_runner.py` keeps the identical source frames, text trajectory, colour and opacity. `runner-type-sharp.mp4` has no graphic blur. `runner-type-blur180.mp4` samples the moving text's 180° exposure window 33 times per motion frame. Protected R02 `runner-type-blur90-r02.mp4` changes only that window to 90°. Both blur variants leave the title sharp after it settles; neither blurs the actual footage.

| Private output | SHA-256 | Decode |
|---|---|---:|
| `runner-type-sharp.mp4` | `6aad1ce3aa4f12718802cd1f9381ab3de946372d720a186563d8b57c34927acd` | 72/72 |
| `runner-type-blur180.mp4` | `4fa2d59ab3bf85abcd7573ae1317f95cb4e26d33f164d2b9980447b41ba962a9` | 72/72 |
| `runner-type-blur90-r02.mp4` | `fb932b8aab6a95d54ba1e81c0820ade5a74fe6da80766e4ac15407e1b625deb9` | 72/72 |

The first **12 decoded frames are pixel-identical** across all three title variants. Private `inspect_runner.py` decoded every frame, compared the title ROI and produced a decoded contact at frames12/14/16/18/20/23/24/30/34/38 plus full-size frames16 and30. At frame16 the 180° title ROI mean absolute RGB difference from sharp is7.5207 levels; R02 is3.9373. Full-size 180° shows a pronounced horizontal smear; R02 retains clearer letter edges. At frame24, when the word is settled, the 180° ROI difference is0.0068 and R02 is0.0473, consistent with sharp pre-encode hold and minor H.264 history. It is **not** a claim of encoded hold pixel identity. The source-only control and contact show the subject continues in the same direction; there is no event cut or fabricated runner motion.

**Decision:** 180° is too soft in the early entry and is rejected for this shot. R02 is the more legible bounded graphic candidate, subject to full-speed human/physical-phone reading and actual music/beat review. The effect's rightward motion follows the runner's direction but its timing is a constructed editorial hypothesis, not a heard beat or approved story. The landscape stock shot, silent outputs, code-generated text, lack of native save/reopen and no second-PC/CG/client review keep all production and mastery gates open. Never carry 90° over as a universal shutter preset.
