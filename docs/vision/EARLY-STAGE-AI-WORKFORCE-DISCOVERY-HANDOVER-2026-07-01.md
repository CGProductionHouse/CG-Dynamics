# CG Dynamics Early-Stage AI Workforce Discovery Handover

**Original discussion date:** 2026-07-01  
**Progress verification added:** 2026-07-21  
**Document role:** Foundational historical handover plus verified implementation snapshot  
**Importance:** Required reading before continuing major AI Workforce, Marketing Library, Industry Brain, Client Brain or specialist-agent work  
**Repository:** `CGProductionHouse/CG-Dynamics`  
**AI branch:** `feature/ai-workforce-db-design`

---

## Read this first

This document preserves the early reasoning that established the AI Workforce and Marketing Library direction, but it now also records what is actually present in GitHub so that future ChatGPT conversations and coding agents do not waste usage rebuilding completed foundations.

It is important, but it is not the only source of truth.

Before proposing or implementing work, read the current living documents in this order:

1. `docs/VISION.md`
2. `docs/CORE_PRINCIPLES.md`
3. `docs/CG_ASSISTANT.md`
4. `docs/CHAT_CONTINUITY.md`
5. `docs/marketing-library/IMPLEMENTATION-READINESS-MANIFEST.md`
6. `docs/marketing-library/universal-marketing-brain/UNIVERSAL-MARKETING-BRAIN-BLUEPRINT.md`
7. `docs/marketing-library/LIBRARY-TRACKER.md`
8. This historical handover
9. Relevant implementation files, migrations, tests, PRs and latest commits

When this document conflicts with newer reviewed documentation or code, use the newer repository truth.

Do not make Christie-Ann repeat this project history unless a genuinely new product decision is required.

---

# Part A — Verified repository progress

## 1. Verified branch snapshot on 2026-07-21

The AI Workforce branch was compared directly against `main`.

At verification time:

- Branch: `feature/ai-workforce-db-design`
- Status versus `main`: diverged
- Ahead of `main`: 48 commits
- Behind `main`: 123 commits
- Merge base: `e918583728b2354f0b4502d64f1418e4ae95b0f4`
- Main comparison commit at that moment: `56ee0fa87365413aa07ce61442ac940865ea8e51`

This means:

- The AI branch contains substantial work that is not on `main`.
- `main` also contains substantial newer application work that is not on the AI branch.
- Do not merge, rebase or copy broad folders blindly.
- Inspect both sides first and plan integration deliberately.
- Do not assume the AI branch is a current full-app branch.

## 2. Broader CG Dynamics progress recorded outside the AI branch

The current continuity document records a major Microsoft transition workstream on a separate branch and PR.

Latest recorded state in `docs/CHAT_CONTINUITY.md` as of 2026-07-20:

- Active Microsoft transition PR: `#27`
- Branch: `feature/microsoft-transition-sync`
- Latest reported sync commit: `9424ebf6b9b48d415d5ca0b8a7396663b97698ba`
- Autonomous preview processed 1,648 source records.
- 539 creates.
- 248 conflicts.
- 861 skipped.
- 0 failed.
- All five sources completed.
- `unsupported_bucket = 0`.
- 22 Microsoft sync tests passed.
- Build passed.
- Vercel deployment passed.
- Coding-agent recommendation was `SAFE TO APPLY`.
- Nothing had been applied at the time of that report.
- No source removals were approved.
- No Microsoft writes occurred.

Before any production reconciliation:

- Inspect PR `#27` and its latest commits.
- Review the current conflict breakdown.
- Require explicit product-owner approval before Apply.
- Require explicit approval for source removals.

The Microsoft coexistence architecture is:

- Microsoft remains read-only upstream during transition.
- CG Dynamics becomes the execution view.
- No Microsoft writes.
- No hard deletes.
- Source removals require approval.
- Outlook maps to CG Calendar.
- Operational Planner sources map to operational destinations.
- Client Socials maps to `monthly_deliverables` and Client Schedule.
- Unknown or ambiguous mappings fail closed.

Do not redo that transition architecture from scratch without reading the PR and continuity documents.

## 3. Current broader product direction already established

Recent product work expanded the architecture beyond the original three-division idea.

The specialist knowledge hierarchy is now:

1. Shared CG marketing and business knowledge.
2. Industry Brains.
3. Client Brains.
4. Campaign and Digital Content Guide context.
5. Content Run outcomes.
6. Performance learning.

Every active client should eventually have an isolated Client Brain that inherits the appropriate Industry Brain and adds:

