---
name: source-led-fire-flicker
description: Use source-motivated fire wipes and brief action flickers where the visible action supports them, with source rights and exact sound checks.
---

# Source-led fire wipe and fast flicker

**Stage:** used in an internal EHP R13 review cut; full-speed creative approval pending. This card is shared through PR #875 for MSI and office PC. Do not call it a mastered template or apply it to every cut.

## Use when

The flame has a narrative cause and destination, such as EHP's real prepared meat leading into an illustrative hot pan. A flicker should punctuate a visible blade, impact, shutter or motion change. Never insert repeated standalone fire shots to make ordinary footage seem energetic. Do not use full-frame white flashing or rapid flicker over a face merely for novelty; check readability and viewer comfort.

## Bounded implementation

`../../ehrlich-november/render_r13.py` contains the tested private recipe. `make_heat_transition` uses 12 frames of a licensed flame's luminance to perturb a left-to-right boundary between the real shop display and the pan, with a narrow blend edge. The flame is a modulation source, not an unrelated inserted cutaway. `make_flicker` uses six consecutive moving saw frames: two high-contrast monochrome frames and one restrained warm exposure frame. Motion continuity prevents a freeze/teleport. Place quiet whoosh peaks at the visible boundary; carry a food sizzle with lead and tail fades across neighboring shots. Return to the real client picture after the cooking illustration.

## Review gate and evidence

Inspect all frames around the incoming/outgoing effect at full resolution, then play the whole sequence at normal speed with sound on a phone and headphones/speakers. Check the subject remains legible, no clipped whites/black frames, no unmotivated repeated fire, no abrupt sound start/stop, and whether the cut lands on a real music beat. The EHP R13 contact sheets and 22.9-second full export were inspected visually and fully decoded; −15.7 LUFS and −2.3 dBFS true peak were measured. **The audio was not perceptually heard by this agent.** The owner-linked TikTok page metadata was found, but its exact effect frames and sound were inaccessible, so this is a tested original treatment of the requested idea rather than an exact tutorial reproduction. Public release and reusable-skill promotion require the independent creative review.
