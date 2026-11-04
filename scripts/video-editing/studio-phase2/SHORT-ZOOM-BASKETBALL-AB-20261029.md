# Short zoom cuts: portrait basketball source screen and bounded A/B

**29 October 2026, Nolan Studio PC.** This is a silent stock-footage research study, not client work or an approved editing default. The source is [Mixkit #2285, “Basketball player dribbling then dunking”](https://mixkit.co/free-stock-video/basketball-player-dribbling-then-dunking-2285/), labelled with the Mixkit Stock Video Free License on its item page; [the publisher's free-video license](https://mixkit.co/license/modal/videoFree/) permits modification and commercial/social-media use. Local downloaded 720p tier: 3,392,553 bytes, SHA-256 `A4FD4AF14F85A29AB46FB511B885B48FB7D0B0BC64AEF5B2EC6CE0639F6110C7`. `ffprobe` found actual **720 × 1280**, 24000/1001 fps, 270 frames, 11.26125 s. The item's “720p” tier label does not mean landscape orientation; inspect bytes before choosing a crop. The file and derived MP4s stay outside Git.

## Selection

I screened the whole source at twelve-frame intervals, then every frame from 64–95. At source frames 85–87, the ball reaches the centre under the dribbler and the ball, legs, hand and hoop remain in a 1.04× centre crop. The later layup uses a separate camera angle with the subject and rim near opposite edges. A centre punch there loses action geography, so it was rejected for this test. The page description says “dunking”; the sampled end frames show a layup-like approach and release, so the published label is not evidence of a successful dunk.

## Actual output

Private source-specific script `work/research-continue/short-zoom/render_ab.py` maps **source frames 48–143** to each 96-frame, 540 × 960, 24000/1001 fps silent H.264 MP4. The plain control uses scale 1.00 throughout. R01 ramps across output frames 37–39 (source 85–87) to 1.08×, then holds. Protected R02 changes only that later ramp/hold to 1.04×. No frame was repeated or dropped in the intended source map. SHA-256:

| Variant | SHA-256 | Output bytes |
| --- | --- | ---: |
| Plain | `76856ff01ac5d7ef02da3175f57c0171977bec35a41eca3216f00650d0cfbf5e` | 2,128,204 |
| R01 1.08× | `e5e74f1bf7d0026cb64e1be59b684fc5e54e7a3a86a7ac3489be1f4398e7718f` | 2,303,155 |
| R02 1.04× | `76bdf47e75874eb53faac2bd723b5d1c46be1aa15ca8b47d87112d5e9cd76aaf` | 2,321,418 |

I decoded **all 96 frames of all three files** after export. Each has 540 × 960 decoded frames at 23.976 fps, with no black frame by mean-luma threshold. The protected opening (output frames 0–36) is **pixel-identical after decoding** across plain, R01 and R02. Encoder lookahead initially caused slight encoded differences in that prefix despite identical input; disabling lookahead and B frames for this comparison yielded the verified protection. The output-frame 37–39 adjacent mean absolute pixel differences are 7.94/8.99/7.67 for plain, 14.20/15.78/15.02 for R01, and 10.81/12.55/11.90 for R02. These numbers detect the punch; they do not measure appeal. The decoded contact sheet shows the ball, legs and hoop remain visible in R02; R01 feels more abrupt in sampled frames, so R02 is the better bounded candidate.

**Gate remains open.** This source supplies one continuous dribble angle, not a compatible second shot or demonstrated cut between shots. I inspected source and decoded output frames, not actual normal-speed playback on a physical phone. The test is silent, so there is no sound or beat judgment. Do not mark the short-zoom-cut family mastered or use this scale as a client default. Next: select two rights-cleared, directionally compatible original shots with a decisive action peak; compare a plain hard cut with a three-frame keyed zoom at full playback speed and phone size, then verify focal alignment and blur frame by frame. Do not inherit the tutorial's `SHUTTER ANGLE=200` without testing.
