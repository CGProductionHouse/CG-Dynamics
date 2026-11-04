# Footage-in-type contrast control — 4 November 2026

Status: **readability repair, hook rejected**. This is a silent rights-cleared practice test, not a client video or a native editor handover. The encoded controls, contacts and receipts are private at `C:\Users\chris\Videos\CG-AI-Editing\Nolan-Office-Skill-Transfer-20261028\skill-proof-aperture-20261104`; source media is outside Git.

## Why this test

The earlier [shared operator controls](PORTABLE-TYPE-OPERATORS-20261103.md) made a moving coffee source visible through `POUR` on a dark matte, but the already dark source produced almost invisible letters. The question here is narrow: can matte contrast fix *word readability*, and does that make the aperture a useful opening? The existing Mixkit coffee #41865 original, SHA-256 `883b71655e2f2448a03b02f6e318eced58b51bac5b74da86c018995f3c817331`, and its documented Free Video License are unchanged. No TikTok picture, audio, client media, paid asset or new plugin was used.

## Controlled comparison

`render_shared_controls.py` now accepts an explicit six-digit `--background-hex` while retaining the original `0A141C` default. It uses the **same** moving source frames, `POUR` glyph, pivot, 72-frame timing and existing `text_aperture` operator. New matte controls are pale ivory `F5F0E4` and muted warm `B7A892`; the prior dark aperture and an unchanged full-picture/plain title are the controls. The plain output SHA-256 is identical between the prior run and the new mid-matte run: `F2C25A3E6F0134B0572DD630214C217EE06C88956098C3822D3BF349B599BAC7`.

Both new sets comprise 72 frames at 540×960/24 fps; the script's four modes decode fully. The aperture becomes the exact full source picture from frame 45. The light-aperture MP4 SHA-256 is `B550DAA18B281F3D04A4E9833A2126D3A89C5794451ADED103AB43CFCE3CDEAC`; mid-aperture is `59F32D75D8B79AAEC6B670C81B87F1D0DF456C66330370D8336A8E5BBDF42A5F`. A 270×480 side-by-side contact of frames 0, 18, 36, 60 and 71 was inspected, alongside the mid candidate's full comparison contact.

The pale and mid mattes make the opening word visibly readable, unlike the dark original. They do **not** restore the missing action during the first second: the viewer sees a typographic aperture instead of the nozzle, coffee stream and cup. At frame 36, the expanding matte remains a conspicuous light field against dark coffee footage. The plain shot communicates the action immediately, and the flat title retains that picture while adding copy. **Reject matte-colour-only repair as a client hook.** A better test would need a source whose meaningful subject/action is visible *inside* the chosen glyphs early, plus a story reason to withhold the wider view. Do not repeat the same coffee asset with more colour tweaks.

Normal-speed motion, actual phone playback, sound-to-picture, native editable text and audience retention remain unverified. No production export was changed or sent.
