# AI Workforce — Verified Open Source Ingestion Manifest

Last updated: 2026-07-26
Status: Source-level rights and ingestion handoff. No production knowledge activated.

## Purpose

This manifest identifies sources that are not merely useful references but are technically and legally suitable candidates for lawful ingestion, subject to the existing rights-gated ingestion pipeline.

It separates:

- full-text ingestion allowed;
- metadata and link only;
- human notes only;
- rights unresolved;
- rejected.

## Ready candidate 1 — Increasing Human Efficiency in Business

Author:
Walter Dill Scott

Title:
Increasing Human Efficiency in Business: A Contribution to the Psychology of Business

Canonical catalogue:
https://www.gutenberg.org/ebooks/1319

Machine-readable HTML:
https://www.gutenberg.org/cache/epub/1319/pg1319.html

Project Gutenberg ebook number:
1319

Release date:
1998-05-01

Last Project Gutenberg update shown:
2015-04-02

Rights statement shown by Project Gutenberg:
Public domain in the USA.

Project Gutenberg licence page applies to the distributed edition. The source page also warns users outside the United States to check local law.

Proposed rights state:
`public_domain`

Proposed access type:
`full_text`

Proposed ingestion state:
`approved_for_ingestion`

Why it is useful:

- early applied psychology of business;
- attention, habit, imitation, competition, loyalty and motivation themes;
- historical evidence for how business psychology was framed;
- useful contrast against modern empirical evidence;
- human-authored source predating modern generative AI.

Important limitations:

- historical workplace assumptions may be outdated or ethically unacceptable;
- it is not a modern social-media, consumer-rights or behavioural-science authority;
- claims should be stored as historical principles or hypotheses unless independently supported;
- South African public-domain status and intended commercial reuse should be reviewed before distributing the complete text outside internal research;
- the Project Gutenberg licence header/footer must be preserved as required by its distribution terms.

Required ingestion process:

1. Fetch the exact plain-text or HTML edition from Project Gutenberg.
2. Preserve the Project Gutenberg licence and edition metadata.
3. Hash the source bytes before transformation.
4. Store the original in the private Marketing Library bucket.
5. Chunk by real chapter/section headings.
6. Preserve exact section references.
7. Mark every extracted card as `needs_review`.
8. Label source era and historical limitations.
9. Do not activate cards until compared with modern evidence.

Environment note:
The current ChatGPT execution environment could verify the catalogue, rights statement and machine-readable HTML page but could not reliably download the complete source bytes into GitHub. The source is therefore registered honestly for the existing ingestion function rather than represented as uploaded.

## Ready candidate 2 — Scientific Advertising

Author:
Claude C. Hopkins

Title:
Scientific Advertising

Canonical Library of Congress record:
https://www.loc.gov/item/23009362/

LCCN:
23009362

Published:
1923

Digital format:
Page images through Library of Congress / IIIF.

Rights statement:
The Library of Congress states that books in the collection are in the public domain and are free to use and reuse.

Proposed rights state:
`public_domain`

Proposed access type:
`page_images`

Proposed ingestion state:
`approved_for_ocr_ingestion`

Why it is useful:

- testing and response measurement;
- specificity;
- offers, samples and reason-why advertising;
- salesmanship framing;
- historical direct-response practice.

Limitations:

- page-image OCR requires verification;
- historical commercial examples are not automatically valid today;
- modern privacy, consumer protection, platform policy and brand-building evidence must override conflicting advice;
- page references must come from actual OCR/page mapping, never generated guesses.

Required ingestion process:

1. Use the Library of Congress IIIF manifest or downloadable page images.
2. Preserve page order and image identity.
3. OCR with confidence values.
4. Review low-confidence text manually.
5. Store page-level citations.
6. Compare candidate cards with modern platform and advertising evidence.
7. Keep all cards `needs_review` until confirmed.

## Ready candidate 3 — My Life in Advertising

