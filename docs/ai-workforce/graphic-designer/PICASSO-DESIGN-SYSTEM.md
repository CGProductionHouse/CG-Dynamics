# PICASSO — CG graphic design system

Owner authority: CA, 25 November 2026. Development: #948 / draft PR #956.
Applies to human designers and all agents (ChatGPT, Claude, Codex and others).
This is the common craft and evidence standard for still posters, animated posters
and video graphics. It does not replace Nolan's editing pipeline or Picasso's
private photography engine. It does not prescribe one visual style for every client.

## Start here on every job

1. Resolve the exact client and **explicit brand scope** in Dynamics. Read current
   strategy, package, Content Guideline, feedback and `monthly_deliverables` dates.
   Planner is operational work; CG Calendar is not the posting schedule. Research
   the actual target month/local audience; distinguish facts from hypotheses.
2. Read the reviewed client Brand Pack and active exact-client + house rules.
   Missing/conflicting/expired branding holds production. Do not substitute another
   client's kit, national branding or previous chat memory.
3. Build the brief and month grid before expensive production. Every item needs a
   specific proposition, real product/service, audience, moment, proof, visual idea,
   source need and action. Balance people/product/service/place and scope/location.
4. Select original sources, check actual reuse history, edit selected photographs,
   then assemble independent layers. Preserve exact sources, logos and live type.
5. Inspect the real export and grid. Complete **each** applicable checklist item
   with result, reason and retained evidence. Run the preflight on exact file bytes.
6. Correct holds; preserve versions and accepted work. Send only authorised changed
   revisions, serially, with allocated unsigned captions and delivery readback.
   Human approval and publication permissions are separate from this checklist.

## One maintained authority

| Information | Authority |
| --- | --- |
| Identity, current facts/strategy/feedback | Exact client in CG Dynamics |
| Brand profile, active must/should rules | Existing `client_brand_profiles`, `client_brand_rules` |
| Structured reviewed pack | `client_brand_profiles.design_pack`, with explicit brand scopes and versioned OneDrive source |
| Actual logos, fonts/licence evidence, originals, derivative recipes | Authorised company OneDrive; selection-first access |
| Approved historical visual style | Actual approved artwork + relevant social/approval history, recorded in the pack |
| Shared checklist contract | `supabase/functions/_shared/picassoDesignSystem.ts`; portable `picasso-standard.v1.json` is tested against it |
| Poster technique/tool evidence | `.agents/skills/cg-graphic-designer/SKILL.md` and its references |
| Local photo finishing | Existing Picasso lane #878/#879; no private cloud photo batch uploads |
| Video work/status/files | Existing [video system of record](../../ops/VIDEO-EDITING-SYSTEM-OF-RECORD.md), Nolan ownership and working-file authority |
| Final client-safe files | Existing same-client Client Portal Library, approved month/location and real Dynamics links |

There is no new client database, tracker, hosted app, paid model or mandatory
desktop takeover. The existing authenticated connector and repository skill are
the agent entrypoints. OneDrive contains private assets; Git holds safe rules,
contracts, scripts and tests, never private photos, licensed fonts or credentials.

## Brand Pack setup once, reviewed maintenance thereafter

An imported Canva Kit or loose font list is discovery, not a complete reviewed
pack. A manager reviews a compact metadata pack, preserves its versioned OneDrive
source and imports it through Content operations → PICASSO. It extends the existing
brand profile; the familiar profile/rule editor remains available to video staff.
No profile is silently created or backfilled. Save uses the loaded profile's
`updated_at` fence; reload/reconcile if another editor changes it.

Use `design-brand-pack.example.json` only as a **synthetic draft structure**, never
as evidence for a real client. Its fields are validated by
`validateDesignBrandPack`. Each scope separately records:

- Exact hashed logo files/variants, clear-space and validity (including anniversary
  marks), actual Canva Kit and original OneDrive locators.
- Actual font families/weights/roles, licence evidence and verified availability.
  Resolve Kit/guideline conflicts; don't silently substitute or rebrand.
- Exact colour values **and allowed roles**, not just swatches. Client-specific
  background guidance must not become a house-wide dark/colour ban.
- Typography, shapes/devices, gradient behaviour, texture, depth, photo treatment,
  motion language, voice and explicit avoid rules, grounded in approved examples.
- Photo authority, current claims/contacts, approved artwork and feedback locators.
- Pack revision, named reviewer, review time/due date and source hash.

Piek Group/Engen/Sasol/Get Together, for example, require distinct scopes. A parent
using a subsidiary photo needs a reviewed source-scope permission in the existing
creative ledger; that does not permit using the subsidiary's kit as the parent's.
Human/AI work shares the same use history. Never create face embeddings or a
biometric identity register. A pack remains the default until properly revised;
contradictory new feedback blocks the affected job until reconciled, rather than
silently overwriting accepted brand rules. Retire/add rules; preserve their history.

