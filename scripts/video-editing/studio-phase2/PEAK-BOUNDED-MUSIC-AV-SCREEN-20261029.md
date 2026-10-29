# Bounded peak control on licensed moving AV — office background screen, 29 October 2026

This advances the existing peak-control family with a **non-native, source-specific technical comparison**. It does not repair or supersede the earlier native Premiere test, establish a limiter preset, certify loudness policy or claim a heard mix. Command-line background work only; no visible GUI/editor, paid/API service, MSI client amendment, Central Canvas change, storage worker or WhatsApp send.

## Rights, selected picture and control

The pinned original [Mixkit city walk #134](https://mixkit.co/free-stock-video/a-man-being-followed-walking-in-a-city-134/) is Stock Video Free License, SHA-256 `DE17D355543CDA1F396361D2E217AE115C9BE5EB60EFE22CCE0FC6A3D517D54D`. Its previously verified upright source frames336–407 are the picture in private `native-peak/peak-plain.mp4`, reverified this screen at AV SHA-256 `5C53966F34D8D840B727DFD400AE384C385D74D8D89C0582A3A6EDFA52C6DA61`. That H.264 picture stream is **copied unchanged** into every new output. The exact original [Cat Walk by Arulo on Mixkit](https://mixkit.co/free-stock-music/house/) MP3 SHA-256 is `e241cba000ce12e52cadd4c9956274e391ef1f66d1e48a5dd40bfc21645aa489`. The [Music Free License](https://mixkit.co/license/modal/musicFree/) permits music in social and educational audiovisual work subject to its exclusions; these private AV tests are not standalone music distribution or client suitability approval.

The 48 kHz stereo MP3 decode is trimmed to144,144 samples (3.003 s) and used identically in all five 72-frame AV files. `plain` preserves its decoded gain. `hot-r00` deliberately adds12 dB and is a **rejected over-range control**. `whole-gain` uses+2 dB, equivalent to reducing that hot working track by10 dB everywhere. `local-r01` applies the hot gain, then an original 673-sample neighbourhood-peak envelope, smoothed conservatively and bounded at0.55 float sample amplitude. This is a deterministic local gain construction, **not** Adobe Hard Limiter equivalence. `later-r02` protects the first96,000 float samples of R01 exactly, then ramps a further late ceiling toward0.45 over0.1 s starting at2.0 s. Picture and music source time remain unchanged.

## Delivered AV measurements and failed exact gate

All five H.264/AAC AV outputs fully decode to72 frames at1280×720/24000/1001 and144,144 stereo audio samples at48 kHz. Their decoded picture is72/72 **pixel identical**, with71/71 changing adjacent picture pairs. Separately encoded mono AV checks also decode144,144 samples each. Picture frames0/36/71 from the actual R02 output and a diagnostic ten-millisecond decoded-AAC peak-envelope plot were inspected; the man, jacket and city setting remain upright and source-continuous.

| Delivered variant | Stereo sample peak / dBTP | Encoded mono sample peak / dBTP | Stereo integrated LUFS | Decision |
|---|---|---|---|---|
| Plain |0.53250 /−5.47|0.58241 /−4.70|−21.29|Unprocessed local control.|
| Hot +12 dB |1.53133 /+3.70|1.60641 /+4.12|−11.44|**Rejected:**63 decoded stereo and52 mono samples exceed1.|
| Whole gain +2 dB |0.67222 /−3.45|0.71782 /−2.88|−19.30|Whole-track reduction control.|
| Local R01 |0.57500 /−4.74|0.76268 /−2.34|−13.93|Bounded technical candidate; hearing pending.|
| Later R02 |0.57500 /−4.74|0.76268 /−2.34|−14.26|Protected late revision; **no overall true-peak improvement**.|

These dBTP/LUFS values come from FFmpeg `loudnorm` analysis of the actual delivered stereo and separately AAC-encoded mono files. They are diagnostics, not matched-level listening or a delivery target. Mono true peak remains hotter than stereo for R01/R02. After2.1 s, R02 decoded stereo sample peak falls from0.55616 to0.45710 and mono from0.68255 to0.55617; the earlier global maximum remains unchanged.

The R01→R02 **float PCM** prefix is exactly equal for samples0–95,999. In both delivered stereo and mono AAC, the first different decoded sample is95,232, i.e. 768 samples/16 ms before the 2.0 s control boundary; only95,232/96,000 prefix samples remain exact. **Strict encoded two-second protection fails.** AAC transform overlap near the boundary is a plausible explanation, but it was not independently isolated. This is materially narrower than the earlier native Premiere opening difference at sample832; it does **not** repair that native failure. No cache splice or audio replacement was used to force parity.

| New private AV output | SHA-256 |
|---|---|
| `plain.mp4` | `8614088d190c434c55a97696f5f42201cda3b062b96c65fcbc681ca776980216` |
| `hot-r00.mp4` | `12a118e2d01d968acd088be9be3cfd17143cf4fa6b4115fc47f310528e29af2b` |
| `whole-gain.mp4` | `2fa7842d3d6e733f522f38c1cfea214861b5513860dc31796220021680dda337` |
| `local-r01.mp4` | `38ed29afa096307c62c35e565d9ee1f2e8cc06161fc1ec7cacd91eec9048be34` |
| `later-r02.mp4` | `c4146906422c683115162d6314ac6dd1e4305816385cb93d2b6cf36afadf4a34` |

Private source reference, scripts, AAC mono checks, raw QA buffers, AV outputs, contact and measurements remain at `work/research-continue/peak-bounded`; no audio or media is committed or distributed. The hot control is private failure evidence. A real layered mix requires independent matched-level listening for timbre/pumping, an authorised source/event, exact final codec and mono path, final music tail, physical-phone review and staff-editable project/reopen. **Mastered: no.**
