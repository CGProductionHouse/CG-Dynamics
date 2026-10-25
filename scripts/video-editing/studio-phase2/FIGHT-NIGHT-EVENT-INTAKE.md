# Staffy Fight Night event intake — 25 October 2026

Owner priority: complete the 30-second **trailer for the full event film** before restarting TBS. The trailer must earn its power through clearly witnessed blows and their actual aftermath. The two reference videos are mapped in `FIGHT-REFERENCE-SHOT-GRAMMAR.md`; the previously rejected stock montage and song are excluded.

## Source inventory and access

- Exact OneDrive source: `Clients/The Staffy/Videos/2026/2026_10_OCT/FIGHT NIGHT` on personal drive `A2AC9FE4B255F52F`, folder `A2AC9FE4B255F52F!s2cd5c22d5be343fe8401d6a2e396aafc`.
- At the 20:40 SAST check, 121 MP4 entries were listed: 115 had nonzero lengths totalling 35.80 GB; six (`3Q7A9106`, `9107`, `9108`, `9115`, `9145`, `9488`) still reported zero bytes. `DRONE` reported zero children. This is a live upload snapshot, not proof that the batch is finished. Exact filenames, IDs, byte counts, remote hashes and modified times are in `FIGHT-NIGHT-SOURCE-INVENTORY-20261025.csv`.
- The connector lists metadata, but repeated raw fetch attempts on nonzero files through 21:05 SAST returned `403 Database Is Read Only` / `serviceReadOnly`. Do not report this as a file corruption verdict. The signed-in Christie-Ann OneDrive browser opened source previews and downloaded the first two small files. Subsequent browser Download commands for larger bouts and a 55.6 MB short clip did not yield complete files by 21:05. Browser download commands can be delayed and the browser download-event listener did not observe them even when the first files arrived; verify locally by exact filename, byte count and SHA-256 before editing. Leave cloud originals unchanged.
- Local private work area: `C:\Users\chris\Videos\CG-AI-Editing\Fight-Night-2026\source`. Nothing from the camera is committed to Git or uploaded to an external AI service.

## First source screen, with explicit non-selects

| Source | Evidence | Editorial decision |
| --- | --- | --- |
| `3Q7A9109.MP4` | Browser preview and complete local 97,182,548-byte H.264 3840×2160/50 fps, 3.44 s, stereo AAC. Local SHA-256 `1CCFED5E27DFBC2ECD3A3E0C1DF43AAF2F517BF13169BDA9D059EE6CA5D2CB07` matches OneDrive metadata. | Arena light/roof detail, possible very brief setting texture; **no hit**. Do not assign an impact slot. |
| `3Q7A9327.MP4` | Complete local 97,711,684-byte H.264 3840×2160/50 fps, 3.48 s, stereo AAC. Local SHA-256 `1E35E24618B1F7F2EF3BD4E2B283AC420317DC2910F6896FEC1953DF0397811C` matches OneDrive metadata. 5 fps contact sheet shows a lone boxer waiting in the ring. | Ring introduction/geography only; **no hit**. Do not label it impact footage. |
| `3Q7A9330.MP4` | Browser playback showed two boxers engaged in the ring in a 23-second take. Paused frames around 0:05 show a red glove apparently reaching white headgear/guard; 0:15 and 0:20 show other exchanges. Adjacent frames and the original audio are still needed to distinguish headgear contact, a block and a miss. Remote size 646,389,792 bytes; browser download commands have not yielded a complete local file. | Candidate action only. **No blow/contact verified.** Do not cut this as a landed impact based on the single 0:05 still. |
| `3Q7A9517.MP4` | Browser preview showed a woman boxer facing an opponent in a 29-second take. At about 0:10 a glove appears to reach the other fighter's headgear, but the still does not establish clean contact or consequence. Remote size 822,043,500 bytes. | Candidate action only. No blow/contact or original-audio timecode verified yet. |
| `3Q7A9116.MP4` | Browser preview opened, but the picture remained white at 0:00 in the browser after loading. Remote size 58,314,816 bytes; Download did not yield a complete local file by 21:05. | Cannot evaluate the content from the preview. Do not infer a file failure or a usable moment. |
| `3Q7A9491.MP4` | Browser still in a roughly one-second preview showed a spectator beside the ring. | Atmosphere only; no hit. |
| `3Q7A9461.MP4` | Browser preview showed seated spectators filming, roughly one second. | Atmosphere only; no hit. |
| `3Q7A9630.MP4` | Browser preview showed two boxers facing off in a roughly two-second take; no contact established by the sampled frame. | Candidate ring geography only until full-speed frame inspection. |

