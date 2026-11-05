# Fight trailer scene 3: contact-frame hold on a power-run hit

**Decision:** keep [the natural 1.001 s stock shot](proof-fight-scene3-natural.mp4) for this practice source. The [two-frame contact hold](proof-fight-scene3-contact-hold.mp4) is a reproducible candidate, but the [frames 8–19 comparison](proof-fight-scene3-comparison.png) shows a three-frame contact plateau followed by two frames of delayed reaction. This 24 fps source already plays as slow motion; the hold adds stationary time without revealing new impact detail. Treat it as **rejected for this source**, not as a generally mastered freeze-frame technique. The moving/audio result has not had a human full-speed audition.

The licensed practice source is [Mixkit #40969](https://mixkit.co/free-stock-video/boxer-is-knocked-out-when-getting-hit-in-a-ring-40969/), 1280×720 at 24000/1001 fps, SHA-256 `5d417cfd997899890a199c7f5ed3ab5fa7d7592e96a5bfeb511eb24349667298`, under the [Mixkit free stock-video licence](https://mixkit.co/license/modal/videoFree/). The x=300–704 vertical crop keeps the face, glove and apparent contact near source 0.5 s. The full source-page description mentions a knockout, but this isolated one-second crop does **not** prove or depict the full outcome. Original media remains in ignored `media/fight-practice/`; the rendered test has a visible `STOCK PRACTICE` label.

`python render_fight_contact_hold.py` makes a natural control and a 24-frame candidate with FFmpeg. The candidate repeats source frame 12 twice, then trims the end back to 24 frames; the control uses the same frames without a hold. Both outputs have no audio. Each MP4 fully decoded, has 24 frames and lasts 1.001 s.

| Output | SHA-256 |
|---|---|
| Natural control | `ff46cd721d3c6433a3b995e671cd1c8f9940cffd980f889642f69be618dbd23b` |
| Two-frame hold candidate | `4be620d1d859caf18d6bdcb0e2cea2e3f0e33795becac2a165f25e7b54d742ba` |

The contact-sheet frames are sampled from the *output* and make the timing mechanism visible, not its felt rhythm. Separate H.264 encodes mean decoded pixels in nominally unchanged frames can differ. This experiment does not demonstrate a good 5–10 s power run, complete trailer rhythm, sound design or staff-editable project.

**Next gate:** with the real event footage, prefer the natural contact shot first. A contact hold is worth testing only if original-speed motion is too fast to read and the held frame is genuinely sharp. A/B against the continuous shot with original camera sound, review at normal speed and phone size, and reject any glitch-like stutter, false contact emphasis or lost reaction frame. High-fps source may allow a better clean slow-motion treatment than duplicating 24 fps frames.
