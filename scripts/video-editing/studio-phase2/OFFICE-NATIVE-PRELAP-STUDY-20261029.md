# Office native incoming silhouette — 29 October 2026

This advances the existing subject-silhouette-prelap family, not a new family or a creative mastery claim. The useful discovery is that holding a source frame and checking Hold Filters does **not** freeze this native Object Mask's boundary. Nesting the completed transparent silhouette, then holding the nest, repairs the measured drift. Keep the failed direct-hold controls.

## Sources and purpose

Both actual originals were rehashed and their publisher pages rechecked at about 04:04–04:05 SAST. Each explicitly offers the Stock Video Free License for commercial/personal use:

- [Woodland 5040](https://mixkit.co/free-stock-video/huge-trees-in-a-large-green-forest-5040/): original `https://assets.mixkit.co/videos/5040/5040-720.mp4`, SHA256 `ea27751d1ad382903511d2f4d0e25ddeddea26233f14ada5348e6fc58e676953`, 1280×720, 30 fps, 1203 frames. The selected native opening actually maps output 0–28 to source 420–448, all 29 frames, rather than the intended 30-frame insert. Native source IN 14:00/OUT 14:29 becomes 29 frames on this 29.97 timeline. Full-frame downsampled nearest-original comparison confirms the map, maximum RGB MSE 9.571 at 160×90. Do not silently round this to a one-second/30-frame cut.
- [Park woman 4825](https://mixkit.co/free-stock-video/girl-from-the-front-walking-through-a-park-4825/): original `https://assets.mixkit.co/videos/4825/4825-720.mp4`, SHA256 `3afa22d3acf94f0aa73f2958f70a05842a88a3b62f7784aecee75a40d78a126f`, 1280×720, 30000/1001 fps, 318 frames. Plain output 29–118 maps consecutively to original 0–89; maximum 160×90 RGB MSE 4.442. Incoming source 0 is covered by the silhouette at the cut; source 1 returns at output 30, then real motion continues. No invented/interpolated action.

Earlier whole-source screenings are explicitly reused from the [natural-mask](OFFICE-NATURAL-MASK-STUDY-20261028.md) and [forward-handoff](OFFICE-FORWARD-HANDOFF-STUDY-20261028.md) studies. Fresh first frames, the exact moving source selections, all-frame output contacts and full-size cut/return/late samples were inspected this wake. The two selected spans also completed local ffplay playback. Upright trees/face and torso at frame bottom are visible. This is an illustrative nature-to-person anticipation experiment: neither same forest, person journey, country nor client affiliation is established. The outgoing woodland has no second person to duplicate. The shot gives no feet/contact-shadow/clean-empty-plate proof. Deliberate source camera movement is retained for this mechanism comparison, not certified as a finished cinematic grade/stabilisation pass.

## Actual native construction

Premiere 26.5, existing on-device Object Mask and existing local tools only. Save As from the prior natural-mask R02 into a separate private `native-prelap` project; remove its titles, preserve normal V1 and masked V3 duplicates. Insert the verified woodland on V1 before the person; insertion shifts both person layers together. No client timeline or original research project is written. Plain disables V3 and exports the actual hard cut.

For Colour R01, select the V3 duplicate, Frame Hold Options: Hold On / Source Timecode 00:00:00:00, Hold Filters checked. Unlink speed/duration, shorten duration to three frames at 100%, and nudge two frames left with native Alt+Left. It occupies output 27–29 inclusive, resolving at 30. The source pose remains frame 0, but its Object Mask tracks forward. This is a negative boundary-hold control, not a frozen finished matte.

White R02 adds the installed native Tint: both Map Black To and Map White To `FFFFFF`, Amount to Tint 100%. Object Mask is still assigned to Opacity, Smooth, feather/expansion 0, mask opacity 100. No full-picture white exposure flash is substituted. Save/close/reopen/export R02. Earlier R03 changes only the held clip duration/start to five frames at 25–29, with the same cut at 29 and resolve at 30. Its source OutPoint and track Start change; effects, source hold and V1 remain. Reopen/export again. Both direct-hold versions are rejected for strict held-boundary use.

R04 repair: native Nest of only that five-frame V3 silhouette, named `White-Silhouette-Matte-Source0`; then apply Frame Hold Options to the **outer nest**, Source Timecode 00:00:00:00, Hold Filters checked. The nested sequence retains the original editable Object Mask/Tint/linked source; the outer hold samples the completed first-frame alpha. V1 remains moving. Save/close/reopen/export. R05 changes only this outer held clip's duration/start from 25–29 to 27–29, at 100%, preserving the same nested first pose, cut and return. Save/close/reopen/export.

[Adobe Frame Hold instructions](https://helpx.adobe.com/premiere/desktop/edit-projects/change-clip-speed/freeze-a-video-frame-for-the-duration-of-a-clip.html) document source-timecode holding. They do not certify this Object Mask interaction: the failure and repair above come from actual local outputs. Native files are application-created, not injected project XML. Private read-only gzip/XML comparison checks the revisions; no parameter-only revision is falsely claimed for the architectural nesting repair.

## Output and revision acceptance

Twelve NEW native H.264 exports, each 119 frames, 1280×720, 30000/1001 fps, 3.970633 seconds, one silent video stream, fully decoded. They comprise plain, colour, R02/reopen, R03/reopen, repaired R04/reopen, shorter R05/reopen, and two isolated mask diagnostics. All 118 adjacent picture pairs change in the composed clips; the brief foreground hold does not freeze the entire shot. Diagnostics have intentionally black surrounding frames and no alpha channel; they are not reusable transparent mattes.

All four actual save/close/reopen/export pairs match **119/119 decoded RGB frames**. Direct R02→R03 preserves 25/25 opening frames; only 3/89 post-resolve frames match exactly. Repaired R04→R05 also preserves 25/25 opening frames, but only 2/89 post-resolve frames match (30 and 60). Native outer `VideoClipTrackItem` 88 Start and `VideoClip` 131 OutPoint change, plus Project bookkeeping; same nested effects and source. Encoded tail equality fails despite unchanged V1. No encoded cache/splice conceals this.

Native isolation diagnostics make the hold failure measurable. At threshold 128, un-nested R03 changes 5,636 silhouette pixels by its fifth frame against the first; IoU falls to 0.982028 and RGB MSE reaches 208.804. The repaired nest has **zero threshold-mask XOR at 64, 128 and 240 through all five frames**, constant threshold areas 316818/313419/307027, and maximum decoded RGB MSE only 0.001066 against the first. Tiny encoding differences remain; no exact pre-encode alpha or pixel identity is claimed from H.264. Fine hair remains soft/fuzzy and original-mask limited.

Actual full/reduced cut contacts, all 119 ordered R03/R04/R05 frames, full-size silhouette/return/late frames, isolated five-frame comparisons and native saved/reopened settings were inspected. Native R05 playback ran from frame 20 through frame 47, changing picture, then was stopped. Whole six-way labelled comparison and R05 local ffplay playback completed exit 0. These are playback/inspection receipts, not independent continuous human or physical-phone judgement. All sources/outputs are silent; no hearing, beat/SFX fit or comfort approval.

## Editorial decision and remaining gates

The repaired three-frame version is a bounded construction candidate; the five-frame white area withholds the face longer. A large white bust still reads as a conspicuous flash/ghost, not automatically a motivated introduction. Plain gives the person immediately with less visual interruption. Do not make this a client default or claim the exact reference/CapCut template. Natural fine-hair alpha quality, 9:16 framing, heard action-linked sound, physical-phone/independent human comfort, second-PC mask relink and creative/brand/story acceptance remain open. Same-PC native editable nesting/reopen is witnessed; MSI/staff acceptance is not.

Preserve each corresponding entire `[project name] Masks` folder with `.prproj`, linked original media and nested sequences. Save As generated these dependencies. No new model, plugin, engine, credentials, client upload/send, paid/API credits, global setting, storage worker or MSI/Central Canvas amendment was touched. Private QA initially failed on an empty white-pixel selection; that diagnostic now records an empty mask instead of taking a minimum of no pixels. First reopen screenshot was taken before sequence activation; a later actual active-timeline witness preceded re-export. Neither failed diagnostic was counted as acceptance.

Next distinct existing gate: native scene-perspective-type on the already cleared moving wood. Reuse its verified source/feature ledger; test actual installed Corner Pin or another native editable route with plain/fixed/moving controls and protected copy revision. Do not infer native title/tracking from the earlier baked homography proof. Capture-dependent freeze/clone/device transitions remain source-gated.

## Native export SHA256

- `prelap-colour-r01.mp4`: `09388f3142aa2046a4c152a4057e1768cec2bc8bea627a0684dd37c4b4f96321`
- `prelap-earlier-r03-reopened.mp4`: `56e5ca73f7f1451a5b34e7323552a76d42ff3624b79b21d8a6766c7a1874eaeb`
- `prelap-earlier-r03.mp4`: `400bc82b1874a9dcbf482dd5f697396a97bc76e7bf473ed3f39380ef1e79f0c9`
- `prelap-nested-isolated.mp4`: `5d0df9d48a798930e50bee28434a175cb4f2364dbb95c7cd073741714f7f0b40`
- `prelap-nested-r04-reopened.mp4`: `27c5eba4c0f8ec11135f27ccec1124b324e1a234df13286e790ed02f2409d2f3`
- `prelap-nested-r04.mp4`: `588cbedb8d29be3a8cfe812606de58201c844eee5075f97a46ba94ed61b94920`
- `prelap-nested-short-r05-reopened.mp4`: `c08c7989d3377caf0b2db7879cb740c6d41e335f3a3a07caddf0efa9ba984801`
- `prelap-nested-short-r05.mp4`: `a792b4d88f8dcd0debd6e7c46d737ba02380dd5d796329a7438104ff02c9eef0`
- `prelap-plain.mp4`: `c6a91e747d5b829cc225e12827d9dc9f3498d908086775d4a11a71aab6d2b1a1`
- `prelap-unnested-isolated.mp4`: `55b6898eee08e40cfab1d24a5f9d2f345cd690abea0dc4ca17d06e4bd80f68bc`
- `prelap-white-r02-reopened.mp4`: `a57dbdeb669802228f020b0281957b646726ae3e8ba280deda68c3eb1d38c7a9`
- `prelap-white-r02.mp4`: `99a79510f9a036c9f25e95d9e9ed9f3f9159441dd9897186cfa1e2b8a3dfb2dd`
