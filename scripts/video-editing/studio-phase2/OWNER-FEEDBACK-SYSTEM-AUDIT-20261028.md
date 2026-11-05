# Owner-feedback integration audit — 28 October 2026

## Finding and scope

The office agent did fetch/install PR #875 through **1c23da63** and reported hash `CURRENT` in #903 at 06:46 SAST on 28 October. This failure mode cannot be explained solely by a stale skill install. The shared entrypoint had important rules scattered across references/client histories, contradictory beat guidance, an optional-sounding logo-audio instruction, and no explicit exposure/colour-matching baseline. A successful sync never established that a production applied those instructions.

This audit reconciles the owner messages available in this conversation, the repository's actual shared skill/references, project continuity and handoff records, and the latest #903/#904 receipts. It is not a claim to have re-watched every historical source/export, read unavailable private chats or independently reviewed Central Canvas. The specific missed Central Canvas details the owner did not name are not inferred. No Central Canvas media, timeline, desktop or active project was touched.

## New operational authority

- Shared entrypoint: `.agents/skills/cg-video-story-editor/SKILL.md` now requires [production-standard.md](../../../.agents/skills/cg-video-story-editor/references/production-standard.md) before every edit/revision and its evidence record before handoff.
- [exposure-colour-matching.md](../../../.agents/skills/cg-video-story-editor/references/exposure-colour-matching.md) adds correct → match → look, retained detail, scopes/visual comparison, cover treatment and honest limitations.
- Existing preproduction, rhythm and release references link/reconcile the same authority; no second rendering engine, task database, brand kit or production queue was created.
- The standard's 24 decisions and 13 evidence rows are mandatory project work, not a claim that historical videos passed. Exact evidence belongs in the existing private brief/source/release record. Client facts and current approval states stay in the client kit/owning issue.

## Traceability: general rules

Each row identifies an actual owner correction, the prior coverage/gap and its durable implementation. `PS` means the numbered decision in the shared production standard. These are editing decisions, not invented creator-performance guarantees.

