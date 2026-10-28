# Office native text save/reopen/export proof —28 October2026

## Scope and actual source

Existing staggered-type family, not a46th family and not mastered. Native Adobe Premiere26.5.0.99 on the office PC was launched through the ordinary UI after CA explicitly freed the desktop for overnight research. No client project was opened or modified. A new local project uses only transferred, licensed Mixkit41865: `https://mixkit.co/free-stock-video/cup-being-filled-with-coffee-in-a-coffee-machine-41865/`, SHA256`883b71655e2f2448a03b02f6e318eced58b51bac5b74da86c018995f3c817331`. Existing intake rights receipt applies; this is illustrative coffee footage, not CG client work. Local Arial Bold is used, not redistributed.

## Reproduce in the native application

1. Create a new local project; choose the scratch location explicitly. Premiere's last-used location points outside this research lane, so do not accept it. Import the original41865 file, inspect the upright portrait source and set source IN`00:00:02:00`, OUT`00:00:04:23` at24000/1001. Drag to an empty timeline to create the720×1280,72-frame sequence. Preserve all source pixels; no stock sharpening, stabilisation or grade is asserted by this text test.
2. Export an entire-sequence H.264 plain control locally, Match Source–Adaptive High Bitrate, audio disabled, every publishing destination off. This source has no audio. This is3.003s, not exactly3.000s.
3. Create one native Graphic with two separate editable text layers. Both Arial Bold72, white; no burned-in external graphic. SMALL positionX156.3,Y178→154.1 at timeline frames0→6, opacity0→100. DETAILS positionX156,Y320→296 atframes12→18, opacity0→100. Keep unanimated scale100 and source time fixed. The native linear6-frame entrance is a modest bounded text mechanism, not a recreation of the reference's sophisticated pop/easing. Trim the default graphic length to the exact sequence end to avoid a black title tail.
4. Save R01 as an actual`.prproj`, export R01, close the project and reopen the same saved project. Witness online footage/native layers. Atframe24 change only the DETAILS text to RITUALS with Type tool selection, preserving the other word, font and native keyframes. Save As R02, export; close/reopen R02 and export again to a new filename. Do not overwrite an imported/locked media file.
5. Verify the files outside the editor: four MP4s each72frames720×1280/24000/1001,3.003s, H.264 and no audio. Full decode plus sampled encoded pictures atframes0/3/6/12/15/18/40/71 inspected full/reduced. Compare decoded R02 and its reopened export, not merely their different container hashes.

Actual UI evidence, both native projects, original-linked source paths, exports and QA remain private under office`work/research-continue/native-type`; UI screenshots in`work/overnight`. The owner-facing MP4 pair is in`outputs/Nolan-Research-20261028`. No native project or footage enters Git. UI steps are the tested recipe; coordinate clicks are not portable automation.

## Actual results

- Plain SHA256`5978deba4961b6c677c271432415087ef4e87546cd8e3ebf4c7dca8911149f30`.
- R01 SHA256`1ae047407dd8ed4e2952f03420e68304f118f249f71a3daddb8ca3a35eba1481`.
- R02 SHA256`dab8a16791e8767c9e02029902ef429d0c22d3ad7df8ecbe3721f979e873cbb4`.
- R02 reopened export SHA256`10b1f4101d7d0c5356fa304b3d18a843fea023d3d3a9216bf7deb4d45137379d`.
- R02 versus reopened export: **72/72 decoded RGB frames exactly equal** despite different container hashes. Actual native save/reopen/export passes on this PC for this project.
- R01 versus copy revision: frames0–12 exactly equal. Frame13 is first visible second-word change. Outside the title region(y≥400), encoded maximum absolute RGB difference11, mean0.0946124, consistent with re-encoding; do not claim pixel equality of the protected encoded footage. Timeline/source settings were preserved; no exact decoded parity claim outside the changed words.

## Failures and limits

First source OUT was inadvertently set to IN, yielding a one-frame marked range. The visible duration caught it; a settled timecode edit repaired OUT before sequence creation. An initial reopen attempted typing before the file dialog was ready and got File not found; no project/media was lost. Explicitly targeting the filename field reopened the correct file. Never chain blind UI keystrokes through dialogs and infer success. Native create-project survey/feature prompts were dismissed; no feedback submitted, generative function used or account/configuration changed.

Type is readable in sampled encoded frames and leaves both pour streams visible. The top word is intentionally high for this mechanism test and has **not** passed a current platform overlay/crop review. Silent cadence was chosen for testing keyframes, not approved beat/speech timing. No complete heard score, physical-phone, second-editor/second-PC relink or client/creative acceptance. This clears a **single-PC native text workflow gap**, not every family’s native implementation. Next: natural foreground via the installed on-device Object Mask, subject to actual route/performance/edge tests. Adobe describes Object Mask as entirely on-device in its[20January2026 announcement](https://blog.adobe.com/en/publish/2026/01/20/new-ai-powered-video-editing-tools-premiere-major-motion-design-upgrades-after-effects); this does not authorize Generative Media, cloud uploads or credits. Continue with cleared practice footage only.

Validation: canonical skill and amended staggered-type card pass quick_validate in process-only UTF-8 mode;45 cards remain;295 local links across the study/card/status/progress/board resolve. TypeScript and Vite build pass with the existing chunk-size warning. No dependency/lockfile or production application change. Shared canonical reference was reviewed then installed with backup/hash verification. Media/project/UI screenshots and runtime dispatcher remain private; only scoped recipes/receipts/instructions enter the research PR.
