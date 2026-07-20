# CG Dynamics Early-Stage AI Workforce Discovery Handover

**Discussion date:** 2026-07-01  
**Document role:** Foundational historical handover  
**Importance:** Required reading before continuing major AI Workforce or Marketing Library work  
**Status:** Preserved early-stage product reasoning — not a replacement for current technical source files

---

## Read this first

This document preserves the full early-stage reasoning that established the AI Workforce and Marketing Library direction for CG Dynamics.

It exists so that a new ChatGPT conversation, developer or coding agent can understand why the project was structured this way without requiring the user to repeat the discussion.

This file is deliberately named as an **early-stage discovery handover**. It contains foundational product intent, decisions, constraints, completed work and unresolved thinking from the initial AI Workforce planning period.

It must be treated as important historical context, but it must not silently override newer repository truth.

Before implementing work, also read:

1. `docs/vision/CG-DYNAMICS-MASTER-GOAL-TRACKER.md`
2. `docs/vision/CURRENT-MILESTONE.md`
3. `docs/vision/PARKING-LOT.md`
4. `docs/vision/AI-WORKFORCE-ROADMAP.md`
5. `docs/marketing-library/README.md`
6. `docs/marketing-library/LIBRARY-TRACKER.md`
7. Relevant implementation files, migrations and latest commits

When this handover conflicts with a newer reviewed document or implementation, use the newer source and update the relevant tracker rather than relying on stale discussion history.

---

## 1. Why this discussion started

The user is building CG Dynamics as the internal operating environment for CG Production House, with the possibility of turning parts of it into sellable products or services later.

The immediate concern was that AI should not simply create more generic content. The user wants AI to reduce repetitive production pressure while increasing strategic quality.

The desired shift is:

- Staff should spend less time producing repetitive variations of ordinary social media graphics and copy.
- Staff should spend more time on brand direction, creative judgement, client relationships, video production, quality control and higher-value thinking.
- AI should help with repeatable work, but it must operate from trusted knowledge and real client context.
- Human creativity, especially video production and strategic direction, remains a differentiator.
- The system should make the company stronger rather than reducing every service to undifferentiated AI output.

The user specifically rejected the idea of building another generic ChatGPT wrapper that produces phrases such as:

- Elevate your business.
- Unlock your potential.
- Upgrade your lifestyle.
- Revolutionise your brand.
- Seamless solutions.
- Game-changing results.

The objective is not merely faster content. It is better applied judgement.

---

## 2. Product identity established during the discussion

CG Dynamics is not only a task manager, client dashboard or AI chatbot.

The long-term definition established was:

> CG Dynamics is an AI-assisted business operating system where client intelligence, internal operations and specialist AI knowledge systems work together.

The application should eventually become smarter through accumulated:

- Client information.
- Campaign results.
- Reports.
- Tasks and workflow outcomes.
- Marketing research.
- Approved business knowledge.
- Staff learnings.
- Structured Skill Cards.

The long-term moat is not only the source code. It is the structured intelligence and applied workflow that accumulates in the system.

---

## 3. The three-division architecture

The discussion established three major divisions inside one application.

### 3.1 Client Intelligence

Purpose: Show clients clear value and make performance understandable.

This is the premium client-facing layer and may eventually become a separate subscription or product offering.

Expected future capabilities include:

- Premium performance dashboards.
- Monthly and quarterly reports.
- Campaign performance.
- Meta, Google, website and SEO insights.
- Lead and enquiry tracking where available.
- Competitor and market notes.
- Recommendations and next actions.
- Growth timelines.
- Client-specific insight based on active records and current data.

Core principle:

Reports must not be generic AI summaries. They must explain:

1. What happened.
2. Why it matters.
3. What should happen next.

The client dashboard should eventually be good enough to send directly to a client and strong enough to prove continued value.

### 3.2 Operations Hub

Purpose: Replace scattered daily internal workflow tools when CG Dynamics becomes genuinely easier to use.

The user's current workflow relies heavily on Microsoft Teams, Planner-style buckets, calendars, posting schedules and WhatsApp client groups.

Expected future capabilities include:

