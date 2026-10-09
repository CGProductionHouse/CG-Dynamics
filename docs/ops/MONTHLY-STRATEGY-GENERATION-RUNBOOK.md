# Monthly strategy generation — prepared, not activated (#731)

The existing daily `monthly_strategy_autopilot` worker remains the only scheduler. It seeds current/next-month drafts. With `MONTHLY_STRATEGY_AI_ENABLED=true`, the daily pass also requests one idempotent exact-client next-month child job per eligible draft. The flag defaults off; this branch does not set it, deploy Edge code, backfill production, call a model, approve or publish a strategy.

## Authority and safety

- One `monthly_client_strategies` row per exact client/month; the client portal still reads only the published snapshot.
- The system prepares from the confirmed package, approved/reviewed client evidence, incorporated meeting decisions, prior **published** strategy snapshot and published report/post evidence. Unknown and stale facts are not turned into claims. Internal voice rules are constraints, not commercial objectives.
- The model request is source-digested, version-fenced, token-capped and routed through existing AI budget/health accounting. A failed request leaves the current draft unchanged; there is no canned strategy fallback.
- The proposed migration `20261009120000_guard_monthly_strategy_generation.sql` is necessary before activation. The service-role-only RPC locks the exact row, requires an unpublished `draft`, checks its version and writes an append-only revision. Approval does **not** increment version in the existing canonical RPC; using the ordinary amendment RPC here would permit an in-flight model response to revert an approved strategy. Never substitute that RPC.
- System-authored text may refresh after a new incorporated decision only while it exactly matches its previous generated value. Staff wording, review state, internal notes and published snapshots are retained. Actual conflicts are visible to staff in the strategy editor. No automatic publication exists.

## Protected release gate

Under #679, first resolve the Vercel spend ceiling/client-site reserve and separately authorize the bounded hosting release. Applying the new migration, deploying the two changed Edge functions, enabling model spend, production backfill and any production data write each require their own protected approval/receipt. Do not use production to test an incomplete model prompt.

Before any later activation, require exact-client fixtures and human quality review for Piek, Daisy, We Ar Fuels, AV Event Life and the four Bloemfontein package holds. Reject generic/guardrail-only prose, invented claims, disabled deliverables and stale/partial performance presented as current. Verify model budget and one-job runtime using a non-production environment; then prove the 57 existing November drafts can receive proposals without staff/published overwrites. Check staff desktop/mobile provenance and client published-only projections. Failed jobs must remain visible and safely retryable; do not mark a blank draft as a finished strategy.

## Local verification

`node --test tests/monthlyStrategyAutopilot.test.mjs tests/monthlyStrategyProposal.test.mjs tests/monthlyStrategyGeneration.test.mjs` covers the core exact-client, package, note revision, staff-edit, approval-race and idempotency boundaries. `npm run build` covers the staff UI. Deno type-check both changed Edge entrypoints. The full repository suite has an unrelated expired signed-link fixture in `clientPortalLibraryTruth.test.mjs` at the 9 Oct run; repair it on its own lane, then rerun.
