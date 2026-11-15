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
