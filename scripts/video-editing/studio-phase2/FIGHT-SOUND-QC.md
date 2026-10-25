# Read-only sound stream inspection

`inspect_audio_stream.py` is a small local intake/export check using installed FFprobe, FFmpeg and NumPy. It reads one local media file, prints JSON and does not change or upload it. It reports the video/audio stream start offsets, decoded sample peak, 10 ms RMS windows, near-silent fraction, loudest window's *candidate* time and FFmpeg's delivered-file true peak. The loudest window is **not** an automatically identified punch; it may be crowd, handling, music or a codec artefact. No sound classifier or creative approval is implied.

```powershell
python inspect_audio_stream.py C:\path\to\local\take.mp4
```

Use its JSON to triage source files and the final export, then inspect source picture and *listen* at the candidate time. `NO_AUDIO_STREAM` exits 2; a decode/FFprobe error exits 1; a measured audio stream exits 0 even if diagnostic flags are raised. Flags are review prompts, not release criteria: a −1 dBTP threshold is conservative for this pilot and is not a substitute for the intended platform's actual delivery specification. Never choose an effect from this output alone.

**Verified controls on 25 October 2026:** an exact digital-silence WAV flagged near-silence, a steady 440 Hz synthetic tone did not, the public boxing-labelled `Broll7.webm` flagged near-silence, and the silent `proof-fight-graphic-control.mp4` returned `NO_AUDIO_STREAM`. The music-free bag cue reported its existing −8.3 dBTP with no near-full-scale samples. The public [landing A/B](FIGHT-SOURCE-AUDIO-LEVEL-STUDY.md) −6 dB export reported a 0.076 s audio/video stream offset, decoded peak 0.880, zero samples ≥0.999 and −1.1 dBTP; these agree with independent FFmpeg commands. The tests do **not** establish useful bag timbre, musical fit, genuine fight contact or staff approval. No client media was used for these controls.

The source path and SHA-256 appear in stdout; store reports only in the approved private job workspace when inspecting client footage. The script scans audio twice (PCM window measurements and FFmpeg true peak), so a long original file takes time. It intentionally makes no irreversible correction, normalization or automatic mix decision. Keep the stream/timestamp report with the [sound handover ledger](FIGHT-SOUND-PLAYBOOK.md) so the editor knows whether a stem needs explicit alignment.
