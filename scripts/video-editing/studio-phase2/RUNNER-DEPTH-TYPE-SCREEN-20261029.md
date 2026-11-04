# Office background study — moving runner in front of fixed type, 29 October 2026

**Existing family:** [depth type](skills/depth-type/SKILL.md). This is a private, silent, landscape source screen. It extends the earlier one-subject native Object Mask proof to a person travelling across a wide backlit shot. It does not replace that native proof or establish client readiness.

## Source and question

- [Mixkit park runner #4831](https://mixkit.co/free-stock-video/view-of-a-park-while-a-girl-runs-across-4831/) displays the Stock Video Free License, permitting commercial/personal use. The exact downloaded original in private `work/research-continue/motion-trail-runner/mixkit-4831-720.mp4` is SHA-256 `66a9efc3cd5f2f09d81207d6731f0297f95439a0711dd1f9a4ec128c9fb1bed6`; 1280×720, 24000/1001 fps, 198 silent frames. No CG/client media or externally generated subject was used.
- Exact source frames 112–183 provide a continuous left-to-right crossing. Source frame 48 is a same-shot empty-path plate for a bounded per-frame GrabCut upper-body matte. The text `MOVE` is fixed at (505,245) in Segoe UI Bold, 156 px. Source and story are stock practice, not CG copy or an approved Reel.
- Question: does the moving human remain legibly in front of a fixed word across several positions, versus the identical title simply overlaid in front of her? The empty plate, right/left framing, large dark letters and no camera cut make the layer order inspectable.

## Controls and protected revisions

Private scripts/receipts: `depth_mask_probe.py`, `depth_repair.py`, `depth_runner.py`, `inspect_depth.py`, `inspect_depth_r03.py`, `depth-masks.json`, `depth-r03-masks.json`, `depth-inspection.json`, `depth-r03-inspection.json`. Private MP4s are deliberately outside Git. All outputs have 72 decoded 1280×720 frames at source rate, no audio or black frames.

| Output | Purpose | SHA-256 |
|---|---|---|
| `depth-plain.mp4` | no type; byte-identical reuse of the earlier runner-hook plain, so **not counted new** | `4af7f6be0684e118267c0edf1eaa978498976ed519d0523ac89f8b393d798abf` |
| `depth-front.mp4` | same title in front of the complete runner | `abf5942fb91af67618973651c73085f1612a6ebc0c443120526c361d984c8fe9` |
| `depth-behind-r01.mp4` | binary foreground matte over title | `36ed0ab1dafec70bf66b7f14f92756d92518704c0f0141313d99c6c0fc10eb9f` |
| `depth-behind-r02.mp4` | 0.8 px feathered matte, protected original opening | `36daf02f70eb74d34e5659f276feee1fedf029623247621f740cc27381552d5e` |
| `depth-behind-r03.mp4` | repair connected path leak on source frames 148–151; same title and protected opening | `dac474c63b27600568be77bdf044ceb1dc7c9830cc1fe72990d47d2c091a216b` |

All variants decode and the first 24 decoded frames are pixel-identical. The title fades in output frames 24–27, holds, and fades out 49–54. R02 and R03 are identical in inspected title ROI at output frames 24,28,32; they diverge only when the repaired matte reaches the word. In R02, the foreground connected component widened to 134–148 px across source frames 148–151 (ordinary adjacent widths 57–76 px): a narrow horizontal piece of path was mistakenly restored in front of type. **Reject R02 as a clean moving-matte example.** Morphological opening and torso-seed component retention reduce those four widths to 60,57,61,62 px, with subject continuity at the adjacent frames. R03 is the preferred bounded comparison, not a universal person mask.

## Actual inspection and limits

Decoded plain/front/R02/R03 contact sheets at output frames 28,32,36,40,48 and full-size R03 frames 36/40 were inspected. The person crosses `MOVE` in the right direction; the word remains readable, and the repaired path line is absent in the sampled frames. R03 differs from the front-title control within the text/subject ROI at frames 24,28,32,36,40,48,49,54; first 24 remain exact. The backlit hair and feet require an independent full-motion edge and physical-phone review; contacts and sampled frames are limited evidence. The word is a visible graphic over a bright sky, not convincing scene-projected signage. The clip is landscape and silent. No normal-speed human motion judgement, heard sound, native Premiere save/reopen/export, second-PC relink, client story or approval is claimed. Keep all revisions and the failed path-leak gate with the private source.
