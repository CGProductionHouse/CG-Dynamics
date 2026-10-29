# Three distinct coffee files in full-height bands — 29 October 2026

This advances the existing [stacked-reaction-panels family](skills/stacked-reaction-panels/SKILL.md) under [PR #910](https://github.com/CGProductionHouse/CG-Dynamics/pull/910), #874/#903 and the owner's three-distinct-shot horizontal stack rule. It extends the earlier [one-file coffee sequence screen](COFFEE-THREE-BAND-PROCESS-SCREEN-20261029.md) with **three genuinely separate original video files**. It is silent illustrative stock, not a client cafe, one verified brewing process, the JFJ example or a ready social film. No GUI, client media, paid service, API credit or external upload was used.

## Sources and story truth

Each publisher page states Mixkit Stock Video Free License for commercial/personal use; actual local files were SHA-verified before rendering:

| Band / honest label | Source and selected 60 frames | SHA-256 |
|---|---|---|
| Top, `BEANS` | [Mixkit #4989 coffee preparation sequence](https://mixkit.co/free-stock-video/video-sequence-of-the-coffee-preparation-process-4989/), original0–59 at24000/1001fps | `407c95f695dca9c8b25fb586b3a2eae8736747bf7a4b021f1c1b179101601a50` |
| Middle, `ESPRESSO` | [Mixkit #41865 machine cup](https://mixkit.co/free-stock-video/cup-being-filled-with-coffee-in-a-coffee-machine-41865/), original48–107 at24000/1001fps | `883b71655e2f2448a03b02f6e318eced58b51bac5b74da86c018995f3c817331` |
| Bottom, `CUP POUR` | [Mixkit #43941 separate overhead pour](https://mixkit.co/free-stock-video/pouring-coffee-in-a-cup-43941/), original0–59 at24000/1001fps | `b258a4d247d2da42286ae775772c437526207c9b37db65c15d6ddec8d6df90c3` |

The third Free-License file was downloaded privately from the publisher's asset host, 5,782,673 bytes, 369 frames, 1280×720. The first source has a later grinder/machine view entering toward the end of its selected range; beans remain visible, but this is a stock sequence, not a one-shot bean harvest. The espresso source is upright portrait720×1280, cropped only to y400–825 for a horizontal band so both streams and cup rim remain visible. Other two landscape sources use aspect-preserving scale and shallow horizontal crop. None of these disparate shoots is claimed to portray one cup, place, person or product.

## Plain control and staged revisions

Private `work/research-continue/three-distinct-coffee/render.py` uses the existing local Python/OpenCV/Pillow/FFmpeg tools. Its 720×1280 canvas comprises contiguous complete horizontal rows y0–426,427–852,853–1279, with no black gutters or solitary letterbox. All three distinct images advance one source frame per output frame from frame0. Plain shows all bands at full source brightness with descriptive tabs. R01 leaves future bands visible but at48% pixel brightness, brightening the middle at12 and bottom at24. R02 protects the first18 pre-encode frames and moves only bottom brightening to18. No music/beat is invented or inferred from the silent stock.

| Private MP4 | SHA-256 | Result |
|---|---|---|
| `plain.mp4` | `95776c26448836508a0f2697c179c3f6b134bd3cd6a95edaaf8df39360b36000` | All three actions readable from the opening. |
| `staged-r01.mp4` | `10cf0beee91fe05ea4a5943fa0b2d2253638d955846222ee50add85321a07c5d` | Full frame stays filled, but middle/bottom are too subdued at the opening. |
| `earlier-r02.mp4` | `41af8627e1a6e348918504add3f92e86cedaf96c2eac4be56595c98a339283cf` | Earlier final emphasis gives six more bright bottom frames; does not repair dark opening. |

All three fully decode to60 portrait frames, 24000/1001fps/2.5025s. Frame0/7/12/17/18/23/24/35/59 contacts and full-size R02 frame24 were inspected; separate input contacts show original motion/objects. No output has a wholly black row. In plain, adjacent motion above0.5mean-absolute levels occurs59/59 top,54/59 middle and59/59 bottom pairs; lower/middle are relatively gentle movements. R01's first middle-band mean luma15.81 versus plain34.90 and bottom22.45 versus48.79: the staging visibly hides already dark espresso, so **plain is preferred for this source opening**. At180×320 reduced contact, labels are small. The2.5s duration is also short for three pieces of information; no normal-speed human comprehension or physical-phone pass is claimed.

R01→R02's first18 **working frames are pixel-identical**, but separately encoded H.264 outputs show0/18 exact decoded frame matches; mean absolute difference is0.244 levels. All42 later encoded frames differ. This is a failed strict encoded-prefix gate, not a source/layout timing change. No codec splice was used to force a pass. The effect is a useful three-file layout mechanism, but full-speed rhythmic timing, per-shot exposure/colour match, sound, approved client-specific copy, platform overlays, native linked-layer editability for this new assembly, second-PC and physical-phone review remain open. Earlier native three-file woodland stack demonstrates a separate one-PC editable mechanism; it does not certify this baked coffee output.
