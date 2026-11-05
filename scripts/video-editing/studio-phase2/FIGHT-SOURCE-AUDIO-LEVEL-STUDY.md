# Source sound before sound design: over-range landing A/B

**25 October 2026. Technical source-audio proof; creative sound is not approved.** The earlier stock boxing examples supplied either no microphone sound, near-silence or a pre-edited soundtrack. To test the first *sound* decision on a visible action with its own recorded audio, I screened [Medvedev's 3.1-second “Ollie 1”](https://commons.wikimedia.org/wiki/File:Ollie_1.ogv). It is a skateboarding landing, **not** Fight Night footage or a punch-sound surrogate. Wikimedia lists it as the author's own work under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/); attribution and ShareAlike would matter for distribution. The original and all derived MP4s stay in ignored `media/fight-practice/`, outside Git. Original SHA-256: `e09dadde533909bf104a724621ef86496d8f1f8711d5967587363c4b34da4529`.

## What was actually observed

- The 24 fps, 1024×576 picture contact covers a visible jump and landing. At 1.70–1.78 s the board and rider are visibly coming down/rolling out. A 5 fps contact sheet and those two source frames were inspected. This supports a landing action; it does not prove the exact acoustic cause of either transient.
- Its own mono Vorbis track is 11,025 Hz. Decoded float audio has 24 samples above magnitude 1.0, a maximum of 1.149 (about +1.2 dBFS), and prominent 0.1 s RMS windows at 1.3 and 1.7 s. The source is already technically stressed and low bandwidth; changing gain cannot restore lost fidelity or prove the recording sounds natural.
- The source video starts at 0.000 s but its audio stream starts at 0.074286 s. Simply extracting audio to WAV drops that stream offset: the raw decoded first nonzero sample is at 0.02358 s in the WAV. A tested full-length float WAV stem resets decoded audio PTS, explicitly pads 819 samples (`0.074286 × 11025`, rounded), and ends at 3.12 s; its first nonzero sample is at 0.09787 s. This retains the relative picture/sound start for an editor timeline. Recompute stream offset and sample padding for **each** event file; do not copy 819 or 3.12 as universal values.
- I made three *same-picture* local exports with native audio only: unchanged gain, −3 dB, and −6 dB. No music, whoosh, bass hit, synthetic crowd or unrelated bag sound was used. The three encoded H.264 video streams have the identical SHA-256 `14baef2539ec43cadd167fc204259d13bb2bc0091d9fc939fea7a1e67d7db1b2`. Each has 74 video frames and a fully decoding AAC track.

| Local export | Decoded sample peak | Samples ≥0.999 | Measured true peak after AAC | Result |
|---|---:|---:|---:|---|
| `Ollie_1_control.mp4` | 1.733 | 48 | +4.8 dBTP | Reject: over-range on delivery decode. |
| `Ollie_1_gain_minus3.mp4` | 1.229 | 4 | +1.8 dBTP | Reject: a nominal 3 dB reduction was insufficient. |
| `Ollie_1_gain_minus6.mp4` | 0.880 | 0 | −1.1 dBTP | Narrow technical pass for this encoded file; not an audible quality verdict or a universal gain setting. |

The source itself is already over-range in float decode, and lossy AAC can create additional reconstructed peaks. **Measure the delivered file**, including true peak, after every gain/codec change. Do not normalize an isolated hit to a full-programme LUFS target; this would make its transient disproportionately loud. Do not use a limiter to conceal an already compromised recording without auditioning it. The −6 dB candidate may still sound rough or too quiet; it has not been heard by this agent.

Reproduce in a scratch folder after obtaining the original under its stated licence:

```powershell
ffmpeg -hide_banner -loglevel error -y -i Ollie_1.ogv -map 0:v:0 -map 0:a:0 -vf 'scale=720:-2' -r 24 -c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p -af 'volume=-6dB' -c:a aac -b:a 192k -ar 48000 Ollie_1_gain_minus6.mp4
ffmpeg -hide_banner -i Ollie_1_gain_minus6.mp4 -af 'ebur128=peak=true' -f null NUL
ffmpeg -hide_banner -loglevel error -i Ollie_1_gain_minus6.mp4 -f null NUL
ffmpeg -hide_banner -loglevel error -y -i Ollie_1.ogv -map 0:a:0 -af 'asetpts=N/SR/TB,adelay=819S:all=1,apad=whole_dur=3.12,atrim=end=3.12' -c:a pcm_f32le Ollie_1_camera_stem.wav
```

**Transfer to Staffy:** pair each verified visible impact with that take's own camera-audio timecode. Retain an untouched source stem and a separately named corrected working stem; keep effects/music on different tracks. Check whether the source transient is authentic, intelligible, clipped, wind-covered or absent *before* selecting an effect. Measure the actual encoded export, including phone/mono playback. If the source is damaged, record that and choose a defensible source or removable sound treatment; a level adjustment does not make an invented hit truthful. A competent independent editor must hear the actual finished event mix at normal speed before any creative acceptance. The owner is not the routine practice-audition gate.
