# Current client launch — Overview / Plan truth correction

Owning scope: #389 / #623. Onboarding is separately parked in PR #662 and is
not this mission's launch focus. Base main4aa9a95d82ced27564d3b16ce59e801a49f3f999.

## Reproduced defect

Overview derived its working month from the last published report and its current
direction from that report's strategy_data. A May report therefore requested June
schedule while Plan defaulted to October. No report meant no schedule request.
Plan already uses the canonical monthly strategy RPC, so Overview could disagree.
Separate Plan content detection omitted goldStandard fields and hid a valid
gold-standard-only published strategy. Regression fixtures fail on original main.

## Correction

- Working month uses existing businessMonthKey (Africa/Johannesburg), independent
  of report availability/age. Report period stays separately labelled unchanged.
- Overview requests current exact own client calendar and canonical
  client_monthly_strategy, never a staff table/draft/fallback from report prose.
- Preview requires exact first-of-month match plus valid publication evidence;
  existing client-facing copy quality guard excludes internal/filler text.
- Strategy read failure has an unavailable message; empty/unpublished stays
  awaiting reviewed publication. No fabricated copy or metric.
- Plan recognises existing hasStrategyContent including gold-standard-only
  fields, preserves selected-calendar content and uses the same copy guard.
- Plan, standalone Strategy, Calendar and Guidelines share Johannesburg defaults;
  calendar date grouping/today use business date. Malformed month00/13 defaults
  fail closed instead of allowing a bogus query.

No new schema/API/Edge/config/provider/production data, package confirmation,
strategy amendment/approval/publication, metric aggregation or visual redesign.
Existing client role guards and exact-own published RPCs remain authority. The
guarded client read has no client-ID override; calendar retains explicit own UUID.

## Verification

Six new executable regressions: old-report independence; Johannesburg September/
October and December/January boundaries; canonical current gold-standard preview;
missing/unpublished/malformed/foreign-month rejection; internal/filler rejection;
gold-standard-only content authority and own published RPC contract. Full focused,
suite/build/lint/diff and exact-head Vercel results are recorded on the PR.

Existing requested info Chrome production session is staff/admin, not a genuine
client-role session. Do not claim client-role browser acceptance or copy tokens
to preview. Production deployment parity and available staff controls can be
checked, but exact-client login remains the honest browser acceptance limitation.

## Genuine remaining client launch gates

- #513:72 guarded amendments prepared,22 blocked; no approval/publication. Poor
  stored prose requires the exact protected amendment packet, not UI masking.
- #389:two reviewed entitlement migrations and exact admin service verification
  for61 active clients; unknown scope cannot yield a premium purchase offer.
- #451:approved engineering, protected three-function freshness rollout still
  pending; stale/partial must remain truthful meanwhile.
- #505:owner/provider linking/access/consent gates; CA's current work untouched.
- #405:separate delivery owner; no duplicate Website/Resend activation work.
- Four unverified package receipts and exact calendar duplicate decisions need
  human evidence/audited production action; Hours/history preserved.
- Actual client/staff/Hours role acceptance only with legitimate sessions.

This is not an overall launch-complete claim. Master handover remains
supervisor-owned; #389/#623/#381 receive the durable receipt.