Pack status/reviewer fields are manager declarations with source evidence, not a
cryptographic approval service. The validator cannot authenticate an external
approval link or decide whether a design is excellent. Review evidence must be read.

## Craft rules learned from production

Freshness is the concept and composition, not a different colour on one skeleton.
Inspect actual adjacent posts and the whole month: vary hierarchy, source/crop,
primary-logo and CTA relationship, photographic planes and mechanisms deliberately.
Keep exact brand grammar. A logo plate, empty footer, diagonal card or a few extra
layers is not a substitute for art direction. Restraint may be correct for one
brand; rich graphics may be correct for another. Avoid generic corporate/filler copy.

Before assembly, name each poster's headline region and reading order, grid or
alignment anchor, primary-logo anchor, photo/depth mechanism and CTA relationship.
Review those choices against the adjacent actual posters, not in isolation.
26 November owner feedback explicitly rejects repeatedly putting headings in the
same place. Do not use the same upper-left header and corner logo throughout a
batch. Deliberately vary the visual hierarchy while retaining coherent brand
grammar; arbitrary movement or a numerical quadrant target is not good composition.
The final export must demonstrate the stated relationships and clear reading.

Depth must be convincing: purposeful silhouettes, foreground/background interaction,
contact shadows, light, texture, graphics and gradients. Do not put decorations
through important text or faces. Real subject/type overlap can work when registered
and readable. Preserve it during margin/amendment fixes. Inspect full silhouettes,
held equipment, mask wedges, halos and object contact in the actual HD export.
Do not force background removal, bubbles, honeycomb, navy or a repeated button
onto every concept. Modern type must not become crude hard-offset shadow frames.

Use compact intentional line spacing and a clear reading path. Inspect actual
glyphs and visible ink: native boxes do not establish correct fonts, contrast,
line breaks, containment or safe spacing. Keep important text/logos away from
edges according to the brand/format/platform and logo clear-space. The previous
64px-at-1080 convention is a review starting point, not an approved universal inset.
Measure and justify the real job's inset. Backgrounds intended to bleed reach all
edges; accidental hairline photo strips, clipped marks and stretched footers fail.
Physical print bleed is separately specified by the printer, not a social margin.

Each logo also needs a stated alignment anchor within the composition. Check
visible-ink padding around any backing and its relationship to nearby headings,
columns and negative space; a contained native frame alone cannot pass this check.
Inspect contact-shadow falloff and diagonal antialiasing at actual export size.
Upsized low-resolution source media remains limited even when typography is sharp.
Client-specific luxury/background and punctuation feedback belongs in that
client's rules; it is not a global dark-background or no-punctuation mandate.

Photos need selection **and** professional finishing. Compare original, edited
derivative and final crop. Resolve ICC/EXIF evidence before grading; real colour
conversion is not `.convert('RGB')` or attaching an sRGB tag. Correct exposure,
face luminance, casts and contrast conservatively, according to the actual scene.
Preserve atmosphere, skin and texture; sharpen appropriately without hiding blur.
Retouch temporary blemishes only. Do not promise recovery of clipped JPEG data,
reshape bodies/faces, remove permanent features or generate replacement identities.
Monochrome can be a reviewed editorial choice, not an automatic escape from bad WB.
No awkward expression, closed eyes or irrelevant photo just to fill the package.

Approved examples teach the visual language; they do not authorise photo reuse.
Check real relevant social **artwork**, queued/approval images, canonical history and
human-created Canva pages before any internal send. Retain dates/locators, image
evidence, source hashes, comparisons and coverage limits. Captions alone, sample
negatives, helper-folder labels and status names cannot clear global reuse.
Audit exact/near images, same shoot, people (job-scoped non-biometric reviewer tags),
branch, service/product, headline, concept and composition. Insufficient coverage
is a hold. Revisions of one DP are not automatically separate new uses.

## Actual checks and receipts

The portable standard contains **27 named checks**, each with required evidence
kind and applicability. Read the full list; it is displayed inside Dynamics too.
Every required item needs `pass` + a meaningful reason + evidence. `fail`, `hold`,
missing items, wrong evidence, duplicate IDs and unjustified `na` block readiness.
Visual evidence binds to the actual final artifact SHA-256. Geometry/layer counts
and source matching remain limited technical evidence, never creative certification.

The context binds exact client/scope, pack revision/content hash, active rules hash,
current guide/recorded-update fingerprint,
artwork bytes, exact caption bytes, format, stage and audio/print declarations.
Changes invalidate the old review. Keep old reports/exports historically but exclude
them from the current delivery selection. Rejects invalidate creative readiness.