| Category / owner correction | Audit result before this change | Current shared implementation |
| --- | --- | --- |
| Research first; buyer goal, hook, feeling, proof and reason to reach out | Strong story gate existed; easy to skip by loading only entrypoint | Mandatory PS1–3 and evidence rows; three hooks and one CTA remain in story gate |
| Local month/season and actual activity; South African summer, not winter imagery | In story gate and PSG notes, not a visible baseline | PS3/7; source-backed local activity, wardrobe, business reason; no invented urgency/current-year forecast |
| Check actual source-month and subsequent public posts, not only filenames/local finals | Detailed reference existed after TBS failure | PS4/5 plus explicit entrypoint; URL/date/scope, source ranges and old/new story job required |
| Reuse older folders intelligently; do not copy posted beat/story as-is or ban whole shoots | Later correction existed beside earlier absolute-sounding restrictions | PS5 and preproduction introduction explicitly state the corrected interpretation; unknown is not unused |
| Useful moment only, no fumbles, awkward poses/resets or out-of-frame action | Moment reference strong, several client notes historical | PS6/7; adjacent rejected range and payoff; exact moving span, not thumbnail screening |
| Natural staff/team B-roll; don't mute someone addressing viewer | In moment reference but not main sound instruction | PS8 and rewritten entrypoint decision14; preserve words/sync or replace picture |
| Mute crew instructions, prompts, false starts under B-roll | Main instruction said keep natural sound without classifying it | PS8/17/19 and entrypoint14 explicitly distinguish crew direction from ambience |
| Authentic client identity, not generic stock pretending to be their store/team | Several references covered identity; missing central emphasis | PS7; real place/people/process, stock labelled illustrative, proportion tied to story |
| Old product footage cannot imply current shelf stock/offer | In Daisy/story gate | PS7 with current offer evidence; specific products allowed when currently verified |
| Each shot/word/sound needs an intentional job; no five-second static filler | Scene-intent sheet existed | PS3/7/12/17; stable background justified by actual overlay/voice reading need |
| Orientation per file; no upside-down frames or sideways sign | Entry rule13 and Daisy correction existed | PS9 and evidence row; whole selected span/crop, not one frame or folder preset |
| Stabilise ordinary clips by default; rough sporty exception only | Explicit baseline added 27 October | PS9 preserves default, crop/warp review, source/settings and intentional movement |
| Normalize overexposure/white balance, match clips, coherent cinematic look | **Missing explicit workflow**; generic comparison mentioned colour | New colour reference and PS10; correct → match → look; no universal LUT or false clipped-detail recovery |
| Never change approved fonts/colours; don't add ugly black outlines | In brand references and PSG notes | PS11; exact approved brand/substitute evidence, no convenient substitutions |
| Remove terminal full stops from marketing captions | Only PSG note / vague client-style check | PS11 makes owner default explicit; exact quotes/contacts and social-post caption remain distinct |
| Dynamic colour assets and text reveals across entire video, not intro only | Body guidance existed in rhythm reference | PS11/12; brand accents, hierarchy/reading holds, varied whole-film visual map, no effect quota |
| Hook should earn immediate attention; no distracting solid screen/abstract word | Client examples, general hook gate | PS3/12; meaningful action/promise, three candidates and clean-cut comparison |
| Imported coherent icons; polished carousel, not AI-looking board | Licensed-vector card exists; design acceptance still limited | PS13; asset family/licence, labels/read time/safe area, no claim carousel proof = approved design |
| Foreground cutouts grounded; real occlusion/depth/perspective | Continuity gate and technique cards, not shared entrypoint baseline | PS14; whole-span exported matte/layer-order check, no floating people/duplicate subjects |
| Real physical phone/device effect, not passing off a fake mockup | Filmed-screen/window-grow cards recorded failed grow | PS13/14; retain proof/failure boundaries and reject unsupported treatment |
| Music fit matters; stop recycling rejected song or prior film's cue | In continuity/client audio library, not main music direction | PS15; exact ID/history, actual phrase/ending, preserve owner-liked score during revision |
| Cuts on beats or skipped beats throughout; music/SFX can shape timing | **Conflict:** entry15 said not every later cut on beat; rhythm suggested casual frame shifts | Both rewritten; PS16 requires frame-based beat map, meaningful holds and explicit alternative audible cue for deliberate non-music-led passage |
| Intentional layered transition/action sound, not generic whoosh per cut | Rhythm references already detailed | PS17/19; cue causes/onset/peak/tail, licensed separate stems, sync after revisions |
| Voice must stay intelligible and source-aligned when speaking picture restored | TBS V9/continuity correction | PS8/17; fresh sync check after offset/retime/treatment, not old B-roll timing |
| Never use logo animation's embedded sound | **Conflict:** release reference said sound “can be omitted” | PS18 and release reference now explicit mute, continuous music/effects and exact tail check |
| Use official animated logo, no static substitute or damaged crop | Technical handoff and client notes | PS18; meaningful construction/full mark, portrait adaptation and exact final frame |
| No near-silent tail; hear source/mix/export; autonomous routine work | Existing audio gate honestly limited | PS19; exact export, B-roll, mono/stems/tail plus measurements; no routine owner practice auditions or invented listener/model verdict |
| Covers follow actual client cover collection/approved Canva page, not poster | Cover reference strong; old handover stale | PS20; approved exact page, subject/logo/title, exposure, small grid and square/3:4/4:5 checks |
| File naming from OneDrive + Dynamics; no experiment name | Release rule existed after PSG failure | PS21; configured code/sequence, exact preview basename/hash, protected revision; no guessed identity |
| Forwardable video+caption together, separate HD cover alone, notes separately | Release rule existed | PS22; exact recipient/type/status and assignment-specific playable-HD override; no public approval inference |
| Acknowledge amendments; after objective look for next owned work | In operational history, easy to confuse monitoring with work | PS24; current feedback checkpoint, scoped authorised acknowledgements and sustained work; no recreated cancelled reminders |
| Preserve good music/vibe/intro while applying other changes | Keep/change language existed in audio section only | PS2 and evidence row apply to all revisions and visual choices |
| Staff-editable output and cross-device relink must actually work | Handover good but release forced Premiere | PS23 and release now tool-agnostic; actual native tests if claimed, source/baked limitations explicit |
| Preserve projects/ownership/no desktop conflict/no unapproved uploads/spend | Handover/AGENTS rules existed | PS1/24 and existing safety authority; no cross-lane timeline/control or credential copying |
| Test each tutorial mechanism, negative controls, no unsupported mastery | Technique cards/status already explicit | PS12–14/19 and existing execution board; documented source suitability, A/B and limits, not blanket effects |
| Skills visible to office through one shared library, not private memory | Hash sync already worked | Required per-job library/feedback checkpoint and evidence rows; this audit fixes application/discovery, not model training |

## Client-specific continuity retained, not universalized