- Brand context.
- Audience understanding.
- Products and services.
- Tone and language.
- Approved wording.
- Rejected ideas.
- Content pillars.
- Assets.
- History.
- Performance learning.

Digital Content Guides are intended to replace static PDF content guidelines with structured in-app workflows connecting:

- Client.
- Content run.
- Operational calendar event.
- Client-visible event where appropriate.
- Staff assignment.
- Industry Brain.
- Client Brain.
- Internal review.
- Client approval, amendment, rejection and comments.
- Editing handoff.
- Client Schedule handoff.

The Content Run completion direction is one natural voice note, not a long manual report form.

The system should infer and summarise:

- Videos completed or shot.
- On-site amendments.
- Rejected or unsuitable ideas.
- Approved videos not completed.
- Ideas to move forward.
- Expired time-sensitive ideas.
- New client preferences.
- Useful operational and creative learning.

The governing principle is less administration, not merely more AI.

## 4. Known app issue that must not be forgotten

`docs/CHAT_CONTINUITY.md` records a Client Schedule regression or unresolved UX issue.

Expected rule:

- Client Schedule must default to a genuine month calendar with days, dates and scheduled times.
- Bucket or board view may exist only as an optional view.
- CG Calendar remains operational and does not own scheduled social posts.

Do not treat the bucket-first state as an approved product decision.

---

# Part B — What is already built on the AI Workforce branch

## 5. Current-truth and continuity documents

The branch contains these living coordination documents:

- `docs/VISION.md`
- `docs/CORE_PRINCIPLES.md`
- `docs/CG_ASSISTANT.md`
- `docs/CHAT_CONTINUITY.md`

These should be read before historical files.

The branch also contains the original vision controls:

- `docs/vision/CG-DYNAMICS-MASTER-GOAL-TRACKER.md`
- `docs/vision/CURRENT-MILESTONE.md`
- `docs/vision/PARKING-LOT.md`
- `docs/vision/AI-WORKFORCE-ROADMAP.md`
- `docs/vision/EARLY-STAGE-AI-WORKFORCE-DISCOVERY-HANDOVER-2026-07-01.md`

## 6. TypeScript Skill Card foundation

The following code exists:

- `src/types/skillCards.ts`
- `src/lib/marketing-library/skillCardUtils.ts`
- `src/features/ai-workforce/marketing-library/sampleSkillCards.ts`
- `src/features/ai-workforce/README.md`
- `src/features/ai-workforce/AiWorkforcePlaceholder.tsx`

### Implemented TypeScript model

`src/types/skillCards.ts` defines:

- Skill Card lifecycle statuses:
  - `draft`
  - `needs_review`
  - `reviewed`
  - `active`
  - `deprecated`
- Knowledge layers:
  - universal principle
  - South African market
  - industry-specific
  - active-client-specific
  - internal learning
- Source types.
- Confidence levels.
- Evidence labels.
- Relevant agents.
- Industry tags.
- Source references.
- Full Skill Card structure.

### Implemented utilities

`src/lib/marketing-library/skillCardUtils.ts` provides:

- Filter by category.
- Filter by industry.
- Filter by relevant agent.
- Active-card check.
- Client-specific-card check.
- Low-trust-source detection.

### Sample data already present

`sampleSkillCards.ts` contains three clearly labelled draft hypotheses for:

- Real estate.
- Restaurants and hospitality.
- Automotive.

These are sample structures and internal observations, not approved universal truth.

### Placeholder UI state

`AiWorkforcePlaceholder.tsx` exists.

It explicitly states that the Marketing Library foundation is isolated and not connected to navigation yet.

Therefore:

- A placeholder component is built.
- A complete AI Workforce interface is not built.
- Navigation integration is not built on this branch.

## 7. Database and storage design already present

The branch contains:

- `supabase/ai-workforce-skill-library.sql`
- `docs/marketing-library/DATABASE-DESIGN.md`

The SQL design includes:

- `marketing_library_sources`
- `skill_cards`
- `skill_card_reviews`
- `skill_card_usage_logs`
- source trust tiers
- Skill Card statuses
- confidence levels
- evidence labels
- relevant metadata
- future active-client link
- review logging
- future usage traceability
- indexes

Important distinction:

- The SQL design file exists.
- Its presence does not prove that the migration has been applied to production.
- Verify Supabase migration history and the live schema before claiming the tables exist in the deployed database.

## 8. Marketing Library governance and schemas already present

