# Office natural foreground and native depth type —28 October2026

## Source and bounded result

Existing depth-type family, not a46th family. Supplemental[Adobe Object Mask tutorial](https://www.adobe.com/learn/premiere-pro/web/text-behind-subject-object-mask) was read through its official transcript; no tutorial audio/full-speed viewing claim. The actual independent practice uses[Mixkit4825](https://mixkit.co/free-stock-video/girl-from-the-front-walking-through-a-park-4825/), whose live page explicitly identifies the Stock Video Free License/commercial use. Original download exposed by that page: `https://assets.mixkit.co/videos/4825/4825-720.mp4`,3363035bytes, SHA256`3afa22d3acf94f0aa73f2958f70a05842a88a3b62f7784aecee75a40d78a126f`. Source1280×720/30000/1001,318frames10.6106s, no audio. Full source1fps screening covers the changing face/hair/background; the actual masked selection is only sourceframes0–89,90frames3.003s. Do not call it a full318-frame mask.

Unlike prior controlled green/dark-backdrop tests, this shot has natural trees, path and moving fine hair. Installed Adobe Premiere26.5.0.99, NVIDIA RTX5070Ti16303MiB/driver610.88. Adobe states Object Mask is[entirely on-device](https://blog.adobe.com/en/publish/2026/01/20/new-ai-powered-video-editing-tools-premiere-major-motion-design-upgrades-after-effects). The native Object Mask/Tracker route was used; no Generative Media/Firefly, provider upload, API key, credit or purchase invoked. Processing locality is vendor-supported, not a packet-capture audit.

## Actual native procedure

1. New isolated local project, import exact source, mark IN00:00:00:00/OUT00:00:02:29 and create matching source sequence. Export plain3.003s control; first filename remained Premiere's `mixkit-4825-720_1.mp4`, not the original. Preserve this exact identity in QA. The original remains unchanged.
2. Select footage, Object Mask tool(Ctrl+Alt+O on this PC), select the person. Initial model/preview response was delayed; wait for an actual mask in Effect Controls, not a screenshot without it. Default Smooth, Feather0, Expansion0, mask Opacity100. Track forward through the selected clip. Tracker UI near completion displayed59fps; this is an observed indicator, not a benchmark or speed guarantee. Drag Object Mask from Unassigned Masks onto Opacity. Export the isolated person over black as a diagnostic. This H.264 MP4 has **no alpha channel** and is not a reusable transparent matte.
3. Keep identical unmodified footage atV1 and the tracked/opacity-masked duplicate atV3. Native editable text atV2. Initial oversized Arial Bold200 OUTSIDE across the head obscured too many letters: front control and behind R01 are retained, but that word/layout is **rejected**, not a client preset.
4. R02 uses two native white Arial Bold110 layers, source-space baselineY300: MAKE X380→40; SPACE X620→860, each moving linearly overframes0→24. Opacity0→100 overframes0→6. Both then hold to89. The words open away from the moving subject and become fully readable at the sampled settle/late frames. Compare the exact same title above the subject(front control) and below the masked subject(candidate). This is a landscape mechanism test; do not crop to9:16 and claim the widely spaced text remains safe.
5. Save R02, close/reopen the actual`.prproj` with its masks folder, export again.90/90 decoded RGB frames equal the earlier R02 despite different container hashes. In the reopened native title change only SPACE→TIME; Save As R03 and export. Native font/position/opacity keys and footage remain. Only decodedframe0 matches exactly between R02 and R03; encoded left-half mean absolute RGB difference0.4682719. Do not claim protected pixel identity across the copy revision.

## Handover dependency caught in the app

Premiere's first Object Mask operation explicitly warned that mask data lives in an external dedicated folder next to the project. Actual R02 and R03 each have a `[project name] Masks` folder containing two`.prmf` files,1751808 and23004bytes. Preserve the **entire** corresponding folder unchanged with the`.prproj`, original-linked footage and fonts. Save As generated each version's masks folder; do not assume copying only the project carries it. [Adobe's masking documentation](https://helpx.adobe.com/premiere/desktop/add-video-effects/work-with-masks/object-masking.html) confirms this transport requirement. The actual same-PC R02 reopen/re-export passed; relocation, independent editor and MSI relink still untested. No client project was opened.

## Actual inspection and limits

Eight native exports below fully decode90frames1280×720/30000/1001,3.003s. All89adjacent frame pairs change in each export: no frozen surrogate. Isolated mask viewed at all90frames at320×180 in a complete contact; full-size isolated/depth/front/revision samples atframes6/12/45/89 inspected, with reduced opener/settle/end comparisons. Face/body remain intact and the torso meets frame-bottom; thin flyaway hair has residual softness/fuzz against black, not perfect strand reconstruction. No natural empty plate, feet/contact shadow, occluded-limb recovery or arbitrary natural matte accuracy is established by this bust shot. Wider/sparser hair needs a separate source test. R01 typography failure is separate from the usable bounded mask.

Exact R02 normal-speed local ffplay run completed exit0 for3.003s. This establishes playback operation, not independent human/phone comfort or artistic acceptance. The selected source/exports are silent; no song fit, heard beat or sound approval claimed. No creator-template match, physical capture,9:16 safety, second-PC/staff acceptance or mastery promotion.45 families remain. Private native projects, `.prmf` data, sources, screenshots and frame QA are under office`work/research-continue/natural-mask`; only docs/recipes enter Git. Owner-facing R02, copy revision and labelled front/behind comparison are in`outputs/Nolan-Research-20261028`.

## Failures retained

- First mask response took longer than the click chain assumed. The eventual native selection and dedicated-folder warning established actual creation before tracking.
- OUTSIDE lost too much meaning behind the head; rejected, replaced with MAKE/SPACE opening into free picture.
- A blind timeline drag after export shifted camera clips three seconds, producing a six-second unsaved project. This was caught visibly, discarded **without saving**, and known-good saved R02 reopened. Its exact90-frame re-export equality proves recovery. Confirm single-clip selection, actual tracks and duration before moving/saving; changing panel focus/layout invalidates fixed coordinates.
- First comparison-label render failed on Windows colon/font-path escaping before output. Using a private local font path repaired it; no font redistributed and no native media overwritten.

## Encoded native output SHA256

- `mixkit-4825-720_1.mp4`: `e892c4270fe0cf41b249d4d5a098951f910abcd9e54eee1a81883cf29b369423`
- `Natural-Mask-Isolated.mp4`: `22dfabe343fb18f586d4b4d6f54845f2576b33827f4875a7a81e6273713fb517`
- `Natural-Type-Front-Control.mp4`: `328fc112a06a93c33ce39463a173bbb9296a2c77fa508c519ff5f30b564b5fa7`
- `Natural-Type-Behind-R01-Rejected-Layout.mp4`: `f4d126e84fb5618e75d951a469d601510c3c695e22353ea2878eb7515f9750d0`
- `Natural-Type-Front-R02-Control.mp4`: `488994f5df7190a477a90768a217b74e15582d3d6aaca5ee7cfccd152799dd3f`
- `Natural-Type-Behind-R02.mp4`: `cf5a4390312527ceeebddea33f00f7fe596c76eb0f3a8d9d717fe82790234858`
- `Natural-Type-Behind-R02-Reopened.mp4`: `bedf808272b934483d3c40dda55487dda1c8a6464c7b3fb33f0ffd49b8baef22`
- `Natural-Type-Behind-R03-Copy-Revision.mp4`: `bc7664de00bb2787bfd53484137d47b8be8cb6cd60c2d0dfb35ff10ef177eba6`

R02/reopened export90/90 decoded frames exactly equal. Front/behind R02 differ in all90encoded frames; differing GOP/compression means this count alone is not a geometric mask score. Visual edge/occlusion inspection is separate. Source-only plain, R01 front/behind failure, isolated diagnostic, R02 front/behind/reopen and R03 copy revision are distinct evidence, not eight skills.

Next distinct work: genuinely different-shot directional handoff with clean geography/motion; then unkeyed moving plane. Improve this method only for a new source/quality gate, not identical re-exports. Heard sound, physical phone and independent staff handover remain separate.
Validation: canonical skill and amended depth-type card pass quick_validate in process-only UTF-8 mode.45 cards/304 local links resolve; all eight native exports pass full FFmpeg decode without errors, source hash remains unchanged after UI exports. TypeScript/Vite build and diff checks pass; existing chunk-size warning. Shared canonical reference synced with backup/hash proof. First build-log path was wrong so redirection failed before Vite ran; corrected private path and actual Vite build pass are recorded, not a false initial pass.
