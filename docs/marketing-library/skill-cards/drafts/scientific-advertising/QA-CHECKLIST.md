# Scientific Advertising — QA Checklist

**Date:** 2026-07-01  
**Scope:** QA pass on first draft Skill Cards from the Scientific Advertising source note  
**Status:** QA pass complete — all cards remain needs_review

---

## 1. Source verification status per card

| Card ID | Title | Direct source support | Page/chapter refs | Confidence |
|---|---|---|---|---|
| SCI-ADV-001 | Advertising is salesmanship | Pending manual verification | Missing | Low |
| SCI-ADV-002 | Track before scaling | Pending manual verification | Missing | Low |
| SCI-ADV-003 | Specificity over superlatives | Pending manual verification | Missing | Low |
| SCI-ADV-004 | Offers over empty claims | Pending manual verification | Missing | Low |
| SCI-ADV-005 | Serve the customer, not the award | Pending manual verification | Missing | Low |

All cards are draft quality. None should be treated as verified.

---

## 2. Unsupported or extrapolated statements to verify

The following statements appear in the current drafts but have not been confirmed against the source text. Each must be checked against the actual book before the card can be marked reviewed.

### SCI-ADV-001 — Advertising is salesmanship

- "advertising is not a performance art. It is salesmanship multiplied by media" — confirm whether Hopkins used this exact framing or a different one.
- "attention, interest, desire, action" — this is the AIDA framework, which was popularised by later copywriters (E. St. Elmo Lewis, 1898). It may not appear in Scientific Advertising. Flag as extrapolation.
- "build trust, overcome objections and ask for the action" — confirm whether Hopkins listed these specific sales functions.

### SCI-ADV-002 — Track before scaling

- "Hopkins introduced advertising to the concept of split testing and coupon-based tracking" — verify that Hopkins was among the first to describe this in book form, and confirm the specific methods he described.
- "test one variable at a time" — this is a standard scientific testing principle. Confirm whether Hopkins expressed it in these terms or whether it has been added from later methodology.
- "scale spend only on versions that measurably outperform the control" — confirm that Hopkins discussed scaling budgets based on test results.

### SCI-ADV-003 — Specificity over superlatives

- "Hopkins argued that superlatives like best, greatest, amazing and revolutionary are meaningless" — confirm the exact list of terms Hopkins criticised.
- "Specificity signals honesty. Superlatives signal exaggeration" — this framing may be interpretive. Check against the original text.
- The modern examples (social media, landing pages, feeds) are translations, not from Hopkins.

### SCI-ADV-004 — Offers over empty claims

- "Price alone is rarely the best offer. Service, convenience, risk reduction, guarantee, exclusivity and specific results all outperform a simple price reduction" — this list of alternatives may be a modern expansion. Verify what Hopkins actually said about price versus service.
- "the advertisement is just the delivery mechanism for the offer" — confirm whether Hopkins used this metaphor or a different one.

### SCI-ADV-005 — Serve the customer, not the award

- "advertising exists to serve the customer, not to win awards" — confirm whether Hopkins explicitly discussed advertising awards. The modern advertising awards industry was less prominent in 1923. This principle may have been extrapolated from his broader philosophy about results versus showmanship.
- "most award-winning advertising is not profitable advertising" — this is a strong claim that must be checked. It may be supported by later industry analysis rather than by Hopkins.
- "The customer does not care how creative the ad is" — confirm the tone and strength of this claim in the original text.

---

## 3. Modern marketing translations that are useful but not directly from Hopkins

The following concepts in the cards are useful and aligned with Hopkins' philosophy, but they are not direct extracts from Scientific Advertising. They are modern translations or applications.

- "social media caption", "landing page", "paid ads test", "feed" — these media did not exist in 1923. The principle may transfer, but the specific format is a modern translation.
- "before writing any ad, caption or landing page" — same note. The formats are modern.
- "Would a sceptical prospect believe this?" — this question is not from Hopkins. It is a useful modern filter.
- "Risk reduction in offers (guarantees, free trials, consultations)" — while aligned with Hopkins' emphasis on service, the specific examples are modern.
- "Meta/Google algorithm tactics" disclaimer on every card — correct and necessary. Hopkins did not write about algorithmic platforms.
- "AIDA — attention, interest, desire, action" in SCI-ADV-001 — this is a separate framework not attributable to Hopkins. It has been flagged in the card.