The branch contains:

- `docs/marketing-library/README.md`
- `docs/marketing-library/DATABASE-DESIGN.md`
- `docs/marketing-library/IMPLEMENTATION-READINESS-MANIFEST.md`
- `docs/marketing-library/LIBRARY-TRACKER.md`
- `docs/marketing-library/SKILL-CARD-SCHEMA.md`
- `docs/marketing-library/SOURCE-LIBRARY-RESEARCH-PLAN.md`
- `docs/marketing-library/SOURCE-NOTE-SCHEMA.md`

These documents already define substantial governance and should not be recreated from zero.

The implementation-readiness manifest states that coding agents may begin foundational database and governance implementation for:

- Universal governance.
- Domain 1 records and workflows.
- Platform Expert shared structures.
- Evidence state.
- Confidence.
- Verification.
- Expiry.
- Traceability.
- Review states.

It does not say the entire Universal Marketing Brain is complete.

## 9. Universal Marketing Brain architecture already present

The branch contains:

- `docs/marketing-library/universal-marketing-brain/UNIVERSAL-MARKETING-BRAIN-BLUEPRINT.md`
- `docs/marketing-library/universal-marketing-brain/UNIVERSAL-BRAIN-AUDIT-2026-07-20.md`

The Universal Marketing Brain is organised into twelve domains:

1. Market and customer understanding.
2. Positioning and differentiation.
3. Offer and commercial strategy.
4. Consumer psychology and behaviour.
5. Human copy and language.
6. Ideas, creativity and cultural observation.
7. Storytelling and message architecture.
8. Visual communication and art direction.
9. Trust, proof and persuasion.
10. Campaign planning and channel roles.
11. Measurement, testing and learning.
12. Ethics, legality and brand safety.

The audit is a point-in-time gap analysis. Later work strengthened Domain 1, so do not read the audit's early “weak foundation” label without checking the Domain 1 files and readiness manifest.

## 10. Domain 1 is substantially designed

The following files already exist:

- `docs/marketing-library/universal-marketing-brain/domain-01-market-and-customer-understanding/BUSINESS-UNDERSTANDING-ENGINE.md`
- `docs/marketing-library/universal-marketing-brain/domain-01-market-and-customer-understanding/DOMAIN-01-BLUEPRINT.md`
- `docs/marketing-library/universal-marketing-brain/domain-01-market-and-customer-understanding/DOMAIN-01-DATA-MODEL.md`
- `docs/marketing-library/universal-marketing-brain/domain-01-market-and-customer-understanding/DOMAIN-01-EVALUATION-CHECKLIST.md`

Domain 1 Skill Cards already present:

- `confidence-must-match-the-evidence.md`
- `find-the-current-alternative.md`
- `record-contradictions-not-only-patterns.md`
- `separate-buyer-user-influencer-and-blocker.md`
- `separate-observation-from-interpretation.md`
- `treat-objections-as-different-risks.md`

The readiness manifest says the application may implement Domain 1 records, retrieval, review states and traceability now.

Do not spend usage redesigning Domain 1 from scratch before reading these files.

## 11. Platform Expert architecture already present

Shared platform architecture files:

- `docs/marketing-library/platform-experts/PLATFORM-EXPERT-DATA-MODEL.md`
- `docs/marketing-library/platform-experts/PLATFORM-EXPERT-SYSTEM-BLUEPRINT.md`

Initial Platform Expert documents already exist for:

- Facebook.
- Instagram.
- LinkedIn.
- TikTok.
- Google Business Profile.
- YouTube.
- WhatsApp Business.

These are foundation expert documents.

They do not mean every current platform mechanic has been fully populated or verified.

Current mechanics must still come from exact official source records and require freshness, expiry and change handling.

## 12. Industry Expert work already present

The branch contains:

- `docs/marketing-library/industry-experts/hospitality/HOSPITALITY-EXPERT-BLUEPRINT.md`

Hospitality is therefore not an empty starting point.

Read the blueprint before creating new hospitality architecture or cards.

## 13. Source notes and source packs already present

Source-note structure:

- `docs/marketing-library/source-notes/README.md`
- `docs/marketing-library/SOURCE-NOTE-SCHEMA.md`

Source notes already present:

- `scientific-advertising.md`
- `ogilvy-on-advertising.md`
- `influence.md`
- `made-to-stick.md`
- `historical-advertising-and-human-copy.md`
- `hospitality-human-motivations-and-occasions.md`

Source pack already present:

