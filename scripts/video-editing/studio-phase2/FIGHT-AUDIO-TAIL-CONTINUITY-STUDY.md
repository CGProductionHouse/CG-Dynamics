# Delivered audio tail: bounded hard-end/fade A/B

**25 October 2026.** This is an audio-only delivery-repair test on the public [Medvedev “Ollie 1”](https://commons.wikimedia.org/wiki/File:Ollie_1.ogv) camera sound. Its source, licence and 74 ms offset are recorded in [the source sound study](FIGHT-SOURCE-AUDIO-LEVEL-STUDY.md). It is **not** a Fight Night end button, music selection, or heard approval. All WAV/AAC outputs remain ignored in `media/fight-practice/tail-continuity/`.

The working camera stem was cut at source 2.900 s, where its last sample is nonzero. Both versions apply the same source-specific −6 dB working gain and contain **31,972 PCM samples at 11,025 Hz** (2.89995 s). The control ends hard; the candidate linearly lowers only the last 60 ms to zero. All samples before that tail are exactly identical. The hard working PCM ends at −0.05664 linear amplitude; the candidate ends at zero. This establishes a deterministic tail edit, not that 60 ms is musically or perceptually correct.

Both 192 kbit/s mono AAC outputs fully decoded, have a 2.900 s container duration, 48 kHz delivery rate and the **same −1.1 dBTP true peak**. Measured 20 ms RMS at the end of the decoded files dropped from −30.5 dBFS (hard control) to −45.8 dBFS (fade candidate). The [stream inspector](FIGHT-SOUND-QC.md) reports no near-full-scale samples in either. Hard/fade AAC SHA-256 values are `eed16c16892fc2cddff421c122acc1f5df4b65bba739d8e85ab10ef9aebd0fb2` and `d841b5c009376889da01a3f7753b28da5db2f4951eb86b89551f3a3228153186`.

Reproduce from `scripts/video-editing/studio-phase2` with the existing ignored padded source stem:

```powershell
$o='media/fight-practice/tail-continuity'
New-Item -ItemType Directory -Force -Path $o | Out-Null
python -c "import soundfile as sf,numpy as np,pathlib; p=pathlib.Path('media/fight-practice'); a,s=sf.read(p/'Ollie_1_camera_stem.wav',dtype='float32'); n=round(2.9*s); w=round(.06*s); hard=a[:n]*np.float32(10**(-6/20)); fade=hard.copy(); fade[-w:]*=np.linspace(1,0,w,dtype=np.float32); q=p/'tail-continuity'; sf.write(q/'hard-end.wav',hard,s,subtype='FLOAT'); sf.write(q/'fade-60ms.wav',fade,s,subtype='FLOAT')"
ffmpeg -hide_banner -loglevel error -y -i (Join-Path $o 'hard-end.wav') -ar 48000 -c:a aac -b:a 192k (Join-Path $o 'hard-end.m4a')
ffmpeg -hide_banner -loglevel error -y -i (Join-Path $o 'fade-60ms.wav') -ar 48000 -c:a aac -b:a 192k (Join-Path $o 'fade-60ms.m4a')
```

**Transfer rule:** inspect the actual final export's last picture, original location sound, chosen licensed music phrase and effect tails together. An accidental truncated ambience tail is a repair candidate; a deliberately hard musical stop or authentic final impact may need no fade. Keep the clean control, make the repair on a separate working track, re-encode, inspect the delivered last 0.25 s and have an independent editor hear the ending. A low final RMS or zero terminal sample cannot decide the creative end button.
