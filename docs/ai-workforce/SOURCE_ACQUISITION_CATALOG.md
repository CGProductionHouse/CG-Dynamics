# AI Workforce — Source Acquisition Catalog (V1)

Last updated: 2026-07-25
Status: Rights-classified catalog. Derived Skill Cards are NOT auto-activated.

Every record carries an explicit rights status and access mode. Rights are never
inferred from age alone — item-level verification is required before full-text
ingestion of any archive.org / Wikimedia scan. Seeded into
`marketing_library_sources` by `supabase/phase-23a-ai-workforce-source-rights.sql`.

## A. Public-domain books — full ingestion permitted (tier-1 primary)

| # | Title | Author | Year | Rights | Access | Canonical |
|---|---|---|---|---|---|---|
| 1 | Scientific Advertising | Claude C. Hopkins | 1923 | public_domain | full_text_allowed | https://www.loc.gov/item/23009362/ |
| 2 | My Life in Advertising | Claude C. Hopkins | 1927 | public_domain | full_text_allowed | https://www.loc.gov/item/27024090/ |
| 3 | The Theory of Advertising | Walter Dill Scott | 1903 | public_domain | full_text_allowed¹ | https://archive.org/details/theoryofadvertis00scotrich |
| 4 | The Psychology of Advertising | Walter Dill Scott | 1913 | public_domain | full_text_allowed¹ | https://commons.wikimedia.org/wiki/File:The_psychology_of_advertising_(IA_psychologyadvert00scotrich).pdf |
| 5 | Advertising and Its Mental Laws | Henry Foster Adams | 1916 | public_domain | full_text_allowed¹ | https://openlibrary.org/books/OL7177286M/Advertising_and_its_mental_laws |
| 6 | Advertising, Its Principles and Practice | Tipper, Hollingworth, Hotchkiss, Parsons | 1915 | public_domain | full_text_allowed¹ | https://openlibrary.org/books/OL14588708M/Advertising_its_principles_and_practice |
| 7 | How to Write Advertisements That Sell | A.W. Shaw Company | 1912 | public_domain | full_text_allowed¹ | https://openlibrary.org/books/OL6548765M/How_to_write_advertisements_that_sell |
| 8 | Commercial Advertising | Thomas Russell | 1919 | public_domain | full_text_allowed¹ | Wikimedia Commons (commercialadvert00russrich) |

¹ Confirm the specific scanned item's rights label before storing full text.

## B. Historic newspapers

| # | Source | Org | Rights | Access | API / Collection |
|---|---|---|---|---|---|
| 9 | Chronicling America | LoC / NEH | public_domain (pages through 1930); later pages need item-level review | metadata_and_link_only (public-domain pages may be analysed) | https://www.loc.gov/apis/additional-apis/chronicling-america-api/ · https://www.loc.gov/collections/chronicling-america/ |

Historic-ad research queue (terms): free sample, coupon, money-back guarantee,
mail order, testimonial, limited offer, demonstration, comparison, headline,
direct response, catalogue, patent medicine, department store, motor car,
restaurant, hotel, real estate, household product. Each finding must retain
publication title, date, page, location, canonical LoC URL, OCR confidence,
rights cutoff and interpretation notes. OCR text is never turned directly into
an active Skill Card.

## C. Free-to-use advertising imagery (LoC free-to-use/reuse)

| # | Collection | Rights | Access | URL |
|---|---|---|---|---|
| 10 | Advertising Food | public_domain / free reuse | full image/reference allowed | https://www.loc.gov/free-to-use/advertising-food/ |
| 11 | Poster Parade | free to use and reuse | full image/reference allowed | https://www.loc.gov/free-to-use/poster-parade/ |
| 12 | WPA Posters | free to use and reuse | full image/reference allowed | https://www.loc.gov/free-to-use/wpa-posters/ |

Visual-study queue target: ≥30 ads/posters across food, travel, public
information, retail, entertainment, health communication, transport, events.
Each record captures headline, product/offer, visual hierarchy, dominant appeal,
proof device, CTA, audience, period, rights, canonical URL. Interpretation must
separate: timeless principle / obsolete media practice / unethical or
discriminatory practice / claim that would fail modern standards.

## D. Research-only archives — DO NOT mirror (metadata + link + notes only)

| # | Archive | Org | Coverage | Rights | Access | URL |
|---|---|---|---|---|---|---|
| 13 | Emergence of Advertising in America | Duke | 1850–1920 | research_only | metadata_and_link_only | https://blogs.library.duke.edu/digital-collections/eaa/about |
| 14 | Ad*Access | Duke | 1911–1955 | research_only | metadata_and_link_only | https://blogs.library.duke.edu/digital-collections/adaccess/about/ |

Do not save Duke image files into CG Dynamics; do not publish through the client
portal. Store citations + research notes only; derived observations stay
`needs_review`; preserve archive item ID and attribution.

## E. Rights-unconfirmed collection

| # | Collection | Coverage | Rights | Access | URL |
|---|---|---|---|---|---|
| 15 | LoC Advertising Poster Collection | 1845–1947 | rights_unknown (collection level) | metadata_and_link_only until each item is cleared | https://www.loc.gov/pictures/item/2005682804/ |

Do not assume every item is reusable merely because the Library of Congress holds it.

## Rights totals (seeded)

- public_domain, full-text-permitted books/collections: 10
- public_domain, metadata-only (newspapers): 1
- research_only, metadata-only (Duke): 2
- rights_unknown, metadata-only: 1

## Ingestion status (V1)

Sources are **catalogued** with verified rights. Full-text document + chunk
ingestion (`marketing_library_documents` / `marketing_library_chunks`) is a
separate reviewed step per source, gated by `access_mode`. No book text has been
ingested yet in V1 — the schema and rights gate are in place for it.