- `docs/marketing-library/source-packs/golden-marketing-source-pack-01.md`

Do not recreate these files without first auditing and improving them.

## 14. Skill Cards and knowledge assets already present

### Scientific Advertising draft folder

`docs/marketing-library/skill-cards/drafts/scientific-advertising/`

Contains:

- `README.md`
- `QA-CHECKLIST.md`
- `advertising-is-salesmanship.md`
- `tracking-before-scaling.md`
- `specificity-over-superlatives.md`
- `offers-over-empty-claims.md`
- `serve-the-customer-not-the-award.md`

These cards remain draft knowledge requiring manual verification.

Known QA warnings include:

- Do not attribute AIDA to Claude Hopkins without evidence.
- Verify split-testing and scaling wording.
- Verify specific terms and claims.
- Treat modern digital examples as translations.
- `Serve the customer, not the award` has high extrapolation risk.

### Additional Skill Cards already present

The branch also contains:

- `ask-about-the-last-real-event.md`
- `capture-customer-words-verbatim.md`
- `cultural-observation-before-copy.md`
- `evidence-before-persona.md`
- `human-copy-over-ai-slop.md`
- `map-functional-emotional-social-and-identity-progress.md`
- `map-the-trigger-not-only-the-demographic.md`
- `market-the-occasion-not-only-the-item.md`

Do not assume Scientific Advertising is the only completed content batch.

## 15. Made to Stick status — important correction

A prompt was prepared to create six Made to Stick draft Skill Cards, but the expected draft folder and first card were not present when verified on 2026-07-21.

The missing expected path was:

`docs/marketing-library/skill-cards/drafts/made-to-stick/`

The Marketing Library tracker still recorded Made to Stick extraction as `Not started`.

Therefore:

- The Made to Stick source note exists.
- The six planned Made to Stick draft cards should not be claimed as completed.
- Before creating them, check newer commits again in case another agent has completed the task after this verification.

Planned cards were:

- `MTS-001` — Concrete details beat abstract claims.
- `MTS-002` — Curse of knowledge.
- `MTS-003` — Simple core message.
- `MTS-004` — Unexpected openings.
- `MTS-005` — Emotional relevance.
- `MTS-006` — Stories as mental simulation.

## 16. Library Tracker warning

`docs/marketing-library/LIBRARY-TRACKER.md` was last updated on 2026-07-01 and accurately records the initial source-note and Scientific Advertising phase.

It does not yet reflect all later work now present on the branch, including:

- Universal Marketing Brain architecture.
- Domain 1 architecture and Skill Cards.
- Platform Expert architecture.
- Hospitality Expert blueprint.
- Later source notes.
- Source pack.
- Additional Skill Cards.
- Implementation readiness work.

Do not use the tracker as the sole measure of current progress.

A future focused documentation task should reconcile it with the actual branch inventory.

---

# Part C — What is not yet built or must not be assumed

## 17. Do not claim these as completed without verification

The following are not proven complete merely because architecture documents exist:

- Full AI Workforce navigation and user interface.
- Production Marketing Library UI.
- Runtime retrieval engine.
- Specialist agent execution.
- Agent orchestration.
- Active-card enforcement at runtime.
- Stale-source blocking in running application code.
- Platform change-refresh automation.
- Production Industry Brain system.
- Production Client Brain system.
- Digital Content Guide workflow.
- Voice-note Content Run completion workflow.
- Automatic performance-learning loop.
- Applied production database migration.
- Full Universal Marketing Brain domains 2 through 12.
- Fully verified and current official platform mechanics.
- Made to Stick draft-card batch.

## 18. Current implementation boundary

What exists today is strongest in:

- Product architecture.
- Governance.
- Source standards.
- Knowledge schemas.
- Domain 1 design.
- Platform Expert design.
- Early Skill Card content.
- TypeScript model foundation.
- SQL storage design.

What remains is the larger application implementation and controlled integration into the modern `main` application.

---

# Part D — Foundational product reasoning

## 19. Why the AI Workforce discussion started

The aim was never to build another generic ChatGPT wrapper.

The user wants AI to reduce repetitive production pressure while increasing strategic quality.

Desired shift:

- Less repetitive generic copy and design production.
- More human creative direction.
- More strategic thinking.
- More client understanding.
- More quality control.
- More measurable business value.
- Better use of video, insight and brand judgement.

Generic wording such as the following is unacceptable unless specifically justified by brand context:

- Elevate.
- Unlock.
- Revolutionise.
- Seamless.
- Game-changing.
- Upgrade your lifestyle.

