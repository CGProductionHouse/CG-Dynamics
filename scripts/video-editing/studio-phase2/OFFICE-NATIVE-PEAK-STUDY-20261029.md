# Office native peak-control study —29October2026

Existing peak-control family, PR910 after nativeEQ b7a59b26. This is a source-specific technical laboratory test, not a client mix, universal limiter preset or heard approval. MSI Fight Night and other amendments, Central Canvas and storage workers remain untouched. No installation, paid/API credit or new engine.

## Sources and fresh native project

Same original licensed Cat Walk/Arulo music as the preceding [native EQ study](OFFICE-NATIVE-EQ-STUDY-20261029.md), actual hash `e241cba000ce12e52cadd4c9956274e391ef1f66d1e48a5dd40bfc21645aa489`. Source/rights rechecked there this same session: [publisher page](https://mixkit.co/free-stock-music/house/), [Music Free License](https://mixkit.co/license/modal/musicFree/). Short AV research permitted; private PCM is QA only, never a distributed music stem. No dialogue, client recording or invented real impact. This tests natural musical peaks in the first3.003s, not the legacy synthetic6ms transient or actual Fight Night sound.

Fixed licensed city134 picture, original hash `de17d355543cda1f396361d2e217ae115c9be5eb60efe22cce0fc6a3d517d54d`, [source](https://mixkit.co/free-stock-video/a-man-being-followed-walking-in-a-city-134/). Exact previously checked upright original336–407 landscape span. New native project created through File/NewProject, imported both linked originals; New Sequence From Clip creates a fresh source-matched sequence, not an inherited related SaveAs timeline. Parked projects were preserved. Native Source Monitor marks14:00–16:23 city I/O; music starts at0. An insert-audio operation initially shifted picture by3s; corrected in this fresh sequence before export. Plain output matches verified cityselect72/72decoded frames and prior dry audio peak0.5352555/144144samples. Actual sequence is named mixkit-134-720, unlike preceding inherited561sequence. New-project title alone was not used as active-sequence evidence.

## Native controls and revision

Premiere26.5.0.99/RTX5070Ti; private `work/research-continue/native-peak`. Plain preserves unity clip gain; Hot sets native Audio Gain+12dB, deliberately exposing over-range peaks as a REJECTED technical control. Gain control sets+2dB, i.e. lowers the hot track10dB throughout. Native Audio Gain dialog readback confirms+2 before export; no limiter present in these controls.

R02: clip gain+12dB, native Hard Limiter applied to the working audio clip, Bypassfalse. Custom native editor: True Peak selected, Maximum Amplitude−4dB, Input Boost0dB, Look-Ahead7ms, Release100ms, LinkChannelschecked. These are measured test settings, not a default client mix. [Adobe's Premiere audio-effects library](https://helpx.adobe.com/in/premiere/desktop/add-audio-effects/apply-audio-effects/audio-effects-library.html) describes the amplitude/input/look-ahead/release controls. Original/working gain/effect remain separately editable, not baked replacement media.

R03 native SaveAs revision retains source/in/out/picture/gain and other limiter settings. Animate ONLY Maximum Amplitude:−4dB at frame48,−6dB at66. Native effect-controls readback shows two keyframes and−6 at66. Read-only saved-project comparison finds AudioComponentParam113MaximumAmplitude changed, AudioFilterComponent102native plugin state updated, and Bypass112only its UI-group expansion changed(false→true); no actual Bypass automation/value change. No native project XML was written/injected.

R02 and R03 each actually saved/closed/reopened and exported again. Both have72/72decoded picture equality AND all144144stereo samples identical after reopen. First R02reopen screenshot briefly showed Media Pending; later output/full decode/picture parity confirms that placeholder was not the export. Native timed playback witnesses programframe16→34 with changing picture and green/yellow stereo meters, not hearing or creative approval.

## Delivered-file measurements

All seven native H264/AAC exports fully decode,1280×720/24000/1001,72frames/3.003s,stereo48kHz/144144samples, fixed picture72/72equal to plain. The measured native AAC timing limitation from the preceding study remains relevant; this study does not claim an absolute sync repair. All controls use the same native codec path.

For EVERY delivered file, an actual separate mono AV was made with FFmpeg `-ac 1 -c:a aac -b:a 192k`, video stream copied,3.003s. Each mono export fully decodes144144samples; peaks are measured after that encode, not inferred from a stereo arithmetic average. This standard FFmpeg stereo→mono route is the tested matrix, not every possible platform/player downmix.

| Native control | Stereo sample peak / dBTP | Encoded mono peak / dBTP | Integrated stereo LUFS |
|---|---|---|---|
| Plain0dB |0.53526 /−5.4|0.58499 /−4.7|−21.3|
| REJECTED Hot+12dB |1.02584 /+0.2|1.42193 /+3.1|−9.6|
| Gain+2dB |0.67508 /−3.4|0.73337 /−2.7|−19.3|
| LimiterR02 |0.63356 /−4.0|0.87486 /−1.1|−13.6|
| LimiterR03 |0.63283 /−4.0|0.87888 /−1.1|−13.8|

Hot has1084stereo samples above1 and44encoded mono samples above1: explicit REJECT. No other tested stereo or mono export exceeds1 or contains nonfinite samples. Mono is about2.9dB hotter in true peak than stereo for R02; passing a stereo ceiling does not establish a requested mono ceiling.−1.1dBTPmono is a measured result with limited margin, not a universal delivery target or guarantee. Limiter retains more whole-track measured level than the10dB gain reduction, but these very short LUFS readings do not establish intelligibility, timbre, pumping or creative preference. ShortclipLRA20LU is not a meaningful mix target.

## Protected audio revision: FAILED exact gate

Native parameter timing is bounded to frames48–66, and all picture is unchanged. However R02→R03 AAC differs from stereo sample832(0.017333s), long before frame48's2.002s: exact encoded opening protection FAILS. Native48kHz16bitPCM exports of both variants also differ from sample0; before48differenceRMS0.0000956519, late differenceRMS0.00508160. PCM peaks0.635498/0.634644. The early deviation is much smaller but still not zero. Native processor/oversampling/dither/export state may contribute; cause was not isolated, and no claim of exact protected audio or codec-only cause is made. Do not conceal the failure by shifting, caching or replacing an opening from another output. A dedicated pre-edit baseline and isolated application/export-state experiment remain required before promising sample-identical preserved audio.

This fresh sequence establishes distinct plain/gain/limiter outputs. It does NOT resolve the previous EQ constantPCM wrong-signal failure or prove that shared caches caused it. Preserve that separate failure and parked projects.

## Inspection and comparison

All72ordered R03picture contacts, full-sizeframe60 and native controls inspected; source head/shoulders stay upright, no new border/changed picture is introduced. Source is naturally soft/shallow focus; no cinematic finishing claim. Complete12.012s/288frame comparison fully decodes and local ffplay exits0; its full-sizeR03frame36 was inspected. Plain/Gain/R02/R03preview audio is RMS-aligned to plain, with gain offsets0/−2.00053/−7.83163/−7.70675dB, labelled on picture. This is objective RMS alignment, not perceptual loudness matching or a heard choice. Rejected hot audio is excluded from the comparison and owner-facing copies; original hot control stays private with failure measurements.

Owner local outputs include plain/gain/R02/R03nativeAV, separately labelled R02monoAV and RMS-aligned comparison; no standalone licensed audio stem is copied. Native projects, linked media, private WAV/UI/QA stay outside Git. Actual headphone/speaker/phone hearing, material preservation/pumping, last5s of a real film, full layered mix, physical-phone review and second-PC relink/editing remain OPEN. One-PC save/reopen/export supports only these native controls.

## Exact native AV outputs

| Output | SHA-256 |
|---|---|
| peak-gain-plus2.mp4 | `7e3130fa48e541489c470b5406069684ad6630f5493ff52ab6ddcb66a4628708` |
| peak-hot-plus12.mp4 | `5c40ba0959e94ec8f39592c045d1479d2a96eb6ddb4abe1451eb398e35486194` |
| peak-limiter-r02-reopened.mp4 | `ef0ae29464c7568433517e4d41eb58443f8aad1daca0e86e4ed077be44902b46` |
| peak-limiter-r02.mp4 | `fb6d81fdf5bd386a733287af5024635b2865460ca27bfdb9968af94935360d37` |
| peak-limiter-r03-reopened.mp4 | `f3cc0b39a409a16d7e279b65c10f70401be5b6eb330525ff61f694a6db10939c` |
| peak-limiter-r03.mp4 | `bde64e282bd82139d3f74b3d6ab0c35cf83454098992e4abf0a582660095f133` |
| peak-plain.mp4 | `5c53966f34d8d840b727dfd400ae384c385d74d8d89c0582a3a6edfa52c6da61` |

Private `verify_outputs.py`, `qa.json`, `pcm-qa.json`, loudness logs and comparison-gains.json retain actual samples/codec/parameter evidence. Nine native exports total: sevenAV plus twoPCM; seven derived monoAV QA files plus one comparison are not additional native exports. Two native AV reopen pairs pass. Exact audio revision opening fails, despite editable native keys.

Existing45families unchanged, no mastered count. Next distinct existing native gate: registered-slanted-panels, common source/time canvas and separate editable apertures, plain/control/protected revision/save/reopen/export/inspection. Read its existing card and pinned coffee41865 rights/selects before building; do not hide the product action to satisfy an effect quota.
