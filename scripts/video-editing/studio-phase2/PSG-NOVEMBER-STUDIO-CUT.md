# PSG November Studio restart — owner-review cut, 25 October 2026

This is the **separate Nolan Studio #872 restart** in draft PR #875. It does not modify Nolan's active Premiere project, the posted October export, the CapCut lane or any source original. The rendered client media and edit script are private, ignored files at `output/psg-872/`; none is committed to Git or sent to a third-party editor.

## Brief and live approval context

The live `CGPH TO DO` assignment specifies a November **crop-insurance** video. Read-only WhatsApp review on 25 October found PSG Marketing approval for the *posted October* “Your Business Grew” film and VIDEO APPROVALS feedback rejecting the later stock-only, fast-cut crop draft: repeated “what changed” question, dated banner titles, obvious reuse of the office/table cluster and too little PSG identity. The October/posting comparison and Nolan's `PUBLISHED-CONTENT-AUDIT.md` were read before source selection. The earlier Studio portrait and `CHANGED?` moving tests remain retired.

The restart's distinct idea is **“Before the first row”**: open through moving planting footage inside the word `BEFORE`, hold the real planting shot, follow the field/work/weather arc, then turn to crop insurance and an animated PSG Insure poster. It uses full-shot breathing room rather than the rejected five-shot rush or a “what changed?” hook. No stock person is represented as PSG staff or a verified local farmer; no coverage, eligibility, payout or premium promise is made.

## Private owner-review package

| Item | Local private path / status |
|---|---|
| 30 s cut | `output/psg-872/PSG-NOVEMBER-STUDIO-OWNER-REVIEW.mp4` — SHA-256 `64c0eb6e4af97932458ca9d95cdff26ca6d85d818fafbe922f51428aed95d463` |
| Cover | `output/psg-872/PSG-NOVEMBER-COVER.jpg` — 1080×1920; checked as a 1080×1080 centre grid crop |
| Caption | `output/psg-872/PSG-NOVEMBER-CAPTION.txt` |
| Repeatable local edit | `output/psg-872/render_november.py`, `make_cover.py`, `render-receipt.json` and per-scene MP4s; edit copy and scene durations there, then rerender. These are **code-editable assets**, not a proven native Premiere/CapCut handover. |

Shot map (30 fps, vertical; source in points are approximate to source-frame precision):

| Film time | Scene / on-screen role | Private source and in/out |
|---|---|---|
| 0.0–2.2 | PSG-colour footage-inside-type `BEFORE` zoom through to the field | Adobe Stock `1553691006`, 0.5–2.7 s |
| 2.2–5.8 | Planting tractor; “THE FIRST ROW ISN'T THE FIRST DECISION.” | same source, 2.7–6.3 s; continuous action across reveal |
| 5.8–10.5 | High field geometry; “EVERY SEASON STARTS WITH A PLAN.” | Adobe Stock `802755080`, 1.0–5.7 s |
| 10.5–15.2 | Hand through wheat; value of the work | Adobe Stock `815213130`, 1.0–5.7 s |
| 15.2–19.7 | Grain field under weather; timing of risk | Adobe Stock `518406931`, 1.7–6.2 s |
| 19.7–24.0 | Farmer checking field; crop-insurance turn | Adobe Stock `210329647`, 1.0–5.3 s |
| 24.0–30.0 | Moving PSG Insure brand plaque, action and office number | client-supplied `PSG_Insure_2026_Canva_Logo.png`; original poster animation |

Adobe Stock footage above was already recorded by Nolan's `PUBLISHED-CONTENT-AUDIT.md` as licensed from Adobe's free collection for this November job and absent from the eight audited PSG published exports. The rejected *unpublished* Nolan November cut used this licensed source pool too; its story, title graphics, edit and music were not imported. Mixkit's **Sun and His Daughter** by Eugenio Mininni is `https://assets.mixkit.co/music/580/580.mp3`, used from 14–44 s under the [stock music free licence](https://mixkit.co/license/modal/musicFree/). The quiet opening cue reuses `SFX_Flying_Swoosh_1469.wav`; its exact SHA-256 matches the [Mixkit-hosted file](https://assets.mixkit.co/active_storage/sfx/1469/1469.wav), under the [sound-effects free licence](https://mixkit.co/license/#sfxFree). Nothing was purchased or generated with credits.

The local office number **051 813 9300** and Donald Murray/Bloemfontein location were checked against PSG's current [official adviser profile](https://advisers.psg.co.za/financial-advice/adviser-profile/louise-pretorius). The profile supports the office route, not a claim about exact crop policy terms. The staff assignment supplies the crop-insurance topic; screen/caption copy asks for a conversation only.

## Checks witnessed, and limits

- The final MP4 is H.264/AAC stereo, **1080×1920, 30 fps, exactly 30.000 seconds**. Full FFmpeg decode completed without error. The source and edit script are preserved locally; original projects and footage were not modified.
- Frames at each edit and the first 2.4 seconds were inspected. A first end-card version was rejected in this pass because a 16:9 PSG animation floated as a rectangle in the vertical frame; it was replaced by the client-supplied PSG **Insure** plaque. The cover's central grid crop was inspected.
- Measured audio is **−16.62 LUFS integrated**, **−5.26 dB true peak**, **2.00 LU LRA**. There was no detected silence ≥0.2 s below −50 dB. Stereo is 48 kHz; a mono fold measured about −20.04 LUFS and −5.82 dBTP. These are technical checks, **not a heard creative or phone playback approval**. The source Adobe shots have no usable camera sound except one unselected clip, so the cut has music plus one low, motivated reveal cue, not a fabricated farm ambience.
- The visual crop is a deliberate vertical composition with no cutout or floating mask edge. The initial footage-inside-type uses a title aperture and then reveals the actual full planting frame; it is the correct family of the owner's Solid Coast reference, not a person-behind-text claim.
- **Still unverified:** normal-speed full-video and headphone/phone assessment by an independent editor; native staff-editable project; exact PSG crop product wording/CTA signoff; client approval and publication. The archive did not yield a fresh, contextually appropriate PSG staff *moving shot*: October office cluster, July outdoor adviser setup, 2024 vehicles/aircraft, January race, April donation and July event vendors/band were excluded. This cut substitutes a moving PSG-owned branded poster. It must not be represented as a witnessed staff-person film or release master.

The next edit decision is an independent full-speed picture/sound review. If the owner specifically wants a PSG staff member on screen, commission or obtain a current, approved PSG adviser video in an insurance setting and replace the illustrative field/adviser beat; no unrelated archive person should be inserted merely to satisfy a logo/person quota. Keep PR #875 draft and the film private until these gates pass.
