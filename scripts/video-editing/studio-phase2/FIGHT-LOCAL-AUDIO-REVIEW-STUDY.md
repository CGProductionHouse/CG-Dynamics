# Local audio review: control before any creative judgment

**25 October 2026.** The owner wants the Nolan Studio sound lane to work without asking them to audition every practice edit. The current Codex task cannot receive audio as an input; two media-output attempts omitted it. That limitation does not justify promoting an unheard cue. This study checks whether an already installed local audio-capable model can provide a useful independent *screen*, alongside FFmpeg signal checks. All requests go to `127.0.0.1`; no audio is sent to a cloud API.

## Failed first candidate

`ollama show gemma4:12b` reports an `audio` capability on this workstation, but capability metadata is insufficient. An OpenAI-compatible local `/v1/chat/completions` request with a WAV `input_audio` block returned a different token count than a text-only control, showing that an audio payload was processed. Its answers were unreliable:

| Known input | Model response |
|---|---|
| No audio block | Requested an audio/video file |
| Exactly one second of 16 kHz digital silence | Claimed a clear person speaking in a room |
| Exactly one second of 440 Hz sine at 0.3 amplitude | Called it a high-pitched metallic clink |
| The existing bag-contact candidate | Called it a continuous, slightly distorted electronic tone |

The silence hallucination is disqualifying. Do **not** use this model's sound descriptions to choose music, accept an impact or claim that a mix was heard. The [bag cue's decoded QC](FIGHT-BAG-SOUND-AB.md) remains an objective timing/clipping check only.

The reproducible control probe below made the failure even clearer with the same prompt for all three inputs: 12B called **silence** a resonant drum hit, called the **steady tone** a percussive hit, and called the **bag candidate** a drum hit. The audio-block prompt token counts were 90, 90 and 97 respectively. A model that gives nearly the same event label for these controls cannot be an autonomous sound judge, regardless of its advertised capability.

## Second candidate and fail-closed test

The official [Ollama Gemma 4 page](https://ollama.com/library/gemma4) describes the small E4B architecture as an audio-input variant. `gemma4:e4b` was pulled locally as a free model, not installed as a plugin. The bounded [control probe](probe_local_fight_audio.py) sends three pinned, non-client WAV inputs to localhost: true silence, a steady 440 Hz tone and the licensed bag-contact practice candidate. It prints the model response, prompt-token count and WAV digest without publishing sound files. It never invokes an external endpoint or selects a cue automatically.

**E4B failed the same gate.** With exactly the same prompt, it called all three inputs “a steady electronic tone”: digital silence (86 prompt tokens), the actual tone (86) and the bag candidate (93). Thus both installed local Gemma variants are **rejected for sound review**, despite exposing an `audio` capability. The differing token counts show input variation but do not make the descriptions true. Do not use either model to judge music, effects or final mix quality. A useful future local classifier must pass known silent, continuous and transient controls before its labels are considered at all.

The autonomous lane can still verify source-track presence, exact timecode alignment, decoded channels, clipping, loudness range, fades and export integrity. Those are technical gates, not a substitute for hearing a creative mix. Preserve original event camera audio, keep library effects removable and compare with a dry control. Independent editing-staff acceptance of the finished client cut may remain necessary; the owner is **not** the routine practice-audition gate. This is a clear system limitation, not permission to call an unheard stock cue approved.
