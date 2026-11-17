# Nolan Studio: isolated synthetic rendering proof (#871)

This is one bounded, local, tool-agnostic Studio experiment. It renders an 18-second baseline and a 17.5-second owner-feedback revision at **2160 × 3840, 24 fps**, with FFmpeg as the renderer. It has no Premiere or CapCut dependency. The fictional **ARC / FORM** label and abstract geometry make no client, stock, or product claim. The MP4s and detailed receipts remain in ignored `output/`; the committed [contact sheet](proof-contact.png) is visual review evidence, not a substitute for playing the video with sound.

## Story and design intent

Audience: a design-conscious viewer of an invented object label. The opening stroke is a visual hook; geometry moves closer, a synthetic human silhouette supplies scale and a foreground/text depth effect, a diagonal turn changes pace, and concentric forms resolve into an end card with the explicit conceptual CTA **EXPLORE THE CONCEPT**. Palette, typography, scene roles, durations and source policy live in `project.json`. This is a graphics-first concept, so it does not prove human footage, real client brand accuracy, truthful offer selection, or production footage rights.

## P0: private builder audit, read-only

Four private workstation builders and their original outputs were found and inspected without launching an editor or changing them. The locations, source content and client assets remain private. The table gives basenames and source hashes for a reproducible inventory without publishing workstation paths. Output probes establish that files exist and decode metadata; they do **not** establish client approval or editing quality.

| Original builder | SHA-256 of source | Observed pattern and dependency | Strongest original output probed |
|---|---|---|---|
| `build_premiere.py` (Bloem) | `8CB19296D934FD8FEFABCCEF881B85350D3726D4C825C362C0863A05A2686CA0` | Private `build_bloem` import, OpenTimelineIO and FCP7/Premiere handoff. Not standalone. | 1080×1920, 36.4 s, 29,403,023 bytes |
| `build_psg_final_rev5.py` (PSG) | `BA55DF508022B81756EAC2DE1041B4B077535AF0FA2C5BD86D631AC51C0C96C1` | FFmpeg, Pillow, NumPy, OTIO/FCP7; absolute client, stock and font paths. | 1080×1920, 26.2 s, 11,812,651 bytes |
| `build_jfj_final_candidate_10.py` (JFJ) | `BCF2E753544E8AD881AEC738D6991C4D653EF2A79E9E46B01CC76C2AC789F576` | FFmpeg, Pillow, NumPy, manual XML; absolute font reference into another client tree. | 1280×720, 13.6 s, 5,584,525 bytes |
| `build_emoya_v5.py` (Emoya) | `1BB55CE868C6274F485861B48C5419C0926910D34F70024D44298EADF3733770` | Private `build_emoya` import, FFmpeg/Pillow/NumPy and third-party music. | 1080×1920, 30.0 s, 37,139,078 bytes |

The reusable **approach** is scene-by-scene FFmpeg rendering, graphics generation, separate audio stems, then concat/mux. The original source is neither a clean package nor independently portable. Its cross-client absolute paths/imports, client media and third-party licences are unresolved. Its code ownership and redistribution rights were not established, so no original code, media, music or fonts were copied into this branch. This pilot implements only the minimum synthetic scene and revision proof around installed FFmpeg; it does not claim to have reused the private builders verbatim or to have recreated an NLE. HyperFrames was not installed: the already available FFmpeg/Python path was sufficient for this bounded test.

## Reproduce locally

Tested on Windows with FFmpeg/FFprobe **8.1.1**, Python **3.13**, Pillow **12.2.0**, NumPy **2.5.1**, and the Windows supplied Arial Bold font. No package was installed for this task. The proprietary OS font is rendered locally and is **not** redistributed. Before a different host renders, confirm its installed font and licensing; changing the font changes the output hash and may change text bounds.

From this directory:

```powershell
python render.py baseline
python render.py revision
python verify.py
```

