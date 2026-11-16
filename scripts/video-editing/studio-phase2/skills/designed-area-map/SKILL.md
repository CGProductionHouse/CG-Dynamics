---
name: nolan-designed-area-map
description: Draw a branded, animated area map from real OpenStreetMap street geometry, with true-direction landmark callouts and honest distances, instead of a Google Maps screenshot.
---

# Designed area map — owner-liked in the Property Gain listing film

**Use when** a location matters (property, branch, venue). Never screenshot Google Maps; never invent a street layout.

**Data:** OpenStreetMap via the Overpass API: `way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified"](bbox); out geom;` plus named landmarks with `out center`. Centre on the suburb's OSM place node and cross-check it against published distances. The Wikipedia coordinate for Wilgehof was about 1.3 km off. Project equirectangularly around the centre (`x = (lon−lon0)·111320·cos(lat0)·k`, `y = −(lat−lat0)·110540·k`), simplify (RDP about 1 to 2 px) and keep only what falls in the map circle. Attribution: "Map: OpenStreetMap streets" on screen and © OpenStreetMap contributors (ODbL) in the receipt.

**Access note:** the cloud shell cannot reach Overpass. The public server is often busy (HTTP 502). The working route was the company Chrome on overpass-api.de: fetch, simplify and delta-encode inside the page, then read it out in chunks of under 1,000 characters. See [mapdata.py](../../studies/claude-browser-motion-20261111/property-wilgehof/mapdata.py) and the study README.

**Design:** north-up disc with a tick ring and an "N" marker; streets drawn on with `pathLength=1` dash animation by class (motorway white, primary red, tertiary silver, residential navy); pulse pin and a suburb chip at the centre. Landmarks beyond the disc are glass chips whose leader lines start at the ring in their **true compass direction**. Place chips by hand so they do not collide. Label distances "±x km", straight line, with a small "approximate" note.

**Evidence:** Wilgehof R01 (CA: "great video, i like it"). Landmarks used: Wilgehof Primary ±0.4, Willows Centre ±1.3, Mimosa Mall ±2.5, Life Rosepark Hospital ±2.7, Fleurdal Mall ±3.1, University of the Free State ±3.3 km.
**Open:** driving distances and times were not computed; OSM completeness varies by suburb.
