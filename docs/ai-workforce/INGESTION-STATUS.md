# Ingestion Status (V2)

Last updated: 2026-07-25

## Pipeline: DELIVERED

- Deterministic, rights-gated ingestion core:
  `src/features/ai-workforce/ingestion/ingestionPipeline.ts` (15 unit tests).
- Admin-only edge function `marketing-library-ingest` (deployed, `verify_jwt`
  on; rejects unauthenticated calls with 401).
- Private Storage bucket `marketing-library-sources` (staff read / admin manage;
  no public/client access) for original files — **books/PDFs never go in GitHub.**
- Idempotency: unique `(document_id, content_hash)` on chunks; document-level
  content hash prevents duplicate ingestion; re-ingestion is a no-op.
- The pipeline is source-type agnostic (books, openly licensed documents, official
  docs/reports, CG-owned notes, page/image-sequence citations) — not Hopkins-only.

## Actual full-text ingestion: BLOCKED (documented, not faked)

**No book text has been ingested.** Reason: a verifiably-open, machine-readable,
public-domain edition could not be obtained through channels whose rights I could
verify in this session:

- **Project Gutenberg** — Scientific Advertising and My Life in Advertising are
  **not present** (Gutendex `count: 0`).
- **Wikisource (English)** — "Scientific Advertising" page is **missing**; search
  returned only unrelated works.
- **archive.org** — search surfaced only post-1930 items (a 2010 scan, a 1968
  edition, a 1998 compilation) that are reprints or controlled-digital-lending
  scans of **ambiguous rights**. Ingesting their OCR would violate the rules
  "no rights from age alone" and "no pirated/ambiguous copies".

Per the governance rules, I did **not** ingest from an ambiguous-rights scan and
did **not** fabricate any text, quote, chapter, or page.

## State recorded honestly

- The 8 public-domain books (`source_type = book`, `full_text_allowed`) are
  `acquisition_status = approved_for_ingestion`, `ingestion_status = catalogued`,
  `full_text_storage = false` (nothing stored yet).
- The pipeline + edge function are ready to ingest the moment a lawful
  machine-readable text (or a reviewed admin-supplied transcription) is available.

## How to unblock (next reviewed step, needs a human)

1. An admin obtains a lawful machine-readable text of a public-domain edition
   (e.g. a verified LoC/HathiTrust full-text export, or a manually reviewed
   transcription) and confirms it is the public-domain edition.
2. Upload the original to the `marketing-library-sources` bucket.
3. Call `marketing-library-ingest` with `action: 'ingest'`, the `sourceId`, and
   segments carrying `{ section, page, text }`.
4. Chunks land `verification_state = 'unverified'`; a reviewer verifies chapter
   openings / headings / quoted passages before any chunk is quoted verbatim.
