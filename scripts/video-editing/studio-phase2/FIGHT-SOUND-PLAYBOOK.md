# Fight Night trailer sound: source-first staff handover

**Scope:** sound workflow for the owner's 30-second trailer of the *full* Fight Night film. This is the operating sequence for the existing Python/FFmpeg build or a staff editor, not a new rendering engine or an approved soundtrack. The owner rejected the stock montage's music. Do not reuse it or infer a replacement's quality from BPM, loudness or a waveform. **Live intake update:** the Staffy folder now lists 121 MP4s; see [FIGHT-NIGHT-EVENT-INTAKE.md](FIGHT-NIGHT-EVENT-INTAKE.md) for exact source and access status. No event hit has been verified and **no event mix has been made or heard**.

## 1. Lock picture and real moments first

For each chosen hit, record source filename/OneDrive ID, source in/out, bout, frame of visible contact, immediate consequence, camera audio stream and any obscured/miss ambiguity. Preserve a straight-cut picture control. Check the original at full speed with audio before moving, slowing or repeating it. Sound must not turn a miss or hidden contact into an apparent landing. A crowd response or waveform spike is not proof of a punch. If a clip is sped up/slowed, explicitly map source audio time to picture time; a copied unretimed impact track can drift from a retimed contact. The [same-picture slowed-contact A/B](FIGHT-RETIME-AUDIO-SYNC-STUDY.md) demonstrates a public landing's strong audio window at 1.81 s against an airborne frame when the original sound is left unmapped; the remapped candidate moves it near the grounded picture at 2.36 s. That is timestamp evidence, not an approved sound effect.

## 2. Inventory and protect camera sound

Probe every selected take for audio stream count, sample rate, channels, **stream start offset** and duration. Export a time-aligned, lossless working stem and preserve the untouched original; never overwrite source media. A raw WAV extraction has no container timestamp and may lose an audio stream's delayed start. The [original-sound level A/B](FIGHT-SOURCE-AUDIO-LEVEL-STUDY.md) demonstrates an actual 74 ms offset and a tested explicit-padding stem; calculate the delay for each source rather than borrowing its number. Listen at the hit and before/after it for glove, shoe, breath, ring, crowd, mic handling, wind, clipping and pre-existing music. Use the [public camera-sound screen](FIGHT-CAMERA-SOUND-SOURCE-GATE.md) as the negative examples: an audio stream can be near-silent, pre-edited or attached to an irrelevant picture. The level A/B also shows why even a simple gain change must be checked *after* AAC delivery encode. If a source has no usable sound, mark it `SOURCE_AUDIO_UNUSABLE`; do not silently substitute a library hit.

## 3. Build a dry trailer before effects

Use real camera sound and short room/crowd continuity from the same event. Keep cuts and ambience edits separately editable; crossfade room tone only where it avoids an accidental hole or click. A [public camera-audio cut A/B](FIGHT-SOURCE-CUT-CONTINUITY-STUDY.md) reduced one sampled splice jump from 0.14217 to 0.00039 with a 10 ms overlap while preserving all other samples; this is a technical repair candidate, not a universal fade length or heard approval. Do not smear a genuine impact with a long fade. The dry export is the comparison control for every later mix. Preserve the full lead-in and tail around each best moment so that rhythm is not constructed from isolated transients alone.

## 4. Select music by the actual film

Choose after the clean picture and real sound are known. Audition several *licensed-for-this-client-and-destination* candidates at full trailer length; compare their groove, phrase structure, dynamic space, timbre and ending against the real moments. A plausible BPM or free download does not establish a good track or social-use rights. Record title, composer, exact asset URL, licence version, required attribution/project registration, purchased/download date if relevant, client/platform rights and original file SHA-256. Reject any track that overwhelms real contact, dictates false chronology, cannot end cleanly at 30 seconds or duplicates the owner's rejected stock-bed character. Leave music absent if no candidate passes. No TikTok reference soundtrack is automatically usable.

## 5. Add only motivated layers

