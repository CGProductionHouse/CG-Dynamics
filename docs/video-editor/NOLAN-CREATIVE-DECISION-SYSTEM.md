# Nolan creative decision system — use skills with taste, learn from every approved edit
**22 October 2026 — research-derived design proposal, not active runtime code.** Complements PR #859's CG video story editor skill, moment screening, rhythm/sound playbook, 44 TikTok tutorial ledger and #862's verified Premiere implementation. Do not copy/rewrite #859's active skill files. This defines **what Nolan should remember and decide**, not a new editing application or mandatory schema migration.

## Nolan's editorial north star

**Create a memorable, truthful, visually and sonically exceptional *client film*; use the least intrusive techniques that best deliver its promise.** Technical knowledge is a palette. Contemporary editing isn't the maximum number of transitions, the shortest average shot duration, or mimicking the latest TikTok gimmick. Good work can be restrained, expressive, kinetic, warm, strange or luxurious as the buyer's story requires.

At the start of a video ask: **Who is watching? Why do they care? What evidence does this footage genuinely show? What emotional progression makes them keep watching? What should they feel or do at the end?** Then inspect the actual shots and audio before choosing editing techniques.

The existing PR #859 **story preproduction gate is mandatory authority**; this document adds a compact *technique selection and learning decision layer* without inventing separate strategy/approval/publishing authority.

## Selection: choose the appropriate technique, not a preset by category

| Story / circumstance | First editorial mechanism to consider | Optional treatment only if motivated | Failure mode to avoid |
| --- | --- | --- | --- |
| **Sport / golf / live action** | Place action's decisive frame, cut on motion, make contact/result audible, alternate action/face/detail and allow payoff to register. | Tight 3–6-frame detail rush; genuine high-fps interpreted slowdown on the decisive move; an editable motion zoom, sound transient and quiet release. | Long windup before ball contact; arbitrary cuts on beat; synthetic impact disconnected from the pictured strike; endless acceleration/no payoff. |
| **Premium architecture / lodging / furniture** | Travel through a believable space, reveal scale and material, match screen direction, use considered holds. | One smooth spatial reveal, foreground title/mask if truly clean, natural sonic texture. | Strobing flashes, distorted ultrawide crops, over-repeating one room or forcing a fake journey through different sites. |
| **Professional services / finance / funeral / medical** | Human trust, relevant buyer question, concise truthful proof, calm continuity. | Restricted hero typography, J/L dialogue cuts, purposeful ambient sound, restrained match on action. | Fake client outcomes, exaggerated claims, flashy glitch effects that trivialise the service, stock posing as a real local case. |
| **Event / festival / night sport** | Recognisable opening energy, strong faces and motion, music phrase arcs, a genuine climactic payoff. | J-cut of audience/venue sound, sparse impacts, rhythmic burst then breathing shot, occasional light/motion accent. | Constant cuts with no visual recognition, looped whooshes, clipped songs, unsafe footage reuse. |
| **Food / retail / tactile product** | Demonstrate sensory action, material and result; let the sound of the genuine action reinforce it. | Match same hand/item across frames, macro insert, small title gesture, cohesive colour. | Generic stock SFX unrelated to the actual material, repetitive beauty shots, false product transformations. |
| **Interview / documentary / testimonial** | Preserve meaningful phrasing, expression, breath and chronology; visible proof should enrich rather than disguise the speaker. | J/L cuts, subtle crop, selective B-roll, understated key-word type. | Auto-cut every pause, reordered statements that change meaning, fake words/background interactions. |

**Always apply to the actual media.** “Sporty” is not a blanket licence to install a speed-ramp pack. A poorly framed shot might be better replaced, cropped or removed than filled with effects.

### Per-edit decision score (small, not an AI optimisation project)

