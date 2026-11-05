# Source audio through a slowed contact: same-picture timing A/B

**25 October 2026.** Technical sync proof on the public [Medvedev “Ollie 1”](https://commons.wikimedia.org/wiki/File:Ollie_1.ogv) source, **not** fight footage or a proposed trailer effect. Its [source sound study](FIGHT-SOURCE-AUDIO-LEVEL-STUDY.md) records the CC BY-SA 3.0 attribution/ShareAlike terms, low-bandwidth and already stressed camera audio, visible landing and 74.286 ms audio stream offset. The original and both A/B MP4s remain in ignored `media/fight-practice/retime-audio/`; none is a client deliverable or in Git.

The picture slows original frames **30–44** (source 1.250–1.875 s) by 2×, keeping the lead-in and exit at 1×. This moves a source event at 1.81 s to approximately `1.25 + 2 × (1.81 − 1.25) = 2.37 s` on the output timeline. The picture is the same in both versions (copied H.264 stream MD5 `8b77b86df927bea11aa4b88004353442`):

| Variant | Sound treatment | Loudest 10 ms window | Picture at that moment |
|---|---|---:|---|
| `unmapped-audio.mp4` negative control | The original 74 ms-padded camera stem plays straight through while picture slows. | 1.81 s | Board and skater are still airborne in the slowed picture. |
| `mapped-audio.mp4` timing candidate | The matching audio interval is also lengthened 2× using FFmpeg `atempo=0.5`; the surrounding camera sound stays at 1×. | 2.36 s | Board and skater have returned to the ground. |

The peak is **consistent with** the visible landing, but the recording contains multiple transients; a waveform peak alone does not establish that a particular acoustic event is the wheel contact. The two sampled pictures were visually inspected. Both exports have 89 video frames at 24 fps, 3.708 s container duration, 48 kHz mono AAC, audio start zero and 3.708 s audio stream duration after explicit padding. Both fully decode. The initial mapped render ended audio **27 ms before video**; this was corrected with an explicit full-duration pad and the failed first render was not retained as a passing result. Measured encoded true peaks: mapped −1.2 dBTP, negative control −1.1 dBTP. These are technical values on a compromised 11.025 kHz source, not a sound-quality recommendation. The current mapped and control SHA-256 values are `4db75a6ef4a1ef1cc9a9296281fed8a00cd794b76c9f1e5f9ec04ac6fba4a516` and `48d00275d95d585cf216780d3876fa71dc24ffb0f13239b1be9bc75b46f7bd1c`.

For reproduction, begin with the **explicitly padded** `Ollie_1_camera_stem.wav` from the source study. From `scripts/video-editing/studio-phase2` in PowerShell:

```powershell
$p='media/fight-practice'; $o=Join-Path $p 'retime-audio'
New-Item -ItemType Directory -Force -Path $o | Out-Null
ffmpeg -hide_banner -loglevel error -y -i (Join-Path $p 'Ollie_1.ogv') -i (Join-Path $p 'Ollie_1_camera_stem.wav') -filter_complex '[0:v]split=3[v0][v1][v2];[v0]trim=start_frame=0:end_frame=30,setpts=PTS-STARTPTS,fps=24[va];[v1]trim=start_frame=30:end_frame=45,setpts=2*(PTS-STARTPTS),fps=24[vb];[v2]trim=start_frame=45:end_frame=74,setpts=PTS-STARTPTS,fps=24[vc];[va][vb][vc]concat=n=3:v=1:a=0[v];[1:a]asplit=3[a0][a1][a2];[a0]atrim=0:1.25,asetpts=PTS-STARTPTS[aa];[a1]atrim=1.25:1.875,asetpts=PTS-STARTPTS,atempo=0.5[ab];[a2]atrim=start=1.875:end=3.083333,asetpts=PTS-STARTPTS[ac];[aa][ab][ac]concat=n=3:v=0:a=1,volume=-6dB,aresample=48000,apad=whole_dur=3.708333,atrim=end=3.708333[a]' -map '[v]' -map '[a]' -c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p -c:a aac -b:a 192k (Join-Path $o 'mapped-audio.mp4')
ffmpeg -hide_banner -loglevel error -y -i (Join-Path $o 'mapped-audio.mp4') -i (Join-Path $p 'Ollie_1_camera_stem.wav') -map 0:v:0 -map 1:a:0 -c:v copy -af 'volume=-6dB,aresample=48000,apad=whole_dur=3.708333,atrim=end=3.708333' -c:a aac -b:a 192k (Join-Path $o 'unmapped-audio.mp4')
```

Run the [read-only audio inspector](FIGHT-SOUND-QC.md) and a full FFmpeg decode on both deliveries. Retain the original camera track separately; a slowed working stem never replaces it.

**Transfer to Fight Night:** record the source-to-timeline time map for every retimed impact. Never move a picture contact without remapping its source audio or deliberately replacing/omitting the affected source interval in a separately editable working track. `atempo=0.5` can change the character of a short transient and room sound; this test was not heard, so do not turn it into an automatic sound design preset. A real 59.94 fps event clip may justify a modest slow visual interval while keeping its actual hit at real speed with a cut or speed transition. Judge the finished picture and sound together at full speed on headphones, speakers and phone before acceptance. This proof establishes timestamp discipline only; no event source, music, SFX, creative mix or staff handover was tested.