Track order: `CAMERA_ORIGINAL` (protected), `CAMERA_WORKING`, `ROOM_CROWD`, `MUSIC`, `SFX_IMPACT`, `SFX_MOTION`, `VOICE_IF_PRESENT`. Every added SFX has its own source/licence, source in/out, timeline onset, gain/pan and editorial reason. First compare dry camera sound with one-cue version at matched playback level; retain an effect only if the picture truly supports it and it improves the heard event. A whip sound requires visible movement. A sub hit cannot fabricate a knockout. Use brief music reduction before a *verified* peak only if it reveals real breath/room or improves tension without breaking the musical phrase. The [stock pressure-pocket test](FIGHT-SCENE4-PRESSURE-POCKET-STUDY.md) proves gain automation only; its 15 dB dip is not a production preset. Keep all embellishment removable for staff.

## 6. Measure and listen to the delivered mix

After export, verify both streams fully decode, start/end A/V alignment, stream duration, channels, silence, sample peak, **true peak after encoding**, stereo/mono fold-down and first/last 0.25 seconds. The read-only [sound stream inspector](FIGHT-SOUND-QC.md) turns stream/offset/peak/silence checks into a repeatable JSON receipt, but does not identify a punch or rate a mix. A [public hard-end/fade A/B](FIGHT-AUDIO-TAIL-CONTINUITY-STUDY.md) proves that a bounded 60 ms working-track fade can lower the delivered final 20 ms level without altering the earlier sound; it is not an automatic end-button treatment. A clip's isolated LUFS number is not a programme loudness target; compare continuous music and designed versions at matched perceived level. Play the *entire* 30 seconds at normal speed on headphones, speakers and a physical phone, watching picture with sound. Check the glove/contact sync, whether each sound belongs to the shown event, intelligibility of any voice, music phrase transitions, pressure pocket, bass translation, harshness, abrupt tails and a clean final button. Technical tools and the two tested local Gemma audio models cannot provide this perceptual verdict; both models failed silence/tone controls. A [synthetic voice/music duck test](DIALOGUE-MUSIC-AB.md) also failed to turn small-model ASR into a reliable intelligibility gate. Request independent editing-staff acceptance of the **finished event cut**, not a series of owner practice reviews.

## 7. Handover and revision evidence

Save the clean picture/control, final preview, editor project or existing scene source, original-media links, lossless aligned stems, music/SFX licence receipts, and a row per audible decision. Use the same zero time for each full-length stem so staff can drop all stems onto matching tracks; record any intentional offsets. The [disposable stem handover check](FIGHT-AUDIO-STEM-HANDOVER-STUDY.md) proves that two 6 s lossless practice layers can be independently revised and recombined with an unchanged voice source; no staff editor or event project has yet opened them. Keep the original licensed track and editable automation alongside a printed music stem. A rendered MP4 alone is not editable. For each revision, change one layer or cut, preserve the previous version, export a new preview and compare unchanged sections. Record a listener's concrete fault and its resolution; silence from reviewers is not approval.

| Timeline in–out | Video source ID + source in–out | Contact evidence | Camera track / source condition | Music/SFX asset + licence | Gain/automation and reason | Staff decision |
|---|---|---|---|---|---|---|
| _fill only after event intake_ | | | | | | |

**Done gate for the real trailer:** all represented hits confirmed from originals, exact audio/rights ledger complete, dry and designed cuts compared at matched level, no misleading synthetic impacts, native/stem handover opens for staff revision, full export passes technical QC and independent editor has heard the full cut on headphones/speakers/phone. Until actual footage and that listening pass exist, the reusable procedure is prepared but the event soundtrack is **not complete**.

## Current sound gate ledger (25 October 2026)

