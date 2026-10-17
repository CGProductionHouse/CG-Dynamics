# Client Lead Inbox read truth — 17 October 2026

Authority: #405 / #668 / #381; release gate #679. Base main
`a0c6a066411b9f557f20156f31ddafaa4e48c470`. Open #775/#662/#618 owners inspected,
not changed. No new data authority, package or calendar model.

## Reproduced and fixed

Five actual-reader test groups failed before the fix:

- Null `website_lead_inbox` data was converted into verified empty `[]`.
- Missing lead identities and invalid dates survived mapping, allowing invalid
  Date rendering or ambiguous records instead of a safe load error.
- `website_lead_metrics` was accepted through an object cast: unknown state,
  wrong period, negative/string/fractional/unsafe counts, inconsistent lifecycle
  totals and invalid qualification rates could reach display components.
- The metrics cast retained unexpected fields rather than an aggregate allowlist.
- Rejected inbox/metrics/breakdown promises escaped the reader contract; the
  Inbox's initial load had no rejection handler, so it could remain loading.

Existing database functions and server-owned identities are unchanged. Frontend
readers now return safe error states for malformed/missing/rejected results;
confirmed empty arrays, real zeroes, disconnected retained history, rounded
qualification rates and ordinary unavailable-rollout responses remain distinct.
Wrong explicit client identity remains rejected. Metrics project only known fields.
Qualified is still Good including later Won/Lost, not a disjoint pipeline bucket.

Runtime: `src/lib/db/websiteLeads.ts`, `src/lib/websiteLeads.ts`.
Tests: new `tests/websiteLeadReadTruth.test.mjs`, new actual-component
`scripts/client-leads-readonly-browser.mjs`; registered in the existing local
acceptance plan. Existing full-preview fixture now supplies the complete real
metrics response shape, rather than an incomplete stub; its expectations remain.
No TSX/design or production dependency change.

## Live contract/source check

Executed only:

```sql
select pg_get_functiondef('public.website_lead_metrics(uuid,date,date)'::regprocedure) as definition;
```

Production function body matches the committed lifecycle migration body exactly.
Safe definition/query receipt:
`strategy-review/2026-10-17-live-lead-metrics-contract.json`.
This proves the implemented contract, not actual visitor volumes, freshness,
activation or delivery. No customer rows, session impersonation, auth changes,
production function execution or SQL mutation used.

Supabase changelog and official JavaScript RPC reference were checked. No SDK,
transport or platform configuration changed. Focused data-quality checks used
the exact client/period aggregate grain and existing lifecycle rules; no KPI
definition, historical data, missing figure or source status was invented.

## Verification and review

- Before repair: **5 failed /1 passed** actual-reader test groups.
- After repair: **33 focused pass /0 fail** (read truth, lifecycle, breakdown,
  website dashboard, navigation and local acceptance contracts).
- Final supported serial suite: **3924 total /3905 pass /19 intentional skips
  /0 fail**. Two optional PostgreSQL checks are skipped because Docker is stopped;
  unsupported Windows Bash SES is excluded, not passed. Log: workstation Temp
  `cg-lead-read-truth-full-suite.log`.
- All **15** canonical local browser fixtures pass. New Lead Inbox fixture tests
  actual components in client-pinned and named preview modes at1440/375/390/430;
  missing envelope, malformed row, transport rejection, verified zero and invalid
  metrics. No browser runtime errors/overflow; only intercepted existing read RPCs.
- Build (`tsc -b && vite build`), emitted application code (`client-schedule`),
  scoped ESLint and diff checks pass. Existing large-chunk warning unchanged.
- Review: no source-of-truth duplication, auth/RLS/service secret, write/signature,
  publication or role-boundary change. Existing lifecycle save function untouched.
  False absence is prevented without discarding legitimate zero or historical data.

Local fixtures and function-definition parity do not prove a real client-role
production journey. No new dashboard claims are made about live lead numbers.

## Neshora authoring continuation — verified separately

The existing **Write Client Strategies** chat is completed/idle on this check.
Its answer body is only an opaque content reference through the app reader; that
reference was not treated as strategy content or a canonical save receipt. Fresh
company CG connector readback confirms:

- Client `3c20fae1-8e91-41d5-98eb-1c331600e6e3`.
- Exact19October run `0441e2b1-7170-4ba1-bbbc-49400bda083a`.
- Existing draft Content Guideline `9ba79133-aace-4caa-bf4f-0b1c236f65df`; two
  ordered ideas have scripts, with October/November coverage months respectively.
- Both ideas are unallocated/not_shot; no published final. Missing client short
  code prevents canonical production folder readiness. No code guessed or written.
- November strategy `0018ace6-7f52-4b52-a411-ae34dbc89cb2`, version1, draft,
  no published version; still `CLIENT_EVIDENCE_UNVERIFIED` and
  `EXACT_STRATEGY_EVIDENCE_UNAVAILABLE`. Confirmed scope was not requested again.

No attribution that the latest writer turn created/changed those scripts: there
is no independently compared prior full-script revision in this pass. No patient
story text or private health details copied into GitHub. Existing authoring and
owner/source decisions remain separate; no duplicate writer mission dispatched.

## Release/remaining boundary

ZERO Vercel/cloud builds/deployments, production data/schema/Edge/config/secrets,
provider/OAuth/permission changes or strategy/report/asset publication. These
frontend readers are source-ready, not deployed. Git deployment guard remains OFF.
No discarded or recreated clients, CG Hours or timesheets.

Continue exact #451 provider repairs and source-ready normal-chat authoring while
preserving protected source, recipient/final-asset, publication and true-client
acceptance gates. Frontend release requires #679's exact fresh approved packet.
This does not close #405's real enquiry/delivery acceptance or declare all clients
launch-ready. GitHub/#381/handover updated; previously inaccessible Control Centre
reference not guessed or replaced.
