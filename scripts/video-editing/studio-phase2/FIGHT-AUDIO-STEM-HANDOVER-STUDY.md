# Aligned audio stems: disposable handover and revision check

**25 October 2026. Technical, audio-only proof; not a Fight Night mix or a staff-editor acceptance.** This uses the local synthetic announcer and previously licensed Arulo “Cat Walk” practice excerpt documented in [the voice/music A/B](DIALOGUE-MUSIC-AB.md). The track is not proposed for the event. Source, stems and exports are ignored under `media/fight-practice/stem-handover/`; no client material or stock audio is committed.

The question was narrower than music taste: can staff receive aligned, separate, lossless layers and make a one-layer revision without rebuilding the sound? The source voice enters at 0.8 s. The existing ducked music-only practice file supplies a separate music layer. FFmpeg 8.1.1 produced two **6.000 s, 48 kHz, stereo, 32-bit float WAV** stems from timeline zero. `VOICE.wav` is the synthetic voice resampled, delayed and set to 0.36 linear gain. `MUSIC.wav` is the earlier ducked music-only file padded/trimmed to six seconds. The latter already contains its practice envelope; a real editor should retain the original licensed track and editable gain automation alongside any printed stem.

For a disposable local reproduction from `scripts/video-editing/studio-phase2` in PowerShell, with the previously documented practice sources present:

```powershell
$p='media/fight-practice'
$o=Join-Path $p 'stem-handover'
New-Item -ItemType Directory -Force -Path $o | Out-Null
ffmpeg -hide_banner -loglevel error -y -i (Join-Path $p 'music_only_duck_early.wav') -af 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad=whole_dur=6,atrim=end=6' -c:a pcm_f32le (Join-Path $o 'MUSIC.wav')
ffmpeg -hide_banner -loglevel error -y -i (Join-Path $p 'synthetic-announcer.wav') -af 'aresample=48000,adelay=800:all=1,volume=0.36,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad=whole_dur=6,atrim=end=6' -c:a pcm_f32le (Join-Path $o 'VOICE.wav')
ffmpeg -hide_banner -loglevel error -y -i (Join-Path $o 'MUSIC.wav') -i (Join-Path $o 'VOICE.wav') -filter_complex '[0:a][1:a]amix=inputs=2:duration=first:normalize=0[a]' -map '[a]' -c:a pcm_f32le (Join-Path $o 'mix-baseline.wav')
ffmpeg -hide_banner -loglevel error -y -i (Join-Path $o 'MUSIC.wav') -i (Join-Path $o 'VOICE.wav') -filter_complex '[0:a]volume=-3dB[m];[m][1:a]amix=inputs=2:duration=first:normalize=0[a]' -map '[a]' -c:a pcm_f32le (Join-Path $o 'mix-revision.wav')
```

The two outputs have identical sample count and channel format. A local `soundfile`/NumPy read of all four WAVs found **288,000 stereo samples per file**. `mix-baseline - VOICE - MUSIC` had maximum absolute residual `7.45e-9`; `mix-revision - VOICE - MUSIC × 10^(-3/20)` had residual `1.65e-8` (float rounding). `VOICE.wav` remained byte-identical across both mixes, SHA-256 `03c32ddf46922bf8fcf3ca19f2c37ddaefa0cb3280c7870ca6019ae412822f46`. The mixes differ in RMS by `0.00749` linear; this is the deliberately changed music layer. There is no missing start offset in the printed stems.

Both mixes were separately AAC encoded at 192 kbit/s and decoded by the read-only [audio inspector](FIGHT-SOUND-QC.md). Both report 6.000 s container duration, 48 kHz stereo, audio start 0, no decoded near-full-scale samples and no true-peak flag. The baseline true peak is **−8.8 dBTP**, revision **−11.8 dBTP**; encoded SHA-256 values are `b29f8cbf66c18328603f56d5bed58bc60cf520d0599062aae0862a1bc61bf199` and `65ee4e5c51219d867908d0f53522d83b314beaa98ca2bfe85e75dc1e4ecab6d4`. AAC decode yielded 288,768 samples per channel, so use the lossless stems rather than AAC sample counts as the timeline alignment authority. The practice music includes quiet intervals; the inspector's window counts do not label those as creative pauses.

**What passed:** aligned, separately editable lossless layers; a one-layer gain revision with mathematically unchanged voice source; two decodable delivery files; no clipping by measured true peak. **What did not pass:** no editor import/save/reopen on another machine, no event camera/room/SFX stems, no actual picture sync, no music-selection or audible quality verdict, and no phone/headphone hearing. Thus this establishes a packaging mechanic, not staff handover or completed sound. For Fight Night, each selected camera sound and removable SFX/music must have a source/licence row, zero-aligned full-length stem and original-media link; an independent editor must open the package and hear the finished cut before acceptance.
