# CG Dynamics — Canonical Project Continuity Handoff

Last updated: 2026-08-06 08:01 SAST
Status: Canonical continuity document for a new ChatGPT/Codex/Claude session.
Repository: `CGProductionHouse/CG-Dynamics`
Production app: `https://cg-dynamics.vercel.app`

## Read this first

This document exists so a new session can continue without asking the user to re-explain CG Dynamics, its vision, current workflows, architecture, completed work, active missions or the Marketing Library programme.

Before giving coding guidance or writing a coding-agent prompt:

1. Read the latest repository state and relevant files.
2. Check the latest commit, open PRs and issues.
3. Treat GitHub as the source of truth for code, docs, migrations and current implementation.
4. Do not claim production deployment, data changes, tests or merges without direct evidence.
5. Keep one substantial coding-agent mission active at a time unless the user explicitly directs otherwise.
6. Small isolated work may run in parallel only when it does not overlap the active large mission.

## User and working style

The user is CA / Christie-Ann, not Christie.

Working preferences:

- Direct, concise, complete and outcome-focused.
- No giant history dumps in coding prompts unless materially needed.
- One task per coding-agent prompt.
- Coding agents must run `git status`, pull latest, inspect the repo, build and test, and only commit/push when the build passes.
- Final coding-agent reports must be one complete copyable Markdown report.
- Never invent production state.
- Do not hardcode current staff, clients or aliases when the system can be directory-driven.
- Do not make the user repeatedly provide screenshots for defects that can be converted into issues or agent missions.
- The user strongly dislikes generic AI copy, corporate filler, fake confidence and unsupported assumptions.

## Product vision

CG Dynamics is intended to become the operating system for CG Production House and related businesses.

The long-term direction has three connected divisions:

1. **Client Intelligence**
   - client profiles and exact-client knowledge;
   - marketing strategy and research;
   - content planning and performance;
   - advertising, SEO, websites and local presence;
   - reporting and recommendations;
   - client portal access limited to the client’s own information.

2. **Operations Hub**
   - task and workflow management;
   - team ownership and accountability;
   - schedules and calendars;
   - approvals and production workflows;
   - Microsoft/Planner/Outlook transition support;
   - WhatsApp integration later;
   - eventual replacement of fragmented Teams/Planner workflows only when CG Dynamics is genuinely easier and more useful.

3. **AI Workforce**
   - CG Assistant as the main operating layer;
   - personal staff agents with permission-isolated context;
   - a master management agent authorised across the team;
   - provider-agnostic model routing;
   - inexpensive models for routine work and stronger models for sensitive/complex work;
   - Groq or equivalent for transcription where appropriate;
   - usage controls, citations, uncertainty, review states and strict client isolation.

The app should not merely copy Teams. It must reduce friction, improve daily clarity and make work more enjoyable and useful.

## Current operating reality the app must replace or improve

The company currently relies heavily on:

- Microsoft Teams and Planner buckets for task management;
- Calendar integration for posting schedules and production planning;
- Outlook meetings and imported schedules;
- WhatsApp groups as the primary client communication and approval channel;
- manual morning lists and staff coordination;
- disconnected reporting, task, content and client-information systems.

The intended CG Dynamics model is:

- one shared client directory;
- one canonical task authority;
- clear staff ownership;
- integrated schedule/calendar views;
- client-specific content and marketing intelligence;
- CG Assistant able to surface work, risks, suggestions and next actions;
- backend screens used for oversight, correction and evidence rather than becoming another cluttered system.

## Information architecture direction

- Staff navigation is split into **Hub** and **Performance** zones.
- Clients are shared across both zones.
- Performance includes client performance, reports, integrations and client preview.
- Hub includes Command Centre, CG Assistant, planning, schedules and operations.
- Client portal users must see only their own client data and must not receive CG Assistant access.
- Client Schedule mutations are admin-controlled, with proposals and audit where relevant.
- Sync and import tools should live under Integrations rather than cluttering primary navigation.
- The entire app needs a major responsive and visual overhaul toward a premium, modern, readable, mobile-friendly product.

## Canonical staff and ownership principles

All staff identity and ownership must be dynamic and directory-driven.

Known staff names include:

- Christie-Ann / CA;
- Amonique Fourie;
- Franco Lessing;
- Sydney Oosthuizen;
- Ger-Marie Pretorius;
- KG;
- all other current and future staff.