| Client / scope | Keep, reject and later correction |
| --- | --- |
| PSG November | Authentic team presence, especially the owner-named short-haired blonde woman; no unsupported current-role claims. Later photo-as-designed-insert permission supersedes earlier video-only restriction. Approved Montserrat Bold substitute and white/cyan/magenta/blue bracket/gradient language; no invented outlines/fonts/colours. Exclude current October posted picture/story, rejected music580 and October Driving Ambition cue. New seasonal farmer story, dynamic body, official logo picture-only, correctly named production identity. These do not become other clients' palette/person/copy requirements. |
| TBS November | Never repeat posted June advice story as a fresh strategy. Natural work/action supports a new equipment-cover purpose. No sideways sign, weak static hook, short padded story, flickering saw or crew chatter. Meaningful selected adviser words need visible source-aligned speech. Keep approved revision; TBS owner approval is not permission to alter it without new feedback. |
| Daisy November | Preserve owner-liked Romantic03, buoyant rhythm, yellow/white type and improved real-store intro. Real store/range/action should establish Daisy identity; avoid stock-dominated story, old-stock availability implications, February Valentine decor and winter styling. Older different moments are allowed, not the exact reused1073 published beat. Franco's later current folders allow verified current products. Orientation/stabilisation and picture-only official outro with audible musical tail remain baseline. Current amendment/approval state must come from the client kit/owner, not old frozen README bullets. |
| Fight Night | Owner wants a ~30-second trailer of strongest genuinely landed blows, not a general recap or generic stock montage. Source filenames/timecodes, actual contact/consequence and original audio matter. No inferred knockouts, rejected stock score, incomplete/preview files called masters or repeat oversized connector retries. Skill work can continue while complete source intake is blocked; edit resumption follows current owner scope. |
| CapCut / native handover | Native9.6 proof is a compatibility receipt, not transferable staff editability. Never touch PR870/production drafts from this lane. Editable handover requires actual media/text/audio/relink/save/reopen/native export and separate target-machine test; tool-agnostic Nolan does not require CapCut for every film. |
| Central Canvas office #904 | Office owns its source/timeline/amendments. Latest receipt at07:19 SAST reports R02 source-specific tonal corrections and replacement cover; owner requested playable HD video for this job. No independent MSI video review or owner approval is inferred. Office should reconcile its next revision/release record against this shared standard; MSI did not change that film or issue its own creative verdict. |

## Corrected authority/discovery problems

1. Entry point now surfaces mandatory cross-client defaults instead of expecting an agent to infer them from a long PSG history.
2. Beat instruction and optional logo-sound wording corrected in **both** entry and underlying references, not only a new memo.
3. Complete sound classification added to the main editorial decision, matching the existing moment-selection warning.
4. Tool-agnostic native acceptance replaces a universal Premiere-only release instruction.
5. Two-PC handover no longer says second-PC setup is wholly unwitnessed; scope is anchored to actual #903 receipt and native/phone limits remain open.
   Its stale Daisy R04/pending-amendment line is also reconciled to the witnessed R05 handoff; the Google mirror already had the later state. Internal delivery still does not establish client/public approval.
6. New feedback does not erase keep elements or become a global brand/style rule. Historical client notes remain history and must yield to the current client checkpoint.
7. New colour requirement is a documented baseline **not a new tested look/mastery claim**. It must be applied and evidenced on actual projects.

## Validation and office propagation

Check relative reference targets, required standard/evidence categories, removal of known contradictory phrases, and skill metadata; run the repository build and hash install check. Update PR875/#903/#904 and the existing Google Drive handover mirror with exact new commit and scope. Office installation/application of this **new** audit remains pending until the office agent records receipt and project evidence. Do not claim that a GitHub comment or Google Doc update remotely installed it or improved a film.

Local validation completed: 276 relative links across23 skill/continuity documents resolve;24 decision and13 evidence-row assertions plus known beat/logo-conflict removal checks pass. `git diff --check` passes. `npm run build` passes TypeScript and Vite7.3.6, retaining the existing large-chunk warning. The MSI installed skill hash reads `CURRENT`; the prior local copy is backed up outside the live skills catalog. No application code or dependency changed, so no new runtime/browser/film acceptance is claimed. The ops handover first preserved the current `origin/main`7eb0473f content (450 lines missing from this older lane snapshot) before adding the scoped audit entry; no current main operating notes were discarded. Exact Control Centre title search returned no result, so no substitute tracker was edited.

No video/client data, editor session, permission, provider setting, recurring task, paid resource or public/client send changes in this audit.
