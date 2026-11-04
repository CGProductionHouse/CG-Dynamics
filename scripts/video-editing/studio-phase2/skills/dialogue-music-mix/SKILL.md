---
name: nolan-dialogue-music-mix-research
description: Balance spoken words, music and effects in a short client edit while preserving natural speech and checking the heard mix.
---

# Dialogue over music — researched, listening proof pending

**Lifecycle:** owner's [voice/music EQ reference](https://www.tiktok.com/@247.mp4/video/7576683123891539222), [hard-limiter reference](https://www.tiktok.com/@247.mp4/video/7600018236138081558) and [low-pass variant](https://www.tiktok.com/@migsmatias/video/7610873096626605333) visually sampled → [synthetic voice/music duck A/B](../../DIALOGUE-MUSIC-AB.md) rendered and measured, but a tiny local ASR transcribed its first word *worse* after ducking → heard acceptance pending → mastered **NO**. No numerical setting or improvement was established by hearing these references.

Start with the recorded voice: cut noise and distracting breaths only as far as natural speech allows, then set intelligible level. Add the music under it and automate music gain around phrases. Use a broad music EQ dip only when level automation alone leaves masking; sweep and compare with bypass to ensure the song still sounds healthy. A hard limiter may catch occasional peaks after the balance is right; it cannot repair masked words. Low-pass is a *story effect* for a motivated phone, doorway or memory perspective, not a default repair for bad voice capture.

The separate [muffled-perspective synthetic A/B](../muffled-perspective/SKILL.md) now measures a reversible low-pass window and documents a rejected over-filtered setting. It does not prove that the effect sounds good on real dialogue or that a filtered voice is intelligible over music.

For the test, export equal-length A/B mixes from one original sentence with the same music section. Measure each mix's integrated loudness and true peak, but choose by listening at ordinary phone volume and through headphones. Check every consonant, the lead-in and tail, sudden gain changes, stereo/mono compatibility and whether the music returns too abruptly after speech. Record the exact original music/voice rights and the editable track automation or render parameters. Do not copy a creator's audio sample, preset claim or numeric threshold without testing the actual source.

Music selection is a separate creative gate even when the film has no dialogue. The [PSG November owner correction](../../PSG-NOVEMBER-V2-OWNER-FEEDBACK.md) rejected a track that had passed decode, loudness and peak tests because its mood was wrong and the same cue had been disapproved before. Maintain a client-specific rejected-track list, check prior video use, audition the exact source in/out and full delivered film, and inspect the final musical phrase. Replacing a disliked cue with an older approved one is a **provisional comparison**, not proof that the new film sounds right. Never relabel technical QC or a failed local audio model as a listening verdict.


##29October licensed-music AV lead-in screen

[Office background timing study](../../DIALOGUE-MUSIC-LEAD-IN-AV-SCREEN-20261029.md) pairs the existing synthetic SAPI voice with licensed Cat Walk music and144continuous city frames. Three AV outputs retain144/144decoded picture identity. R02 starts the music duck before voice activity while R01 ramps into the first word; residual music RMS at0.9–1.0s drops0.032785→0.011108. Float first21,600samples are exact, but stereo AAC first differs20,480 and mono19,456: strict encoded prefix fails. Encoded mono true peak around−0.83dBTP leaves little margin. This is a technical timing construction, not heard intelligibility, client copy/music fit, native automation or mastery.
