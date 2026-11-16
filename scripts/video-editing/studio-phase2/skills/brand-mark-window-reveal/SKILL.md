---
name: nolan-brand-mark-window-reveal
description: Open a film by drawing the client's logo shape as an outline, then growing one part of it into the window that reveals the hero picture.
---

# Brand-mark window reveal — owner-liked opening, Property Gain listing film

**Use when** the logo has a simple, recognisable outline (Property Gain's three houses; a pin, a shield, a monogram) and the first picture is the subject (a stand, a product, a venue). It works as a 1 to 2 second hook into the question.

**Construction:** draw the logo's strokes with `stroke-dasharray` on `pathLength=1` (0 to 0.95 s), staggered, in the logo's own colours. Then scale the lead shape from logo size to beyond the frame (about 1.0 to 2.05 s, ease in-out) while the same polygon clips the hero photo (`clip-path: polygon()`, closed), and the other strokes fade. Push the photo from 1.18× to 1.0× during the reveal. Bring the question in at about 1.6 s over a lower gradient. See `S1` in the [study code](../../studies/claude-browser-motion-20261111/property-wilgehof/build_timeline.py).

**Lessons:** close the polygon. An open bottom made a tall photo column that looked like a mistake in the first test. Hide round line-caps at zero progress or a stray dot appears.

**Evidence:** Wilgehof R01 opening ("WHAT WOULD YOU / use this space / FOR?"), liked by CA. Not used on another client yet. It needs a verified logo shape; never redraw a client mark loosely.
