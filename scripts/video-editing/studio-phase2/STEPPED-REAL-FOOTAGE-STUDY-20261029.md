# Stepped object motion: real-footage timing screen

**29 October 2026, Nolan Studio PC.** This is a silent research A/B using stock footage, not physical stop-motion capture or a client edit. Source screening rejected [Mixkit #49904, close chess board](https://mixkit.co/free-stock-video/chess-game-in-a-close-view-of-the-board-49904/): the camera reframes downward while a chess piece is moved, so repeating frames would step the whole camera move. The second source, [Mixkit #42196, girl playing with Lego](https://mixkit.co/free-stock-video/little-girl-playing-with-her-legos-42196/), is listed under the Stock Video Free License for commercial or personal use. The publisher's [free video license](https://mixkit.co/license/modal/videoFree/) permits modification and commercial/social-media use. The 720p-tier download is actually 720 × 1280, 24000/1001 fps, 279 frames, 11.636625 s; SHA-256 `6B9ABFB25AD64200D32AE07F4A5B84991C47B2E97735D34E4C17D03BCA00518C`. Stock media and derived outputs stay outside Git.

## Controlled comparison

The camera remains materially steadier than the chess shot across the sampled sequence. I mapped original source frames 96–191 to 96 output frames at 540 × 960 and 24000/1001 fps. The **plain** control uses every source frame. **R01** repeats each source frame for two output frames. **Protected R02** keeps R01's first 48 frames, then repeats each source frame for four output frames. The private render and inspection scripts plus receipts are in `work/research-continue/stepped-object/` in the office workspace.

| Output | SHA-256 | Bytes |
| --- | --- | ---: |
| Plain | `01e25ea201e384f0a49b70ca9d50ca4bbb9c8a35770d23b300c399b766720b2e` | 1,600,671 |
| Two-frame R01 | `3e07845181b4ed20bb97556ca4b10e42cf5684dfb6da910e114ce87f1456ab33` | 1,551,645 |
| R02, later four-frame holds | `88f2facf3a939cd947d51fa8759e406ec5eef8f7e20c181d3b857640cfc83242` | 1,580,040 |

All three files fully decode to 96 frames at the intended resolution and frame rate, with no black frame at mean-luma threshold 8. After H.264 encoding, no adjacent decoded pair is **bit-identical**, even when the input was held. Using mean absolute decoded pixel difference <1 as a practical near-hold diagnostic gives 0/95 pairs for plain, 48/95 for R01 and 60/95 for R02. R01 and R02 decode **pixel-identically for all 48 protected opening frames**; the later section differs. The decoded contact sheet at frames 0, 23–24, 47–52, 60, 72 and 95 shows the hand holding the yellow Lego vehicle while the green vehicle remains on the tabletop.

**Gate remains open.** Because the child's hand and expression move with the object, stepped playback reads as a held filmed action, not a self-moving object photographed between takes. The four-frame change is less smooth in the source map, but I have not viewed this at normal speed or on a physical phone and cannot claim a creative preference. There is no original location sound in the exports and no sound audition. The next valid test requires an actual fixed-camera series of original object positions with a stable exposure and physical contact/shadow, followed by normal-speed phone and sound review and editable application handover. Do not describe this stock-footage test as physical stop motion.