- Tasks.
- Buckets.
- Planner-style views.
- Content calendars.
- Posting schedules.
- Morning lists.
- Staff assignments.
- Production pipelines.
- Client requests.
- WhatsApp intake and approval workflows where technically possible.
- Internal handovers and notes.

The user wants CG Dynamics to have the potential to replace Teams instead of adding another disconnected tool.

However, the user also warned that CG Dynamics should not attempt to replace Teams merely by copying features. It must reduce friction and be more pleasant, clear and useful in daily work.

WhatsApp is a particularly important challenge because client groups, approvals and communication currently happen there.

### 3.3 AI Workforce

Purpose: Create specialist AI agents powered by a verified knowledge base.

Expected future areas include:

- Marketing Library.
- Skill Cards.
- Industry libraries.
- Source management.
- Specialist agents.
- Prompt patterns.
- Brand Guardian agents.
- Copywriting agents.
- Marketing Strategy agents.
- Creative Review agents.
- SEO agents.
- Paid Ads agents.
- Reporting agents.
- Internal campaign learning systems.

The AI Workforce must remain a distinct subsystem rather than being mixed randomly into every menu and workflow before its foundation is ready.

---

## 4. Separation rules

The three divisions must share the same ecosystem while remaining visually and mentally distinct.

- Client Intelligence is for client value and performance.
- Operations Hub is for internal delivery and workflow.
- AI Workforce is for knowledge, skills and specialist agents.

Shared data, components and design language are acceptable.

Confused navigation, mixed workflows and random cross-linking are not acceptable.

The user also established a strong product design concern: CG Dynamics currently needs a meaningful visual overhaul in future. The preferred direction is a premium, modern, readable and mobile-friendly experience closer to the clean client-facing dashboard/report design rather than minor cosmetic tweaks.

---

## 5. CG Hours boundary

CG Hours remains a separate application.

Reasons:

- It contains payroll-related information.
- It contains sensitive staff and time data.
- It needs a stable, controlled environment.
- CG Dynamics is broader and more experimental.

Hard rule:

Do not blend confidential payroll or staff financial information into CG Dynamics.

High-level operational integrations may be considered later, but the systems must not become carelessly merged.

---

## 6. The AI philosophy

The central AI rule established was:

> AI must retrieve, reason and apply expertise. AI must not invent expertise.

The system should be able to explain why it proposed a recommendation, headline, campaign structure, report conclusion or creative direction.

AI-generated text is not evidence and is not a source.

AI may assist with:

- Organisation.
- Summarisation.
- Extraction.
- Drafting.
- Applying verified principles.
- Comparing outputs against known standards.

AI may not be treated as the origin of authoritative marketing knowledge.

---

## 7. Why the Marketing Library comes before sophisticated agents

The discussion concluded that building agents before building trusted knowledge would produce polished but generic output.

Therefore the active milestone became the Marketing Library foundation.

The intended sequence is:

1. Define the product vision and boundaries.
2. Define source standards.
3. Define the Skill Card structure.
4. Define storage and database design.
5. Build source notes.
6. Create a small number of draft cards.
7. Perform source-integrity QA.
8. Track status clearly.
9. Verify cards manually.
10. Only then allow agents to use active cards.

The goal is quality over quantity.

---

## 8. Marketing Library source philosophy

The Marketing Library should be built from trusted human and measured sources.

Preferred sources include:

- Classic advertising and copywriting books.
- Behavioural psychology.
- Consumer behaviour research.
- Peer-reviewed research papers.
- Official platform documentation.
- Reputable market data.
- South African audience and market research.
- Internal campaign performance data.
- Client interviews and approved client notes.
- Staff observations clearly labelled as internal learning.

Sources to avoid or treat cautiously include:

- Generic SEO blogs.
- Unverified marketing listicles.
- AI-generated marketing articles.
- Trend-chasing claims without evidence.
- Unsupported attribution.
- Vague principles that merely sound intelligent.

Official platform documentation will eventually be especially important for:

- Meta campaign mechanics.
- Google Ads.
- TikTok Ads.
- SEO platform requirements.
- Analytics and measurement rules.

Classic books should not be used to claim modern platform mechanics they never discussed.

---