Never make these names a hardcoded authority.

Ownership rules:

- canonical profile/assignee IDs are authoritative;
- imported names are evidence only;
- helper names are never owners;
- ambiguous, unresolved or conflicting work must remain review-state work;
- person-specific outputs must include only verified ownership;
- managers may receive assignment-review digests;
- duplicate recurring instances must not be collapsed merely because titles match.

## Important merged production work

Verified merged work on `main`:

- PR #151 / commit `9edbea...`: Franco personal daily assistant.
- PR #154 / commit `dc121e0...`: web push.
- PR #155 / commit `9fdfa76...`: restored Command Centre and Morning List Import navigation.
- PR #156 / commit `c8de334...`: iPhone input and safe-area fixes.
- PR #158 / commit `629fbf1...`: simplified mobile Assistant initial state.
- PR #159 / commit `033688d...`: composer controls.
- PR #160 / commit `06990bd...`: daily voice state.
- PR #162 / commit `84da09c5...`: full-screen mobile Assistant using `visualViewport`.
- PR #165 / commit `b0517b7f...`: Microsoft Sync reset.
- PR #167 / commit `e34ac8d69da481fe80b9d5e2a2de08a6b0bdb888`: Meta sync retry and classification; 72/74 pages completed; AV Event Life permission remains blocked.
- PR #169 / merge commit `5bf7b87ce08cb923f780aff83ff05e6f2567cacf`: canonical staff identity and assignment resolution.
- PR #170 / merge commit `092f4ab48fbd5ec565e396e58ff947e6e0231b0c`: canonical task authority.
- PR #171 / merge commit `288760609c87041e67fa42463f3c0048caae4e26`: operational outputs use canonical ownership.
- PR #172 / merge commit `119faaa09b558cbce4f4b2ec7d77f12dc73306de`: notifications and Assistant use canonical ownership.
- PR #173 / merge commit `15c421eea9a540c96b896c30b96ee0fc26928543`: generic directory-driven Morning List client matcher.
- PR #174 / merge commit `f6a86782aa9cb62208702dd514368051f1e28b02`: Microsoft/Outlook/Planner/schedule client aliases moved to the database-backed matcher.

Issue #168 may still appear open even though much of the underlying ownership work landed through PRs #169–#172. Do not claim it is closed unless verified.

## Active large coding mission

PR #175 is the current active Claude mission:

**Title:** real staff invitation lifecycle, activation and identity reconciliation.

Branch: `pr5/staff-invitation-lifecycle`
Base at mission start: `f6a86782aa9cb62208702dd514368051f1e28b02`

Current reported state:

- draft PR;
- dedicated `staff_invitations` state machine;
- statuses include pending, sending, sent, accepted, failed, expired and cancelled;
- integrity constraints require truthful send, failure and acceptance evidence;
- invitation UI, resend, cancel, expiry and reconciliation work implemented;
- migrations applied according to the PR report;
- tests and build reported green;
- real SMTP delivery and clean-session browser acceptance remain unproven;
- the PR must remain draft and unmerged until real delivery and acceptance are proven.

Important invitation details:

- correct Amonique account/invite must be used;
- bad historical address `amonique@cgoroductionhouse.com` must remain only as failed/cancelled audit evidence and must never receive mail;
- CA/Christie-Ann duplicate identity signal must be reviewed, not auto-merged;
- all current and future staff must work through the generic lifecycle;
- role vocabulary must align with the actual database permission model.

Do not launch another broad overlapping Claude coding mission until PR #175 is resolved unless the user explicitly redirects.

## Open product and UX issues

- #176 completed tasks remain active.
- #177 duplicate Outlook meeting.
- #178 Schedule Calendar is not an actual calendar.
- #179 Work/My Day contains overloaded instructional copy.
- #180 app-wide UX copy and noise overhaul.
- #181 app-wide responsive layout overhaul.
- #182 information architecture and navigation simplification; sync tools under Integrations.
- #183 Marketing/Knowledge overhaul.
- #184 populate the Marketing Library resource foundation before client research and then perform client-by-client research.

## Marketing Library vision

The Marketing Library must become a real evidence-backed decision system for CG Production House.

It must help the company make excellent client decisions across:

- sales and lead generation;
- performance and conversion;
- brand recognition;
- authenticity and trust;
- reach and follower growth;
- entertainment and engagement;
- content, photography and video;
- paid advertising;
- websites, SEO and Google Business Profile;
- giveaways, partnerships and physical activations;
- customer retention, referrals and reviews;
- measurement and optimisation.