| Gate | Tested evidence | Event status |
|---|---|---|
| Stream intake, offset and clipping | [Read-only inspector](FIGHT-SOUND-QC.md) and [public source A/B](FIGHT-SOURCE-AUDIO-LEVEL-STUDY.md) measured a real 74 ms offset and an over-range camera recording. Six actual Staffy short takes were measured privately on 25 October night; details below. | Six local Staffy camera streams are present; their creative sound has **not** been heard. Large bout/hit source is still unavailable. |
| Time mapping through slow picture | [Same-picture audio A/B](FIGHT-RETIME-AUDIO-SYNC-STUDY.md) caught an unretimed landing transient against an airborne frame and mapped it near the landing. | Procedure ready; event time map and heard timbre pending. |
| Non-impact source-audio joins | [Camera-audio splice A/B](FIGHT-SOURCE-CUT-CONTINUITY-STUDY.md) preserved every sample outside a 10 ms repair and reduced the measured join discontinuity. | Use only on truthful event ambience joins; actual click/heard match pending. |
| Separable sound layers and revision | [Six-second voice/music stem proof](FIGHT-AUDIO-STEM-HANDOVER-STUDY.md) kept zero-aligned WAVs and an unchanged voice layer under music revision. | Staff project open/relink/revision pending. |
| Stereo/mono and export safety | Full two-layer practice mix retained voice and music on measured 50/50 mono fold-down; decoded AAC true peaks stayed below the inspector's conservative threshold. | Repeat on the actual 30 s delivered picture/sound file. |
| Accidental end truncation | [Hard-end/fade A/B](FIGHT-AUDIO-TAIL-CONTINUITY-STUDY.md) preserved earlier PCM and lowered one delivered last-20-ms window from −30.5 to −45.8 dBFS. | Decide the final event/music button by hearing the actual cut. |
| Contact/SFX/music creative choices | The owner rejected the integrated stock music; bag cue was timed but unheard; automated local audio models failed known controls. | Select against real footage, original sound and approved rights. No production choices made. |
| Finished event soundtrack | 27 event camera originals are local and hash-matched, but the screened short takes show **zero verified landed blows**. Six original audio streams passed local decode/intake. | **Blocked for a hit-led trailer by the missing large bout originals**, then independent full-speed editor headphone/speaker/phone listening. |

No further stock montage, generic music search or automated audio-model verdict resolves the last two rows. Continue technical work only when it answers a new failure; move directly to source-led event selects and the removable sound mix when the actual upload arrives.

### Actual Staffy camera-sound intake, 25 October night

The unmodified local, SHA-matched originals are in the private `Fight-Night-2026/source` area; six individual JSON receipts from `inspect_audio_stream.py` are in its private `work` area. These are read-only PCM-window, stream-offset and encoded true-peak measurements. No client sound, receipt or source media was committed or uploaded to an external model. Every take has 48 kHz stereo AAC starting at video time zero. The loudest 10 ms window is a diagnostic timestamp **only**; picture screening already found no confirmed hit in these clips.

| Source | Visible role, not impact evidence | Duration | RMS dBFS | Encoded true peak dBTP | Diagnostic note |
| --- | --- | ---: | ---: | ---: | --- |
| `3Q7A9109.MP4` | Arena light/roof | 3.44 s | −16.38 | −2.0 | Candidate opening atmosphere only; no hit. |
| `3Q7A9327.MP4` | Lone boxer waiting | 3.48 s | −17.38 | **+0.2** | Decoded near-full-scale samples and over-zero true peak; protect original and avoid carrying this unattenuated into delivery. Not a punch cue. |
| `3Q7A9456.MP4` | Spectator | 2.76 s | −16.64 | −2.9 | Possible room/crowd bed only after source listening. |
| `3Q7A9515.MP4` | Spectator | 1.48 s | −17.03 | −4.0 | Very short ambience candidate; do not stretch into an invented consequence. |
| `3Q7A9630.MP4` | Obscured ring exchange | 2.64 s | −15.98 | −0.6 | Loudest window at 1.97 s cannot be called a glove hit; visible contact is unresolved. |
| `3Q7A9745.MP4` | Post-bout embrace | 1.48 s | −16.49 | about 0.0 | Near-zero true peak; event-emotion/room candidate only, without causal link to a selected strike. |

Next sound decision depends on actual full-speed listening to these sources and the eventual **verified** blow takes. Existing V3 opening's −6 dB working camera gain is a protective working choice, not a mix setting for every source. Do not select the loudest waveform window as an impact or claim the soundtrack is complete from these measurements.