## 9. Client and industry knowledge boundaries

Industry knowledge should remain industry-focused and reusable.

Client-specific knowledge must remain tied to active clients and approved context.

Rules established:

- Do not hardcode former clients into the permanent master knowledge base.
- Do not allow inactive-client information to pollute default recommendations.
- Store active client information in client records, client knowledge cards or client-specific context.
- Archived client information may remain searchable if intentionally retained, but it must not become default universal truth.
- Master Skill Cards should remain principle-focused and industry-neutral unless they are explicitly industry cards.

The user was concerned that old client information should never become permanent noise merely because it existed during development.

---

## 10. South African intelligence layer

A dedicated South African market intelligence layer was identified as an important future direction.

It should eventually cover subjects such as:

- Provincial differences.
- Audience language.
- Trust signals.
- Platform usage.
- Buying behaviour.
- Cultural context.
- Local price sensitivity.
- Urban and regional differences.
- South African advertising standards and constraints.

This was parked until the core Marketing Library structure exists.

The reason is that generic American marketing guidance frequently misses local context.

---

## 11. Skill Card model

Every serious, reusable principle should eventually be represented as a Skill Card.

A Skill Card should record:

- The principle.
- Source.
- Author or organisation.
- Source type.
- Publication date where relevant.
- Chapter or section.
- Page reference where available.
- Confidence level.
- Knowledge layer.
- Industry relevance.
- Agent permissions or relevant agents.
- How the principle should be applied.
- Examples.
- Mistakes to avoid.
- Verification status.
- Extrapolation risk.
- Modern translations.
- Review history.

A Skill Card is not active merely because it sounds useful.

Lifecycle established:

1. Draft.
2. `needs_review`.
3. Reviewed after manual source verification.
4. Active only after required review and evidence standards are met.

No card should gain confidence simply because an AI model repeated the idea convincingly.

---

## 12. Source-integrity rules

The following rules were repeatedly reinforced:

- Never invent a page number.
- Never fabricate a quote.
- Never imply a paraphrase is a direct quotation.
- Never attribute a later framework to an earlier author without evidence.
- Label modern marketing applications as translations.
- Separate direct source support from interpretation.
- Flag extrapolation risk.
- Keep confidence low until verification occurs.
- Do not move cards to Active during drafting.
- Do not use AI output as a citation.

These are not optional editorial preferences. They are foundational system rules.

---

## 13. Initial source set

The first source notes created were:

1. **Scientific Advertising** — Claude Hopkins
2. **Ogilvy on Advertising** — David Ogilvy
3. **Influence** — Robert Cialdini
4. **Made to Stick** — Chip Heath and Dan Heath

The source notes were intentionally created without fabricated page references or quotations.

Each note records:

- Why the source matters.
- What it can support.
- What it cannot support.
- Candidate future Skill Cards.
- Review status.
- Manual verification needs.

---

## 14. Scientific Advertising draft batch

The first five draft cards were created from the Scientific Advertising source note:

- `SCI-ADV-001` — Advertising is salesmanship
- `SCI-ADV-002` — Track before scaling
- `SCI-ADV-003` — Specificity over superlatives
- `SCI-ADV-004` — Offers over empty claims
- `SCI-ADV-005` — Serve the customer, not the award

All remained:

- Status: `needs_review`
- Confidence: Low
- Missing verified page/chapter references

They were deliberately not treated as trusted active knowledge.

---

## 15. Scientific Advertising QA findings

A source-integrity QA pass was completed before creating a larger volume of cards.

Important findings included:

### Advertising is salesmanship

The draft used an AIDA-style structure: attention, interest, desire, action.

This must not be attributed to Claude Hopkins without evidence. AIDA is associated with E. St. Elmo Lewis and later copywriting frameworks.

The exact Hopkins wording around salesmanship also requires verification.

### Track before scaling

The card requires verification around:

- Whether Hopkins described split testing in the terms used.
- Whether he said to test one variable at a time.
- Whether budget scaling based on a control was directly discussed.
- How coupon-based tracking should be translated into modern digital contexts.

### Specificity over superlatives

The card requires verification around:

