# Camera-audio splice: bounded click-repair A/B

**25 October 2026.** An audio-only technical test using the public [Medvedev “Ollie 1”](https://commons.wikimedia.org/wiki/File:Ollie_1.ogv) camera recording documented in [the source-sound study](FIGHT-SOURCE-AUDIO-LEVEL-STUDY.md). It is a skateboard example, **not** Fight Night room tone or an approved event sound. The CC BY-SA 3.0 source and all derivatives remain in ignored `media/fight-practice/source-cut-continuity/`.

Two selections of the **same** explicitly timestamp-padded camera stem were joined: source 0–0.900 s and 2.300–3.120 s. This is deliberately a technical audio discontinuity outside the identified landing region, not a proposed picture edit. The hard-cut control and 10 ms linear-overlap version both contain exactly **18,963 samples at 11,025 Hz, 1.720 s**. The overlap uses the additional 0.900–0.910 s samples from the outgoing source and 2.300–2.310 s from the incoming source, so the timeline duration remains identical.

| Measured property on lossless PCM | Hard cut | 10 ms overlap |
|---|---:|---:|
| Single-sample jump at 0.900 s | 0.14217 | 0.00039 |
| Largest adjacent-sample jump in 20 ms centred on the join | 0.28055 | 0.14652 |
| Samples before the join and after the 10 ms repair | Reference | **Exactly identical to hard cut** |

Only 109 of the 18,963 samples differ between the two WAVs (one ramp endpoint also matches). This is a narrow discontinuity repair, not a broad smoothing or a claim about how natural the edited ambience sounds. The source is 11.025 kHz and its original camera audio is stressed; this test does not qualify it as Fight Night ambience.

To reproduce from `scripts/video-editing/studio-phase2` with the already documented, ignored `media/fight-practice/Ollie_1_camera_stem.wav`:

```powershell
$o='media/fight-practice/source-cut-continuity'
New-Item -ItemType Directory -Force -Path $o | Out-Null
python -c "import soundfile as sf,numpy as np,pathlib; p=pathlib.Path('media/fight-practice'); a,s=sf.read(p/'Ollie_1_camera_stem.wav',dtype='float32'); n0=round(.9*s); n2=round(2.3*s); w=round(.01*s); ramp=np.linspace(0,1,w,dtype=np.float32); hard=np.concatenate([a[:n0],a[n2:]]); smooth=np.concatenate([a[:n0],a[n0:n0+w]*(1-ramp)+a[n2:n2+w]*ramp,a[n2+w:]]); q=p/'source-cut-continuity'; sf.write(q/'hard-cut.wav',hard,s,subtype='FLOAT'); sf.write(q/'crossfade-10ms.wav',smooth,s,subtype='FLOAT')"
ffmpeg -hide_banner -loglevel error -y -i (Join-Path $o 'hard-cut.wav') -ar 48000 -c:a aac -b:a 192k (Join-Path $o 'hard-cut.m4a')
ffmpeg -hide_banner -loglevel error -y -i (Join-Path $o 'crossfade-10ms.wav') -ar 48000 -c:a aac -b:a 192k (Join-Path $o 'crossfade-10ms.m4a')
```

Both AAC files fully decode as 1.720 s mono/48 kHz, with the same measured −3.5 dBTP true peak and no near-full-scale samples. The hard and repaired encoded SHA-256 values are `eb07dcfca0b9e1fd730f5584f9fef42bc38be15d8ac6d490da00ac91c7dea464` and `5bcc88bd612fa2e74af37227b952809691f9f48f92bdd447bb0f1c4175cd4d69`. Thus the seam repair does not hide a whole-file level difference. It has **not been heard**, so no claim is made that 10 ms is perceptually ideal or that the surrounding sound belongs to one continuous real event.

**Transfer rule:** in the real Fight Night dry cut, first choose truthful consecutive camera/venue ambience and preserve the untouched source tracks. When a non-impact ambience join clicks, compare a hard join with a short overlap on a separate working track. Keep the measured junction and an actual full-speed listening decision. Do not crossfade through a verified glove/contact transient, smear a sharp hit, join unrelated bouts as if one take, or cover a gap with invented crowd sound. Source-specific timing and staff editability remain required.
