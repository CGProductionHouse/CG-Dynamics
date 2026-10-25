# Fight cue: stereo versus mono fold-down

**25 October 2026 — technical playback gate, not creative sound approval.** The [existing 1.251 s music-free bag-contact candidate](FIGHT-BAG-SOUND-AB.md) was checked for the mono cancellation risk noted by the owner's dialogue/music mixing references. The [mono check](proof-fight-bag-sound-mono-check.mp4) copies the *same* 30-frame picture and folds its stereo AAC to mono with `0.5 × left + 0.5 × right`. Its encoded video-stream SHA-256 is identical to the stereo candidate: `c20cb28ed6f1f4f7b2c6f5462f18a13570eb5335b0b23b88a0ab0fb01ddeb5d2`. This does not change the action or add another hit.

Reproduce from the committed [stereo candidate](proof-fight-bag-sound-one-cue.mp4):

```powershell
ffmpeg -hide_banner -loglevel error -y -i proof-fight-bag-sound-one-cue.mp4 -map 0:v:0 -map 0:a:0 -c:v copy -af 'pan=mono|c0=0.5*c0+0.5*c1' -c:a aac -b:a 192k proof-fight-bag-sound-mono-check.mp4
```

The mono MP4 has SHA-256 `2f6ed85167fab11def3185f5b2847dc9eeeee6d19cf66338a37ac89bd44270b8`, 30 H.264 frames and one 44.1 kHz AAC channel; full video/audio decode passed. Decoded stereo-channel correlation is `0.888`. In the 0.52–0.65 s attack window, stereo RMS is `0.02544` left and `0.02680` right; folded mono RMS is `0.02537`, about **0.25 dB below** the two-channel arithmetic RMS average. The mono attack first exceeds a 0.01 sample threshold at 0.537 s, and its peak is 0.306 full scale with zero samples at or above 0.999. The final 10 ms RMS is `0.000012`. This specific cue does **not** lose its measured attack to phase cancellation on mono fold-down, and no new digital clip or hard tail appears.

These values say nothing about whether the bag material, room image or perceived attack feels real at normal speed. The stock picture itself has no camera sound. Do not transfer this technical pass to the owner's Fight Night footage or use this bag recording to imply a fighter was hit. For the event mix, preserve original camera channels and test **each finished music/ambience/effect mix** in mono; a pass on one cue does not cover other layers. Keep every optional cue removable in the staff edit, and leave creative acceptance to an independent editor on the completed trailer. No routine owner practice audition is requested.