Score each *candidate technique* qualitatively against:
- **Narrative gain:** does it reveal information / emotion / momentum that the clean edit misses?
- **Motion/source fit:** are the frames, direction, handles, source fps, object edges, audio and edit points suitable?
- **Brand/taste:** does it match the client and current CG quality bar?
- **Source truth:** real client content, rights-cleared music/SFX; no misleading AI-created claim?
- **Cost and reliability:** confirmed native controls on the installed Premiere; editable; viable render/recovery; no major quota burn?
- **Legibility/comfort:** readable phone composition, pacing/beat, safe zones, no unintended flash/exposure surprise.

**Decision:** keep a clean-cut fallback. Use a new treatment only when the result is visibly/audibly superior after real playback; otherwise reject or defer. The editor may choose a brave original treatment *when justified*, but must explain the intended viewer effect, not name-drop an effect.

## Skill memory: durable, retrievable and technically honest

For each technique/lesson Nolan genuinely uses, retain a small **skill card** (GitHub text/markdown for generic skill only; client-specific review remains in the authorised private client record). Fields, not a new DB:

```yaml
id: action-match-cut-putter-impact
name: Match on action at decisive contact
maturity: creatively-proven # discovered | host-implemented | creatively-proven | repeatable
viewer_objective: Make a repetitive physical action feel immediate, credible and satisfying
use_when: Two angles genuinely contain compatible phases of the same action and screen direction
avoid_when: Both angles show incompatible continuity/ball positions or edits misrepresent a single event
source_prerequisites: Reviewed moving footage, accurate source timecodes, meaningful impact audio
premiere_recipe: Exact clip ID/in-out plus frame-based match cut; optional independent foley cue if genuine/cleared
verified_host: Premiere 26.3.2; note whether tested through UXP/MCP or a manual fallback
review_evidence: Private before/after rendered playback and owner's approved note; never put private media links in GitHub
failure_and_fallback: If second view doesn't match, make a tighter single-view action cut
provenance: Staff feedback from approved working edit; mark who reviewed and date privately
cost: No new plugin; track real elapsed editor/model/QA time if measured
```

**Maturity is earned, not self-awarded:**
1. **Discovered:** tutorial read/visual sample, sound/host execution not yet proved.
2. **Host-implemented:** technique applied via actual Premiere controls, readback/save/render verified; still not a beautiful client edit.
3. **Creatively proven:** side-by-side footage and audio checked; authorised owner/staff judgement says it improves the real film.
4. **Repeatable:** successfully transferred to at least one materially different real edit with relevant brand constraints and negligible rediscovery cost.

There is **no background retraining of the language model** simply because a technique was written down. Nolan must actually **retrieve** pertinent cards and original client rules when beginning/editing a project. Index by **intent**, **viewer emotion**, **subject/action**, **client genre**, **shot prerequisites**, **host feature readiness**, **negative example**—not just effect title.

## Permanent feedback without bad over-generalisation

Translate review notes into four distinct layers:
1. **Exact requested action** (per client, per cut): e.g. remove sentence-ending periods from Emoya on-screen text; shorten *this* golf putting section.
2. **Editor diagnosis:** why the viewer struggled: repetition, missing visual payoff, typography cadence, crop distortion, sonic mismatch.
3. **Transferable hypothesis:** e.g. cut a physical gesture close to the decisive moment when the anticipation no longer serves the story.
4. **Promotion evidence:** same principle helped a different approved video *and* didn't harm clarity or tone. Only now treat as broadly recommended.

Never translate “make Emoya faster” into “all sports videos require 3-frame cuts”. Never translate “no punctuation on this graphic” into a universal company copy policy. Client-specific feedback overrides general recipes for that client only. Later superseding owner feedback must preserve and retire old examples, not silently overwrite history.

### Emoya example — what is actually known now

**Verified source from owner/staff communication:** Current Emoya draft has promising overall direction, but the putting action waits too long for contact, and on-screen terminal periods feel awkward. Franco proposed an action-continuous cut between two genuine putting views just before/at contact; Sydney wants the unwanted periods removed. **This does not certify a particular pair of real timecodes, impact audio or a final export.**