Author:
Claude C. Hopkins

Title:
My Life in Advertising

Canonical Library of Congress record:
https://www.loc.gov/item/27024090/

LCCN:
27024090

Published:
1927

Rights statement:
The Library of Congress states that books in the collection are in the public domain and are free to use and reuse.

Proposed rights state:
`public_domain`

Proposed access type:
`page_images`

Proposed ingestion state:
`approved_for_ocr_ingestion`

Why it is useful:

- campaign case histories;
- offer and product-demonstration thinking;
- testing culture;
- historical agency and client practice;
- source material for distinguishing principle from anecdote.

Limitations:

- autobiography and practitioner recollection are not controlled research;
- success stories can contain survivorship and self-report bias;
- modern claims must not inherit historical certainty;
- campaign anecdotes should be stored as historical examples, not universal proof.

## Open-access research suitable for structured evidence ingestion

The following articles have verified open-access or Creative Commons availability from the publisher/PMC record and can be stored as source documents subject to article-level licence verification during ingestion:

### Mere exposure and advertising-image attention

- Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC6134073/
- Licence: CC BY shown in PMC record.
- Proposed state: `approved_for_ingestion`
- Use: exposure, attention, affective evaluation.

### Awareness and mere exposure

- Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC3798387/
- Licence: CC BY shown in PMC record.
- Proposed state: `approved_for_ingestion`
- Use: attention/awareness limitation on exposure claims.

### Source monitoring under advertising exposure

- Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC9444107/
- Licence: CC BY 4.0 shown in PMC record.
- Proposed state: `approved_for_ingestion`
- Use: source memory and high-exposure limitations.

### Advertising creativity and hierarchy of effects

- Source: https://www.sciencedirect.com/science/article/pii/S2405844023064915
- DOI: 10.1016/j.heliyon.2023.e19283
- Licence: Open access under Creative Commons as shown by publisher.
- Proposed state: `approved_for_ingestion_after_licence_capture`

### Advertising creativity, surprise and relevance

- Source: https://www.sciencedirect.com/science/article/pii/S2212567114005735
- DOI: 10.1016/S2212-5671(14)00573-5
- Licence: Open access under Creative Commons as shown by publisher.
- Proposed state: `approved_for_ingestion_after_licence_capture`

### Text style, CTR and conversion

- Source: https://www.sciencedirect.com/science/article/pii/S2667325821002168
- DOI: 10.1016/j.fmre.2021.11.004
- Licence: Open access under Creative Commons as shown by publisher.
- Proposed state: `approved_for_ingestion_after_licence_capture`

## Metadata and link only

Keep these as metadata and abstract-level evidence until full-text rights are confirmed:

- Advertising to businesses: Does creativity matter?
  https://www.sciencedirect.com/science/article/pii/S001985011500293X
- Operationalizing ad creativity and its effects in B2B advertising
  https://www.sciencedirect.com/science/article/abs/pii/S0019850125000318
- Ad creativity in a negative context
  https://www.sciencedirect.com/science/article/pii/S096969892100391X

No paywalled or rights-unclear full text may be copied into the Marketing Library.

## Ingestion metadata required for every source

- source_id;
- canonical URL;
- title;
- author(s);
- publisher or repository;
- publication year;
- DOI/LCCN/ebook ID where applicable;
- rights status;
- licence URL or rights evidence;
- access type;
- source hash;
- retrieval date;
- source era;
- geography/sample where applicable;
- document type;
- OCR state;
- review state;
- allowed knowledge layers;
- prohibited uses;
- freshness policy;
- citation granularity.

## Non-negotiable controls

- AI-generated summaries are not source documents.
- Abstract-only access does not permit full-text reconstruction.
- Public domain does not make historical claims current.
- A licence must be captured at source level, not inferred from publication age.
- Page/chapter references must be derived from the actual document.
- Human review remains mandatory before activation.