It is not a generic business-operations library. Exclude bookkeeping, payroll, tax, procurement, rosters and unrelated administration.

Evidence standards:

- official platforms and regulators;
- credible market and consumer research;
- proven campaigns and advertising structures;
- reputable books and industry sources;
- real customer language, reviews, comments and interviews;
- verified case studies and performance evidence;
- no generic AI slogans;
- no invented case studies;
- no unsupported market-size or success claims;
- no copyrighted full-text ingestion without rights;
- all derived knowledge must carry citations, limitations, freshness and review state;
- client-specific evidence must never become universal industry truth without independent support.

Canonical scope file:

- `docs/ai-workforce/MARKETING-LIBRARY-RESEARCH-SCOPE.md`

Master inventory:

- `docs/ai-workforce/HUMAN-MARKETING-GOLDMINE-MASTER-INVENTORY-2026-08.md`

## Completed industry-level Marketing Library research

The planned broad industry sequence is complete at repository-document level.

Completed packs include:

- retail and ecommerce;
- agriculture;
- automotive;
- legal and professional services;
- building materials;
- sustainability and green energy;
- hospitality, restaurants, bars and events;
- South African hospitality brand leaders supplement;
- property, architecture and construction services;
- music, entertainment, creators and ticketed events;
- healthcare, wellness and medical services;
- tourism, accommodation and destinations;
- B2B manufacturing and industrial supply;
- education and training;
- financial, insurance and credit services;
- security and risk services;
- community, sport and entertainment;
- South African rugby culture, Free State and Cheetahs supplement.

These are researched repository documents only. They are not proof that source records, approved knowledge, retrieval or CG Assistant grounding are live in the production Marketing Library.

The correct operational sequence remains:

1. extract and deduplicate sources;
2. assess rights, strength, jurisdiction and freshness;
3. register sources in the actual Library;
4. derive review-state knowledge and skill cards only from strong evidence;
5. prove search, retrieval, citations and limitations;
6. prove approved-only CG Assistant grounding;
7. continue active-client research one client at a time.

## Client-by-client Marketing Library research workflow

The user directed the following workflow:

1. Work alphabetically from the client list.
2. Research one client deeply.
3. Save a client-isolated Marketing Intelligence pack in GitHub.
4. After completion, state the next client name.
5. The user replies **skip** or **go**.
6. Never assume package status from the directory; the user will decide whether to skip or proceed.
7. Verify the exact client identity from website and social evidence before researching.
8. Do not match only on a common name.

Every client pack should cover where applicable:

- exact business identity and services;
- website, Facebook, Instagram, TikTok, LinkedIn, YouTube and Google presence;
- exact locations and service area;
- audience and buying journeys;
- local, provincial and national competitors;
- competitor offers, positioning, content, SEO, reviews, advertising and funnels;
- real customer language and objections;
- positioning and proof pillars;
- sales, lead and booking opportunities;
- content and short-form video systems;
- brand recognition, authenticity and trust;
- entertainment, engagement, reach and following;
- website, SEO and Google Business Profile improvements;
- paid media structures;
- giveaways, partnerships and physical activations;
- reviews, referrals and retention;
- measurable outcomes and a practical 90-day plan;
- explicit unknowns and internal-confirmation requirements.

## Client directory captured from the user’s screenshots

This is the alphabetical working order visible in the screenshots. It is not proof that every record has an active package.

1. Action Sport
2. Adnitor
3. Agri-Secure
4. AV Event Life
5. Avodah
6. Bat Hill Royale
7. BFN Polisie Klub
8. Bloem Marble & Granite
9. Bloem Vascular
10. Bohemia
11. Bouwer & Coetzee Attorneys
12. Braize
13. Brocor
14. C&L Innovations
15. Cape Lumber
16. Case Bloemfontein
17. Central Canvas
18. CG Production House
19. Dabo
20. Daisy & Co
21. Delta Gas
22. Dulux Bloemfontein
23. Econ Foods
24. Ehrlich Park Butchery
25. Emmanuel Funerals
26. Emoya Driving Range
27. First Tech
28. Full Rig Auto Worx
29. G6
30. Germoparts
31. Hino Trucks
32. HMH Attorneys
33. Human Auto
34. Jenkor
35. Kundedienste
36. Local Deli
37. Local Meat Deli
38. Loraclox
39. Madison Wear
40. Madisons
41. My City
42. NCNA
43. Net Nine Nine
44. Nikan Solar
45. Novus Steel
46. Once Off
47. Peyper Bonds
48. Piek Group
49. PSG
50. RC-Polypipe
51. Red Oak
52. Rusoord Farmstay
53. Securiforce
54. Supa Quick BFN
55. Supa Quick Centurion
56. TBS
57. The Staffy
58. Tobich Optics
59. Toyota Bloemfontein
60. Van Pie
61. Vryfees
62. Watch Addict
63. We Ar Fuels
64. Wiseman Group
65. Zooz Lifestyle WFF