**Next creative hypothesis:** Find the true putter/ball contact frames (and compatible screen direction), test tight match-on-action versus a single-shot cut, listen to the contact cue; retain what makes the ball strike clear and the next shot rewarding. Preserve successful existing shots. Consider *one* purposeful rhythmic rush into a held hero shot, editable native text reveal and coherent music/SFX transitions, but only if the footage and brand support them. Full-motion/phone and owner approval are indispensable.

**Past technical trap:** The 12s practice Emoya sequence in #862 verified many native operations; it is **not** the existing ~30s client commercial nor a review pass. Practice titles, temporary typeface/branding and exposed overlay tests cannot be promoted as final quality.

## Creative study loop — small, active, evergreen

**Discovery:** For new footage/edit needs, look up 1–3 relevant references: PR #859's 44-video TikTok collection first, then fresh primary creator posts, high-quality commercials, Adobe technique docs. Record URL, publication/sample date, what was actually visible/heard, whether technique was replicated, and rights/licence. **No scraping whole copyrighted courses or downloading unlicensed music/presets.**

**Deconstruct intent:** Opening image/sound, progression, action/reaction, cut points relative to motion, screen direction, typography entry, audio attack/tail, payoff, real buyer relevance. Differentiate trend from craftsmanship and source camera advantages.

**Choose test in actual client edit:** Candidate 3–8s section *inside* authorised real work and clean-cut baseline; do not spin up a separate month-long tutorial lab. New technique should be selected because it solves this video's problem.

**Verify fast:** Native parameter readbacks, clean 4K export, look at early/mid/late frames, **watch the actual moving cut with sound** on desktop and phone; measure turnaround time including retries. Text tracking/clipping, 9:16 crops, black frames, cuts off source bounds, peaks, credits, claims, and rights are meaningful gates; a codec-decode PASS is not aesthetic approval.

**Record and promote:** Keep or reject with a short reason and evidence. Save only a compact transferable technique card; update the exact client feedback privately. On the next video, retrieve matching proven cards by narrative/action, use judgement and re-evaluate creative fit.

**Never let novelty displace delivery:** One intentional creative stretch per edit is often more valuable than 15 unrelated new tools. Owner can set a stricter budget. Stop investigating after a demonstrated sufficient result, unsupported API, lack of licence or diminishing editing improvement.

## Why AI video editing remains hard

The [VEBench research paper (May 2026)](https://arxiv.org/abs/2605.03276) measures video-technique recognition and multi-source operational editing reasoning and identifies a substantial gap to human expertise; it is **research evidence, not a benchmark Nolan passed**. The [DIRECT hierarchical video-planning paper (April 2026)](https://arxiv.org/abs/2604.04875) separates a story-level planning layer, editing intent, and fine-grained execution—a useful *design analogy*, not an installation request or validated performance guarantee.

Nolan should use these ideas as **a decision order within his existing skills**, not build multi-agent software to imitate the paper:

**Viewer story → ranked decisive source moments → rhythm and audio architecture → techniques with verified prerequisites → 4K editable execution → creative review → feedback retrieval.**

## Operational boundaries

- Existing [#859 creative skill](https://github.com/CGProductionHouse/CG-Dynamics/pull/859) stays authoritative/in flight; never change it from this research branch.
- Existing [#862 live Premiere work](https://github.com/CGProductionHouse/CG-Dynamics/pull/862) owns API fixes/install/config/cold recovery; never race or operate the host here.
- No automatic publishing, no private raw/brand paths in public GitHub, no new server/backend/workflows, no creative claims beyond actual reviewed source. Owner and staff feedback is allowed to overrule generic internet examples.
- Real success measures: fewer repeated review comments, stronger owner-approved opening/payoff, credible source selection, approved 4K review output, source-linked editable project, and decreasing *total* turnaround and tokens per accepted video—not number of studied tutorials or MCP tools.
