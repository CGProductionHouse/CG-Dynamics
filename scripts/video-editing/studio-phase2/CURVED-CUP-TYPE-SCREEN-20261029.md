# Office background screen — type on a curved coffee cup, 29 October 2026

**Existing family:** [scene perspective type](skills/scene-perspective-type/SKILL.md). This is a silent portrait stock screen of a gently curved surface, not a client logo, approved cup branding or native scene tracking.

## Source and rights

- [Mixkit #41865, cup filling under an espresso machine](https://mixkit.co/free-stock-video/cup-being-filled-with-coffee-in-a-coffee-machine-41865/) explicitly lists its Stock Video Free License for commercial/personal use. Exact private source `work/research-intake/extracted/core-licensed-inputs/repo/scripts/video-editing/studio-phase2/media/mixkit-41865-720.mp4` SHA-256 `883b71655e2f2448a03b02f6e318eced58b51bac5b74da86c018995f3c817331`, 720×1280, 24000/1001 fps, 316 frames. Selected source frames48–119 keep the same cup and moving espresso streams. No client or tutorial footage was used.
- The cup front is broad, gently cylindrical and approximately fixed in this 72-frame selection. The test word `BREW` is fictional practice copy. It fades over output frames24–31, holds through54 and fades out55–61. The unchanged first24 frames let a later material revision be inspected without touching the opening.

## Controls and protected revisions

Private renderer `work/research-continue/curved-cup-type/render.py` checks the source hash. It exports the original moving shot, a flat 2D word, a 2D cylindrical remap, an R02 remap with luminance-weighted alpha and an R03 remap that multiplies the real cup pixels under the ink. R03 retains the cup's existing highlights/shadows better than mixing toward a fixed navy colour. It does **not** estimate or track a 3D surface; projection parameters were selected from the visible cup shape.

| Private output | SHA-256 | Decode |
|---|---|---:|
| `cup-type-plain.mp4` | `926d1f249a19b28864f1c7dbcc0df69db7d0149a97784688d2cdd89856fc946f` | 72/72 |
| `cup-type-flat.mp4` | `4ef61da10920bbb93486be344c8152d7b7787fa2cabafba8f23f9e406f1d0e54` | 72/72 |
| `cup-type-curved.mp4` | `39f0cbdbdf00df8a1bf5019d5fc01f4e051b24574480f886384e3b297844f108` | 72/72 |
| `cup-type-curved-shaded-r02.mp4` | `5657eae2223bb328c6340a96fd21fd2d71f90fe3031d20ed872bb385cdc94b62` | 72/72 |
| `cup-type-curved-multiply-r03.mp4` | `3ab70b433cf55e8ed19189e7a27bed3744e05ce1afb0301d7e896004b17436b1` | 72/72 |

Private `inspect.py` decoded every frame and verified **24/24 pixel-identical opening frames across all five**. The decoded contact compares frames23/24/32/42/54/61 at 220-pixel cell width; full-size flat/curved/R02/R03 frame42 and R02 frame61 were inspected. All words stay on the cup body below the rim in those samples. At output frame42, the flat-versus-curved cup ROI mean absolute RGB difference is3.8804 levels and48,558 decoded pixels differ by more than3 levels; the remap is real, even though the viewer sees little extra curvature at reduced size. R02 becomes too faint. R03 remains legible and carries cup luminance through the darkened letters, but the result still reads largely as a graphic overlay and does not visibly establish convincing physical printing or tracked surface depth. H.264 history makes post-fade encoded frames differ slightly from the plain stream; no exact tail parity is claimed.

**Decision: curved-surface realism gate remains failed.** R03 is a more readable bounded material candidate, not a mastered scene-perspective treatment. The cup's mild curvature and near-static position are insufficient to prove arbitrary curved/depth-changing planes, moving camera tracking, foreground occlusion or actual logo printing. Full-speed human/physical-phone judgement, heard sound, story/brand fit, native editor save/reopen and second-PC handover remain open. For a future test, choose a surface with measurable changing perspective and clear object occlusion, then compare flat versus tracked projection with staff-editable layers.
