---
name: nolan-stacked-reaction-panels
description: Compare one shared wide action with larger synchronous reaction panels in a vertical frame, then return to context.
---

# Stacked reaction panels — real-footage visual candidate

**Owner reference:** The [panel example in the newer tutorial intake](../../NEW-REFERENCE-INTAKE-20261027.md) shows separate scenes arranged in glowing panels. Its exact geometry, timings and sound were not established from the muted reference. This bounded adaptation solves a specific CG editing problem: a horizontal two-person exchange becomes too small in a vertical phone frame. It uses restrained framed crops; no bought panel preset, synthetic glow or copied tutorial asset is involved.

**Source:** [Mixkit #41225](https://mixkit.co/free-stock-video/two-young-friends-laughing-and-fooling-around-in-a-coffee-41225/) explicitly permits commercial use under its Stock Video Free License. The private local 1280×720, 24 fps original has SHA-256 `28D499C55C9FA1E50920BA51028262669A5762FFD98E8B5AE12D1D828727C5D5` and no audio stream. This is practice stock, not Daisy client footage or a client deliverable. The two crops are from **the same source frame at the same time**, so their reactions cannot drift or imply a false simultaneous shoot.

**A/B:** Run `py render_ab.py`. It checks the original hash and writes 2.500-second, mute 720×1280 `plain-context.mp4` and `faces-then-context.mp4`, plus full-size and reduced contacts, privately in `C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\stacked-reaction-panels-20261027`. Both select original source 4.2–6.7 s. The plain control keeps a 720×405 complete wide at frame center. The candidate starts with two larger framed face crops (left person above, right below) and reveals the same moving shared wide at output frame 29. It does not change time or invent a second location.

**Observed decision:** Both MP4s fully decode. At 270×480, the first 29 candidate frames make both facial reactions larger and separately readable; the plain wide preserves the table, drinks and shared gesture but makes both faces small. The candidate's return to the wide restores that missing context and gives the layout a reason to exist. Full-size frame 24 has complete heads and grounded rectangular panel edges; it does not float a cutout person. A first tighter crop left too much empty lower space and was replaced with 500-pixel-high panels. The result is a **promising source-specific visual treatment**, not a universal panel preset. It would be wrong where the shared object/table matters from the first frame or where the two cropped people are from unrelated shoots.

**Open gate:** The contact sheet and decoder do not establish normal-speed rhythm, comfort, brand typography, licensed cue or staff editability. The practice source has no sound, and no sound was added. Test the reveal at a real music event in a protected edit, keep the source and two panel crops as independently adjustable native layers, then let an independent editor judge full-speed picture and sound on a phone. Do not claim the stock setting is a client's cafe or that this proves the tutorial's separate glowing-panel design.
