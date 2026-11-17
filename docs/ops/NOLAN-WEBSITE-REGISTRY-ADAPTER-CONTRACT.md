# Full website registry adapter: exact remaining backend requirement

This is a proposed implementation contract, not a deployed capability.

## Verified current source

- Builder: `CGProductionHouse/cg-website-editor`, `src/collections/Websites.ts`.
  Website records own `clientName`, `slug`, `publicSiteUrl`, `status`, operations
  eligibility/disposition, reporting identity and launchDiscovery evidence.
- Existing Builder GET `/api/reporting/websites/[websiteId]` accepts the server-held
  reporting bearer and exact Dynamics client UUID, returning one reporting period.
- Existing Dynamics `website-performance-report` authenticates the Dynamics user,
  checks their profile role and explicit client mapping, then calls that endpoint.
- Neither inspected endpoint provides a full managed-website inventory. The
  Website Operations connector lists per-user enabled operations, not every record.

## Required backend addition before native fleet completion

1. Add a dedicated read-only inventory endpoint in Builder, with its own explicit
   authorization contract. Do not silently broaden the existing reporting token.
   An approved server identity must be granted only the inventory-read scope.
2. Return a minimal allowlisted projection: immutable Website ID, display name,
   exact Dynamics client UUID if bound, canonical/public host, active/paused/archived
   state, out-of-scope/held classification, repository identity, source updated time,
   reporting availability, and launch checklist status/evidence timestamp if present.
   Never return contact details, tokens, arbitrary notes or unrestricted collections.
3. Include all authorized records (including disabled/held) with stable ID-order
   cursor pagination, total denominator, exact coverage and server read timestamp.
   Missing mapping is explicit. Never fuzzy-match company names.
4. Dynamics authenticated edge adapter must validate bearer via existing auth,
   require current admin/manager role, use the dedicated server-held credential,
   validate upstream identity/schema and pagination, fail closed on partial errors,
   and send no secrets to the browser. Client/staff denial and cross-tenant tests
   are mandatory; do not reuse a service key as a browser credential.
5. Browser view reads that adapter, displays registry state separately from health,
   includes freshness/held/unknown states, and opens current authoritative records.
   No website mutation, deployment, crawling or health probes are side effects.
6. Gate rollout under #679 and explicit credential/permission approval where needed.
   Verify real manager access, staff/client denial, totals, late-page errors, wrong
   client mapping and rollback before claiming live fleet coverage.

No endpoint, token, role, live configuration, permission or deployment was changed
by this investigation. Implementation cannot honestly be called supported by the
current inspected contract. The website tab remains visibly incomplete meanwhile.

## 15 November authoritative recheck (compiled 14:24 UTC / 16:24 SAST)

Production `list_websites` returned **10 accessible enabled-operation records**, not
a certified full-fleet denominator. IDs: Piek 1, Get Together 2, Imbewu 4, CG ARCC 5,
Emmanuel 6, Red Oak 7, All Around PVC 8, JFJ 9, Raadzaal 10, Wiseman 11. This differs
from the earlier nine-row receipt; do not silently carry nine forward. Seven have
publicSiteUrl values; CG ARCC/JFJ/Wiseman return null. Null means no recorded URL,
not down, missing or unowned. All ten exact `get_website` records were read; none
exposes `reporting.dynamicsClientId`. Registration read for Get Together also omits
that binding. No new Dynamics joins can therefore be certified by these tools.

Builder source pinned to commit `96a6876da6b46cfa71d3c5a28d80af8f2964a12a`:
- `src/lib/websiteOperations/service.ts`: `listManagedWebsites` filters
  `operations.enabled=true`, uses `limit:200`, returns projected docs without total
  or continuation. Its exact getters expose identity/repository, not reporting UUID.
- `src/collections/Websites.ts`: the UUID exists under `reporting.dynamicsClientId`;
  existence of the schema field does not verify values of any live record.
- `src/lib/websiteOperations/auth.ts` and `src/access/websiteAccess.ts`: bearer
  principal resolves via Payload or configured OAuth user-info; enabled account
  and owner/admin versus assigned-website access remain authoritative. This is not
  proof that a Dynamics bearer may be forwarded to that separate service.
- `src/app/(payload)/api/reporting/websites/[websiteId]/route.ts`: server-held
  reporting token, one Website ID plus exact client UUID and bounded date range;
  this is not inventory authorization or pagination.

Existing Dynamics `website-performance-report` validates its own signed-in user
and active client, server-held explicit client map and duplicate-map rejection,
then returned Website/client/period identity. Its report preview role list is
admin/manager/staff/team; saving is separately admin/manager-only. The workbook
still uses the existing manager route and read-only reporting panel. The proposed
inventory adapter's narrower manager/admin contract remains a NEW requirement,
not an already-deployed capability. No token, role, map or permission changed.

The four source-reviewed Dynamics UUID/presentation hosts remain unchanged.
Matching their recorded public hosts to operations summaries is corroboration of
presentation only, not a newly verified reporting binding. Six remaining operations
records must not be joined by names, slugs, domains or presumed package activity.
The existing workbook now exposes accessible client-identity coverage and exact
mapping IDs, explicitly distinct from website denominator, report health or source
freshness. Additional inventory/mapping access remains the precise expansion blocker.