## Required next pass

1. Confirm each selected download's size and remote SHA-256. Probe duration, fps and audio start offset. Preserve unaltered originals locally; never edit OneDrive source.
2. Inspect *all* completed camera takes at original speed. Log bout, source in/out, exact visible contact frame, strike direction, immediate consequence, source sound and ambiguity. Mark misses or obscured contact separately. Source duration and file naming are not evidence of a hit.
3. Assemble a plain-cut dry 30-second candidate from distinct verified moments before effect or music work. Use real venue/ring audio first. Do not imply different bouts are one continuous strike.
4. Build a separate designed pass: short motivated camera whip/foreground transitions, controlled speed from real 50 fps frames, geographic resets, beat-led cuts, licensed music and individually justified effects. Avoid hiding contact under flashes, masks or artificial impacts.
5. Review the full film at actual speed and phone framing with the delivered sound; verify native or otherwise staff-revisable handover, output streams, full decode, first/last frames, mono fold-down, true peak and clean musical ending. Technical metrics cannot approve creative listening.
6. When honestly reviewable, follow `docs/onedrive-naming-authority.md` and the exact internal WhatsApp package: MP4 document with *only* its proposed social caption, then a separate cover image without a caption. Do not publish to a client or public channel. TBS follows this trailer.

The current intake is **not yet a trailer** and contains **zero verified event hits**. Do not turn a source preview or a sound measurement into an approval claim.

## 21:50 SAST connector recovery and local screen

- The SharePoint raw-file route recovered for files below its **104,857,600-byte (100 MiB) fetch ceiling**. The 58,314,816-byte `3Q7A9116.MP4` returned a signed private raw file; local download matched both the inventory size and SHA-256. The same route rejected `3Q7A9330.MP4` (646,389,792 bytes) with explicit `413 File too large to fetch`, not corruption or a claim that the video is empty. Larger bout sources still need a legitimate download route. Do not fragment or bypass the connector limit.
- Twenty-seven complete original camera MP4s are now private under `...\Fight-Night-2026\source`; **all 27 match the exact OneDrive inventory byte length and SHA-256**. This includes 25 newly acquired originals in this pass. No media entered Git or an external AI service.
- Original-frame contact sheets were inspected for all 25 newly acquired files. `3Q7A9630.MP4` is the only one of this set showing a live exchange. At 50 fps across its first 0.60 s, red gloves probe toward a white-headgear opponent; the contact point is occluded or out of view, with no demonstrated clean landing or aftermath. **Do not score this as a landed blow.** The remaining short sources are primarily corner preparation (`9116`, `9505`, `9628`, `9724`), ring card (`9117`, `9513`, `9841`), spectators (`9456`, `9515`, `9595`, `9656`–`9659`, `9684`–`9686`, `9987`), a fighter walk or portrait (`9648`, `9763`, `9840`), one corner reaction (`9506`) and a post-bout embrace (`9745`). A cheering spectator or corner reaction cannot be attached to an unwitnessed strike as though causally linked. `9736` shows the official and ring setting; no impact. Some clips are potential sub-second atmosphere or transition shots, subject to crop, original-sound and relevance review, but none earns an impact slot.
- The actual high-energy trailer still requires the **larger bout takes**, including `9330` and `9517`. Retry a legitimate private download path when available; then screen actual adjacent frames and camera sound before choosing blows. Continue the independent TBS redo while this access gate remains open.
- The sustainable large-original route and the tested connector/account limitations are recorded in [FIGHT-NIGHT-MEDIA-INGEST.md](FIGHT-NIGHT-MEDIA-INGEST.md). The documented path has not yet produced a large verified file on this workstation.

## 23:51 SAST completion of the under-100-MiB camera intake