The objective is not merely faster content. It is better applied judgement.

## 20. Product identity

CG Dynamics is an AI-assisted business operating system where client intelligence, internal operations and specialist knowledge systems work together.

The system should become smarter through accumulated:

- Client information.
- Campaign results.
- Reports.
- Tasks and workflow outcomes.
- Marketing research.
- Approved business knowledge.
- Staff learning.
- Structured Skill Cards.
- Content outcomes.
- Performance evidence.

The long-term moat is not only code. It is the structured intelligence and applied workflow that accumulate over time.

## 21. Three primary product divisions

### Client Intelligence

Purpose:

- Show clients clear value.
- Make performance understandable.
- Provide premium reports and dashboards.
- Explain what happened, why it matters and what should happen next.

Expected areas:

- Campaign performance.
- Meta, Google, website and SEO insights.
- Lead and enquiry tracking.
- Recommendations.
- Competitor and market notes.
- Growth timelines.
- Client-specific insights from active records.

### Operations Hub

Purpose:

- Replace scattered daily tools only when CG Dynamics becomes genuinely easier.

Expected areas:

- Tasks.
- Buckets.
- Planner-style views.
- Calendar and content schedules.
- Morning lists.
- Staff assignments.
- Production pipeline.
- Client requests.
- WhatsApp intake and approvals where technically possible.
- Internal handovers.

The product must not simply copy Teams and add more administration.

WhatsApp remains important because client communication and approvals currently happen there.

### AI Workforce

Purpose:

- Create specialist agents powered by verified knowledge and active context.

Expected areas:

- Marketing Library.
- Universal Marketing Brain.
- Industry Brains.
- Client Brains.
- Skill Cards.
- Source management.
- Brand Guardian.
- Copywriting Agent.
- Marketing Strategist.
- Creative Review.
- Paid Ads Agent.
- SEO Agent.
- Reporting Agent.
- Platform Experts.
- Research refresh workflows.

## 22. Separation principles

The divisions share an ecosystem but must remain mentally and visually clear.

- Client Intelligence is for client value and performance.
- Operations Hub is for internal delivery.
- AI Workforce is for knowledge and specialist intelligence.

Shared data and design systems are acceptable.

Confused navigation and mixed workflows are not.

## 23. CG Hours boundary

CG Hours remains separate because it contains payroll-related and sensitive staff data.

Hard rule:

- Do not blend confidential payroll or staff financial data into CG Dynamics.

High-level operational integration may be considered later, but the systems must remain controlled.

## 24. AI philosophy

Core rule:

> AI must retrieve, reason and apply expertise. It must not invent expertise.

AI-generated text is not evidence and is not a source.

AI may help with:

- Organisation.
- Summarisation.
- Extraction.
- Drafting.
- Application of verified principles.
- Comparison against standards.

Material recommendations should expose:

- Source.
- Confidence.
- Freshness.
- Scope.
- Reasoning.

## 25. Marketing Library source philosophy

Preferred sources:

- Classic advertising and copywriting books.
- Behavioural psychology.
- Consumer behaviour research.
- Peer-reviewed research.
- Official platform documentation.
- Reputable market data.
- South African market research.
- Internal campaign performance.
- Client interviews and approved client notes.
- Staff observations clearly labelled as internal learning.

Avoid or treat cautiously:

- Generic SEO blogs.
- Unverified listicles.
- AI-generated marketing articles.
- Unsupported trend claims.
- Unsupported attribution.
- Vague principles that merely sound intelligent.

Classic sources must not be used to claim modern platform mechanics they never discussed.

## 26. Client and industry knowledge boundaries

Rules:

- Do not hardcode former clients into permanent master knowledge.
- Inactive-client information must not pollute default recommendations.
- Active client knowledge belongs in isolated client records or Client Brains.
- Universal cards should remain principle-focused.
- Industry cards may specialise universal knowledge.
- Client-specific learning must remain scoped to the correct client unless deliberately promoted through review.
- A client observation does not automatically become an industry rule.

## 27. South African intelligence layer

A dedicated South African market layer remains important.

Potential scope:

- Provincial differences.
- Audience language.
- Trust signals.
- Platform usage.
- Buying behaviour.
- Cultural context.
- Local price sensitivity.
- Urban and regional differences.
- Advertising standards and legal context.

Generic American guidance must not be assumed to fit South African clients.

## 28. Skill Card lifecycle and integrity

A Skill Card should record:

