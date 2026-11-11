# Nolan — audio perception failure: root-cause triage and free-first recovery
**Owner feedback, 22 October 2026.** The latest Emoya `ONE MORE?` render is **REJECTED**: CA actually listened and says the audio is “a mess.” The engineering audit on PR #862 explicitly states Nolan **cannot hear audio**, despite its valid H.264/AAC decode and level analysis (-13.1 LUFS/-3.7 dBTP). **DO NOT relabel a numeric pass as good sound.** This is research / diagnostic advice, not a local implementation or new vendor approval. Current issue authority: [PR #862 owner rejection](https://github.com/CGProductionHouse/CG-Dynamics/pull/862#issuecomment-6346320310).

## First: separate four distinct capabilities

| Question | How to verify | What it doesn't prove |
|---|---|---|
| Did Adobe export actual audible audio and preserve intended stems? | FFprobe streams, full decode; compare audio duration, beginning/end signal, silence gaps, per-track content and project mix timestamps. | That music choice and transitions are good. |
| Are cuts, impacts and beat attacks aligned? | Decode final rendered PCM; waveform, per-track peak/crest, onset spikes, source-to-sequence time offsets and scene-cut timecode. [librosa beat/onset](https://librosa.org/doc/latest/beat.html) and [FFmpeg loudness/audio tools](https://www.ffmpeg.org/ffmpeg-filters.html). | Detected onset may be a drum hit rather than a golf putt; beats aren't mandatory cut points; don't fake subjective listening. |
| What is happening in the sound? | If applicable, [faster-whisper](https://github.com/SYSTRAN/faster-whisper) for local speech transcription and word timestamps; [PANNs sound-event detection](https://github.com/qiuqiangkong/panns_inference) and [LAION CLAP](https://github.com/LAION-AI/CLAP) as optional locally run **hypotheses** about speech, ball impacts, vehicle, crowd/music. Test accuracy on real short clips before relying on labels. | Classifiers can misidentify subtle transient events, groove/mood, sonic taste; classification isn't hearing as a human would. |
| Is it emotionally/tastefully mixed and professional? | **Full moving video + actual audio audition** by a qualified human/available audio-capable system, with source-stem soloing and precise corrective notes. Compare to earlier good CG final. | LUFS/true peak, successful media decode, video contact sheets or text-only transcript are not this gate. |

**Likely root, not yet proven on local host:** the actual Codex runtime has been exposed only to text, frame data, signal statistics and readback—not a working semantic/perceptual route for *hearing and assessing* the local final mix. The owner's listening feedback and no-audition admission together establish an unsolved capability gap. They **do not prove** which specific audio bug(s) are in the exported edit. We must inspect the real original vs new file/stems to locate mixing errors; don’t guess.

## Recommended bounded diagnostic using already available tools

1. Read exact private `ONE-MORE-DELIVERY.json` and current/project audio tracks, **without overwriting** anything; verify render path, music/SFX source, timeline in/out, gain, each keyframe and music usage/rights. Check old better Emoya version's music and audio layering as creative *floor*.
2. **Export** the new and old mix to offline local PCM WAV (only existing video input → read-only output). Split the first 3s, swing, putting action, drone/transition and final 5s plus solo score/SFX/camera tracks. Don't publish these or upload private stems. Separate track logging: at video contact `t`, which sound's audible *attack* occurs and which preceding sound is still audible? Compare timeline event frame positions against **decoded rendered audio**, not API writes alone.
3. Produce objective reports: nonempty audio, true silence/dropouts, unexpected concurrent score/action overlap, unnatural music resets, stretched/cut-off attack/tail, loudness per section, abrupt gain jumps and final tail. [FFmpeg `loudnorm`, `astats`, `silencedetect`](https://ffmpeg.org/ffmpeg-filters.html) and optional beat/onset tracking are inexpensive starting points. Do **not** automatically normalize/stem-separate everything or chase “-14 LUFS” as a guarantee of taste.
4. If actual agent can't hear: create **one short, timestamped listening checklist** so CA/Franco/Sydney can say: *0:00–0:03 hook score too loud? swing impact missing at xx:xx? SFX attack early? song phrase restart? tail abrupt?* Do not call the next edit *owner-ready* while mandatory listening has never happened.
5. Only if needed, test local ML classifier **one bounded small audio segment** with a known event, not a giant “install five models” mission. Preserve licence/security: no cloud endpoint, no credit usage, no raw-media transfer. Judge against human ears. If model never distinguishes golf-contact foley from beat, mark **FAILED** and revert to manual review.
6. Reopen/review old good CG exports **with sound** and compare musical mood, soundscape, transitions, camera audio, native fade curves and emotional shift. Restore superior elements from earlier edit. Don't lay fresh scores/SFX across a better mix merely to show sound-edit automation.

## What NOT to adopt now

- [Qwen2.5-Omni](https://github.com/QwenLM/Qwen2.5-Omni) can process audio/video in principle, but official 3B **30-second BF16 video** VRAM table lists **22.43GB theoretical minimum** (plus practical overhead), far beyond laptop RTX 4060 VRAM; **not a credible quick local full-film fix** without measured optimisations. Don't promise zero-cost/effort local AI “ears.”
- [Meta Demucs](https://github.com/facebookresearch/demucs) can separate stems, but source repository says unmaintained. It does **not** judge whether the original soundtrack is suitable. Use only if a specific separation problem actually blocks the edit.
- [FFmpeg loudnorm](https://www.ffmpeg.org/ffmpeg-filters.html) targets technical loudness range; it can produce technically uniform but creatively poor music/foley balance. A single target does not detect wrong cues.
- Do not use Whisper alone to “hear” instrumental music. Do not request external audio understanding/generation/API fees or send unapproved client media to outside providers.

## Audio acceptance matrix for each real CG deliverable

```text
Original and revised render/version hash:
Scene/edit-timecode map and expected cue type:
Music: cleared source, in/out/phrase, why selected, heard by whom:
Camera sound: deliberate keep/mute decisions, authenticity:
SFX: separately editable track; source licence, attack aligned to action:
Actual rendered PCM vs sequence readback:
Silence/click/dropout/overlap/peak/section dynamics evidence:
Full-motion+headphones AUDIO LISTENED BY [person or verified audio-capable method] at [date]:
Review timestamps and exact requested changes:
Comparison to approved prior CG export:
Status: AUDIO_UNVERIFIED | LISTENED_NEEDS_WORK | LISTENED_APPROVED
```

**Only AUDIO LISTENED_APPROVED means it passed human/perceptual review.** AI extraction/classifier confidence alone cannot promote to that. The active `ONE MORE?` Emoya cut is currently **LISTENED_NEEDS_WORK** based on CA's explicit owner verdict. Do not promote its soundtrack as a reusable sound-design skill.

**Coordination:** Independent draft PR #865 retains research only; PR #862 owns MSI debugging and client revision. No install, payment, credits, cloud upload, live Premiere edits, merge or publish from this document.
