---
name: nolan-muffled-perspective-experimental
description: Test a reversible low-pass voice perspective against a dry control, without using it as routine dialogue repair.
---

# Muffled perspective — measured synthetic proof, listening pending

**Stage:** the owner's [Migs muffled-audio tutorial](https://www.tiktok.com/@migsmatias/video/7610873096626605333) was visually sampled in Premiere. It showed Parametric Equalizer `Generic Low-Pass` and a separate `Lowpass` effect route, but its sound and a safe setting were **not** established. A 26 October local synthetic voice A/B now tests the filter mechanism. Mastered: **no**.

Use this only when the picture establishes an outside-room, phone, memory or other subjective listening perspective. Preserve an untouched original track. Place the perspective effect on a working duplicate and return to the dry voice with short ramps. Do not use a low-pass filter to fix noisy or unintelligible speech, or apply a generic cutoff to every voice. Prefer an editor-native EQ and automation for actual staff handover.

## Reproducible local A/B

`proof-source-synthetic-voice.wav` is a local Windows SAPI voice saying “Listen to the room. Then step outside.” It is **not** client speech, a recording from the owner's tutorial, or a proposed voiceover. Its SHA-256 is `0F450927A2AEC5E2A451391235DA19520996957FFC0CE4468B1602287B13A2BC`. [`render_lowpass_ab.py`](render_lowpass_ab.py) uses the existing Python/numpy/scipy and FFmpeg tools; nothing was installed for this test. Run `python render_lowpass_ab.py proof-source-synthetic-voice.wav OUTPUT_DIR` from this folder. Private WAV intermediates and a JSON receipt are generated beside the outputs.

Compare the [dry AAC control](proof-lowpass-dry.m4a) with the [windowed low-pass AAC](proof-lowpass-window.m4a). Both have 3.754 s duration, 48 kHz stereo AAC, complete decode, the same source timing and no picture. The final filter is second-order at 1,600 Hz. The effect ramps in over 90 ms from 0.30 s, stays wet, then ramps out over 90 ms to fully dry by 2.25 s. In the working PCM, zero samples change before 0.30 s or after 2.25 s. SHA-256: dry `3BB9EA337D8FFD2C3F9756F3E074E79A2B9B25447B280952EE48A2587AB6706D`; windowed `FF52C8E87B35EBBA7A74DB7895D830904983B8331F0A79C49E3327F6D00B11D7`.

The 0.55–1.95 s dry high-frequency band (≥2.5 kHz) loses **23.9 dB of power** in the filtered version. Delivered AAC measurements are −21.01 LUFS / −6.84 dBTP dry and −21.31 LUFS / −6.84 dBTP windowed. These numbers describe this synthetic A/B only; they are not production loudness targets or an intelligibility verdict. The first 950 Hz fourth-order attempt cut that high band by **79.8 dB** and was rejected as an overly severe reusable starting point. The exact cutoff, slope, ramp and gain must follow real picture and recorded speech.

## Gate before client use

This test was not perceptually heard by the agent, not shown against a doorway/phone scene, and not reopened as editable native EQ keyframes. An independent editor must compare dry and filtered tracks at matched playback level with the actual picture on headphones, speakers and phone. Listen for consonants, perspective believability, tonal pumping at the ramps and whether returning to dry supports the scene. Keep the dry track available and reject the effect if speech becomes less useful or the picture does not motivate it. No client media, external upload, AI credit, plugin or purchase was used.