- Exact superlatives or claims Hopkins criticised.
- Whether the honesty-versus-exaggeration framing is direct or interpretive.
- Modern social media and landing-page examples.

### Offers over empty claims

The card may use the modern term “offer” more centrally than Hopkins did.

The alternatives-to-price list and risk-reduction framing require source checking.

### Serve the customer, not the award

This card was marked **High extrapolation risk**.

The awards and agency-portfolio framing may be a modern interpretation rather than a direct principle from the 1923 source.

Strong claims about award-winning advertising being unprofitable must not be attributed to Hopkins without direct evidence.

This QA pass demonstrated why the verification workflow is essential.

---

## 16. Marketing Library tracker

A central tracker was created to prevent the library from becoming an unstructured folder of files.

It tracks:

- Source inventory.
- Source tier.
- Source-note status.
- Extraction progress.
- Draft Skill Cards.
- Confidence.
- Extrapolation risk.
- Manual verification needs.
- Review order.
- Activation rules.
- Next extraction candidates.

Highest-risk items should be reviewed first rather than merely creating more content.

---

## 17. Next source selected

Made to Stick was selected as the next source for draft extraction before Ogilvy on Advertising.

Reason:

Its principles are immediately useful for reducing generic AI communication and improving clarity, memorability and human relevance.

Planned draft cards:

- `MTS-001` — Concrete details beat abstract claims
- `MTS-002` — Curse of knowledge
- `MTS-003` — Simple core message
- `MTS-004` — Unexpected openings
- `MTS-005` — Emotional relevance
- `MTS-006` — Stories as mental simulation

The planned workflow is:

1. Create the draft cards.
2. Keep them at `needs_review` and Low confidence.
3. Label all modern AI, social media, caption and landing-page uses as modern translations.
4. Run a dedicated QA pass next.
5. Update the library tracker.
6. Do not activate any card until verification.

At the point this handover was created, the prompt for the Made to Stick draft batch had been prepared, but completion had not yet been reported in this conversation.

---

## 18. Future agent concepts discussed

### Brand Guardian

Potential responsibilities:

- Detect generic AI wording.
- Check brand consistency.
- Review CTA clarity.
- Review whether claims are supported.
- Check whether creative is self-indulgent rather than useful.
- Identify layout or messaging issues.
- Explain why a revision is recommended.

### Copywriting Agent

Potential responsibilities:

- Retrieve relevant Skill Cards.
- Apply active-client brand context.
- Generate options based on verified principles.
- Avoid unsupported claims.
- Explain the strategy behind each version.

### Marketing Strategist Agent

Potential responsibilities:

- Build campaign logic.
- Connect audience, objective, offer and channel.
- Use behavioural research appropriately.
- Recommend measurement plans.
- Distinguish evidence from hypotheses.

### Paid Ads Agent

Potential responsibilities:

- Meta and Google campaign planning.
- Audience and funnel logic.
- Lead generation strategy.
- Campaign setup recommendations.
- Result interpretation.

This agent must wait until official platform documentation and paid-ad Skill Cards exist.

### Reporting Agent

Potential responsibilities:

- Interpret campaign and performance data.
- Explain why changes matter.
- Recommend next actions.
- Produce client-readable insight rather than generic summaries.

### AI Poster Workflow

Potential responsibilities:

- Use approved source assets.
- Use brand rules.
- Use verified marketing principles.
- Produce first drafts rather than replacing human creative direction.
- Reduce repetitive design production pressure.

This remains parked until the knowledge and storage foundation exists.

---

## 19. Broader commercial direction

The user sees several possible long-term commercial layers:

- CG Dynamics as an internal operating system.
- Premium client intelligence and reporting as a standalone service or subscription.
- AI-powered advertising and marketing strategy services.
- Specialist agents for SMEs.
- A structured marketing intelligence platform built from real campaign data and verified knowledge.

The user wants CG Production House to move beyond producing attractive content and become stronger at measurable lead generation, campaign strategy and business value.

The client dashboard is therefore not merely an internal reporting screen. It may become an important storefront and retention tool.

---

## 20. Development workflow established

GitHub is the permanent source of truth for project direction, progress and handover.

The coding workflow established was:

1. Check the repository first.
2. Check the latest commit and relevant files.
3. Use one focused task per coding prompt.
4. Avoid repeating the entire project history when the repository already records it.
5. Tell the coding agent to run `git status` first.
6. Pull before work.
7. Build before committing.
8. Commit and push only if the build passes.
9. Never allow two coding agents to work on the same branch simultaneously.

The user often uses OpenCode with DeepSeek as the practical workhorse, with Gemini CLI, Claude, Codex, Cline and Roo Code as available or backup agents depending on usage limits.

---

## 21. Worktree and branch isolation

Operations Hub development was happening at the same time as AI Workforce work.

The original AI branch became contaminated by unrelated planner/task changes in the working tree. The build failure was not necessarily caused by AI Workforce files, but the overlap demonstrated that branch separation alone was not enough when multiple active work streams shared one physical working directory.

A separate Git worktree was therefore created.

### Original project worktree

`C:\Projects\CG-Dynamics`

Used for active Operations Hub and general app development.

### AI Workforce worktree

`C:\Projects\CG-Dynamics-AI`

Used for isolated AI Workforce and Marketing Library work.

### Active AI branch during this discussion

`feature/ai-workforce-db-design`

Rules:

- AI prompts must verify the folder and branch before changing files.
- AI Workforce tasks must not touch planner, Command Centre, task, Hub, CG Hours or unrelated app files unless a future milestone explicitly integrates them.
- Do not let another coding agent work on the same branch at the same time.
- Keep commits focused.

---

## 22. Files and foundations created during this initiative

### Vision and control documents

- `docs/vision/CG-DYNAMICS-MASTER-GOAL-TRACKER.md`
- `docs/vision/CURRENT-MILESTONE.md`
- `docs/vision/PARKING-LOT.md`
- `docs/vision/AI-WORKFORCE-ROADMAP.md`

### Marketing Library governance

- `docs/marketing-library/README.md`
- `docs/marketing-library/SKILL-CARD-TEMPLATE.md`
- `docs/marketing-library/SOURCE-STANDARDS.md`
- `docs/marketing-library/DATABASE-DESIGN.md`
- `docs/marketing-library/LIBRARY-TRACKER.md`

### AI Workforce code foundation

- `src/types/skillCards.ts`
- `src/lib/marketing-library/skillCardUtils.ts`
- `src/features/ai-workforce/marketing-library/sampleSkillCards.ts`
- `src/features/ai-workforce/README.md`
- `src/features/ai-workforce/AiWorkforcePlaceholder.tsx`

### Database design

- `supabase/ai-workforce-skill-library.sql`

### Source notes

- `docs/marketing-library/source-notes/README.md`
- `docs/marketing-library/source-notes/scientific-advertising.md`
- `docs/marketing-library/source-notes/ogilvy-on-advertising.md`
- `docs/marketing-library/source-notes/influence.md`
- `docs/marketing-library/source-notes/made-to-stick.md`

### Scientific Advertising draft cards

Folder:

`docs/marketing-library/skill-cards/drafts/scientific-advertising/`

Contents include:

- `README.md`
- `QA-CHECKLIST.md`
- `advertising-is-salesmanship.md`
- `tracking-before-scaling.md`
- `specificity-over-superlatives.md`
- `offers-over-empty-claims.md`
- `serve-the-customer-not-the-award.md`

---

## 23. Commit history recorded during this initiative

The following commits were reported and reviewed during the early foundation work:

### `3e6076d`

`feat: add AI Workforce skill library foundation`

Added the first isolated AI Workforce code foundation, including types, utilities, sample cards, feature README and placeholder component.

### `bf2e640`

`feat: add marketing library database design`

Added:

- `supabase/ai-workforce-skill-library.sql`
- `docs/marketing-library/DATABASE-DESIGN.md`

This work was completed after moving AI development into the clean worktree.

### `733809a`

`docs: add marketing library source note templates`

Added the source-note structure and first source notes.

### `aa68b98`

`docs: add first Scientific Advertising draft skill cards`

Added the five initial draft cards. All were kept at `needs_review`.

### `589b5e5b4754a683c740021d41272b12298c5a82`