The screenshots came from CG Hours and may contain inactive, once-off, paused or historical records. The user controls skip/go decisions.

## Completed client intelligence packs in this sequence

### Action Sport — completed

File:

- `docs/ai-workforce/client-intelligence/ACTION-SPORT-BLOEMFONTEIN-CLIENT-MARKETING-INTELLIGENCE-2026-08.md`

Commit:

- `e8b2cd44d9788ac413039d21bd43e6ee0601bbaa`

Scope included sports, facilities, parties, team building, local competitors, conversion, SEO, content, paid media and 90-day growth.

### Adnitor — skipped by user

No client pack required at this stage.

### Agri-Secure — completed

File:

- `docs/ai-workforce/client-intelligence/AGRI-SECURE-FARM-ARMED-RESPONSE-CLIENT-MARKETING-INTELLIGENCE-2026-08.md`

Commit:

- `f68e1cdfdc7940999996b8a3a91df001e19c5004`

Scope included farm armed response, rural security, farmer trust, layered security, PSiRA, partnerships, lead generation, content and 90-day growth.

### AV Event Life — completed

File:

- `docs/ai-workforce/client-intelligence/AV-EVENT-LIFE-CLIENT-MARKETING-INTELLIGENCE-2026-08.md`

Commit:

- `da5557ad6b35bd010473f228ca8245f00a83942a`

Scope included sound, lighting, staging, screens, livestreaming, installations, event categories, competitors, booking funnels, content and 90-day growth.

### Avodah Manufacturers — completed after full correction

Correct identity:

- Avodah Manufacturers, Bloemfontein;
- cattle-gate and livestock-handling manufacturer;
- public Facebook identity showed approximately 2.6K followers and 126 posts at the time of the user’s screenshot;
- public details included `avodahm.co.za`, 12 Pine Street, Bloemfontein, phone `084 472 3060`, and contact `stefanvanvuuren4@gmail.com`;
- products/content shown included steel cattle gates, feeding rings, custom livestock solutions, sheep flow and pressure-race systems.

Correct file:

- `docs/ai-workforce/client-intelligence/AVODAH-MANUFACTURERS-CATTLE-HANDLING-CLIENT-MARKETING-INTELLIGENCE-2026-08.md`

Commit:

- `8ec7766a764a14825529f0d090b1d8d94e3f4fdc`

The incorrect Christian gap-year pack was deleted completely.

Deletion commit:

- `d147ea6313e33f6fc0de4bff0b33ca307c06248d`

Critical lesson:

> Never select a client identity from name similarity alone. Verify using the client’s actual website, social account, location, phone, products and screenshots before creating permanent knowledge.

## Exact next action

The next client in the alphabetical sequence is:

**Bat Hill Royale**

The next assistant response in this workflow should ask only:

> **Next client: Bat Hill Royale — skip or go?**

Do not begin Bat Hill Royale research until the user says go.

## Known documentation caveat

An attempt to update the master inventory after the Avodah correction hit a GitHub SHA conflict. The incorrect Avodah file itself was deleted and the correct replacement file was created successfully. A later maintenance pass should verify the master inventory contains no stale reference to the deleted Christian gap-year file and update it using a freshly fetched blob SHA.

## Continuity rule for future sessions

At the beginning of a new CG Dynamics session:

1. Read this document.
2. Read `docs/vision/CURRENT-MILESTONE.md`.
3. Read the latest relevant open PR and issue states.
4. Read Issue #184 and its latest comments for Marketing Library progress.
5. Verify the latest default-branch commit before writing code prompts.
6. Continue from the **Exact next action** unless the user redirects.

Do not ask the user to explain CG Dynamics again unless a genuinely new business decision is required.