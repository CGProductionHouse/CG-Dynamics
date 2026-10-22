# Native Premiere finishing recipes — verified 22 October 2026

Engineering companion to the [audit](../../docs/ops/CGPH-NOLAN-PREMIERE-INTEGRATION-AUDIT-2026-10-22.md). Continue #856/#862; #859 owns the creative skill pack. These are bounded Adobe API recipes and acceptance rules, not another editor, general script server or installation package. Client media, paths, templates and private receipts stay outside Git.

**Later approved integration:** [1.24.3 installed and tested](ISOLATED-UXP-1243-ACCEPTANCE.md). Native effect insertion and key authoring now have a real external MCP route alongside CEP. Read its limits before using: timed scalar values need independent wrapper-aware verification, AE text remains on CEP, and the transition guard refused this host. The earlier pending-approval/Playground-only statements below are historical for those accepted new operations; no default/all-tools promotion.

## Route to use

Keep the approved pinned PremiereMCP CEP repair candidate and its 19 selected tools for verified exposed AE text/font/size/colour, identity, reads, save and export. Use the existing approved Adobe UXP Developer Tools for finite duplicate-only native transactions where CEP effect insertion or QE transitions fail. Do not retry the failed CEP routes. UDT still needs GUI loading/running; this is not an unattended external UXP connection.

Existing installed resources are sufficient to demonstrate a real flash transition, original-linked slow motion, Lumetri, editable title reveals and independent sound automation. Installing more plugins is not the acceptance criterion. OpenCurve remains a tested GUI option; sampled native keys can express a bounded easing curve without another plugin. Installed Film Impact Flash availability on this laptop does not prove another staff machine's entitlement.

## 1. Separate discovery from synchronous actions

```javascript
// In an already approved Adobe UXP context, after exact duplicate path/GUID
// and active sequence GUID checks. Repeat those checks before each transaction.
const component = await pp.VideoFilterFactory.createComponent(matchName);
project.lockedAccess(() => {
  const accepted = project.executeTransaction(compound => {
    compound.addAction(chain.createAppendComponentAction(component));
  }, 'Bounded native effect');
  if (!accepted) throw new Error('Transaction refused');
});
```

Discover asynchronously first. Create Action objects synchronously inside the lock/transaction. Read the resulting chain and exact match name afterward. An action return, toast, saved project or nonempty component count is not proof the intended effect exists.

Verified match names on Premiere 26.3.2:

| Control | Exact discovered name | Host evidence |
| --- | --- | --- |
| Lumetri | `AE.ADBE Lumetri` | Appended to eleven original camera clips; Exposure/Contrast/Highlights/Shadows changed |
| Crop | `AE.ADBE AECrop` | Appended to three AE MOGRT clips; Bottom keys independently sampled |
| Motion / Opacity | `AE.ADBE Motion` / `AE.ADBE Opacity` | Native scale, rotation, crop adaptation and opacity keys |
| Stereo gain | `Internal Volume Stereo` | Independent score, riser and original action-cue automation |
| Flash transition | `AE.AE_Impact_Flash` | Actual native transition and flash frames in Adobe render |

The guessed `AE.ADBE Crop` failed discovery. Do not infer match names from UI labels. Lumetri indices 19/20/21/22 on this host were Exposure/Contrast/Highlights/Shadows; assert each display name before writing. Do not assume index portability across releases/languages.

## 2. Keep both source item wrappers

Retain `{ item, clip: pp.ClipProjectItem.cast(item), id: item.getId() }` after matching the exact media path. Use the clip wrapper for source interpretation/in/out; use the original ProjectItem for `createOverwriteItemAction`. The cast wrapper does not supply `getId()` on this host. A wrong wrapper previously failed before sequence creation; this is not a reason to disable guards.

Before each edit, verify source duration, intended action moment, prior-use ledger, interpretation, timeline occupancy and rights. Do not reuse a source clip within one film. A short burst needs distinct meaningful visual details, not arbitrary frames from one shot.

## 3. Use a frame plan and verify the resulting timeline

Specify integer sequence frames, then convert to TickTime. Re-read **every** native start, end, source in and source out after assembly/retiming. In the practice run, a planned five-frame item read back as four frames, leaving a one-frame gap; the precise quantisation cause was not isolated. A later source-range correction unexpectedly moved the timeline placement. Both were caught before accepting the third render.

On this host, `createSetInPointAction`/`createSetOutPointAction` changed sequence start/end as well as source range. Do not assume a slip edit. After source changes, `createMoveAction(TickTime.createWithSeconds(targetStart - actualStart))` restored the intended timeline position while preserving the new source in/out. Assert the complete range tuple before export. Overlap, gaps or out-of-media ranges fail the gate even if sequence duration is correct.

50fps → 25fps `ClipProjectItem.createSetOverrideFrameRateAction(25)` produced native interpreted slow motion; footage interpretation read back 25. Interpreted source-time ranges double. This is a shared project-item interpretation change in the protected duplicate, **not per-instance variable Time Remapping or a speed ramp**. Audit other instances before reuse; never mutate the real client project's source interpretation casually.

## 4. Animated exposed titles

