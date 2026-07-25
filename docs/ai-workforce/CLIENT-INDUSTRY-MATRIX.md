# Active-Client Industry Matrix (V2)

Last updated: 2026-07-25
Source: `public.clients` (active = true), loaded from production Supabase.
Stored in `public.client_industry_profiles` (admin-only).

Industry is **never** inferred from a name. Every active client starts
`needs_research`; only official-evidence classifications are promoted. No inactive
client is imported (Braize Promotions, `active = false`, is excluded).

## Researched (official evidence, high confidence)

| Client | Primary | Secondary | Review state |
|---|---|---|---|
| RC-Polypipe | Agriculture | Irrigation & farm water (low-pressure field irrigation) | needs_internal_review |
| Case Bloemfontein | Agriculture | Agricultural machinery — dealership & after-sales | needs_internal_review |

## Not yet researched (`needs_research`)

The remaining 43 active clients are seeded as `needs_research` with no guessed
industry. Notably, **Agri-Secure is left `needs_research`** — its name suggests
agriculture, but per the standard we do not classify from a name; it awaits
official-source research.

Candidate industry groupings to confirm later (from `INDUSTRY-LIBRARY-PRIORITY.md`,
**not** applied to records): automotive & dealerships (Toyota Bloemfontein, Hino
Trucks, Human Auto, Supa Quick BFN/Centurion, Germoparts); legal/professional
(Bouwer & Coetzee Attorneys, HMH Attorneys, Peyper Bonds); building materials &
trade (Cape Lumber, Bloem Marble & Granite, Novus Steel, Dulux Bloemfontein).
These names are research prompts, not classifications.

## Lifecycle

`draft → needs_research → needs_client_confirmation → needs_internal_review →
reviewed → active → deprecated`. Only current active clients may have active
retrieval; client-specific knowledge never activates through research alone.
