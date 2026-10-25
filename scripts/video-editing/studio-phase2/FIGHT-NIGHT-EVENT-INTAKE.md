# Staffy Fight Night event intake — 25 October 2026

Owner priority: complete the 30-second **trailer for the full event film** before restarting TBS. The trailer must earn its power through clearly witnessed blows and their actual aftermath. The two reference videos are mapped in `FIGHT-REFERENCE-SHOT-GRAMMAR.md`; the previously rejected stock montage and song are excluded.

## Source inventory and access

- Exact OneDrive source: `Clients/The Staffy/Videos/2026/2026_10_OCT/FIGHT NIGHT` on personal drive `A2AC9FE4B255F52F`, folder `A2AC9FE4B255F52F!s2cd5c22d5be343fe8401d6a2e396aafc`.
- At the 20:40 SAST check, 121 MP4 entries were listed: 115 had nonzero lengths totalling 35.80 GB; six (`3Q7A9106`, `9107`, `9108`, `9115`, `9145`, `9488`) still reported zero bytes. `DRONE` reported zero children. This is a live upload snapshot, not proof that the batch is finished. Exact filenames, IDs, byte counts, remote hashes and modified times are in `FIGHT-NIGHT-SOURCE-INVENTORY-20261025.csv`.
- The connector lists metadata, but raw fetch attempts on two nonzero files returned `403 Database Is Read Only` / `serviceReadOnly`. Do not report this as a file corruption verdict. The signed-in Christie-Ann OneDrive browser opened source previews and downloaded the first two small files. Browser download commands can be delayed and the browser download-event listener did not observe them even when the files arrived; verify locally by exact filename, byte count and SHA-256 before editing. Leave cloud originals unchanged.
- Local private work area: `C:\Users\chris\Videos\CG-AI-Editing\Fight-Night-2026\source`. Nothing from the camera is committed to Git or uploaded to an external AI service.

## First source screen, with explicit non-selects

| Source | Evidence | Editorial decision |
| --- | --- | --- |
| `3Q7A9109.MP4` | Browser preview and complete local 97,182,548-byte H.264 3840×2160/50 fps, 3.44 s, stereo AAC. Local SHA-256 `1CCFED5E27DFBC2ECD3A3E0C1DF43AAF2F517BF13169BDA9D059EE6CA5D2CB07` matches OneDrive metadata. | Arena light/roof detail, possible very brief setting texture; **no hit**. Do not assign an impact slot. |
| `3Q7A9327.MP4` | Complete local 97,711,684-byte H.264 3840×2160/50 fps, 3.48 s, stereo AAC. Local SHA-256 `1E35E24618B1F7F2EF3BD4E2B283AC420317DC2910F6896FEC1953DF0397811C` matches OneDrive metadata. 5 fps contact sheet shows a lone boxer waiting in the ring. | Ring introduction/geography only; **no hit**. Do not label it impact footage. |
| `3Q7A9330.MP4` | Browser playback showed two boxers engaged in the ring in a 23-second take. Remote size 646,389,792 bytes; source download requested. | Candidate action only. No blow/contact or original-audio timecode verified yet. |
| `3Q7A9517.MP4` | Browser preview showed a woman boxer facing an opponent in a 29-second take. Remote size 822,043,500 bytes. | Candidate action only. No blow/contact or original-audio timecode verified yet. |
| `3Q7A9491.MP4` | Browser still in a roughly one-second preview showed a spectator beside the ring. | Atmosphere only; no hit. |

## Required next pass

1. Confirm each selected download's size and remote SHA-256. Probe duration, fps and audio start offset. Preserve unaltered originals locally; never edit OneDrive source.
2. Inspect *all* completed camera takes at original speed. Log bout, source in/out, exact visible contact frame, strike direction, immediate consequence, source sound and ambiguity. Mark misses or obscured contact separately. Source duration and file naming are not evidence of a hit.
3. Assemble a plain-cut dry 30-second candidate from distinct verified moments before effect or music work. Use real venue/ring audio first. Do not imply different bouts are one continuous strike.
4. Build a separate designed pass: short motivated camera whip/foreground transitions, controlled speed from real 50 fps frames, geographic resets, beat-led cuts, licensed music and individually justified effects. Avoid hiding contact under flashes, masks or artificial impacts.
5. Review the full film at actual speed and phone framing with the delivered sound; verify native or otherwise staff-revisable handover, output streams, full decode, first/last frames, mono fold-down, true peak and clean musical ending. Technical metrics cannot approve creative listening.
6. When honestly reviewable, follow `docs/onedrive-naming-authority.md` and the exact internal WhatsApp package: MP4 document with *only* its proposed social caption, then a separate cover image without a caption. Do not publish to a client or public channel. TBS follows this trailer.

The current intake is **not yet a trailer** and contains **zero verified event hits**. Do not turn a source preview or a sound measurement into an approval claim.
