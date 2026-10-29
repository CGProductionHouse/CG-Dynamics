# Moving title blur over portrait basketball — 29 October 2026

This advances the existing [graphic transform blur family](skills/graphic-transform-blur/SKILL.md) in [draft PR #910](https://github.com/CGProductionHouse/CG-Dynamics/pull/910), #874/#903. Earlier runner source proof was landscape. This is a silent stock practice on a genuinely upright portrait source, not client copy, an approved Reel or a native Premiere effect. No GUI/playback window, client media, paid/API credit, purchase or external upload was used.

## Source, layout and source truth

The [Mixkit #2285 basketball original](https://mixkit.co/free-stock-video/basketball-player-dribbling-then-dunking-2285/) is marked Stock Video Free License for audiovisual use; its exact private 720×1280 original is SHA-256 `a4fd4af14f85a29ab46fb511b885b48fb7d0b0bc64aef5b2ec6ce0639f6110c7`, 24000/1001fps, silent. The actual source frames48–119 show a continuous dribble beneath a hoop. The title `DRIBBLE` names an action visibly present; it does **not** establish a dunk or a client message. Arial Bold is locally installed and not redistributed. Private `work/research-continue/portrait-graphic-blur/render.py` leaves footage upright, scales to540×960 and draws only a warm-white glyph mask over the lower court. The text enters from the left on output frames12–23, holds through51 and is absent from52 onward. No ball/player pixels are intentionally warped or re-timed.

## Plain control and protected graphic revision

Four 72-frame H.264 silent MP4s were rendered with the same continuous source-frame map. The plain has no type. Sharp carries the identical x-position/visibility schedule without motion accumulation. `blur180` averages33 fractional title positions over a nominal 180° exposure window during entry only. Protected `blur90-r02` reduces only that graphic sampling window to90°; text position, wording, colour, picture and timeline remain fixed. These are code-rendered graphic exposure hypotheses, **not** a claim of native Premiere Transform parameter equivalence or camera shutter blur.

| Private MP4 | SHA-256 | Picture finding |
|---|---|---|
| `plain.mp4` | `0a662de64e4f69b9f1c4e6f069a201b1bbdb333849549954024c953082c78af0` | **Preferred story control:** dribble reads without redundant low copy. |
| `sharp.mp4` | `ccf450b8a358b0d8a0109f7715915f9a4819a72db02bef0ed75f5e523f069e47` | Clear once settled; entry still begins as partial word. |
| `blur180.mp4` | `cfda021c7aa471e356bb8f7d85c87414fca814a2314acedd9b65b10af4f6152b` | **Reject strong entry:** wide smear delays word reading. |
| `blur90-r02.mp4` | `7b0cc625839b45489ccdf2e6d463e95378b8b93b1483f79155de18d8b77f5a84` | More legible technical revision, but redundant copy and low placement reject it as an editorial choice for this shot. |

All four actual outputs fully decoded to72 portrait frames, and all71 adjacent frame pairs change. Decoded frames0,11,12,14,16,18,20,23,24,30,51,52,71 were inspected in a 180×320 four-way contact; full-size strong/restrained frame16 and restrained frame30 were inspected. At output16, title-band mean absolute RGB difference from sharp is10.691 for180° and5.114 for90°. The ball-region difference from the no-title plain is **0.000** for both blur variants at that sample, showing the graphic remains spatially isolated in the tested region. The strong word is visibly stretched across court texture; the smaller window retains firmer letter strokes, but both arrive as a partial word. At frame30 the text is sharp and entirely visible, although low in the frame where platform UI may compete. No physical-phone safe-area check exists.

`blur180`→`blur90-r02` decoded comparison protects first12/12 frames and final48/48 frames exactly; changed output frames are only12–23. Intra-only H.264 made this strict output check pass for the tested exports. The clean no-title picture remains preferred because the overlay adds no fact to the basketball action, not because the restrained blur fails mechanically. No approved brand typography/copy, action-motivated beat, heard music, independent full-speed/physical-phone viewing, native editable graphic handover, second-PC relink or creative/client approval is established. A useful future application needs a title that adds meaning, clears platform UI and settles before the viewer needs to read it.