`docs: add Scientific Advertising skill card QA pass`

Added the QA checklist and Verification flags to all five cards.

### `a9bcc605826587392b45d5d8add187ff733e02ed`

`docs: add marketing library tracker`

Added the central library tracker and linked it from the Marketing Library README.

A later conversation or coding agent must verify the branch history and latest repository state rather than assuming this list remains complete.

---

## 24. Parking-lot ideas captured

The following ideas were intentionally parked rather than allowed to derail the foundation milestone:

- AI-generated poster workflow.
- Brand Guardian review agent.
- Premium client reporting storefront.
- Paid ads strategy agent.
- South African market intelligence layer.

These ideas remain important. They were not rejected; they were sequenced.

---

## 25. Current milestone at the time of this handover

**Milestone:** Marketing Library foundation

The purpose was to create trusted knowledge structure before specialist AI execution.

In scope:

- Product documents.
- Skill Card schema.
- Source standards.
- Database/storage design.
- Source notes.
- First trusted draft batches.
- QA and review workflow.

Out of scope during this milestone:

- Full agent execution.
- Automated poster generation.
- Large-scale client libraries.
- Client report redesign.
- Full Operations Hub rebuild.
- CG Hours integration.
- Payroll features.

---

## 26. Definition of “good” for this initiative

A successful AI Workforce is not measured by how much text it generates.

It should:

- Produce less generic work.
- Be able to cite or identify its reasoning source.
- Separate fact, principle, interpretation and hypothesis.
- Respect client boundaries.
- Improve human decision-making.
- Reduce repetitive pressure.
- Help staff act as strategists, directors and reviewers.
- Become more useful as verified knowledge and real performance data accumulate.

A feature should be reassessed when it does not make CG Dynamics:

- Smarter.
- Easier to use.
- More valuable to clients.

---

## 27. Risks identified

### Knowledge pollution

Risk: Filling the library with unverified claims, AI-generated material or client-specific noise.

Control: Source standards, confidence levels, review states, Verification flags and active-client boundaries.

### Generic AI output

Risk: Agents produce fluent but interchangeable content.

Control: Verified Skill Cards, Brand Guardian logic, concrete-message principles, client context and explainable recommendations.

### Product drift

Risk: CG Dynamics becomes a random collection of tools.

Control: Master Goal Tracker, current milestone, parking lot and one-task prompts.

### Workflow duplication

Risk: The app becomes another manual system alongside Teams and WhatsApp.

Control: Only replace workflows when CG Dynamics is genuinely easier and integrates the real way the team works.

### Branch contamination

Risk: Simultaneous Hub and AI development alter the same working tree.

Control: Dedicated worktree and branch isolation.

### False historical attribution

Risk: Modern frameworks are incorrectly attributed to classic authors.

Control: Manual source verification and explicit extrapolation flags.

---

## 28. Instructions for a new ChatGPT conversation

When this file is supplied to another ChatGPT conversation, that conversation should:

1. Treat this as foundational background.
2. Read current GitHub files before proposing code.
3. Verify the latest branch and commits.
4. Ask which division and milestone the requested task belongs to.
5. Keep AI Workforce work isolated unless integration is explicitly requested.
6. Preserve source-integrity rules.
7. Avoid turning parked concepts into immediate scope.
8. Do not assume an old planned task is still the next task.
9. Prefer short, focused coding-agent prompts.
10. Run build checks before recommending commits.

The conversation should not make the user repeat the philosophy above unless a genuinely new decision is required.

---

## 29. Immediate continuation point recorded here

The immediate planned coding task when this handover was requested was:

> Create six draft Made to Stick Skill Cards in the clean AI worktree, update the tracker, keep all cards at `needs_review` and Low confidence, label modern translations, run the build, commit and push if successful. Do not create the QA checklist in the same task.

Before executing that plan, check whether it has already been completed in newer commits.

---

## 30. Final foundational statement

CG Dynamics should not become a system that generates more noise.

It should become a system that helps CG Production House think better, work with less friction, demonstrate clearer value to clients and preserve real expertise over time.

The AI Workforce succeeds only when its intelligence is traceable, useful, context-aware and worthy of human trust.
