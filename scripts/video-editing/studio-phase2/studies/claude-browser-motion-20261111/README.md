# Claude browser-motion productions, 11–12 November 2026

Code and receipts for two owner-reviewed Claude-lane films, made with the deterministic seek-to-MP4 browser route already recorded in `docs/ops/NOLAN-BROWSER-MOTION-UPGRADE-2026-11-10.md` and draft PR982. This adds working productions and techniques to that route; it is not a second renderer or registry. Overview: `.agents/skills/cg-video-story-editor/references/claude-motion-library-20261116.md`.

| Folder | Film | Output |
|---|---|---|
| `cg-websites/` | CG Production House "We build websites and apps", R06, 1920×1080, 30 s | `build_timeline.py` → `cg-websites-apps-v6.html` |
| `property-wilgehof/` | Property Gain Wilgehof vacant stand, R02, 1080×1920, 30 s | `build_timeline.py` + `mapdata.py` → `wilgehof.html` |

Shared tools: `render_scene.py PAGE SIZE NAME T0 T1` (one scene to MP4) and `contact_sheet.py PAGE SIZE T...` (full-size stills and a sheet).

## Run

Assets are **not** in Git: client photos, screenshots, portraits and logos stay in each project's company-Drive folder (`CG Video Editing System / Projects / …`). Download `cg-websites-R06-build-assets.zip` or `wilgehof-R02-build-assets.zip` from that folder and unzip it next to the generator (`shots/`, `img/`); see `docs/ops/CLAUDE-NOLAN-HANDOVER-2026-11-16.md`. Requirements: Python 3 with Pillow and Playwright (Chromium), FFmpeg; Inter Display (CG film), Poppins and npm `@fontsource/cormorant-garamond@5` (Wilgehof). Set `AGENT_PHONE` for the Wilgehof CTA.

```
python property-wilgehof/build_timeline.py          # writes wilgehof.html
python contact_sheet.py wilgehof.html 1080x1920 0.5 9.9 13.2 24.3 29.5
python render_scene.py wilgehof.html 1080x1920 a1 0 3.2    # ... one call per scene
ls scenes/*.mp4 | sort | sed "s/^/file '/;s/$/'/" > list.txt
ffmpeg -f concat -safe 0 -i list.txt -c copy -movflags +faststart out.mp4
```

## Receipts

See `RESULTS.json`. Both generators were re-run on 16 November from these Git copies and reproduced the delivered pages byte for byte (Wilgehof with `AGENT_PHONE` set). The shared renderer was re-tested on a 6-frame range (decoded 1080×1920, 6 frames).

## Data notice

`property-wilgehof/mapdata.py` contains street geometry and landmark positions derived from OpenStreetMap, © OpenStreetMap contributors, available under the Open Database Licence (ODbL 1.0, https://opendatacommons.org/licenses/odbl/). Keep the on-screen credit "Map: OpenStreetMap streets".