`project.json` is the editable baseline source. `revision.json` is the exact owner-feedback simulation: change scene `s03_person` from **MADE FOR / MOMENTS** to **MADE FOR / PEOPLE**; shorten `s04_turn` from 72 to 60 frames. The renderer checks the old field value and refuses changes to protected scenes. Stable scene IDs, per-scene cache keys, timing, SHA-256 source/scene/audio hashes, font licence/hash, render-script hash, project/revision hash, render timestamp and elapsed time are recorded in each ignored `output/<variant>/receipt.json`. Generated PNG assets and PCM stems remain in `output/cache/`, and their exact local paths/hashes are in the receipts. No raw media or generated master is committed. `output/verification.json` is the ignored repeatable QC receipt.

The proposed future job surface is **design only** in the manifest: `create_video_job`, `get_status`, `request_revision`, `get_review_asset`. There is no hosted worker, MCP service, upload, WhatsApp integration or paid compute.

## P1/P2: observed renders and revision

| Evidence | Baseline | Revision |
|---|---:|---:|
| MP4 | `output/baseline/studio_871_baseline_4k.mp4` | `output/revision/studio_871_revision_4k.mp4` |
| SHA-256 | `959ce19cd2a4d35f4ca4fb9eadfde9ccacfd2986afd96814207b837649757f19` | `4586853747b8a44da48961fd69f25e657e392b43b8a8ed694768c638be9aeed4` |
| Bytes | 27,321,763 | 26,403,886 |
| Frames / duration | 432 / 18.0 s | 420 / 17.5 s |
| Measured render | 43.91 s for full baseline; a later cached repeat took 0.52 s | 18.58 s with four unchanged scene caches |

The four protected IDs (`s01_line`, `s02_detail`, `s05_glow`, `s06_end`) have identical individual picture MP4 bytes, PCM stem bytes and **decoded frame hashes inside both final MP4s**. The unchanged last two scenes start 12 frames earlier in the revision because `s04_turn` is shorter. Audio **mix timing** and edit points necessarily shift globally; full-master bytes are not identical. Scene `s03_person` changed as requested. No claim of identical AAC packets after remuxing or of independent human approval is made.

## P3: quality checks and limits

`verify.py` passed FFprobe dimensions, codec, frame count and duration; complete video **and** audio decode; per-scene title motion bounds within the test safe box (x 130–2030, y 300–3420); stems' duration and peak/RMS checks; and protected picture/stem/decoded-frame comparisons. The revised stereo mix measured peak **−14.95 dBFS**, RMS **−26.43 dBFS** before AAC. FFmpeg's final-output scan reported no black interval of at least 0.1 s at the chosen threshold, no silence interval of at least 0.25 s below −50 dB, and AAC mean/maximum levels of −26.4/−14.9 dB. A 2 fps full-duration contact sheet was visually checked: title/accent collision found in scene 2 was corrected, text is readable at contact-sheet scale, the end card is present, and foreground silhouette covers part of scene 3 typography. The 4K MP4 is the master; the contact sheet is a review proxy.

**Not yet accepted artistically:** this agent could inspect the contact sheet but had no audio perception input, so final sound was **not listened to**. Full-speed playback on a phone and staff/owner review of rhythm, colour/exposure, sound, safe areas in target apps, foreground aesthetics and whether the concept feels excellent are pending. The figure and background are synthetic graphics, not footage or a real segmentation mask. Graphics-heavy scenes can feel like animated cards; the contact sheet alone cannot establish motion quality. The Windows font's redistribution rights were not established, and no client brand reference or stock licence was used or approved. The render does not create an editor-native editable timeline; its scene sources and revision manifest are editable in code.

Source provenance is strict: this pilot's generated picture and sound are `illustrative`; actual client facts, offers, product availability and licensed source material would need `current_verified` evidence before production. `archived` material may inform history but does not establish a current claim. `unknown` is excluded from factual output. In particular, a stock image or filmed product for Daisy & Co must not imply in-store availability without current verification. No such client material entered this pilot.

## Exact next improvement after this stop line

Run one short, full-speed **human-visible and human-listenable** review of the local revision master on a target phone; collect one concrete rhythm/audio/typography correction and re-run the same protected-scene comparison. The current local engine is sufficient to test that edit. Do not add a hosting or editor framework before the creative review exposes a specific need.
