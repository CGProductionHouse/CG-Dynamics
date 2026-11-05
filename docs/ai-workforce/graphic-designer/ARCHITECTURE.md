# CG Graphic Designer / Poster Studio — proof architecture

Issue #948 is the implementation authority. This directory records the smallest tested architecture; it does not claim production readiness.

## Authority boundaries

- CG Dynamics resolves the exact client, approved claims and client intelligence.
- OneDrive remains the authority for logos, source photography, brand artwork and design files.
- A compact, versioned Brand Pack records locators and verified rules; it does not duplicate client files or create another client database.
- Canva is useful for one-time discovery and optional output/editing. It is not scanned on every poster request.
- Only approved finals may be copied into the existing Client Portal Library. Drafts and source files stay private.

## Composition contract

The initial engine under `scripts/poster-studio/` accepts a private JSON scene outside Git. Stable layer IDs represent source images, exact logos, editable text, shapes, masks/effects and groups. It emits an editable SVG, a PNG review rendition, and a SHA-256 manifest. A second scene can be compared with the first to prove an isolated amendment.

The portable SVG is explicitly an interim editable document. It is not an editable PSD. Photoshop 2026 and UXP Developer Tools are installed on the MSI and are the preferred professional PSD finishing route, but PSD claims remain blocked until an actual local UXP round trip is opened, inspected and saved successfully.

## Minimal eventual ChatGPT contract

Normal company ChatGPT should receive a narrow CG Dynamics tool surface, not general desktop control:

1. `poster_brand_pack(client_id)` — read exact-client approved brand locators/rules.
2. `poster_create_job(client_id, brief, source_asset_ids)` — create a private local queued job with immutable source hashes.
3. `poster_render(job_id)` — run the local composition/Photoshop bridge and return status plus private review artifacts.
4. `poster_amend(job_id, base_version, patch)` — change explicit stable layer IDs only.
5. `poster_versions(job_id)` — list manifests and review renditions.
6. `poster_approve(job_id, version)` — record human approval; it must not publish by itself.

The local workstation bridge must allow only the Picasso/Poster Studio private roots and approved OneDrive locators, expose no arbitrary shell or filesystem access, and never upload private source media to a public URL. No production tool registration is part of this proof branch.

## Quality gates

- genuine client photo and exact logo hashes recorded;
- no generative reconstruction of products, people or venues;
- fictional/unverified offer details visibly labelled;
- live typography and independently addressable layers;
- mobile-size review;
- amendment receipt proves protected layers unchanged;
- PSD opened and inspected in Photoshop before claiming PSD support;
- human creative approval remains mandatory before client publication.
