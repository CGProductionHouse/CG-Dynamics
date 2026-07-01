# Marketing Library Tracker

Last updated: 2026-07-01
Status: Active tracking document

## 1. Purpose

This file tracks the Marketing Library buildout across sources, draft Skill Cards, reviewed Skill Cards and active Skill Cards.

It exists so we can see:

- Which sources have been identified.
- Which sources have source notes.
- Which Skill Cards have been drafted.
- Which cards are in the review queue.
- What needs manual verification before any card can become active.

This tracker prevents the library from becoming an untracked collection of files with no clear status.

## 2. Current source inventory

| Source | Author / Organisation | Type | Tier | Status | Notes file | Extraction progress |
|---|---|---|---|---|---|---|
| Scientific Advertising | Claude Hopkins | Book | 1 | Source note complete; draft cards exist | source-notes/scientific-advertising.md | 5 draft cards created; QA pass done |
| Ogilvy on Advertising | David Ogilvy | Book | 1 | Source note complete | source-notes/ogilvy-on-advertising.md | Not started |
| Influence | Robert Cialdini | Book | 1 | Source note complete | source-notes/influence.md | Not started |
| Made to Stick | Chip Heath and Dan Heath | Book | 1 | Source note complete | source-notes/made-to-stick.md | Not started |

## 3. Draft Skill Card inventory

| Card ID | Title | Source | Category | Status | Confidence | Extrapolation risk | Needs manual verification | File |
|---|---|---|---|---|---|---|---|---|
| SCI-ADV-001 | Advertising is salesmanship | Scientific Advertising | Marketing Fundamentals | needs_review | Low | Medium | Yes — AIDA framework attribution, exact Hopkins wording | advertising-is-salesmanship.md |
| SCI-ADV-002 | Track before scaling | Scientific Advertising | Marketing Fundamentals | needs_review | Low | Medium | Yes — split-testing specifics, budget scaling, coupon method details | tracking-before-scaling.md |
| SCI-ADV-003 | Specificity over superlatives | Scientific Advertising | Copywriting | needs_review | Low | Medium | Yes — Hopkins' exact term list, interpretive framing | specificity-over-superlatives.md |
| SCI-ADV-004 | Offers over empty claims | Scientific Advertising | Marketing Fundamentals | needs_review | Low | Medium | Yes — "offer" terminology, alternatives-to-price list | offers-over-empty-claims.md |
| SCI-ADV-005 | Serve the customer, not the award | Scientific Advertising | Marketing Fundamentals | needs_review | Low | High | Yes — awards discussion may not exist in Hopkins; extrapolation risk flagged | serve-the-customer-not-the-award.md |

## 4. Review queue

### Highest risk first

1. **SCI-ADV-005** — Serve the customer, not the award. High extrapolation risk. The awards and agency-portfolio framing may not be present in Hopkins at all. Requires the most urgent manual verification.
2. **SCI-ADV-001** — Advertising is salesmanship. Contains AIDA framework that is not attributable to Hopkins. Needs the salesmanship principle confirmed in the source and the AIDA reference either verified or removed.
3. **SCI-ADV-002** — Track before scaling. Split-testing methodology needs verification. The coupon tracking examples are period-specific and may not transfer directly.
4. **SCI-ADV-003** — Specificity over superlatives. The specific terms Hopkins criticised need to be verified. The interpretive framing needs checking.
5. **SCI-ADV-004** — Offers over empty claims. Terminology needs verification. The card may rely too heavily on a modern definition of "offer" rather than Hopkins' language.

### Missing page or chapter references

All five cards are missing chapter and page references. No card should move to reviewed until at least the chapter or section is identified.

### Modern translations that need verification

- All cards include modern digital marketing examples (social media, landing pages, paid ads). These are useful translations but must be clearly labelled as modern applications, not as Hopkins' original context.
- SCI-ADV-001 includes the AIDA framework, which is a later copywriting structure.
- SCI-ADV-005 includes agency culture critiques that are likely modern additions.

## 5. Activation rules

A card may only become active when all of the following are satisfied:

1. **Source verification is complete.** The relevant chapter or section has been checked and the principle confirmed against the source text.
2. **No fake page numbers.** Page references must be real. Do not invent them.
3. **No fabricated quotes.** Every attributed statement must be traceable to the source.
4. **No active client examples in master library cards.** The default Marketing Library stays industry and principle focused. Client-specific knowledge belongs in active client records or client-specific Skill Cards.
5. **AI output is never a source.** AI-generated content may not be used as source material. AI may assist with organisation, summarisation and application, but the source of truth must be human authored, official, measured or captured from real business context.
6. **Confidence level is honest.** Do not raise confidence to High until the source has been manually verified.
7. **Extrapolation risk is flagged.** If the card contains modern translations or expansions, these must be clearly labelled in the Verification flags section.
8. **Review is logged.** A human reviewer must sign off before activation. The review should be recorded in the skill card review system when available.

## 6. Next extraction candidates

These are sourced from existing source notes. Do not create yet — they are queued for the next extraction pass.

### From Ogilvy on Advertising

- Research before creative
- The big idea
- Headline principles
- Brand voice consistency

### From Influence

- Social proof
- Authority and trust signals
- Reciprocity in marketing
- Scarcity and urgency

### From Made to Stick

- Concrete details
- The curse of knowledge
- Unexpected openings
- Stories as mental flight simulators
