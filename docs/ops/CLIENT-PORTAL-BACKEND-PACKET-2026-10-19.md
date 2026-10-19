# Client backend packet - review only, NOT release approval

#396/#668; coordination #381; frontend/hosting #679 separately.
Source `ff894ebade8c6cd3e4b230dc86bfbdffcd34c8b0`, branch
`codex/client-portal-reviewed-candidate-2026-10-19`, main base b77b89fb.
Do not deploy/push earlier private-inventory branch history.

## Exact target and closure

Existing `client-onboarding` only, preserving ALL transitive imports at this
commit. No new function, migration/table/role/grant, dependency, secret or
provider configuration. Canonical Git blobs, unaffected by checkout newlines:

| File in supabase/functions/client-onboarding | Git blob |
| --- | --- |
| index.ts | 81f9e5e6b4cb5d5f9d53dd2e4f42e2765048c5ce |
| library-asset-boundary.ts | 9bc6f3c2059a632bb29cbfd171054d23223c0756 |
| library-management-store.ts | 850242bd99e60b184875e9c6330be00e9358f3fa |
| library-management.ts | 78a86e7e0654c8fe4d216accb0811d22c1729140 |
| onedrive-adapter.ts | bf2d6829a97067868a5a53e6ec082440594df80c |

Active-admin curation uses existing private bindings/tables. Authentication,
active-profile roles, onboarding/upload/token flow, client read scope and signed
stream/range behavior preserved. Added exact live asset/category/root ancestry,
malformed-body containment and exact-state publication/visibility conflict guards.
Client projections never expose raw drive/item IDs or internal Microsoft links.

Read/preserve actual hosted JWT/config/secrets and prior deployed rollback closure
at the separately authorised release; local source does not certify those hosted
settings. Never guess CLI flags. Do not wholesale replace index.ts from stale
#775/#662 readiness/resolver PRs. #843 shares App/handover but is a separate forms
release; #842 owns guideline-return-to-review. Staff47+paths remain separate.

## Evidence / controlled activation

`CLIENT-PORTAL-FINAL-CANDIDATE-2026-10-19.md` records frozen full suite,19browser
journeys, actual-handler/SDK synthetic transport, Deno closure and scoped review.
No hosted RLS or true concurrent multi-session certification inferred.

After exact backend approval: prepare existing verified library roots privately,
select individually cleared source files, separately enable one pilot client.
No public OneDrive links, historical Video-tree publication or internal media
exposure. Emmanuel's old staged marketing mockup stays unpublished as a logo;
proper existing source marks were found, with exact references kept private.

Verify real pilot file list/view/download, other-client and inactive/staff denial,
read-only admin-preview agreement, HTTP206/range/expiry, hidden/moved-file refusal
and unconfirmed-write recovery. Only then continue the reviewed cohort. Stop on
identity/ancestry/permission/version/outcome ambiguity; never replay unknown writes.
Content rollback is existing non-destructive hide/disable, not audit deletion;
code rollback is the preserved prior deployed closure.

Compatible frontend release remains a separate #679-authorised artifact. This
packet has NOT deployed, applied SQL/data, copied files, published assets, changed
permissions/OAuth/provider settings or performed any Vercel operation.
