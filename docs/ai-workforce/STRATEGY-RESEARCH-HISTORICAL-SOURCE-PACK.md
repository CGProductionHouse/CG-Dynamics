# Strategy, Research and Historical Advertising Source Pack

Status: review-ready candidates only
Verified: 3 August 2026

## Scope

This pack adds a small evidence layer for the Marketing Strategist, Research Librarian and Historical Advertising Analyst. It does not activate knowledge, create client claims or treat historical advice as current platform guidance.

## Directly inspected sources

### UK Government Communications: OASIS

- URL: https://www.communications.gov.uk/publication/guide-to-campaign-planning-oasis/
- Type: official documentation, machine-readable HTML
- Inspected sections: Objectives; Audience and insights; Strategy and ideas; Implementation; Scoring and evaluation
- Use: audience segmentation, campaign objectives, proposition/offer framing, channel roles, measurement and learning
- Rights handling: metadata and link only in this pass. No page text is mirrored. Re-check current Crown copyright/Open Government Licence terms before full-text ingestion.
- Limitation: UK government communications guidance is a useful planning structure, not South African law, a causal guarantee or a current platform rule.

### UK Government Communications: Evaluation Cycle

- URL: https://www.communications.gov.uk/publication/gcs-evaluation-cycle/
- Type: official documentation, machine-readable HTML
- Inspected sections: Inputs - Communication planning; Linking the Evaluation Cycle and OASIS
- Use: evaluation-at-planning-time, KPIs, testing, outputs/outtakes/outcomes and learning loops
- Rights handling: metadata and link only in this pass.
- Limitation: campaign metrics still require their actual platform/business definitions and verified data.

### OpenStax: Principles of Marketing

- URL: https://openstax.org/books/principles-marketing/pages/preface
- Type: reviewed professional educational source, machine-readable HTML
- Inspected sections:
  - 5.1 Market Segmentation and Consumer Markets
  - 5.6 Product Positioning
  - 13.4 Steps in the IMC Planning Process
- Use: segmentation, positioning, audience/value/action coherence and channel planning
- Rights handling: OpenStax states CC BY-NC-SA 4.0. CG stores source metadata and narrow derived review notes only. No full text, figures or commercial reproduction are ingested.
- Limitation: textbook concepts do not prove client demand, customer perception, offer performance or campaign causation.

### Scientific Advertising (Hopkins, 1923)

- Canonical record: https://www.loc.gov/item/23009362/
- Existing source record: public-domain Library of Congress item, LCCN 23009362
- Inspected location used in this pack: Chapter 15 title, `Test Campaigns`; no page number asserted
- Use: historical context only
- Limitation: the chapter is not a modern experimentation standard or current platform rule. The rejected `Advertising is salesmanship` card is not modified or activated.

### CG Dynamics Research and Source Quality Standard

- Repository location: `docs/research-source-quality-standard.md`
- Type: internal operating governance
- Use: evidence classification, refusal threshold and historical-source handling
- Limitation: internal governance is not external market evidence.

## Candidate cards and routing

| Area | Cards | Marketing Strategist | Research Librarian | Historical Analyst |
|---|---:|---:|---:|---:|
| Strategy foundations | 6 | 6 | 6 | 0 |
| Research governance | 2 | 0 | 2 | 0 |
| Historical governance/context | 2 | 0 | 2 | 2 |
| Total routed candidates | 10 | 6 | 10 | 2 |

All cards enter `needs_review`. Production retrieval continues to require `status = active`, a successful substantive review and the existing activation gate.

## Specialist output contracts

### Research Librarian

Returns a structured evidence brief with:

- research question;
- cited source facts;
- interpretations;
- internal observations;
- uncertainties and contradictions;
- evidence gaps;
- evidence IDs and confidence.

It never writes campaign strategy or final client copy. If approved sources are insufficient, it returns the evidence gap and refuses the factual brief.

### Historical Advertising Analyst

Returns:

- original-source claim;
- verifiable source location;
- historical context;
- modern interpretation;
- outdated assumptions;
- applicability limits;
- ethical flags;
- evidence IDs and confidence.

It never presents historical principles as current platform rules and refuses claims whose source location cannot be verified.

## Human review required

An admin must use Skill Card Review to check source fit, wording, rights metadata, routing, expiry, safe claim and prohibited overclaim. This migration never activates a card.
