# Fight trailer end button: synthetic placement A/B

**Scope:** out-of-sequence scene 7 geometry exercise. Scene 4's pressure pocket needs real camera/ring audio, and the event footage was not available at the last documented folder check. These two 2-second videos contain no event footage, music, sound design, approved event logo or release claim.

Run `python render_fight_title_safe.py`. It uses the already-bundled Space Grotesk OFL font and Pillow/FFmpeg. Both 1080×1920/24 fps outputs have the same generic copy, colours and 8-frame entrance; only vertical placement differs. [Contained placement](proof-fight-title-contained.mp4) holds its lowest letter around y=1490 of 1920; [low placement](proof-fight-title-unsafe.mp4) runs almost to the bottom. The [side-by-side 270×480 reduction](proof-fight-title-phone-comparison.png) visibly shows the low version crowding the bottom edge, while the contained version remains easier to scan. This is a design comparison, **not** a measured platform safe-zone or in-app overlay test.

| Output | SHA-256 |
|---|---|
| Contained | `579d6f4042c21a1701feb7927db72186ac65deb16114c42d33ea6d2743cb6b4c` |
| Low | `719a06013428454676d68990ae9a3bf2347cb88465ab960c0d` |

The contained file was fully decoded by FFmpeg and probed at 48 frames/2.000 s, H.264 1080×1920 without audio. The comparison PNG was visually inspected at its native phone-scale resolution. Neither version has been watched at normal speed on a physical phone or inside a social app. The work does not prove an editor-editable title or an end button suitable for delivery. A static backdrop leaves too much empty space for a final high-energy fight trailer; a real end frame must be composed against the selected event shot or approved graphic.

**Next gate:** obtain approved event naming, logo, message and target destinations; inspect the actual app UI overlays and current delivery specs; place the title over the chosen closing picture; then test 30-second trailer rhythm, physical-phone view and native/staff-editable source. Keep the low placement only as a negative control.