Choose an existing licensed MOGRT with actual font/size/text controls. Preserve its AE text JSON run metadata. Fit the template text box first; native Motion scaling cannot fix internal overflow. Use installed fonts only, verify the rendered design, and keep brand approval separate from a technical sans-font test.

The practice title uses ten native Scale keys at 25fps over 0.36s:

```javascript
const u = frame / 9; // frame = 0..9
const value = 210 + 40 * (1 - Math.pow(1 - u, 3));
const key = scale.createKeyframe(value);
key.position = pp.TickTime.createWithSeconds(sourceIn + frame / 25);
// createSetTimeVaryingAction(true), then createAddKeyframeAction(key),
// synchronously inside the protected transaction; independent readback follows.
```

Independent CEP reads after native writes: Scale **210 / 243.141296 / 250** at source **0 / .16 / .36s**, versus a linear midpoint. Opacity **0 / 100 / 100** and Crop Bottom **55 / 30.555555 / 0** at the same times. All remain native editable parameters. This is sampled easing, not proof of arbitrary Bezier-handle control or text behind a tracked subject.

Landscape-template Motion Position `[.5,.5]` did not center its internal artwork in the portrait render. Actual first export cut words off-screen. A template-specific position correction made all three words readable in the later render. No universal magic position should be installed into a client preset. Check actual type bounds/contrast at entry, settled and exit frames on every new template/aspect ratio.

Graphic `setColorValue` alpha 0 read back but the tested AE template's rendered main artwork remained visible. Thus exposed colour alpha is **not an accepted background-removal control** for this template. Use an intentional opaque brand treatment or a template with verified background visibility controls. Never call a native readback an appearance guarantee.

## 5. Audio stays separate from picture

`createOverwriteItemAction(source, time, 0, -1)` did **not** reliably exclude raw camera audio. Eight unintended audio clips were created. Inspect the audio tracks after insertion; do not build a mix on this assumption. Use a verified stream-selection/subclip route, or explicitly remove only the unwanted audio track items on the protected duplicate before adding the mix.

For native removal, construct `TrackItemSelection.createEmptySelection(callback)` and `createRemoveItemsAction(selection, false, MediaType.AUDIO, false)` **inside** the synchronous transaction callback. Do not let selection/action lifetime escape into an async continuation. Verify picture counts and ranges afterward.

Native stereo Level uses approximately **0.17782794 for 0dB**. Its scalar is not ordinary unit gain: 0.065 is about −8.7dB, not −23.7dB. Formula for this tested encoding: `level = 0.17782794 * 10 ** (dB / 20)`. Verify actual host/readback/output before reuse on another audio component. Early .45/.35 trial values were replaced before the accepted render.

Give impacts a few milliseconds attack plus a natural tail across the picture cut. Extracted original audio excerpts may be reused as independent source-linked cues; keep original source/time provenance. Do not render the complete mix into a film-length stem. Align the impact to the displayed action after retiming, then listen; waveform peaks alone cannot establish synchronisation or taste.

The practice has separate score, riser and two original action cues. The riser ends at 2.24s; music begins at 3.36s after a 1.12s breath. The song is not started, interrupted and resumed. Export measured **−19.1 LUFS integrated / −4.6dB true peak**, with no clipping indicated. This is not listening approval or an automatic loudness target for every film.

## 6. Rendering is part of editing

Use a fresh unique Adobe output, verify completion, 4K dimensions/fps/frame count, full audio/video decode and unexpected black segments. Then inspect the relevant frames and motion/audio. Quick AE PNG previews remain excluded because changed graphics can be stale/missing. FFmpeg may inspect/extract Adobe output and derive unmodified audio cues; it does not replace native picture/title/effect rendering.

The first practice render failed composition and source-bound gates; the second corrected source ranges but revealed moved timeline positions. The third passed exact range continuity and full decode with no detected black segments. Contact sheets/individual frames were inspected, including all 29 burst frames. **Full-motion playback, listening, phone and staff-device acceptance remain open.** A numeric pass must never be promoted to a premium-client-final approval.

## Boundaries and next reuse

- Real source-linked Premiere finishing is viable with the accepted controls. A 12s capability proof does not replace a research-backed ~30s client brief, conversion goal, real brand font/logo/CTA, cover or caption.
- Native variable speed ramps, Optical Flow authoring, tracked subject masks and arbitrary keyframe handles remain unsupported/unverified through the tested routes. Do not invent API signatures or hide externally baked substitutes.
- UDT script loading is still GUI dependent; the preserved CEP bridge is not native UXP MCP. The separately researched MIT `premiere-pro-mcp` 1.24.3 offers a candidate authenticated UXP connection, **pending owner installation approval and actual test**. Its broad network/folder permissions require review; catalog counts do not establish acceptance.
- Before staff rollout: exact Adobe/plugin/font entitlement, original media access, an independent backup, saved editable controls, render/playback/listening and a second-device relink test. Do not redistribute Adobe MOGRTs or client assets in a public skill repository.

Primary references: [Adobe UXP API](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/), [component parameters](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/componentparam), [clip source interpretation](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/clipprojectitem), [sequence editor](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/sequenceeditor), [candidate pinned release](https://github.com/leancoderkavy/premiere-pro-mcp/releases/tag/v1.24.3). Vendor documentation is separate from the local host evidence above.
