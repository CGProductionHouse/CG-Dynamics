# CG Graphic Designer / Poster Studio — proof architecture

Issue #948 is the parent implementation authority. Issue #955 is the Piek Group January 2027 full-month acceptance authority. This directory records the smallest tested architecture; it does not claim production readiness.

## Current acceptance target

Piek Group January 2027 replaces Red Oak as the first complete monthly pilot. Red Oak remains a technical source-provenance/amendment fixture, but owner review rejected its visual direction as off-brand; it is not a creative-quality success or a reusable style template.

January currently has no dated Piek Client Schedule rows. The latest verified package baseline is 12 designed posters and four professional videos; the checked-in January grid is a proposal with null deliverable IDs until the actual January package/schedule exists.

## Authority boundaries

- CG Dynamics resolves the exact client, approved claims and client intelligence.
- OneDrive remains the authority for logos, source photography, brand artwork and design files.
- A compact, versioned Brand Pack records locators and verified rules; it does not duplicate client files or create another client database.
- Canva is useful for one-time discovery and optional output/editing. It is not scanned on every poster request.
- Only approved finals may be copied into the existing Client Portal Library. Drafts and source files stay private.

## Composition contract

The initial engine under `scripts/poster-studio/` accepts a private JSON scene outside Git. Stable layer IDs represent source images, exact logos, editable text, shapes, masks/effects and groups. It emits an editable SVG, a PNG review rendition, and a SHA-256 manifest. A second scene can be compared with the first to prove an isolated amendment.

`creative-ledger.mjs` adds exact source hashing, perceptual image hashing, same-shoot evidence, reviewer-supplied non-biometric visible-person tags, product/service/branch/concept/headline/mechanism comparison and publication-state memory. `month-plan.mjs` validates scope coverage, strategy completeness, distinct mechanisms, brand-pack gates and the absence of invented future schedule IDs. These commands run headlessly and are the production direction; desktop control is not the operator workflow.

The portable SVG is explicitly an interim editable document. It is not an editable PSD. Image bytes are embedded in the SVG while their original paths and SHA-256 digests remain in the manifest, so another approved workstation does not silently lose linked photo/logo layers. A real Affinity 3.3.1 round trip opened the complete document and saved native `.af` v1/v2 files. Photoshop 2026 and UXP Developer Tools are installed on the MSI and remain the preferred professional PSD finishing route, but the installed Photoshop currently stops at an Adobe device-authentication dialog. PSD claims remain blocked until an authorised account completes that sign-in and an actual local UXP round trip is opened, inspected and saved successfully.

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
