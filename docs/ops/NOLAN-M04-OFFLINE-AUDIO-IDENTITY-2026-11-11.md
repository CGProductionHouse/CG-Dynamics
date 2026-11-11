# Nolan M04: Offline recording identity, full-length coverage and actual history guard

**11 November 2026 — Nolan Studio Desktop PC only.** The owner-authorised development queue points to M04. Verified against the shared music history; original 53-family editor, owner decisions, client masters, Katana, MSI and staff desktop applications remain untouched.

## The concrete failure addressed

The already-installed Chromaprint-based `nolan_audio_identity.py` could identify a re-encode or an excerpt within its sampled opening, but its default first-120-second recording fingerprint did not cover an excerpt occurring later in a long recording. A negative result could therefore be mistaken for a complete scan.

New installed operator: `C:\Users\info\Documents\Codex\2026-10-27\n\work\tools\nolan-browser-motion\nolan_audio_windows.py`. It **reuses** the existing pinned fpcalc 1.6.1 executable, local FFmpeg, original-source SHA256, audio identity cache, matching comparator and legacy CSV + media-events history. No new database or background service.

It creates a bounded sequence of 120-second windows with at least 20-second overlap when full coverage is possible. For tracks longer than the eight-window budget, it records the uncovered tail rather than claiming a full screen. Every window records original source hash, exact range, fpcalc schema and cache location. Actual matching returns **RECORDING_MATCH_REVIEW_HOLD**, never music approval. A negative returns **NO_MATCH_IN_SCREENED_WINDOWS_NOT_CLEARANCE**, reports the actual source/history coverage, and cannot waive previous owner exclusions or licences.

## Measured real-source qualification

Existing authorised local Mixkit tracks from the previously rejected Tobich R03 review were used ONLY for an offline technical test; existing rejection statuses were preserved. Two previously downloaded tracks were concatenated privately into a **213.063039 s synthetic diagnostic source** (SHA256 `d718cdb547f91779b2729cb76f1b5bac04f28d8ef63a3bb307c073f66b5f29a6`). No synthetic test is a new client soundtrack.

- A **20-second** excerpt starting at **175 seconds**, re-encoded AAC 64 kbps and gain 0.52, scored **0.588616** against the first-120-second window alone, so the previous approach MISSED it. The new two-window method scored **0.966741**, correctly flagging the same recording.
- A **24-second** excerpt starting at **28 seconds**, re-encoded MP3 64 kbps and gain 0.75, scored **0.975109** and was flagged.
- A different original recording (third Tobich test song) did **not** cross the configured 0.92 similarity threshold.
- The existing real 124.67-second rejected Tobich source, read against live `NOLAN-MUSIC-USE-AND-REJECTIONS.csv` plus `NOLAN-MEDIA-EVENTS.json`, produced a genuine **RECORDING_MATCH_REVIEW_HOLD** and exit code **2**, preserving `OWNER_REJECTED_RECORDING_FINGERPRINTED`.
- The actual history read returned **55 rows**, of which **12 distinct fingerprint-bearing records were compared** and **43 rows lacked usable fingerprint coverage**. This is a real gap: the library is NOT globally screened for unidentified past recordings.

**20 new positive/negative structural tests passed**, in addition to the **9 existing single-window identity tests**. The installed module passed compilation and a live-history probe. Original 1.6.1 fpcalc binary SHA remains pinned by existing installer record; the latest official availability of newer versions is not permission to modify the qualified desktop.

## Limits and no overclaim

This is **recording identity evidence**, not a model that evaluates enjoyable music, emotional compatibility, creative taste or whether two different recordings use similar arrangements. Pitch/tempo alteration, heavily mixed speech/voiceover, mashups and uncertain short excerpts are NOT qualified. The example includes a deliberately assembled track only to test positional robustness. A 0.92 threshold is a test-calibrated decision for these bounded controls, not a universal detection guarantee. Source analysis is local, with **no hosted audio, uploads, subscriptions, trials or licensed music distribution**.

The new operator is installed only on **DESKTOP-M1VHEJF** and can be called explicitly for long or uncertain history candidates. It does not silently change existing music-selection, qualified listening or release gates, and it does not authorise a client release. Existing owner-rejected recordings remain blocked regardless of a fingerprint score. Extend M06 listening separately.

## Reproduction and evidence

Runtime root: `C:\Users\info\Documents\Codex\2026-10-27\n\work\tools\nolan-browser-motion`

- Installed `nolan_audio_windows.py`, SHA256 `8ba00dedc2345e32c4c557c71d41d9b0db9bfa45dcaff416b862a381acee9f85`.
- R&D `overall-development-20261110\m04-windowed-r01\nolan_audio_windows.py`, `test_audio_windows.py`, `qualify_real_audio.py`.
- `M04-UNIT-TESTS.json`: 20 passed. `M04-REAL-AUDIO-QUALIFICATION.json`: independently checked source hashes, first-window failure and multi-window success. `M04-INSTALLED-REAL-HISTORY-CHECK.json`: live existing CSV/event history, real owner-rejected match. Embedded copyrighted audio is **not** part of the source package.
- Private raw FP values remain inside existing `research/audio-identity-cache` only. No sample recordings or their stems should go into Git or public source archives.

Example local call on the authorised PC with a legitimately licensed candidate (use a NEW receipt path each invocation):

```powershell
& 'C:\Users\info\Documents\Codex\2026-10-27\n\work\tools\editor-python\Scripts\python.exe' 'C:\Users\info\Documents\Codex\2026-10-27\n\work\tools\nolan-browser-motion\nolan_audio_windows.py' 'C:\path\to\authorised-original.mp3' --output 'C:\path\to\NEW-M04-HISTORY-SCAN.json'
```

Exit **2** means a recording-identity review hold; exit **0** means the bounded scan found no matching fingerprint, **not** that the song is safe to use. Existing `music_check` and exact-job owner retention rules must still run.

## Completion and continuation

M04 acceptance fulfilled for **offline recording-identity tests**, including real re-encoding, excerpts from later in a song and a negative recording. Do not interpret this as complete historical fingerprint enrichment, art direction, song selection, final mix qualification or a verified end-to-end Premiere handoff.

**Next cursor M05:** inspect curated already-licensed motion assets, account access and source/version/dependency rights WITHOUT scraping Envato or bulk downloads. If account cannot be verified, retain an explicit blocker and proceed with legitimate existing local cataloguing. Preserve the queued director/TikTok/glass studies for their safe milestones, with all nine TikTok picture/sound sources still marked unviewed.

Original Chromaprint documentation: https://acoustid.org/chromaprint ; source CLI options: https://github.com/acoustid/chromaprint/blob/master/src/cmd/fpcalc.cpp . The source's presence is not owner permission to upload music to the AcoustID service.