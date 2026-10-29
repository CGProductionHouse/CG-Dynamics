# Tracked runner in a graphic inset — office background screen, 29 October 2026

Existing graphic-inset-grow family, tested on moving licensed footage with a **source-following portrait crop**. This is a deliberate graphic card, not a filmed device or natural camera move, client edit, Central Canvas work or a claim about the unseen JFJ example. Background command line only; no GUI/editor takeover, paid/API credits, storage worker or MSI amendment.

## Source and visual gate

The publisher's [Mixkit park-runner #4831 page](https://mixkit.co/free-stock-video/view-of-a-park-while-a-girl-runs-across-4831/) marks the item Free License for commercial/personal video use. Exact pinned local original SHA-256 `66a9efc3cd5f2f09d81207d6731f0297f95439a0711dd1f9a4ec128c9fb1bed6`; actual 1280×720, 24000/1001 fps, 198 silent frames. Source frames112–171 show the runner crossing the frame from left to right. A 9:16 crop is only405 source pixels wide, while the runner moves across most of the1280-pixel original. An eleven-position full-source contact was inspected before editing. The fixed center crop at source x437–841 loses her at the beginning and end, as the actual output contact confirms. **Reject fixed crop.**

The portrait map uses a recorded manual x-center path through source-frame/center anchors `(112,270),(128,430),(144,680),(160,950),(171,1130)` with linear interpolation and a legal crop-left clamp0–875. It is a source-specific editorial track, not automated subject tracking or evidence of other shots. The selected crop moves from left x68 to x875 and retains the runner in inspected first/middle/last output frames. Each output frame samples its corresponding source frame112–171 exactly once; there is no skipped or held picture time. All outputs are540×960/24000/1001 fps, 60 frames, silent H.264.

## Controls, revision and result

`plain-tracked` presents the moving portrait crop full frame. `fixed-grow-r00` holds the center crop and grows a55% card; its first and late frames lack the runner, so geometric growth cannot rescue the source selection. `tracked-grow-r01` uses the same tracked crop inside a deliberately graphic bordered card against a dark solid ground. It holds55% size to frame18, eases to full frame at42, then continues full-frame picture. `tracked-grow-r02` changes **only** the grow end to frame36. Its first19 decoded frames are pixel-identical to R01; 30 of the later41 frames differ. The faster revision makes the runner larger earlier, but neither grow establishes a client-story reason to start small.

All four MP4s fully decode with one video and no audio stream. Nine-position encoded contacts (0/12/18/24/30/36/42/50/59) for each and full-size R02frame24 were inspected. Every pair of adjacent decoded frames changes; the tracked R02 adjacent-frame mean absolute difference spans5.457–31.745. The runner remains visible in the tracked contact; the fixed candidate does not. Because normal CRF encoding changes some later pixels after the shared graphic state, exact full-frame tail parity versus `plain-tracked` is only11/18 frames for R01 and18/24 for R02; do not assert byte-identical protected tails. The **first19 frame R01→R02 prefix** is the verified protected revision.

| Private output | SHA-256 | Decision |
|---|---|---|
| `plain-tracked.mp4` | `5b5fef07bd5de89da452811f81e50b0081484112bcd30368f0a545723309e629` | Clearest action-first control at reduced size. |
| `fixed-grow-r00.mp4` | `5a74c255e92e5af1535a3971246f63f7435f61f60c4da9a58572c4beb74a87e9` | Rejected: person exits fixed crop. |
| `tracked-grow-r01.mp4` | `527e2eaf69250c4047c89b317ce4915f748a6fc79e072a789f9afab752c5ed1b` | Tracked geometry candidate; small opening. |
| `tracked-grow-r02.mp4` | `3811fdc8e17d1f3fce0f2dd17778ddc14b1cf58c10395d09633fadae4abfffd3` | Protected faster-grow timing screen, not preferred over plain for this story. |

Private source, render/QA scripts, encoded contacts and `qa.json` are under `work/research-continue/inset-runner`; no media committed. This test advances the moving-source/crop gate and shows a source-specific reason to prefer the plain cut. Normal-speed perceptual rhythm, sound, physical phone, native scale/position keyframe editability, client context and approved artistic use remain open. All45 families retain open acceptance gates.
