# Fight Night: first integrated stock-only trailer study

**25 October 2026. Practice, not a Staffy trailer.** The exact OneDrive Fight Night video folder remained empty at the 08:06 SAST read-only check, and the owner confirmed it also looked empty from their side. This is a 10.010-second exercise connecting the separately tested timing, portrait framing, pressure pocket, sound cue and safe-area title. It contains **no event footage**, event identity, client claim or source camera audio. Do not stretch these same shots to 30 seconds or describe the result as the requested event film trailer.

## Watch the equal-picture A/B

- [Music-only control](proof-fight-integration-control.mp4)
- [One impact cue plus pre-hit music duck](proof-fight-integration-designed.mp4)
- [Half-second picture contact sheet](proof-fight-integration-contact.png)
- [Reproducible source](render_fight_integration.py)

Both versions use the same 240-frame H.264 picture stream (`SHA-256 567939fa10047862bbf49ac5725dc186e16d7e0710152956e665172f2419bbfb`), at 1080×1920 and 24000/1001 fps. FFprobe reported 10.010 seconds of video and AAC audio; both MP4s decoded completely with FFmpeg. Control SHA-256: `a75988429989bc6b1ef03d57a535e02f0e8a140b617b41b9263a7ed4f83518d4`. Designed SHA-256: `0171378a2e0237ebdd2826d6f45382c2a13daccba499adb8bc2dea5b57e8bffe`. The audio meter reported control −24.9 LUFS integrated/−9.8 dBTP and designed −24.6 LUFS/−8.7 dBTP. These numbers establish comparable overall level and headroom, **not** an audible quality judgement; the agent could not hear either file.

## Timeline and picture judgement

| Output window | Licensed Mixkit source/in | Editorial role | Visible gate |
|---|---|---|---|
| 0–1.50 s | [#40974](https://mixkit.co/free-stock-video/two-men-on-a-ring-fighting-in-a-boxing-match-40974/), 4.75 s | Cold open; one face contact around output 0.625 s | Contact and immediate reaction visible in sampled frames; stock sparring, not Staffy |
| 1.50–3.00 s | [#40973](https://mixkit.co/free-stock-video/man-fighting-hard-in-a-boxing-match-40973/), 1.00 s | Energetic close guard | No separate hit claim |
| 3.00–3.75 s | [#40968](https://mixkit.co/free-stock-video/boxer-giving-a-direct-hit-to-his-rival-40968/), 5.25 s | Brief two-fighter geography | Square action window retains both fighters; blurred bands expose the 16:9 source constraint |
| 3.75–4.75 s | [#40970](https://mixkit.co/free-stock-video/boxer-skillfully-fighting-in-a-semi-professional-match-40970/), 0.25 s | Defense and rising motion | Glove coverage obscures contact; no landed claim |
| 4.75–6.75 s | [#40969](https://mixkit.co/free-stock-video/boxer-is-knocked-out-when-getting-hit-in-a-ring-40969/), 0.00 s | Second face contact around output 5.25 s | One distinct contact, not a replay of #40974; the crop does not verify the source page's knockout description |
| 6.75–8.51 s | #40973 again, 5.25 s | Energy and release | Repeated stock fighter; **not acceptable as separate event impact** |
| 8.51–10.01 s | Synthetic `FIGHT NIGHT / TRAILER STUDY` | End-card spacing | Only a practice title; full-screen black separates it from action |

The contact sheet shows the opening glove-to-face contact, a legible second hit and the end title at reduced size. The #40968 square presentation is more legible than the previously rejected portrait fill, but the sudden wide square is an obvious format shift. Repeating #40973 also makes the stock exercise visually repetitive. Both are source limitations, not techniques to carry into the final event edit. The `STOCK PRACTICE` label and `SYNTHETIC TITLE PLACEMENT` mark the exercise clearly. No foreground cutout or unanchored mask edge was used.

## Sound construction and rights

Both use [Mixkit #676 Epical Drums 01](https://mixkit.co/free-stock-music/percussion-trailer/) from source 24.225 s under the [free music licence](https://mixkit.co/license/modal/musicFree/). The designed version adds one [Mixkit #2165 face punch](https://mixkit.co/free-sound-effects/punch/) under the [free SFX licence](https://mixkit.co/license/modal/sfxFree/) with onset at output 0.592 s, placing its measured waveform peak near the first visible contact at 0.625 s. It lowers music from output 4.65 to 5.40 s around the second shot's hit, with a low plateau from 4.90 to 5.20 s. No false ring ambience or second impact was synthesized. Original stock is silent. All original asset hashes are checked in the script; practice assets stay in ignored `media/fight-practice/` and are not redistributed in Git.

**Creative judgement remains open:** the soundtrack was not perceptually heard in this environment, the complete video was not reviewed with sound at normal speed by a human, and it has not been viewed on a physical phone. The music phrase may clash with the cuts or the effect may sound fake even though their waveform timing and levels are correct. The first 10 seconds are an editorial sketch, not proof of the 30-second high-power trailer. The final edit requires the actual Staffy event files, verified and logged landed blows, usable camera sound, an approved music/effects choice, full-speed listening and phone review, then a staff-revisable handover. A flat MP4 alone is not that handover.

## Reproduce

Place exact Mixkit files named in `render_fight_integration.py` under ignored `media/fight-practice/`; the script rejects missing or changed hashes. The existing `render_fight_impact_scene.py` creates the practice watermark. Run `python render_fight_integration.py` from this folder. It uses the existing FFmpeg/Python route and the existing synthetic title-frame function, without a new rendering engine or editing dependency.