After an approved connector rollout, retrieve `get_client_context` with
`task_type=image_edit` (or `script`/`general`/`content_idea`) and explicit `scope_key`.
Its additive `picasso` packet contains this checklist, current exact-client pack,
active client/house rules and fingerprints, or a clear hold. Existing client-guide
readiness still applies. Fetch caption/footer policy separately with `task_type=caption`.
No new tool scope or write operation is introduced. Private locators are returned
only within existing authenticated staff client context; no public asset hosting.

Local use (save only the private `.picasso` packet and compact job metadata):

```powershell
node scripts/poster-studio/design-preflight.mjs --packet <private-packet.json> --job <job.json> --artifact <actual-export> --caption <allocated-caption.txt> --init-review <new-review.json> --out <new-hold-receipt.json>
node scripts/poster-studio/design-preflight.mjs --packet <fresh-private-packet.json> --job <job.json> --artifact <actual-export> --caption <allocated-caption.txt> --review <completed-review.json> --out <new-receipt.json>
```

`job.json` supplies `clientId`, `scopeKey`, `format` (`still_poster`,
`animated_poster`, `video`), `stage` (`internal_review`, `approved_final`),
`hasAudio` and `isPrint`. Snapshot older than 24h requires refresh; re-read sooner
when facts/rules/feedback change. New receipt files use exclusive creation, never
overwrite sources. Exit 0 means checklist declarations complete, 2 means hold,
1 means an input/I/O error. Even exit 0 always states **send/publication not authorised**.
This is a local prerequisite, not a deployed universal messaging interceptor.

Reuse proven specific checks instead of replacing them:

| Need | Existing tool / limitation |
| --- | --- |
| Exact/near/shoot/concept usage | `creative-ledger.mjs`, `source-history-audit.py`; bounded visual samples are not global clearance |
| Colour provenance/conversion | `photo_colour.py`; unknown profile stops, never false sRGB tagging |
| Source-preserving masks | `local-cutout.py`; actual CPU proof, independent alpha, visual cleanup still required |
| Registered graphics/text clearance | `overlay_preflight.py`, `native-safe-area.mjs`; frames/alpha are not full glyph, z-order or taste checks |
| Native editable composition | `canva-native-package.mjs`, scene/manifest tools; verify actual readback, font rendering and layers |
| Safe target lane | `canva-lane-guard.mjs`; fresh stable page IDs and exact ownership |
| Caption bytes and footer | `caption-guard.mjs`, `caption-footer-guard.mjs`; no signatures/guessed sibling contacts |

## Animation is a first-class format

The shared standard evaluates message, brand, sources, craft, editability and safe
delivery, not one still format. Animated posters and videos additionally require
full playback, readable settled frames, intentional timing, continuous safe areas,
clean moving masks/transitions, appropriate codec/fps/duration and ending/loop.
Audio checks apply only when audio exists; print checks only for print. Preserve
editable timelines/scenes and Nolan's established file/work/approval authority.
Do not force JPEG export, sound, cutouts or a static layout on every motion job.

## Feedback and delivery discipline

Capture exact feedback and actual annotations, map it to affected item/revision,
identify general craft lessons vs exact-client rules vs one-off amendments, and
review the **whole relevant batch** for the general defect. Preserve accepted work;
change only requested elements for bounded amendments, verify independent edits
and the actual resulting composition. Do not blindly apply one client's preferences
to other clients. Never claim an exported file is fixed based only on geometry.

Canva Drafts/Posted/Scheduled and human work stay untouched. Use verified working
lanes and one official client master/approved continuation. Tool-required exact
structural approvals remain distinct from routine save authority. Do not disguise
a connector limitation by deleting history, inventing a page limit or flattening.

Before send check exact current HD attachment + same-message allocated caption,
no signatures, sender/group/active delivery ownership, changed-only selection and
durable duplicate-safe readback. No concurrent WhatsApp sends. Forwarding to Graphic
Design Approvals requires all required approvals and real posting order. Published
photos/videos and client galleries require separate explicit authority. Approved
finals only go to the established month client-portal folder; drafts/working assets
remain internal. Do not add paid APIs, expose private folders or deploy a new app.

After sharing, send a separate short review request tagging the actual Amonique
Fourie and Ger-Marie WhatsApp members. Use a pleasant client/month heading and
brief bullets: what changed and what needs their review. Keep the poster captions
unsigned and directly forwardable. Retain the note's delivery receipt; a follow-up
note never requires replaying the posters. This is an internal review request,
not evidence of approval or authority to publish.

## Rollout truth

Source implementation is on the existing #948/#956 lane. The base brand tables
were already applied under 20261111064719; **do not replay that migration**.
The new `20261125073157_picasso_design_pack.sql`, UI and connector addition are
prepared changes, not evidence of production application. Existing brand/video
reads are unchanged and do not require the new column. Full production RLS/browser
acceptance, reviewed real-client pack population and an actual ordinary-company-
ChatGPT → current pack → completed artifact review invocation remain rollout gates.
No test fixture or source merge may be reported as those live acceptances.