- Principle.
- Source.
- Author or organisation.
- Source type.
- Publication date.
- Chapter, section, page or URL where available.
- Confidence.
- Knowledge layer.
- Industry relevance.
- Relevant agents.
- Application guidance.
- Examples.
- Mistakes to avoid.
- Verification status.
- Extrapolation risk.
- Modern translations.
- Review history.

Lifecycle:

1. Draft.
2. `needs_review`.
3. Reviewed after source verification.
4. Active only after approval.
5. Deprecated when no longer valid.

Integrity rules:

- Never invent a page number.
- Never fabricate a quote.
- Never present paraphrase as quotation.
- Never attribute later frameworks to earlier authors without evidence.
- Label modern applications as translations.
- Separate direct support from interpretation.
- Flag extrapolation risk.
- Keep confidence honest.
- AI output is never a citation.

---

# Part E — Development workflow and branch safety

## 29. Worktree structure

General and Operations worktree:

`C:\Projects\CG-Dynamics`

AI Workforce worktree:

`C:\Projects\CG-Dynamics-AI`

AI branch:

`feature/ai-workforce-db-design`

Rules:

- Verify folder and branch before changing files.
- Do not let two coding agents work on the same branch simultaneously.
- Keep commits focused.
- Pull before work.
- Run relevant tests and build.
- Commit and push only when checks pass.
- Do not touch unrelated planner, Command Centre, CG Hours or Hub files from the isolated AI worktree unless integration is explicitly planned.

## 30. Early verified commits

The early foundation included these reviewed commits:

- `3e6076d` — `feat: add AI Workforce skill library foundation`
- `bf2e640` — `feat: add marketing library database design`
- `733809a` — `docs: add marketing library source note templates`
- `aa68b98` — `docs: add first Scientific Advertising draft skill cards`
- `589b5e5b4754a683c740021d41272b12298c5a82` — `docs: add Scientific Advertising skill card QA pass`
- `a9bcc605826587392b45d5d8add187ff733e02ed` — `docs: add marketing library tracker`
- `d270875b6e5af6f8a2ce289f6811a0df9149784c` — `docs: preserve early AI Workforce discovery handover`

The branch contains many later commits and files beyond this early list.

Always inspect current history rather than assuming this is complete.

## 31. Do-not-redo checklist for a new chat

Before suggesting new work, confirm whether it already exists in:

- Current living docs.
- AI branch diff.
- Universal Brain files.
- Domain 1 files.
- Platform Expert files.
- Hospitality Expert blueprint.
- Source notes.
- Source pack.
- Existing Skill Cards.
- SQL design.
- TypeScript foundation.
- Microsoft transition PR.

Do not create another version of an existing blueprint merely because the current conversation has not read it yet.

## 32. Required behaviour for a new ChatGPT conversation

A new conversation should:

1. Read the four current living documents.
2. Read this handover for the historical AI rationale and verified branch inventory.
3. Inspect GitHub directly.
4. Check the latest branch, PRs and commits.
5. Distinguish built code from architecture-only documentation.
6. Distinguish current truth from historical plans.
7. Identify which division and milestone the request belongs to.
8. Avoid duplicating completed work.
9. Use focused implementation prompts.
10. Require autonomous testing and QA.
11. Ask Christie-Ann only for true product decisions or consequential approvals.

## 33. Current safe continuation logic

Do not automatically continue with the old Made to Stick prompt merely because it was once the next task.

First check:

- Current product priority.
- Microsoft transition status.
- Current branch status.
- Whether the Library Tracker has been reconciled.
- Whether the Made to Stick folder now exists.
- Whether integration work is more urgent than further card drafting.

At the verified point on 2026-07-21:

- The AI branch has substantial completed architecture and content.
- Domain 1 and Platform Expert structures are implementation-ready foundations.
- The Library Tracker is behind the branch's real progress.
- The Made to Stick draft batch is not verified as completed.
- The branch is heavily diverged from `main` and must not be merged casually.
- The broader app priority recorded in continuity is Microsoft transition safety, then Client Schedule, Digital Content Guides, Industry Brains and Client Brains.

---

## Final foundational statement

CG Dynamics should not become a system that generates more noise.

It should help CG Production House:

- Think better.
- Work with less friction.
- Preserve real expertise.
- Understand active clients deeply.
- Produce more human and strategically useful work.
- Demonstrate clearer client value.
- Learn from real outcomes.

The AI Workforce succeeds only when its intelligence is traceable, current, scoped correctly, explainable and worthy of human trust.
