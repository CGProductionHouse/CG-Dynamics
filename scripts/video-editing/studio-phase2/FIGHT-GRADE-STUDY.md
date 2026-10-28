# MMA-style cool-shadow grade: restrained A/B rejected

**25 October 2026.** The [MMA reference](https://www.tiktok.com/@lumaurya/video/7634259458025164054) visibly combines cool cage shadows with warmer skin and stage lights. A grade can preserve and unify suitable event coverage; it cannot supply missing walkout, cage geography, impact or aftermath.

- [Original stock control](proof-fight-grade-control.mp4)
- [Cool-shadow candidate](proof-fight-grade-cool-shadow.mp4)
- [Same-time side-by-side review](proof-fight-grade-ab.mp4) and [frame](proof-fight-grade-ab-frame.png); **left is control, right is treated**
- [Reproducible FFmpeg settings](render_fight_grade_study.py)

The source is [Mixkit #40970](https://mixkit.co/free-stock-video/boxer-skillfully-fighting-in-a-semi-professional-match-40970/) from 0.1 s, hash-checked in the script, under the [free stock-video licence](https://mixkit.co/license/modal/videoFree/). Both versions are silent, 48 frames at 24000/1001 fps, 1080×1920, 2.002 s, and fully decode. Control SHA-256 `879ee0dbc8e2ab50ed5b5ee1b6a3681365e7b1284fd6ab76af32538dc2affef7`; treated SHA-256 `6c51a9bdb12431b0d1e0429423c1b8d3815f25cc5ea05ca298b2c1da226b4b86`.

**Decision: reject this fixed grade as a reusable fight look.** At reduced viewing size the source is already blue/cyan in the shadows, so the candidate adds little; it also darkens the fighter and glove. A stronger local trial darkened that area further and was not promoted. The event film needs a shot-by-shot source colour and skin/exposure review, not an automatic reference-matching preset. This A/B is preserved so the same unnecessary look is not tried again on footage that is already cool. No event client grade, colour-managed pipeline or phone approval is claimed.

## Second source challenge: warm gym contact

The first rejection might have been caused by starting with an already cool source. I therefore tested the same *decision*, not the same preset, on [Pexels #7986157](https://www.pexels.com/video/7986157/) under the [Pexels free licence](https://www.pexels.com/license/). Its ignored original is 720×1280, 60000/1001 fps, SHA-256 `56d9d9b01954509236a5b81bec172f99d513afad9f2e880c33837b2cb06bf803`, with no audio stream. Source ≈0.55–2.55 s includes real glove-to-bag contact, not an event fight. Two 48-frame/2.002 s silent H.264 files were rendered from the exact same frames and fully decoded. The original videos remain ignored; the [270×480 side-by-side](proof-fight-warm-grade-rejected.png) is the review receipt.

The candidate used `eq=contrast=1.05:brightness=0.018:saturation=0.93,colorbalance=rs=-0.015:bs=0.025:rh=0.012:bh=-0.012` after `fps=24000/1001,scale=720:1280`, compared with the same frame selection without the grade. At reduced size it lightens the face and desaturates the warm gym slightly, but does not strengthen the contact, separate the bag or guide the eye better than the control. **Reject this candidate too.** The source already has useful subject/bag separation and the extra treatment reads more like a generic look than an editorial decision. No LUT/preset is promoted. Event coverage must be reviewed shot by shot with skin and exposure references; this 720p stock A/B does not prove final colour, colour management or phone playback.
