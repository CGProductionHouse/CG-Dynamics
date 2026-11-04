# Why the skills were not reaching the films — 3 November2026

Scope: owner-requested MSI system repair on existing office draft PR910, baseline7ee49e52. Office production remains stopped. No client replacement was edited, sent, uploaded or approved in this audit. Existing seven-film rejection and older separately approved MSI films remain distinct.

## Actual defects

1. **Release never consumed the story plan.** Baseline `.agents/skills/cg-video-story-editor/scripts/check_client_release.py` checked actual duration, context, naming, media hashes,11 self-authored review areas and the existing audio gate, but never called `preflight_story.py`. Hook/story, technique implementation and beat timing were absent from its review areas. A plausible all-pass document could reach `EVIDENCED_INTERNAL_REVIEW_READY` without a planned hook, source timeline or applied skill. This was a production-path fault, not merely an editor failing to read a rule.
2. **The preflight was descriptive.** `preflight_story.py` required strings and hook descriptions but no frame timeline, planned duration, selected music/cut anchors or implemented recipe. A preflight success could not establish that its plan was used in a film. The office's later actual-duration guard was useful but arrived after encoding and did not close this gap.
3. **The library was largely experiments rather than production operations.** Many of45 technique families had pinned practice sources/fictional copy, hard-coded paths and bounded native tests. Those discoveries were valuable, but opening SKILL.md did not execute them. Production had to manually rebuild the effect, and no binding exposed when it was omitted. Research publication and installation were repeatedly confused with actual use and creative competence.
4. **Conflicting source rules encouraged the wrong substitutions.** The old validator blanket-rejected repeated source/cluster IDs while the owner allowed distinct cinematic moments from an older shoot for a genuinely different story. This did not justify copying a published story, but a blanket ban was also wrong.
5. **Technical evidence was too easy to promote into creative readiness.** File existence, a PASS label, model output or decode does not prove a useful hook, enjoyable music, purposeful motion or a good film. Another document alone would not fix this.

## Reproduced failure, not a hypothetical

A private wholly synthetic black30second64×96/25fps MP4 was passed through the **baseline code from7ee49e52** and the repaired command. The same hash-bound all-pass labels gave:

| Path | Result |
| --- | --- |
| Baseline | `EVIDENCED_INTERNAL_REVIEW_READY`, no errors |
| Repaired | `BLOCKED`: missing `story_plan` |

Isolation: client-context and audio acceptance were deliberately stubbed in both runs to isolate story/implementation logic. This is not a real client release, audio audition or demonstrated bypass of those external gates. Synthetic MP4 SHA256`e95c949c2297538fc61acc8a25d62208115628090146683503d1a34f2c8a0426`. Local receipt: `C:\Users\chris\Videos\CG-AI-Editing\Nolan-Foundation-Audit-20261103\loophole-reproduction.json`. No client media entered Git.

## Repairs in the existing path

- Production preflight now checks a frame-accurate27–33second plan, distinct hooks, hook/development/payoff coverage, every shot's action/inference/graphic/sound job, selected audio stream, declared cut anchors and actual shared-card/implementation/parameter bindings. A short film or “effects later” plan fails before full rendering.
- The existing release entry point now revalidates that exact plan, checks its render receipt against exact export identity/frame count/rate and requires each planned visual application to survive into the final picture compared with a same-clock plain control. Dropped techniques, changed plans and identical plain output block. No new editor, rendering engine, queue or service was built.
- Extracted **two** source-independent image operators for the existing renderer: brand-explicit staggered/shutter type and registered incoming-picture panels. Tested actual code use, not just card links. Other families retain their evidence/limits; no45-family mastery claim.
- Distinct nonoverlapping moments with a different story role are allowed from the same source; overlapping repeated moments and same-job clusters are blocked. Public-use/story suitability still needs actual screening.
- Review artifacts are hash-bound and attributed to the actual author or independent editor. Successful machine output is now `CANDIDATE_FOR_INTERNAL_REVIEW`, explicitly not creative/owner approval. Hook/story, skill application and beat timing are now named review areas as well as execution-plan inputs.

The operational instructions and record fields are in [the shared execution reference](../../../.agents/skills/cg-video-story-editor/references/production-execution.md), directly linked at the top of the shared skill. The [type](skills/graphic-transform-blur/SKILL.md) and [panel](skills/registered-slanted-panels/SKILL.md) cards point to the callable operations. Existing private renderers must consume the plan and emit their manifest from their actual decisions; do not retrospectively fill it to clear rejected films.

## Verification and honest boundary

The integration tests create real30second750frame synthetic H264 plain/effect films at128×224 using both portable operations, then use actual FFprobe and decoded frame comparisons. Tests cover missing story/skill, short plans, late declared cuts, missing scene intent/parameters, changed frame clocks/plans, dropped treatments, identical plain output, repeat-source distinctions, malformed input, operator resolve/registration and the real release entry point. Client identity/audio acceptance are mocked only in the synthetic release tests; no sound/brand approval follows.

No script can establish story taste from filled text. Declared anchor alignment is not independent beat detection or listening; decoded picture difference can result from encoding or irrelevant changes. The manifest is a reproducibility receipt, not an anti-forgery signature or automatic inference of source use. Normal-speed picture/sound, actual approved-client comparison, source truth and creative judgment remain necessary and must never be invented. This repair closes identified execution bypasses; it does not demonstrate that any rejected client replacement is now good. Native editable and second-PC installation gates remain separate. Do not resume production or reminders from old overnight authority.

Verification receipt:40 tests pass (25 retained audio/naming contracts plus15 production-integration/operator cases); Python compilation, shared-skill validation and `git diff --check` pass. `npm run build` passes with existing stale-Browserslist/chunk-size warnings; existing dependencies were reused only after package/lock hashes matched, with no installation. Changed-document link check found379 local links and10 pre-existing missing ops-handover references inherited from the stacked branch; all newly added links resolve. Static inspection of synthetic early/settled title and panel frames confirms a clipped entry, sharp resolve and common incoming picture; this is diagnostic inspection, not a full-speed sound/phone or client creative verdict. No migration, database, role/security, live app, production project or desktop changes.
