---
name: nolan-metallic-type-material
description: Compare flat gold lettering with a controlled internal bevel and subtle weathering using the same editable wording, font and glyph alpha.
---

# Gold lettering material — original A/B, not a template extraction

28 October2026. The [Wanderlust reference](../../WANDERLUST-DIARIES-STUDY-20261028.md) opens with compact gold dimensional display type. Its later large blue/gold distressed words behind a man are a **different** treatment; this card does not claim to reproduce that depth matte, font, preset or creator asset.

`python render_ab.py --output-dir OUTPUT_DIR` generates wholly original fictional `EXPLORE / MORE` lettering using the existing SIL-OFL Space Grotesk font, Pillow/OpenCV/NumPy and FFmpeg. Both90-frame,3s540×960/30fps silent versions use identical wording, placement and8-frame fade. The variant derives an internal3px bevel from the glyph distance field, lights its normal map, adds subtle band reflectance and seeded material pitting. There is no black outline or imported texture; changes stay inside the glyph alpha. Separate title-mask and material-layer PNGs plus the recipe are preserved for retuning; this is raster material, not native editable editor text.

Portable original outputs: [flat control](proof/flat.mp4), [revised material](proof/material.mp4), [full/phone contact](proof/contact.jpg). Flat SHA2561b968c85f1167d0f06b58259a8b6ba6701e62b1054de0ed43a0069f17ebea2aa; revised material1ad83238da2ae96aa11f0bdb33ca11d8a06762eb86367756d206686ec8e932e8. Both fully decode; pre-encode changed pixels outside glyph alpha=0.

**Rejected first pass:** pitting strength110 and darker reflectance made the letters look dirty/bronze at reduced size. Preserved privately as `material-rejected-heavy-pitting.mp4`, SHA2561556629c9bcbd42d864745ed11123a8bcc8fde0ef077ab70063e6582b7d03fe2. The revision reduces pitting to35, lifts base reflectance and adds a small specular term; inspected lettering now reads as cleaner gold with a visible internal edge at full and reduced size. This is a visual construction result, not full-speed/physical-phone, sound, client-brand or native editing acceptance.

Use only when approved typography/palette and the story justify material lettering. Do not replace established PSG/Daisy brand treatment with gold or texture. A global shine sweep was already tested separately; this proof isolates material, not another mandatory shine preset. Current next gate: controlled native title/material layers, save/reopen/export and a cleared real-scene readability comparison. **Tested raster candidate; mastered NO.**
