---
name: nolan-brand-voice-overlay
description: Prepare and integrate rights-cleared brand narration with exact script/audio bindings, South African voice provenance, phrase timing, readable graphics and speech-preserving music ducking.
---

# Brand voice and narration overlay

CA5November prefers a distinct South African voice for each brand as films are developed. Reuse a brand's accepted voice profile after approval, as with its fonts and assets. A model/voice name, locale string, pitch change or successful transcription does not prove authentic accent, pronunciation, natural performance or rights.

## Source and brand identity

Load the existing client library and `audio/VOICE-PROFILE-DRAFT.json` or its later approved replacement. Retain actual provider/voice ID, locale, language, licensed terms/entitlement or original narrator consent, scope, audio/script hashes, voice-use history, pronunciations, cadence and approval evidence. Keep unknown IDs unassigned. Never clone a client/staff/creator voice from ordinary footage just because the bytes are accessible.

Preferred no-spend source is a **consented original South African narration** already cleared for this use. A commercial TTS route must have verified output rights, account entitlement and no unauthorised cost/credits. Microsoft's [official voice catalogue](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=text-to-speech) lists `en-ZA-LeahNeural` and `en-ZA-LukeNeural`; that catalogue is not evidence this PC has free authorised access. No Azure call/account creation occurred. The installed SAPI voices are en-US and are not acceptable substitutes for an en-ZA final. [Kokoro's own voice definitions](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md) use `af_` for American female, not Afrikaans. Do not mislabel these as South African or use noncommercial-only weights in client advertising.

## Phrase-to-picture workflow

- Write the hook, proof, qualification and next step in spoken language before animating. For roughly30s, estimate the read and then measure the actual take, including breath/reading space and approved outro. Short reference length is not the client's requested final duration.
- Split only at natural phrase boundaries. Record dry audio; keep original breaths where useful, avoid clipped consonants and aggressive gating. Capture a pronunciation list for client names, place names, Afrikaans/English terms and abbreviations. A financial qualifier belongs in the spoken/pictured explanation, not hidden in an unreadable footer.
- Shared `scripts/voice_overlay.py::place_segments` places actual PCM without clipping or overlaps. `ducking_envelope` derives causal attack/release gain from speech energy; multiply the music bed by it, never the narration. Original graphics SFX remain separate and should not mask consonants.
- Read the exact ASR output against the script. A mismatch is an open intelligibility check, not permission to rewrite the transcript to match expectations. Word timestamps and accent/meaning need separate evidence. Check decoded AAC, mono compatibility, true peak, loudness and full-speed exact picture/sound through a qualified route.
- `validate_voice` separates engineering-only sources from production provenance and requires exact affirmative accent/pronunciation review for a production profile. It does not clear creative release or prove a provider account. Bind actual bytes, timeline and evidence through the existing release path.

Current proof uses installed US SAPI **only as a labelled private engineering source**, not a brand candidate. Four real WAV phrases are placed in a30s PSG motion study; earlier ducking uses diagnostic noise. The [later offline ducking controls and failed terminology check](../../VOICE-DUCKING-CLOSEOUT-20261109.md) add actual music controls, optional lookahead/hold and protected AAC revision. Defaults stay causal; apply the envelope only to music, never shift/duck narration.80ms preview/120ms hold are tested values, not automatic brand defaults. An isolated old CTA transcribes correctly while the new split phrase still reads EXCESS as ACCESS in dry and all mixed controls. Ducking does not repair pronunciation; keep that gate failed rather than repeating prompts. The US locale/commercial-scope/accent gate still rejects this source. A South African production narrator is unselected; no hearing, mastery or finished PSG film is claimed.
