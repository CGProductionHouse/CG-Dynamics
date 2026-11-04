# Earlier bounded peak revision — 29 October 2026

This continues the existing [peak-control family](skills/peak-control/SKILL.md) and [previous licensed AV screen](PEAK-BOUNDED-MUSIC-AV-SCREEN-20261029.md) in draft [PR #910](https://github.com/CGProductionHouse/CG-Dynamics/pull/910). The previous late-only revision lowered late peaks but left the global maximum and true peak unchanged. This screen asks whether a source-specific earlier bounded gain can lower the **delivered** stereo and separately encoded mono peaks. It is not Adobe limiter equivalence, a preset or a heard sound-design judgment.

## Pinned source and control

The same [Mixkit #134 city walk](https://mixkit.co/free-stock-video/a-man-being-followed-walking-in-a-city-134/) Stock Video Free License picture and [Cat Walk by Arulo](https://mixkit.co/free-stock-music/house/) Mixkit music are reused from the prior screen. Their actual local hashes remain `de17d355543cda1f396361d2e217ae115c9be5eb60efe22cce0fc6a3d517d54d` and `e241cba000ce12e52cadd4c9956274e391ef1f66d1e48a5dd40bfc21645aa489`. The pinned prior `later-r02.f32` control hashes `92559ae13d90577cfcf310f5283131f1fdef2a15f6e18eec292f6033d84ecebc`. Rights/selection and original plain/hot/whole-gain controls remain described in the linked previous study; none is silently replaced. The licensed music stays in the private AV comparison, not distributed as a stem or adopted for a client.

Private `work/research-continue/peak-global-repair/render.py` applies the existing 673-sample neighbourhood maximum and smoothed gain method to R02's first100,800 stereo float samples, this time with0.42 peak ceiling. It leaves samples100,800–144,143 **exactly unchanged in working PCM**. The source picture stream is copied, not rendered anew. One new private output `early-r03.mp4` hashes `975a6143e060dc8866136a7c42a0b97a0d5d39c62a1aaeed9aef5e1d3b0b5d13`, and its PCM hashes `f285674b86cfabcd3ac3e55bb7285d8412dd213bec2eee8c035cefa852a84817`. This is a protected tail revision of R02, not a new family.

## Actual output inspection

The delivered R03 fully decodes:72 upright1280×720 moving frames at24000/1001fps, 144,144 stereo48kHz samples; all72 picture frames are pixel-identical to the existing plain control and71/71 adjacent picture pairs change. Actual frames0/18/36/53/71 were inspected in a contact; man/hood and city remain continuous. Separately transcoded AAC mono also decodes144,144 samples. Private `qa.py`, JSON, mono output and contact retain the evidence.

| Delivered measure | Prior late R02 | Earlier-bound R03 |
|---|---:|---:|
| Stereo decoded sample peak |0.57500|0.46185|
| Stereo true peak (`loudnorm` input TP) |−4.74 dBTP|−6.68 dBTP|
| Stereo integrated loudness |−14.26 LUFS|−15.51 LUFS|
| Encoded mono decoded sample peak |0.76268|0.57538|
| Encoded mono true peak |−2.34 dBTP|−4.80 dBTP|
| Encoded mono integrated loudness |−16.13 LUFS|−17.54 LUFS|

The global peak reduction works here because the prior global maxima were earlier than the R02 late-only change. It also lowers the measured integrated level, so matched-level listening remains essential before deciding whether this is useful. The float PCM tail's43,344 samples are exact, but only **128/43,344 decoded AAC stereo tail samples and 128/43,344 mono tail samples** match R02 exactly after independent encoding. Thus strict encoded-tail protection fails badly; do not infer final-file identity from working-array identity. No audio splice was used to force a pass.

The earlier hot overrange control, late-only failed global-peak result and native Premiere protected-opening failure all remain in the record. This test proves only a bounded gain mechanism and measured delivered-file result on this one licensed music excerpt. The original stems, real layered client mix, dynamics/pumping audition, phone speaker check, full ending, native editor save/reopen and second-PC handover are still open. No client media, GUI, external upload, paid service or AI credits were used.