The initial 27 files were **not** the entire under-ceiling set. A CSV-to-local comparison exposed ten remaining completed originals smaller than the connector's 104,857,600-byte limit. All ten were fetched privately through the normal raw-file route, preserved unchanged, and individually matched the OneDrive inventory's byte length and SHA-256. A final independent pass verified **all 37 nonzero originals at or below the limit**, totalling 2,370,659,572 bytes, with no size/hash mismatch. The ten new moving sources were screened at 5 fps; contacts remain in the private `Fight-Night-2026/work` area, not Git.

| Newly verified source | Actual picture | Trailer decision |
| --- | --- | --- |
| `3Q7A9455` | Dark audience and ring-side aisle, people moving through the frame | Atmosphere only; no visible strike. |
| `3Q7A9461`, `9463` | Spectators; people cross the foreground | Crowd context only; no contact. |
| `3Q7A9491`, `9492`, `9493` | Ring-side audience, filming and talking | Possible sub-second atmosphere, subject to sound/crop. No causal reaction claim. |
| `3Q7A9494` | Two boxers and an official stand together in the ring under shifting red light | Bout/result setting only; no strike or demonstrated winner in these sampled frames. |
| `3Q7A9594` | Spectator films and cheers | Genuine crowd energy; cannot prove a particular punch. |
| `3Q7A9735` | Spectator in red lighting gestures toward the ring | Very dark audience texture, no hit. |
| `3Q7A9967` | Man in the audience repeatedly raises a fist | Cheering is real, but cannot be attached to an unverified knockout. |

The expanded short-source screen still yields **zero clearly landed blows**. There is now no unexamined completed camera original within the connector's allowed size range. The hit-led trailer depends on larger bouts through a legitimate, complete local transfer and original-frame/audio review. Do not cut a crowd reaction against an ambiguous glove to imply contact.

## First real-footage timeline work

- Private working cut: `C:\Users\chris\Videos\CG-AI-Editing\Fight-Night-2026\work\fight-night-real-footage-opening-v2.mp4` (1.300 s, 1080×1920, 50 fps, stereo AAC). It uses only the hash-matched camera originals above: `3Q7A9109.MP4` source 0.00–0.50 s, then `3Q7A9327.MP4` source 0.50–1.30 s. A centred 9:16 crop preserves the light and boxer. Both original camera tracks are retained with a 6 dB working reduction and 40 ms cut-edge fades. There is no stock, library hit, music or implied blow. The cut is a **potential opening fragment**, not an approval video or the promised 30-second trailer.
- An initial 3.0 s assembly (`...\work\fight-night-real-footage-opening-v1.mp4`) held on the waiting boxer for two seconds and felt too static in the 4 fps frame review; V2 tightened the light/boxer sequence to 1.3 s. V2's 10 fps contact sheet was inspected. It full-decodes without error, and its measured integrated loudness/true peak are approximately −18.9 LUFS/−5.8 dBTP. These are technical checks, not a heard creative approval.
- At 21:33 SAST the SharePoint raw fetch still returned `403 serviceReadOnly`. The browser's Download control for the 646 MB bout source `3Q7A9330.MP4` had again produced no complete local file. Keep editing with verified originals where possible; retry this exact source access without inventing a hit from a preview.
- The official client vector asset was located at `Clients/The Staffy/Brand Identity/Logo/The Staffy logo, vectorised.pdf` and downloaded privately to `...\Fight-Night-2026\brand\the-staffy-logo-vectorised.pdf`. A normal opaque page render showed only the yellow words on white; rendering the PDF with alpha exposed the **complete white dog plus yellow THE STAFFY wordmark**. The exact yellow wordmark was cropped from that transparent render for the opening overlay; no replacement font or invented logo was used. The adjacent `Quick Fire Sparks Logo_1080p.mp4` is listed in the same brand folder but raw fetch returned `403 serviceReadOnly`; its picture and sound are **not** approved or used.
- Branded working cut: `C:\Users\chris\Videos\CG-AI-Editing\Fight-Night-2026\work\fight-night-real-footage-opening-v3-branded.mp4` (1.300 s). It keeps V2's real light/boxer picture and untouched working audio timing; the official yellow wordmark fades in over the top-safe arena roof after the boxer enters. The 10 fps contact sheet and a full-decode check passed; delivered audio measured about −18.9 LUFS/−5.8 dBTP. This remains only a **candidate opening fragment** pending hit-led scene assembly, final pace, soundtrack, and a full-speed human picture/sound review.
