# PICASSO large-shoot hardening — 28 October 2026

This extends the [PICASSO local-editor handover](PICASSO-LOCAL-EDITOR-2026-10-25.md) and GitHub issue #878. It is an engineering intake proof, **not** acceptance of the photographic look or approval to deliver the existing Staffy gallery to a client.

## Implemented

- Runner 0.3.13 renders in bounded image strips, checkpoints every 25 files, records source inventory for resume, and avoids quadratic prior-photo comparisons. A full-size 6000×4000 private one-image render completed in 9.98 seconds and passed `verify --quality` 1/1. A regression fixture retained the previous renderer's decoded-pixel SHA-256. Its actual photo remains REVIEW.
- `shoot_index.py` 0.2.0 indexes approved JPEG originals without editing them, using per-file SQLite checkpoints, SHA-256, EXIF capture times, time-based bursts, adjacent similarity hints, private thumbnails and contact sheets. It refuses linked directories and online-only files. All initial decisions are REVIEW. Human decisions and burst reviews have a reversible journal. Full `stage-selected` requires all bursts reviewed and copies only human KEEP camera bytes to a hash-verified private folder; a labelled calibration mode permits a small pilot. Staged camera bytes retain EXIF and are Lightroom intake, never Pixieset uploads.
- Index tool 0.3.0 adds a read-only `burst-sheet` command. It verifies source SHA-256 and makes eight-frame pages with full scenes above the same-area detail crops, with an optional normalized crop to keep the subjects in view. It does not mark KEEP or claim native-size focus. The calibration staging route now refuses more than 25 KEEP originals, so it cannot bypass full-burst review for a large selection.
- The MSI-local `picasso` skill and Windows host preparation script include the new version. A code-only ZIP for company-account installation is at `C:\Users\chris\Pictures\PICASSO-private\tools\picasso-skill-code-only-2026-10-28.zip` (SHA-256 `83DD1FF11B04779F9552010C4E4E138D986D43E880DDD6E7056FEA1244A6C707`). It contains no client media or credentials. In the company Chrome profile's PICASSO Work chat, `@skill-creator` reported that it saved the **existing** account skill in place and independently matched all 12 supplied files, runner 0.3.13 and index 0.2.0, while preserving the existing icon and settings. Its cloud runtime could not import `cv2`, so a fresh **local Work** execution of the updated skill remains unverified. The saved company skill link is `https://chatgpt.com/skills?skill_id=6ade196e81608191858d0ceefdcb4fdc`.
- A fresh company **browser Work** chat invoked `@picasso` and read both installed scripts: runner 0.3.13 and index 0.2.0 were present. It correctly reported that this browser runtime lacks `cv2` and cannot execute the private MSI index. It accessed no photos. The acceptance chat is `https://chatgpt.com/g/g-p-6ade17c38794819186de588deaddcd85-picasso/c/6ae17f68-6e70-83ea-842b-3e520a91259b`. This proves account distribution and invocation, not a new local-host run.

## Measured evidence

| Test | Result |
| --- | --- |
| Real fast index | 311 Staffy 6000×4000 camera JPEGs, 82.99 seconds, zero errors; no-change resume and seven contact sheets 1.01 seconds |
| Real detailed index | 1,237 Staffy camera JPEGs across three private source folders, 766.24 seconds, zero errors; 444 burst groups and 140 near-duplicate hints |
| Detailed resume in 0.2.0 | 1,237 reused, none reprocessed, 0.14 seconds |
| Synthetic grouping | 6,000 rows passed in the test suite; no claim of a 6,000-real-JPEG benchmark |
| Quality and host checks | 27 Python tests, Windows dependency check, and TypeScript/Vite build passed after the burst-sheet and calibration-cap additions |

### Burst review proof added later on 28 October

The new comparison command read 16 actual Staffy camera JPEGs from two neighboring bursts, verified each indexed SHA-256 and produced two private eight-frame sheets in 8.15 seconds. The Fight 05 selected punch frame had a partially hidden face and magenta skin; nearby frames changed action and facial visibility without yielding an obvious automatic winner. The Fight 06 selection had a soft/bent opponent; adjacent frames reveal different expression and timing. These are editorial observations, not an automated rejection or accepted replacement. The sheets remain only in the private index job; no camera JPEG was modified or uploaded. This confirms that full-frame contact thumbnails and whole-frame sharpness numbers cannot settle these selections. The actual 25-frame photographic gate and the existing 195-photo internal gallery remain unaccepted.

The 1,237 indexed photos and all 444 bursts remain unreviewed. Focus and similarity numbers are triage hints, not a selection of the best story. Lightroom Classic 15.6 Assisted Culling can suggest subject/eye focus and eyes-open when supported; a person must inspect bursts, faces, documentary coverage, masks and full-resolution detail. A 25-frame varied-lighting look still requires staff photographic acceptance before mass editing.

At this audit the MSI C: drive had about 27 GB free. Six thousand JPEGs at the observed Staffy average would need about 38 GB for source copies alone. Preflight the exact shoot on an approved private volume or a separately verified office host. GitHub holds reviewed code only; no client media, active index database, credentials or private previews go there. No new editor, subscription, hosting, Pixieset upload or WhatsApp message was created in this work. Incremental cost R0. Nolan PR #862 and production workflows remain untouched.

## Next action

From a fresh company **local Work** PICASSO chat, run `status` on a private index job using the saved 0.3.13 skill. Then visually select a varied 25-frame calibration, grade in Lightroom against exact approved staff references, inspect at 100%, and obtain Amonique's acceptance. Only after that gate should PICASSO expand to same-light groups and benchmark 100 then 1,000 selected edits. Verify the office host and recovery separately.
