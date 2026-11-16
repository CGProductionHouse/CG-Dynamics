---
name: nolan-photo-anchored-3d-build
description: Construct a building (home, shop, office) in projected 3D on a real still photo of an empty site, stage by stage, so a viewer sees what the space could become.
---

# Photo-anchored 3D build — owner-liked in the Property Gain listing film

**Use when** a vacant stand, empty room or unbuilt site needs a "what could this be" answer. Each scenario must be logical for the site; flag zoning or approval limits on screen when a use is not already permitted.

**Camera match from one photo:** crop the photo to the frame, then estimate the horizon line `yh` and focal length `f` from two known heights (for example a 1.8 m boundary wall: base and top rows) and an assumed camera height of about 1.5 m. Project a world point with `x = cx + f·X/Z`, `y = yh + f·(camH − Y)/Z`. Wilgehof values were `f=983, yh=767` and `f=1300, yh=745` for the two photos.

**Geometry:** buildings are boxes (footprint, height, yaw) built from faces. Draw back to front by mean depth; draw a face only when its outward normal faces the camera; shade by a fixed sun direction matched to the photo's shadows. Windows, doors, cladding, awnings and signs are quads in face (u, v) coordinates. Text on a facade uses an affine matrix from three projected corners. Interior silhouettes sit on a plane inset behind the glass. Contact shadows are the footprint swept along the sun direction, blurred.

**Staging (about 5 s):** footprint lines draw on the ground → slab → walls rise → glass → roof drops in with a slight overshoot → landscaping pops → warm interior light. Everything is a function of time, so `seek(t)` is exact. [Study code](../../studies/claude-browser-motion-20261111/property-wilgehof/build_timeline.py) (`S4` home, `S5` salon).

**Lessons:** start too big and it crops; set the building back (Z about 17 to 18 m) and angle it (yaw about ±0.3 to 0.5 rad) for a two-point look. Keep text in the empty foreground band, not over the building. Warm window glow at about 30% opacity; stronger turned the glass beige.

**Evidence:** Property Gain Wilgehof R01, "great video, i like it" (CA, 12 November). Stills inspected; silent.
**Open:** this is an illustration, not an architect's design or photoreal render; no native editability.
