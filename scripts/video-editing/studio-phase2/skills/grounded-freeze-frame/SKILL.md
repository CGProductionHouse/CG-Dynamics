# Grounded moving-background freeze — source-specific rejection

27 October 2026. The owner's [freeze-frame reference](https://www.tiktok.com/@gakulange/video/7519106258394303765) shows an actor held while the surrounding scene continues. The actor must keep a believable frame/floor connection. This card records a **failed real-footage A/B**, not a mastered effect or client-ready preset.

## Source and bounded test

- Private Mixkit #1252 original, 720 × 1280, 421 frames at 24000/1001 fps, SHA-256 `3EC4C2AD8F277F41D30F2226DE4F1596161F2DB545DEFA7D2610122FED2A5E56`. Licence/source context is in [the earlier object-mask screen](../../NATURAL-OBJECT-MASK-20261026.md). The person's legs meet the bottom frame edge in the original.
- Reused that screen's t=4.0 s GrabCut matte, SHA-256 `9459B47BE62B781B8D7C4264690A1350D4CB937E711E2732CCAF346C0C87C994`. [The bounded renderer](render_stock_ab.py) verifies both hashes and exports one-second, 24 fps `normal.mp4` and `freeze.mp4` privately in `C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\freeze-frame-20261027`. No source or rendered media enters Git.
- Control keeps the source moving from 3.75 s. Candidate holds the t=4.0 s subject from output frame 6 while the original cyc colour changes. A broad polynomial colour plate replaced an initial row-copy plate that created a conspicuous horizontal stripe. Both second-pass MP4s decode at 720 × 1280, 24 fps, 1.000 s. Frame-domain measurement between candidate frames 11 and 17: mean absolute change 0.025 in a selected subject interior versus 10.891 at the right background edge. These numbers establish only that the attempted freeze happened.

## Visual decision

**Reject.** Full-size frame 15 reveals a severed left shoulder, a missing forearm/hand, a false red shoulder silhouette and visible colour/edge contamination around the body. The person's legs still connect to the lower frame edge, but that alone does not repair the damaged silhouette. The contact sheet at thumbnail size concealed these defects. The initial plate's horizontal stripe was repaired; the matte failure remains. No sound was present in this stock source, and no normal-speed human/phone audition or native-editor editability test was performed.

Next gate: choose a source shot whose plain frame has a clean subject/background separation and real floor or frame-edge contact. Test one representative full-size held frame **before** rendering a timeline; check hair, hands, shadow, object continuity and entrance/exit, then compare against the unaltered shot at full speed. Do not promote a synthetic freeze or automated mask metric to a real-footage approval. Do not expand this rejected GrabCut mask into a general segmentation system.
