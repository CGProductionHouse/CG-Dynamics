# Synthetic speech over licensed music — lead-in timing AV screen, 29 October 2026

This advances the existing dialogue-music-mix family with a **technical timing comparison**. It does not propose narration, music or copy for a client; no speech intelligibility or creative preference was established by hearing. Command-line background work only; no visible GUI/editor, paid/API service, MSI client amendment, Central Canvas change, storage worker or WhatsApp send.

## Rights, picture and matched source

The moving [Mixkit city #134](https://mixkit.co/free-stock-video/a-man-being-followed-walking-in-a-city-134/) original is Stock Video Free License, SHA-256 `DE17D355543CDA1F396361D2E217AE115C9BE5EB60EFE22CCE0FC6A3D517D54D`; all outputs use its upright frames336–479 in original order at24000/1001 fps. The exact [Cat Walk by Arulo](https://mixkit.co/free-stock-music/house/) local MP3 hashes to `e241cba000ce12e52cadd4c9956274e391ef1f66d1e48a5dd40bfc21645aa489`. Its [Music Free License](https://mixkit.co/license/modal/musicFree/) permits audiovisual social/educational use subject to the stated exclusions. A six-second excerpt starts10.425 s into that song in all three mixes. The spoken source is the existing original local Windows SAPI WAV, SHA-256 `0f450927a2aec5e2a451391235da19520996957ffc0ce4468b1602287b13a2bc`, saying “Listen to the room. Then step outside.” It is synthetic test speech, **not** a client recording, event copy or external AI-credit voice.

The voice is placed at timeline0.8 s at equal gain in every mix. Its source waveform rises from near silence about0.1 s after that start. Music is0.5 gain in the constant control. R01 begins its duck at0.8 s, reaches0.1 by1.1 s, holds until4.65 s and returns to0.5 by5.05 s. Protected R02 retains the same music, voice, hold and return, but starts the duck at0.45 s and reaches0.1 by0.7 s, before the first substantial voice activity. R01/R02 **uncompressed working mixes** match exactly for the first21,600 samples/0.45 s. The nominal hold gain is −13.98 dB relative to the0.5 control; it is a test value, not a recommended mix setting.

## Actual output and failed gates

Three 960×540 H.264/AAC AV outputs fully decode to144 changing picture frames at24000/1001 fps and288,288 stereo samples at48 kHz. Their decoded pictures are144/144 pixel identical. Separately encoded mono AV checks also decode288,288 samples each. Full-size R02 picture frames0/70/143 were inspected: the walker and city remain upright and moving continuously. Music-only residuals from the private float mix confirm the timing: at0.9–1.0 s, RMS is0.055542 constant,0.032785 late R01 and0.011108 early R02. The early version's music is about9.4 dB below R01 in that window; at1.1–1.2 s both duck variants match0.006965, and at5.2–5.4 s all three return to0.036098. These are **signal-level results**, not consonant audibility or music health judgements.

| Delivered mix | Stereo sample peak / dBTP / LUFS | Encoded mono sample peak / dBTP | Decision |
|---|---|---|---|
| Constant |0.65430 /−3.68/−19.00|0.90669/−0.84|Plain timing control.|
| Late R01 |0.64265/−3.83/−19.56|0.90766/−0.83|First word begins during the music ramp; technically late.|
| Early R02 |0.64269/−3.83/−19.59|0.90777/−0.83|Protected earlier duck, mechanically complete before voice; hearing pending.|

The dBTP/LUFS readings are from FFmpeg `loudnorm` on the **delivered stereo and separate mono AAC** files, not from their float inputs. None of these measured sample peaks exceed1, but the encoded mono true peaks near−0.83 dBTP leave limited headroom; this is not a client-delivery pass. R01/R02 first differ at sample21,601 in float PCM, but stereo AAC first differs at20,480 and the mono re-encode at19,456. Thus only20,480/21,600 stereo and19,456/21,600 mono opening samples are exact: **strict encoded 0.45 s protection fails**. Encoder overlap is a plausible inference, not an isolated cause. No cache splice was used to force a match.

| New private AV output | SHA-256 |
|---|---|
| `constant.mp4` | `fdc85bb38431907d7776de8e79f050c48d53786f897ebef570bb6469de23a044` |
| `late-r01.mp4` | `5bc2d4ddfc56a85c63146803b31c642f23dd2058b8cdea94d5a31546d2082274` |
| `early-r02.mp4` | `43435be3ca0383b6d0c3f55a0a640db9d7931007f35e1a89b1f0c1273adca72f` |

Private source references, AVs, mono checks, float QA buffers, contact and measurements remain at `work/research-continue/dialogue-duck-av`; no media is committed or distributed. The earlier tiny-ASR first-word failure is not overridden by this signal measurement. Real-client use needs actual voice/music rights and purpose, independently heard matched-level A/B at ordinary volume, consonant/return/mono/phone checks, sufficient true-peak margin, final ending and staff-editable track automation. **Mastered: no.**