---

## 4. Items that must not be claimed until manually checked against the book

- That Hopkins was the *first* person to describe split testing or tracking in advertising. Verify this claim.
- That Hopkins explicitly rejected brand building as a concept. He may not have addressed it directly.
- That Hopkins used the term "offer" as centrally as the card suggests. He may have used different language (service, product, benefit).
- That Hopkins was specifically criticising advertising awards. This needs direct evidence from the text.
- Any specific sales figures, campaign results or percentage improvements attributed to Hopkins' methods.
- Any claim about Hopkins' personal biography or career context that is not common knowledge.

---

## 5. Terms that may come from later copywriting frameworks, not from Hopkins

| Term or phrase | Likely source | Present in card |
|---|---|---|
| AIDA (attention, interest, desire, action) | E. St. Elmo Lewis (1898); later adopted by copywriting schools | SCI-ADV-001 — flagged |
| "Split testing" | Modern term for Hopkins' controlled experiments | SCI-ADV-002 — acceptable paraphrase |
| "Value proposition" | Modern marketing terminology | SCI-ADV-001, SCI-ADV-004 — acceptable paraphrase |
| "Landing page" | Digital marketing era | SCI-ADV-001, SCI-ADV-002, SCI-ADV-003 — flagged as translation |
| "Call to action" / "CTA" | Mid-20th century direct response | SCI-ADV-001 — acceptable paraphrase |
| "Risk reduction" | Modern consumer psychology | SCI-ADV-004 — acceptable expansion |
| "Award-winning advertising is not profitable" | Modern industry observation | SCI-ADV-005 — must be verified |
| "Portfolio work vs effective work" | Agency culture commentary | SCI-ADV-005 — likely extrapolation |

---

## 6. Checklist for moving a card from `needs_review` to `reviewed`

A card may only move to `reviewed` when all of the following are true:

- [ ] The source chapter or section has been identified and noted.
- [ ] The core principle has been confirmed against the source text.
- [ ] Any modern translations or expansions are explicitly labelled as such in the card.
- [ ] The confidence level has been reassessed honestly (allowable ranges: Low or Medium for this source).
- [ ] The "Direct source support" flag in Verification flags has been updated to "Confirmed" or "Partially confirmed".
- [ ] No fabricated quotes, invented page numbers or false claims remain.
- [ ] The verification items in the card's Verification flags have been addressed.
- [ ] A human reviewer has read the relevant section of the source and signed off.

---

## 7. Checklist for moving a card from `reviewed` to `active`

A card may only move to `active` when all of the following are true:

- [ ] The card has passed the needs_review → reviewed checklist.
- [ ] All source references include chapter and page numbers where available.
- [ ] The card has been checked against SOURCE-STANDARDS.md.
- [ ] The card is actionable: an AI agent could use it without hallucinating.
- [ ] The "Extrapolation risk" flag is Medium or Low.
- [ ] The confidence level is not Opinion.
- [ ] A second reviewer has read the card and the source excerpt and agreed.
- [ ] The card has been registered in the Marketing Library tracking system (future).
- [ ] The review has been logged in the skill card review system (future).
- [ ] The card has been moved to `skill-cards/active/`.

---

## Card status summary after this QA pass

| Card ID | Previous status | Post-QA status | Action taken |
|---|---|---|---|
| SCI-ADV-001 | needs_review | needs_review | Added Verification flags; flagged AIDA |
| SCI-ADV-002 | needs_review | needs_review | Added Verification flags |
| SCI-ADV-003 | needs_review | needs_review | Added Verification flags |
| SCI-ADV-004 | needs_review | needs_review | Added Verification flags |
| SCI-ADV-005 | needs_review | needs_review | Added Verification flags; flagged award extrapolation |
