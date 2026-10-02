# #389 — verified service expansion checkpoint

Agent 02 scope: #381 comment 5952482200 and #389 comments 5952436301 / 5952485602, with fail-closed rollout correction from #635 supervisor comment 5953401925. This is an isolated acceptance packet, not the supervisor-owned master handover.

## Authority and security

- `client_service_entitlements` is a separate, exact-client, seven-service authority. Missing rows are `unknown`. No changes to `clients.package_settings`, `packageAuthority` or `socialProviderEligibility`.
- Active admin/manager verification requires evidence and source references for affirmative inclusion/exclusion/applicability. Expected revision prevents overwriting another review. Before/after evidence is audited in canonical `planner_activity_log`.
- Clients have no direct evidence-table rows or Planner access. The no-argument safe read resolves active `auth.uid()` → active client profile → exact active client. It returns only service/state/connection/verification time/request time.
- Connection projection reads existing exact-client Meta assets/connections (Page-linked and confirmed standalone), TikTok connections and dedicated/shared Google Ads mappings. No tokens, provider IDs or paths reach the portal. Connected means configured source, never metric completeness or zero activity.
- LinkedIn, Google Business Profile and Website/Digital Experience have no current, canonical connection adapter in this lane. They remain connection-unverified; historical/manual report facts and website snapshots are not promoted into current connectivity. No Website/#405 adapter or provider work is added.
- Only verified `not_included` permits a benefit-led request CTA. Included + disconnected is connection help, never an upsell; unknown is hidden client-side and verified not-applicable is neutral.
- `submit_client_service_expansion_request` accepts service, bounded message, UUID idempotency key and allowlisted surface only. Actor/client/board/bucket/assignee/price are never browser authority.
- One PostgreSQL transaction creates the canonical Operations `planner_tasks` CLIENT REQUESTS row (`priority=client_request`, `source=client_portal_service_expansion`) and its audit receipt. The existing canonical insertion/projection guard pattern is reused; staff/MCP request RPCs remain unchanged. Missing or ambiguous destination fails closed, without fallback.
- Tenant-key advisory serialization plus a unique audit receipt index gives same-payload replay, changed-payload conflict, and no partial task when audit fails. Replay depends on immutable audit payload, not staff-edited task notes.
- Surface measurement and request totals reuse the activity authority, with bounded verified-only seven-service/two-Overview events and exact-client active-manager reads. Unknown/hidden services are not measured as views. Staff quote/follow-up continues in Operations; no purchase/package mutation or speculative conversion/ROI claim is introduced.

## UI

- Performance: editorial section after existing reporting containing only verified included/not_included/not_applicable services (also accessible before the first published report, only if verified services exist).
- Overview: at most two explicitly verified expansion opportunities. Unknown or unavailable reads show no promotional section.
- Loading, missing RPC/schema, read/parse failure and all-unknown results render no client expansion module at all: no heading, container, diagnostics, synthetic rows or CTAs. Client/surface identity changes cannot reuse another read's rows.
- Package Master: active admin/manager evidence verification and request/view totals, linked to existing Operations.
- Client identity changes immediately discard prior client's result/receipt state. Effect cleanup rejects stale responses. An ambiguous submission freezes its payload and retries the same key; durable server receipt survives route switching/reload.

## Verification

- `node scripts/client-service-expansion-acceptance.mjs`: PASS on disposable PostgreSQL 17. Executes the complete new migration against canonical dependency DDL and real Planner insert audit/projection functions. 44 SQL assertions/denial checks plus a six-session request race: RLS/grants, manager authority, inactive identities, exact-client entitlement and configured-source reads, provenance/revision, idempotency/conflict, no bucket fallback, surface counts, admin measurements and injected post-insert audit rollback.
- Eight focused presentation/portal/reporting/Planner suites: 165/165 passing.
- Seven package/eligibility/client-workspace/reconciliation suites: 55/55 passing. Total relevant Node checks: 220/220.
- `scripts/client-service-expansion-browser.mjs`: actual React components/RPC helpers with isolated local auth/network fixtures, no production authentication or writes. Desktop 1440×1000 and mobile 390×844 PASS: verified-only states, hidden unknowns, CTA restrictions, ambiguous retry same payload/key, durable receipt, Overview/Performance switches, cross-client reset, admin evidence submit, no horizontal overflow or page errors. Both surfaces render zero expansion UI for loading, missing RPC (PGRST202), missing schema (42P01), failed read, all-unknown and malformed responses. Three verified opportunities are capped at two on Overview. Hidden modules create no view measurement. Local screenshots: `%TEMP%/cg-389-desktop.png`, `%TEMP%/cg-389-mobile.png`.
- Browser CLI was not installed; approved bundled Playwright supplied the equivalent repeatable browser verification. Test fixtures intentionally use a loopback-only Supabase endpoint and no credentials.
- Production build (`tsc -b && vite build`): PASS; application chunks emitted. Existing >500 kB chunk warning remains.
- Scoped lint: zero errors. Four pre-existing unused disable-directive warnings in Package Master remain unchanged. Diff check: PASS.
- Initial regression invocation lacked local test env and failed; rerun with loopback-only placeholders and serial execution passed. No assertions were removed or weakened.

## Protected rollout / remaining acceptance

Migration `20261002124434_client_service_entitlements.sql` is PREPARED ONLY, never applied to production. No production DB/data/provider/config/permission/OAuth writes, deploy, package change, merge, or master handover edit.

Supervisor review and visual acceptance remain required. Production application and real per-client evidence verification are separate protected gates. A Vercel preview build does not prove authenticated production DB acceptance; before applying the migration, supervisor must verify canonical dependency schema and review the privileged seams. No real entitlement is seeded or inferred by this PR.
