# Boxing camera stabilization screen — office background study,29October2026

This advances the existing **stabilization** family in draft PR910 with a new moving source, separate from the earlier city/Daisy controls. It is a silent stock practice comparison, not a Fight Night client amendment, native editor handover or instruction to stabilize every sporting shot. The office desktop stayed free; no GUI, purchase, paid/API credits, storage worker or client media was used.

## Source, rights and orientation

The [Mixkit #40958 “Close up to a boxing match” item](https://mixkit.co/free-stock-video/close-up-to-a-boxing-match-40958/) labels its 720 tier under the Stock Video Free License for commercial/personal use. The actual downloaded original is7,569,783bytes, SHA-256 `9ba8ed2f03d464b37b4c996132aab67c12a2c2f767b60734278bfbcc826e6085`, 1280×720 upright landscape,24000/1001fps,480 video-only frames. A full-source 20-frame-interval contact and a denser 102–180 segment contact were inspected before selection. The chosen original frames102–173 show one changing guard/exchange with visibly moving foreground gloves/shoulder. The source contains an occluding shoulder, but the sampled occlusion does not establish a safe hidden time-jump or a verified hit; it was not turned into a foreground-handoff edit.

The selection was kept landscape and upright **before** stabilization. The private source, FFmpeg motion transform, FFV1 intermediates, render/QA scripts, contacts and MP4s are under `work/research-continue/stabilization-box`; nothing media-bearing was committed. Detection used the installed FFmpeg `vidstabdetect` with `shakiness=3:accuracy=15:stepsize=6` on exactly72 selected frames resized to960×540. The two transforms reuse the same measured motion: mild `smoothing=5,zoom=3,optzoom=0`, strong `smoothing=30,zoom=12,optzoom=0`. Those numbers are source-specific test values, not presets. The source and output are silent.

## Plain, controls and protected revision

Five 960×540,24000/1001fps,72-frame H.264 outputs fully decode. The ordered encoded contact compares output frames0/12/24/36/47/48/52/55/56/71, and full-size R02 frame52 was inspected. All sources advance in order; there is no inserted duplicate source frame.

| Private MP4 | SHA-256 | Finding |
|---|---|---|
| `plain.mp4` | `5f3c978ddbcab1a0d43af3e0e7f1205c0a7b878385956f99aab9445060aea1c0` | Uncorrected exact-range picture control. |
| `mild.mp4` | `5d88e8cd912cde2d384d37d1e5ba8f0f393c39cb2fb9df1de71122e855afcd6a` | Bounded translation correction; less side-band motion in this weak diagnostic, but no creative pass. |
| `strong.mp4` | `241a08bea37f64b80526594d94a97aad6b7d7afc53fb256d3f35b99596bba6a9` | **Reject**: tighter crop/shift around guard and face and worse side-band motion signal. |
| `hard-r01.mp4` | `ddc453ac63dc9a52aabeede71c83231ffe9a8c290aaa720acee15a5d37803682` | Mild correction through output47, abrupt return to plain on48; a possible reframing seam, not an accepted sports cut. |
| `blend-r02.mp4` | `753f339a0380a48b2c575d44a4843d07b07676c42076132d0e4fd101e1ba2f12` | Protected revision: first48/48 decoded frames exactly equal R01; seven later frames differ, and final16/16 frames equal plain. The eight-frame spatial blend can soften/double fast glove/face detail; reject as a default without normal-speed review. |

The side-band phase-correlation diagnostic on upper-left/right regions reports median step magnitude4.473px plain,2.758px mild,4.760px strong; root-mean-square change in estimated step is19.427,18.259,20.400 respectively. Fighters and foreground gloves enter those bands, so the values are **not** ground-truth camera shake or proof that mild looks better to an audience. The contact supports only that strong changes crop/position substantially, while mild is less invasive in sampled frames. No black-border or exact subject-boundary claim is made from this limited contact. The hard switch's adjacent full-picture MAD at frame48 is29.23 versus30.58 in plain; that number cannot certify seam comfort. R02's adjacent MAD is27.47 at48, but averaging two differently aligned action frames risks ghosting. The plain control may remain the better creative choice for intentional sports movement.

All final comparisons used constant-QP all-intra encoding for exact decoded-frame checks. This is a technical preservation test, not a universal H.264 behavior guarantee. No independent complete normal-speed viewing, physical-phone crop, actual camera sound, heard music/cue judgment, client story fit, native Premiere effect save/reopen/export, second-PC relink or creative approval is claimed. The 45-family library retains open gates.

