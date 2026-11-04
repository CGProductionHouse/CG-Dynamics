# Office native low-pass automation study —29October2026

Existing muffled-perspective family, PR910 after native stabilization72b75406. This advances a bounded native mechanism, not a client scene or creative mastery. No client source, MSI amendment, Central Canvas, storage worker, paid plugin, credit or new engine was used.

## Actual source and rights

Pinned original `repo/scripts/video-editing/studio-phase2/media/mixkit-cat-walk-371.mp3` from accepted additional-licensed-inputs archive: SHA-256 `e241cba000ce12e52cadd4c9956274e391ef1f66d1e48a5dd40bfc21645aa489`, reverified before use. The [publisher's house category](https://mixkit.co/free-stock-music/house/) identifies Cat Walk by Arulo. The live [Music Free License](https://mixkit.co/license/modal/musicFree/) allows educational/commercial/noncommercial audiovisual use with exclusions; it does not authorize distributing the track alone, remixing/claiming it as one's own, rights registration or excluded media. Private PCM exports are QA intermediates, not distributed music stems. Only short AV research outputs are copied to the owner's local outputs folder. No client cue or heard suitability recommendation is implied.

Fixed picture uses the already checked upright licensed city134 original, SHA-256 `de17d355543cda1f396361d2e217ae115c9be5eb60efe22cce0fc6a3d517d54d`, [actual source page](https://mixkit.co/free-stock-video/a-man-being-followed-walking-in-a-city-134/). Landscape original frames336–407,72consecutive frames,1280×720/24000/1001. The prior stabilization study checked full original motion and source mapping. Here no stabilization/crop was added; all72frames of every tested AV output match the dry picture exactly. Music is explicitly a laboratory signal, not recorded city/doorway/phone sound or intelligible voice.

## Native construction and protected revision

Premiere26.5.0.99, private `work/research-continue/native-eq`. Actual SaveAs projects preserve the linked original music at in-point0, unity gain and fixed city picture. Native Lowpass applied to the working audio clip, with dry project retained. [Adobe effect controls](https://helpx.adobe.com/premiere/desktop/add-video-effects/apply-video-effects/about-effect-controls-panel.html) and [native keyframes](https://helpx.adobe.com/premiere/desktop/add-video-effects/control-effects-and-transitions-using-keyframes/about-keyframes.html) informed the UI operation. Project XML was only read for verification, never injected.

R01 constant filter: native controls show1470Hz and Bypassfalse, no automation. The initial file was named constant1600 from the intended input; that filename was wrong. Actual settings and output analysis take precedence over typed plans. R02: Bypass true at0,false at12,true at60. Cutoff keys12/18/48/60; actual held value1470Hz at18/48 and native reopened UI readback18375Hz at60. Do not copy planned1600/20000 values into a preset or treat normalized saved values as Hz. This source-specific trial is not a default speech filter.

Initial R03 moved the final automation keys60→66 and produced an actual AV save/close/reopen/export pair. Subsequently its saved project changed again: object numbering shifted and its final Cutoff normalized value changed. That later disk state does not match the initial output snapshot. It is retained as a failed current-project/output correspondence gate, not silently restored or presented as the preferred project.

R04 was made with native SaveAs from known R02. It retains source, picture, gain, opening and keys through48. Delete final cutoff/bypass keys at60; retain cutoff1470 through66, then Bypasstrue at66. This intentionally holds the filtered state longer instead of ramping back open before bypass. Native UI readbacks at18 and66 were inspected. Read-only native project comparison finds only AudioComponentParam202Bypass and203Cutoff changed outside bookkeeping. The PCM revision protects96105stereo samples,2.0021875s; intended protected span through frame48 is2.002s. Native R04 was actually saved, closed, reopened and exported again: all144144stereoPCM samples exactly reproduce. This is one-PC native linked EQ/automation proof; cross-PC relink and independent staff editing remain untested.

## Output checks and audio timing failure

Six initial native H264/AAC outputs (dry, constant, R02, R02reopened, initialR03, initialR03reopened) fully decode,72frames/3.003s,stereo48kHz,144144decoded samples. Both initial native AV reopen pairs have72/72equal picture frames and all stereo samples equal. R02→initialR03 encoded prefix is95232samples,1.984s: it FAILS exact preservation through2.002s, with AAC boundary influence retained. Native timed playback advanced14→36 with changing picture/green stereo meters; this is not heard audio or approval.

Held-window ≥2.5kHz–20kHz power is25.601dB lower than dry over0.85–1.85s in the initial AAC outputs. Initial sample peaks are at most0.53526 and stereo true peak−5.4dBFS. These are source-specific filter/headroom measurements, not intelligibility, perspective or mix targets. Initial AAC tails were near but not sample-identical to dry.

The dry native Waveform Audio export contains144144stereo48kHz16bit samples. Broad FFT correlation finds original→nativePCM best lag+1sample/correlation0.999967, then nativePCM→nativeAAC lag−1024/correlation0.999961: native AAC is delayed1024samples against its PCM on THIS setup/export. A narrow±128search initially failed and was expanded; no universal Premiere timing defect is asserted. No arbitrary source in-point shift or global preference change was made.

Successful PCM dry/R02/R04/reopenedR04 exports all fully decode,144144samples. R02/R04 first differ from dry at23978samples, about46samples before frame12's24024sample boundary: do not claim an exact opening sample gate. Both PCM tails2.85s onward equal dry exactly. Their native signal output is distinct, and R04reopen is exact.

The separately labelled PCM-based mux copies the verified native dry video stream and encodes native PCM to AAC with FFmpeg, retaining duration3.003s/72frames. Dry/R02/R04 each decode144144samples and have best lag0 against their own PCM (correlations0.999942–0.999944). All72picture frames remain equal. Sample peak0.53648, arithmetic stereo-average peak0.41489 or less, R04true peak−5.4dBFS/integrated−21.3LUFS. Arithmetic average is NOT an actual FFmpeg mono export test. The PCM route repairs the measured delay for these files; it is not a pure Premiere AAC export or broad timing guarantee.

## Rejected export-state attempts

An unattended three-file PCM batch selected DPX instead of Waveform Audio and opened an already-open project without activating its sequence. It generated216DPX frames, not WAVs. Those private files/screenshots are retained as failed output, not three completed audio exports. Native modal format selection must be visually confirmed before export; filenames/extensions and toasts are insufficient.

Two later constant-labelled WAV attempts also FAIL: despite a fresh project's visible1470Hz/no-automation controls, decoded PCM matched R02's automated window instead of a constant filter. They are excluded from the owner comparison and successful controls. Multiple related open projects, active-sequence state or native render cache may be involved, but cause is not established. Do not call the issue repaired because a project title looks right. Next investigation should isolate ONE related project and verify early/held/tail signals before accepting native PCM constant controls; preserve parked projects and avoid deleting shared caches/preferences.

The accepted9.009s/216frame comparison contains only dry/R02/R04 PCM-based AV muxes, accurately labelled LAB music/not scene sound/not heard. Full decode passes; complete local ffplay exits0. Comparison full-sizeR04frame36, all72ordered city frames and native UI/filter controls were inspected; picture is unchanged and the source remains intentionally soft/shallow-focus. No hearing, continuous independent human judgement, physical phone, picture-motivated perspective, creative mastery or cross-PC handover is established.

## Exact AV evidence

| Output | SHA-256 |
|---|---|
| Initial native eq-constant1600-r01.mp4 | `ccee0e06a68bbb88024b0fcf0e4444434f6a8e813cc414250aa769f061e5f35a` |
| Initial native eq-dry.mp4 | `27b756a8542a0d214dec31cb98cc2a59c8cfe0fed0624debb873f2dc2f0dc21f` |
| Initial native eq-window-r02-reopened.mp4 | `857cd97349b1bc2bf0fb4986380c56d9458b0da095b960746b38f6072dda9975` |
| Initial native eq-window-r02.mp4 | `01a088653db0a6fbb1b5a7d267d75472b42da64f2ed6e885931a564b0749aafc` |
| Initial native eq-window-r03-reopened.mp4 | `6928a33f93fdae93ffbe1646a4a63a573dbc9072f654f9776789e8663e4b6d9d` |
| Initial native eq-window-r03.mp4 | `1027b0a6a654f7189d94d2dc35c9a687b1843870402bc98cf2317b6fc1633497` |
| PCM-based eq-dry-pcm-mux.mp4 | `77820ad3e63cc178b4ccd355eaf5e206d9518d240dd30057cfccbbac34ab3d10` |
| PCM-based eq-window-r02-pcm-mux.mp4 | `d27b9567590d9d4e7ebccfc60c714146b401a642af14402e538006fd542fa790` |
| PCM-based eq-window-r04-pcm-mux.mp4 | `c40210eb1ae70751631d719f256388a4d8d9f9b90368a8b95a6904b0b48c2086` |

Private `qa.json`, `pcm-qa.json`, `pcm-alignment.json`, original project snapshots, native UI screenshots, full decodes and scripts retain evidence including failures. No media/native projects/credentials are committed. Ten accepted native exports total: sixAV plus fourPCM, with three actual reopen pairs (twoAV,onePCM). Two incorrect constantPCM attempts and216DPXframes are excluded; three accepted PCM-based AV muxes plus one comparison are derived QA deliverables, not additional native exports.

Existing45families remain45, none declared mastered by this study. Native mechanism advanced; listening/picture motivation/constantPCMstate/phone/second-PC gates remain open. Next distinct useful existing family is peak-control: actual licensed-source/plain/gain/native-limiter controls, protected revision, full encoded stereo AND real mono fold-down checks, native save/reopen/export and honest listening limits. Do not touch MSI Fight Night or produce a client mix from this lab.
