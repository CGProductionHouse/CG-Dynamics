# Nolan technique lab — evidence-led shortlist, not a parallel editing backlog
**As of 22 October 2026. Status of every row below: proposed unless explicitly documented as verified in PR #862.** This is a small, prioritised library of hypotheses for real CG projects. Don't instruct a running Nolan session or install software from this file. Read current #856/#862 and PR #859 for fresh state; this document cannot overrule ongoing production or client instructions.

## What earns a new test?

A new technique deserves editor time when: **(a)** the real current video has a named creative problem; **(b)** an appropriate licensed source/reference exists; **(c)** the host route and fallback are understood; **(d)** one short controlled application could improve the reviewable result. Otherwise archive it as “discovered” and leave it alone.

| Rank | Candidate / existing tutorial | Client problem it could solve | Cheapest current implementation | Proof / stop condition |
| --- | --- | --- | --- | --- |
| **1 — real Emoya cut** | **Match-on-action at putting contact**; [Jordan Orme screen continuity](https://www.tiktok.com/@jordanorme/video/7548901333928086815), PR #859 moment playbook | Existing sequence makes the viewer wait, repeats pre-impact action. | Inspect both moving genuine camera angles. Cut view A on frames immediately before contact → compatible view B at the strike. Align real contact sound or licensed equivalent in isolated SFX lane. Native clip in/out edits; no new plugin. | Before/after full-motion **with sound**, no duplicated/missing golf-ball impact, direction/ball placement consistent. If footage doesn't match, use tighter single view; never invent a fake match. |
| **2 — real Emoya title fix** | Punctuation cleanup + controlled readable type reveal; [Adrian Per pop-up](https://www.tiktok.com/@omgadrian/video/7622560596340362509) | Staff doesn't like odd terminal full stops; titles need polished motion. | Existing known-good CEP text edits with **exposed MOGRT font/size/colour**, native opacity/Scale/Crop easing. Fix only owner-specified punctuation; use fitting brand fonts and logo after verification. | Text readable in actual exported **early/mid/late** frames, no overflow/off-frame or invented brand design. The 12s tech preview from #862 isn't finished client QA. |
| **3 — real Emoya emotional beat** | [Yu-Yen rush–release](https://www.tiktok.com/@yuyenwng/video/7631341066553167126), CG sound playbook | A competent sequence currently feels basic and lacks contrast/enthusiasm. | Group *distinct* action/details into short intentional opening, follow with meaningful held result; genuine audio attack/SFX decays followed by score phrase. Existing UXP 4K sequence and separate SFX tracks proven on a practice copy. | Viewer knows where/what/why; no black frames, no sonic stop/start artifact; watch both with sound; accept only if clearer and more exciting than simple cut. |
| **4 — sports/kinetic** | Motion-matched fast cuts, [Miracamp three-frame zooms](https://www.tiktok.com/@miracampschool/video/7504014296779590935) | Energise an actual action without incoherence. | Native Scale/Position/Opacity keys and source frame plan; existing leancoderkavy UXP verified effect and keys. Keep screen direction and visual anchor. | Motion readback **plus full render**; readable at phone size. 3–6 frame guideline is merely a source tutorial feature, not a mandatory recipe. |
| **5 — premium location/product** | [Fotober spatial progression](https://www.tiktok.com/@fotober/video/7620202358504574239) and [Arthur match anchor](https://www.tiktok.com/@iam_arthur7/video/7394863028220513579) | Make different rooms/services feel coherent and deliberate. | Select linked camera directions, honest space route, cut on strong matching subject/action. No plugin. | No fictitious same-location implication, no awkward crop/brand sign cutoff; reviewer can describe the visual progression without a caption. |
| **6 — foreground title** | [Harrison Niap foreground reveal](https://www.tiktok.com/@harrisonniap/video/7645324681960017170) | One special hero word could belong within the scene, behind a moving object/person. | **Only if approved stable-host mask path exists**; otherwise use manually reviewed mask/alpha composite with exact source and editable title preserved. Adobe [Object Mask documentation](https://helpx.adobe.com/premiere/desktop/add-video-effects/work-with-masks/object-masking.html) describes AI isolate/track but does **not** prove agent authoring on Premiere 26.3.2. | Mask edges through full motion, no clipping/synthetic artifacts; if cannot prove native editable shape, defer. |
| **7 — sports action ramp** | [Miracamp speed ramp](https://www.tiktok.com/@miracampschool/video/7540770684838956310) | Accelerate anticipation into a deliberate slow/held payoff. | Native variable Time Remapping is **not** demonstrated over MCP on installed host. Existing practice 50→25 fps interpretation is *uniform* slow motion, not a variable speed curve. Use real high-fps interpreted insert or supervised Premiere UI only when worth the intervention. | Exposed source fps and motion, full moving render and optical-flow edge QA; do not call pre-rendered speed curve native editable. |
| **8 — optional footage retrieval** | [Jumper agent footage search](https://getjumper.io/ai-agents/premiere-pro), [Adobe built-in local Media Intelligence](https://helpx.adobe.com/premiere/desktop/organize-media/file-organization/media-intelligence-and-search-panel.html) | Find “golf putter makes contact”, best human reactions, clean signage among dozens of 4K takes. | First use existing source ledger, Adobe installed search UI and/or indexed sidecars. Jumper agent callable only after separately approved license/privacy evaluation + isolated test. | **Correct exact original/timecode and actual moving action**, not only semantic screenshot similarity; measure time saved vs manual screening. |
| **9 — optional generated insert** | [Higgsfield Premiere](https://higgsfield.ai/plugins/premiere-pro) / Adobe Firefly | Need a legally allowed background removal, reframe or tiny missing shot handle. | Only after explicit client/cloud/credit approval and strong need. Result as *generated footage* in native Premiere timeline; keep source provenance. | Inspect artifacts and licensing/brand truth. No manufactured client project evidence or silently fabricated real action. |
| **10 — optional CapCut comparison** | [CapCut Auto Cut](https://www.capcut.com/help/auto-cut-in-capcut) / [pyCapCut](https://github.com/GuanYixuan/pyCapCut) | Could a simple staff-only social montage be assembled faster outside Premiere? | In a later non-client or permission-cleared 4K test, compare native CapCut desktop Auto Cut to a clean Premiere baseline. No draft-JSON mutation of active client project; unofficial API tests stay disposable. | Same input, actual editable handoff/export, colour/music/licence retention, tokens+review cost, no missing frames; revert if worse. |

## Learning evidence cards (sample contrast)

### Discovering a tutorial does not mean reproducing it
- [44-video CG TikTok collection already indexed in #859](https://github.com/CGProductionHouse/CG-Dynamics/blob/codex/cg-video-editing-craft/.agents/skills/cg-video-story-editor/references/reference-to-technique-study.md): 44 visually sampled at selected points, **none certified with sound**, none yet certified as directly reproduced from that research set. Mark source audio claims untested.
- [Latest #862 native craft proof](https://github.com/CGProductionHouse/CG-Dynamics/pull/862) demonstrated editable native title/flash/effects/12-second 4K practice footage. That is **host-implemented**, not “CG-approved premium commercial.”
- [UXP 1.24.3 installation receipt](https://github.com/CGProductionHouse/CG-Dynamics/blob/docs/nolan-autonomous-editor-game-plan-20261021/scripts/video-editing/ISOLATED-UXP-1243-ACCEPTANCE.md) proves bounded native effects/keyframes; new MCP is not a universal mask/speed-ramp path and its readback wrapper has known defects.
- [Higgsfield Premiere](https://higgsfield.ai/plugins/premiere-pro): vendor demonstration of compositing, **not** a Nolan-rendered accepted CG before/after.
- [CapCut draft MCP examples](https://github.com/LHenri88/capcut-mcp): community README, **not** a sanctioned public CapCut automation interface nor MSI test.

## Small test receipt for each *actual* video change

```text
Client and exact authorised content run:
Owner's creative objective / approved feedback:
Original problem and timecode:
Technique selected + viewer reason (not merely effect name):
Source clips + decisive timecodes/fps/rights [private client record]:
Reference URL + seen/heard/tested depth:
Clean-cut fallback:
Actual Premiere mechanism / plugin version / API & any Computer Use:
Edit status: discovered | host-implemented | creatively-proven | repeatable
Readback evidence + 4K output + full-motion/audio/phone review:
Owner/staff feedback (exact wording stored privately):
Keep/reject and reason; reusable principle; when NOT to use again:
Time/tokens + retries including setup and render (when measured):
Known hazard / negative test / expiry date for changing tool versions:
```

**Write generic reusable principles to the shared skill only after genuine proof.** Client identities, project paths, upload links, logs, raw footage, account credentials, private staff feedback and unpublished business claims stay in authorised client storage, never this repository. Record precise source/time ranges there so Nolan can avoid replaying a bad clip. Put test failures next to passes so future agents cannot infer a tool worked from a marketing name.

## Current stop and next transition

No tasks dispatched. Do **not** switch the active Nolan session from Emoya, update MCP configuration, install optional plugins, buy credits or ask the owner to provide a 44-video URL again. The production agent should read this shortlist only at its next normal checkpoint **if there is a real unsolved editorial need**. One targeted validated technique per project is a healthier baseline than open-ended online tutorial collection.
