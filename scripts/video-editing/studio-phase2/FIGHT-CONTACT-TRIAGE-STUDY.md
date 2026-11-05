# Fight trailer contact triage: candidate versus obscured

This is an original **source-selection A/B**, not an effect demo or an event-footage review. Both sources are licensed Mixkit stock with no audio streams. Comparing them tests the stricter “actually landed” gate for the requested 30-second trailer. The sheets sample frames; they do not replace full-speed, full-resolution screening.

| Source | Sampled evidence | Decision |
|---|---|---|
| [Mixkit #40968](https://mixkit.co/free-stock-video/boxer-giving-a-direct-hit-to-his-rival-40968/), 1280×720, 24000/1001 fps, 11.011 s, SHA-256 `1a8186f3b7bb178a7da237bdffd19c8f855275c615688e00476f4395924015e8` | [12 fps overview, source 5–6.5 s](proof-fight-contact-candidate-40968.png) and [24 fps closer sequence, 5.25–6.25 s](proof-fight-contact-40968-full-rate.png). Red glove travels toward blue fighter's head/guard; the blue fighter turns/ducks immediately. At the apparent contact, glove and guard partly obscure the target. | **Likely contact candidate, not a clean certified head strike**. Could be guard contact. Do not attach a face-hit effect or describe an outcome from the source-page wording alone. |
| [Mixkit #40970](https://mixkit.co/free-stock-video/boxer-skillfully-fighting-in-a-semi-professional-match-40970/), 720×1280, 24000/1001 fps, 4.171 s, SHA-256 `1400ba43a7d715c07c704f23d17fadd83cd7caee5c6ce576dea856f1c9063749` | [8 fps overview, source 0–4 s](proof-fight-contact-obscured-40970.png) and [24 fps final second, 3.2–4.16 s](proof-fight-contact-40970-final-second.png). One fighter dominates frame. At the apparent late hit, a glove covers part of the face, and the opponent and exact contact point remain out of frame or obscured. The source page describes a hit, but that description alone does not make this a visually clear trailer impact. | **Reject as a hero landed-hit shot on the available view**. It can serve as atmosphere or defense if suitable; never add a face-hit sound to make the obscured moment seem clear. |

Both sources are listed under the [Mixkit free stock-video licence](https://mixkit.co/license/modal/videoFree/). Original files remain in ignored `media/fight-practice/`; these downscaled evidence sheets are not client/event assets. PNG SHA-256 values, in table/link order, are `dc105439a0963ca78c6bc532c2c1695907846f5e3f3d4037df7f5200679ab3d4`, `54cc4f757f555d8f88cce45033431c7b28b30d84dc4badcc0a57b46227bfc0dd`, `2c80c3abee03806862dc0f93f0ffe861fb0389d05cb99717f46d593457eb4006` and `94e5808db239bd5d97ba2b963dbc93f21003258e8e072ba788078137dbd99519`.

Reproduce the sheets with FFmpeg from the exact local source files:

```powershell
ffmpeg -y -v error -ss 5 -t 1.5 -i media/fight-practice/40968.mp4 -vf "fps=12,scale=320:180,tile=6x3" -frames:v 1 proof-fight-contact-candidate-40968.png
ffmpeg -y -v error -ss 5.25 -t 1 -i media/fight-practice/40968.mp4 -vf "fps=24,scale=320:180,tile=6x4" -frames:v 1 proof-fight-contact-40968-full-rate.png
ffmpeg -y -v error -ss 0 -t 4 -i media/fight-practice/40970.mp4 -vf "fps=8,scale=135:240,tile=8x4" -frames:v 1 proof-fight-contact-obscured-40970.png
ffmpeg -y -v error -ss 3.2 -t 0.96 -i media/fight-practice/40970.mp4 -vf "fps=24,scale=180:320,tile=6x4" -frames:v 1 proof-fight-contact-40970-final-second.png
```

**Next gate for actual Fight Night footage:** inventory every upload, log each potential punch with original source ID/timecode, inspect adjacent frames at native frame rate and normal speed with camera sound, and have a second reviewer confirm contact and outcome. Sort trailer selects by visible evidence and impact, then by cinematography. A dramatic head movement, camera shake or crowd reaction never substitutes for a visible landed blow. Keep ambiguous clips out of hit positions and avoid SFX that assert contact.
