# Office native colour-inversion pulse study —29October2026

Existing color-invert-glitch family, PR910 after metallicb4e3deeb. Advances the open native controls/revision gate; does not repeat the old boxing-source rejection as a new client edit. No client/creator media, MSI amendment, Central Canvas, storage-worker, spending, install, global preference or new-engine change.

## Source rights and control

Same cleared moving coffee41865 as the [native metallic study](OFFICE-NATIVE-METAL-STUDY-20261029.md), original SHA-256 `883b71655e2f2448a03b02f6e318eced58b51bac5b74da86c018995f3c817331`. [Publisher Free License page](https://mixkit.co/free-stock-video/cup-being-filled-with-coffee-in-a-coffee-machine-41865/) rechecked earlier in this same wake.720×1280/24000/1001,Rec.709,silent,upright/no rotation metadata. Entire original13.179833s playback and14position inspection recorded in [preceding panel study](OFFICE-NATIVE-PANELS-STUDY-20261029.md). Selection48–119 is reused explicitly; continuous pour/spout/cup, no contact/strike or new action reason for a flash.

Own new SaveAs from previously saved Plain project; source/in/out/default Motion retained. Reused native plain export maps original48–119 exactly and remains unchanged. It is NOT counted as a new export in this study. A separate current native control with Invert attached/BlendWithOriginal100 also matches all72 decoded plain frames, independently checking the new effect's neutral setting. No text, new grade, sound, resize or retime added.

## Actual native controls

Premiere26.5 actual Video Effects > Image Control > Invert exists separately from the audio Invert effect. Native UI and [Adobe's current channel-controls documentation](https://helpx.adobe.com/premiere/desktop/add-video-effects/effects-and-transitions-library/channel-effects.html) identify RGB channel inversion and Blend With Original0–100. GlobalR01 uses RGB/Blend0 for all72frames; OriginalControl uses RGB/Blend100 constant with automation off. Both are separately saved native projects.

R02 animates ONLY native Blend With Original:0=100,23=100,24=0,25=0,26=100,29=100,30=0,31=0,32=100. Thus only24/25 and30/31 are fully inverted at this frame rate; adjacent one-frame transitions yield no extra sampled half-inverted frames. R03 preserves first pulse and changes30/31 to100; adds41=100,42=0,43=0,44=100, leaving other keys/source unchanged. Second two-frame pulse moves12frames/0.5005s later. Existing100 keys at29–32 remain harmless explicit holds.

Read-only saved-project verification converts actual absolute source-time keys by subtracting508540032000ticks and dividing10594584000ticks/frame. All keys land on the documented whole frames. Only native VideoComponentParam97/BlendWithOriginal changes betweenR02 andR03 outside project bookkeeping. No project XML/keyframe bytes injected. Source time remains original48–119; no copied/repeated picture or cache splice used to enforce revision equality. Both versions actually saved, closed, reopened and exported again, not merely loaded a project title.

## Encoded results and failures

Six NEW native H264 files: global, constant-original, R02/reopened andR03/reopened; each72frames/3.003s/720×1280/24000/1001. Reused one-stream plain is a seventh evaluated file. All complete decodes pass. Both R02/R03 native reopen pairs72/72decoded frames EXACT. R02→R03 protected opening30/30 exact; frame30 differs as intended. After both pulse schedules end at44, only1/28tail frames equal exactly: encoded full-tail parity FAIL retained despite equal native controls. Do not infer universal unchanged encoding from the native parameter comparison.

The initial QA assertion of a single silent-video stream FAILED: all six new exports contain an unwanted AAC track because Audio remained enabled; reused plain has video only. Full decoding of every AAC to floatPCM finds exact peak0.0, all samples digital zero. These remain native video exports with a silent audio track, not one-stream files, heard audio approval or a purposeful sound mix. No audio stripping/remux is passed off as a new native export. Future production export must inspect/toggle Audio explicitly rather than assuming a silent source implies no audio stream.

Actual RGBMSE against same-instant plain identifies exactly24/25/30/31 inR02 and24/25/42/43 inR03 above100; no additional inverted frames. At pulse frames, meanRGBsquared error against same-instant Global control is at most1.080; offpulse against plain at most1.018. These small nonzero differences are encoding changes, not zero pixel-parity claims. Constant100 control equals plain72/72 exactly.

Both pulse schedules produce maximum mean encoded grayscale frame jump152.739/255, compared with0.104/255 for plain. This scalar diagnostic describes a very large brightness change; it is not a photosensitivity/comfort/accessibility certificate. Inverted coffee becomes pale blue-white, the light cup becomes muddy and dark machine details appear white. **Reject global and both pulses as a coffee/product style:** no source-action/story reason justifies falsifying colour or interrupting the continuous pour. Moving the second pulse changes cadence but does not repair that source-purpose failure. There is no skin in this shot, so skin preservation or natural subject segmentation is not tested or claimed; the earlier green-screen background-only card remains separate.

All72ordered R02/R03 contacts inspected; full720×1280pulse24 and four-way comparisonframes24/30/42/native controls inspected. Native playback advances32→49 with picture changing, crosses second R03pulse, and is stopped afterwards. Complete local comparison plays to ffplayexit0; no independent continuous human/full-speed, phone comfort or creative acceptance inferred. No sound was added/heard. Source itself remains naturally dark/soft; negative inversion is not cinematic exposure correction.

## Exact native outputs and count

| Output | SHA-256 | Status |
|---|---|---|
| invert-global-r01.mp4 | `806fedd50ceaac10eef8b5dd8c31a12f92e42e39eef255b906bb69eaa0cbac7c` | New native export; zero AAC track |
| invert-original-control.mp4 | `aa272815b69e9565fce5685954d8545860fb1af456c72d0a539f437bf8d86d6e` | New native export; zero AAC track |
| invert-plain-reused.mp4 | `27408852485bd4858805d141849d6421fecd34102a81e1da742763d75d63ba62` | Reused prior native plain; video only |
| invert-pulse-r02-reopened.mp4 | `41d19f81ff7ed23aae4b5d5bde28fdd2738695ef6df703c3787facfe95b0b917` | New native export; zero AAC track |
| invert-pulse-r02.mp4 | `cada65a7e1d3704bc6bb55e57bcf08c194af7827ccd6f299f5e2c59ef9def0d4` | New native export; zero AAC track |
| invert-pulse-r03-reopened.mp4 | `97f603e296baec172b68fcf3bd8b4f868a15296045b6b3292b91d949617fb3c7` | New native export; zero AAC track |
| invert-pulse-r03.mp4 | `325918e57cb04ade0e38b384ed1b215d07ea3ce9ac2b01be6cef3139a1650714` | New native export; zero AAC track |

Private native projects/UI/QA/decoded comparisons remain in `native-invert`, outside Git; no source/media/project/credentials uploaded. Owner-local Plain/R02/R03/Comparison plus this receipt are under outputs. Six new native exports/two actual reopen pairs, one existing family advanced;45families unchanged, no mastered count.

Next distinct existing gate: graphic-inset-grow native moving source/clipping and eased growth, plain control/protected revision/actual save-close-reopen-export. Its original raster proof is not a native layer demonstration. Check source/story fit and frame coverage, retain mismatches rather than force a new client template.
