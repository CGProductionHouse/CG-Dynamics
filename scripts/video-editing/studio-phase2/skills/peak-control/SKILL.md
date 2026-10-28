---
name: nolan-peak-control-experimental
description: Test whether a short transient can be controlled without unnecessarily reducing a whole voice track, including exported mono compatibility.
---

# Peak control — synthetic limiter A/B, listening pending

**Stage:** The owner's 247.mp4 limiter tutorial was visually sampled, but its sound and recommended settings were not verified. This 26 October synthetic A/B tests a reproducible peak-control mechanism with the installed FFmpeg `alimiter`; it is not a production mix preset or creative listening approval. Mastered: **no**.

Start with the actual source and preserve its unprocessed track. If a verified impact or effect creates a narrow peak, adjust that event or its separate stem first. Compare any limiter against an unprocessed export and a simple gain control. Measure the **delivered file**, including a mono fold-down, after encoding. A stereo true-peak result alone did not catch the failure in this test. Keep gain, limiter, and source tracks independently adjustable in the staff editor.

## Repeatable A/B

[`render_peak_ab.py`](render_peak_ab.py) takes the committed [synthetic voice](../muffled-perspective/proof-source-synthetic-voice.wav), adds a 6 ms / 900 Hz synthetic transient at 2.4742 s, and writes private float WAV plus three 48 kHz stereo AAC files. The voice is a local Windows SAPI phrase, not client speech; the added transient does **not** pretend to be a real punch. From this folder, run:

```powershell
python render_peak_ab.py ..\muffled-perspective\proof-source-synthetic-voice.wav C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\peak-20261026
```

The source voice sample peak was 0.6429 and the float working track peak was 1.5309; no premature integer clipping was introduced. All three 3.754 s AAC files completely decoded. The [uncontrolled export](synthetic-hot-raw.m4a) measured −20.36 LUFS / −0.45 dBTP, yet its decoded FFmpeg mono fold-down peaked at **1.34166**, above full scale in floating PCM. [Whole-track −7 dB gain](synthetic-hot-gain.m4a) reduced the integrated level to −27.11 LUFS / −6.32 dBTP, taking the entire voice down to solve one short transient. The [bounded limiter candidate](synthetic-hot-limited.m4a), `alimiter=limit=0.65:attack=5:release=60:level=0:latency=1`, measured −20.72 LUFS / −3.73 dBTP, with decoded mono fold-down peak **0.91993** and zero samples above 1. The limiter setting is specific to this constructed test and this encoder.

An initial `limit=0.75` candidate measured −2.49 dBTP in stereo but still produced a decoded mono peak of **1.06046**. It was rejected. This is why the final mono measurement belongs in the acceptance gate. The raw, gain and final limited AAC SHA-256 values are respectively `464B089B6AEFEBC07DB292E2C3A52E5CAB2BC393A735C5C98FEA09085FAD9625`, `78E3C73C92CF06104035119A5E0BC10C075C3D3337A61D37852896E648E24D2C`, and `2D39A4D8BE067AD47AF7576A376332EE4957EE3AE6944454D3D4AF10CB11C4D3`.

## Before using on an actual edit

Confirm the transient is a genuine intended event, listen to unprocessed and limited versions at matched playback level, and inspect whether limiting dulls the hit or pumps nearby voice/music. Test the actual codec, export path, stereo channels and mono fold-down; check the final five seconds and phone playback. The agent could measure these synthetic files but could not hear them, and no native editable limiter handover or actual Fight Night/client mix was tested. No client media, external upload, purchase, plugin or AI credit was used.

## Office native extension —29October2026

[Native peak-control study](../../OFFICE-NATIVE-PEAK-STUDY-20261029.md) tests licensed musical peaks with new Premiere project/sequence, linked original/plain/hot/gain/nativeHardLimiter controls and MaximumAmplitude keyframe revision. SevenAV/twoPCM exports; both actual native reopen pairs72/72picture/all144144stereo samples exact. Hot+12dB fails; R02TruePeak−4dB/7mslookahead/100msrelease yields−4.0dBTPstereo but−1.1dBTPafteractualFFmpegmonoAACencode. These are measured source-specific settings, not a preset or pumping/intelligibility approval. Exact protected opening FAILS both AAC/PCM despite bounded nativekeys; preserve that failure separately from successful reopen proof. Keep original/gain/effect independently editable, verify real mono output and hear the complete mix before client use. No phone/second-PC/creative mastery.
