# Website M1 — Red Oak acceptance reconciliation

Status: production path complete; optional end-to-end client-session isolation check remains.

This document records read-only production truth observed on 23 September 2026. It is not authority to save another snapshot, edit a report, or publish again.

## Exact pilot identity

- Dynamics client: Red Oak
- Client ID: `cdb11a82-339e-4b46-9b09-bde1a23efeaf`
- Builder Website ID: `7`
- Canonical host: `www.redoakgroup.co.za`
- Environment: `production`
- Reporting period: `[2026-09-01,2026-10-01)`

## Completed production evidence

- Period-contract migration `20260923160000` is applied exactly once.
- One immutable website snapshot exists for Red Oak, revision `1`.
- Its source state is `partial`; traffic coverage begins `2026-09-18`.
- The snapshot is linked to the existing September monthly report, whose persistence period remains inclusive through `2026-09-30`.
- The September report is published.
- No other Red Oak report period was rewritten.
- The client-safe projection removes `identity.dynamicsClientId` while retaining the production host, period, aggregate traffic, aggregate conversion and explicit data-quality limitations.
- `authenticated` has no direct SELECT privilege on `website_report_snapshots`.
- `client_published_reports()` remains executable by authenticated users but filters to `status = 'published'` and `report.client_id = my_client_id()`.

## Do not repeat

- Do not click **Save to monthly report draft** for this acceptance run.
- Do not publish or republish the September report.
- Do not change the website/client mapping, reporting token, report dates or snapshot identity.
- Do not convert partial coverage or unavailable values into zero.

## Optional final client-session proof

1. Sign in through the existing exact Red Oak client portal account.
2. Open September 2026 Performance → Website.
3. Confirm the published snapshot renders Website 7 data, the partial-coverage notice, coverage from 18 September, and no internal IDs/provider credentials.
4. Sign out and sign in as one other mapped client.
5. Confirm that client cannot retrieve or display the Red Oak September report or website snapshot.
6. Record pass/fail only; do not mutate either client's report or portal access.

Any missing authenticated session is a human-access acceptance blocker, not a reason to bypass RLS with service-role data.
