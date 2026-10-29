# Same-take glove pass cannot hide a time jump — office background screen, 29 October 2026

This is a **negative screen** of the existing fight-foreground-handoff family, not a client Fight edit, an event trailer or an approved transition. Command-line work only; no visible editor/GUI, paid/API service, MSI client amendment, Central Canvas change, storage worker or WhatsApp send.

## Source rights and cut truth

[Mixkit #40974](https://mixkit.co/free-stock-video/two-men-on-a-ring-fighting-in-a-boxing-match-40974/) marks the stock clip as available for commercial/personal use under its Stock Video Free License. The pinned upright original is SHA-256 `938bba8c5c586d700be40e2cabf628713dcc440caefb931d8229d1e99f1ce634`, 720×1280, 24000/1001 fps, 336 decoded frames, without source audio. A source contact covers frames160–256 at four-frame intervals. It shows the blue glove crossing the left/centre foreground around172–184 while the red-gloved opponent's head, shoulder and guard remain visible at right. This remains one stock bout; it is **not** verified event contact or a client moment.

Three 72-frame outputs use source frame160 as the opening. The uncut control maps output0–71 to source160–231. Early-jump R01 maps output0–11 to source160–171, then omits source172–187 and resumes at188. Glove-jump R02 protects R01's first12 decoded frames exactly, maps output0–19 to source160–179, then omits source180–195 and resumes at196. Both skips are **deliberate 16-frame time discontinuities**, not speed ramps, alternate cameras or a continuous exchange. No synthetic blur or mask conceals them.

## Actual output and motion inspection

All three private H.264 outputs fully decode to72 frames at the original frame rate and dimensions, one video/no audio; every adjacent pair changes. Full-size R01 frames11/12 and R02 frames19/20/21, plus ordered output contacts and R02 frames17–23 at180×320, were inspected. The blue glove crosses part of the lower left, but the opponent's face/guard and the red glove remain exposed at both cuts. R02's cut from source179 to196 visibly jumps their pose and the blue glove location. Waiting for this foreground position does **not** hide the temporal skip.

For a bounded diagnostic, decoded RGB mean absolute difference in visible-opponent ROI x520–719/y280–779 is33.694 at R01's cut and32.208 at R02's cut, against respective median adjacent ROI differences7.893 and7.952. Whole-frame cut differences are30.244 and30.206, against medians6.861 and7.006. These are discontinuity proxies, not a human comfort score or full-speed verdict. The uncut output's same-index ROI change is5.426. R02 changes the cut timing while keeping12/12 opening frames intact; it does not repair the story/continuity failure.

| Private output | SHA-256 | Decision |
|---|---|---|
| `uncut.mp4` | `d05e0da399467d6f6c56774d3a0f7aad0ae029dc27798527edd891762a4cfdfc` | Honest same-take control; preferred. |
| `early-jump-r01.mp4` | `1a0eccb460edae97d999f18db05e493d659cb79e1b76544187e970ed31fe621c` | Visible time jump before stronger glove coverage. |
| `glove-jump-r02.mp4` | `2d214827b8066faba9bd09e0e4ba791b290e484b2813cde6b30cd5f16510c9ae` | Protected later timing, still a visible time jump; rejected. |

Private source reference, render/QA scripts, outputs and frame contacts are at `work/research-continue/fight-glove-same-take`; no media is committed. A real event handoff needs verified chronology, full-frame or sufficiently covering natural motion, original camera sound, normal-speed/physical-phone viewing and staff-editable handover. Do not use a glove as permission to alter the event order. **Mastered: no.**
