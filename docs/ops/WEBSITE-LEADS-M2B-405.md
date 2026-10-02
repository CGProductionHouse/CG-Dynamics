# Website Lead Inbox — #405 M2B

Owner #405. Builds on M2A (#614, merged to `main`). Migration
`20261002090000_website_lead_lifecycle.sql` is **UNAPPLIED** and must be applied
only after `20261001181932_website_enquiry_transaction.sql`, by explicit CA approval.

## What it adds

- `website_enquiry_lead_states` — the client's mutable lifecycle for one canonical
  enquiry. Status and quality are coupled deterministically (DB constraint + RPC + UI):

  | Client choice | status | quality |
  | --- | --- | --- |
  | New / Contacted | `new` / `contacted` | none (unreviewed) |
  | Good lead | `qualified` | `good` |
  | Won | `won` | `good` |
  | Lost (good lead, did not go ahead) | `closed_lost` | `good` |
  | Poor lead (reason required; note for "other") | `closed_lost` | `poor` |

  Any other pair (e.g. Good + New, Poor + Qualified/Won, unreviewed Won) is rejected.
  Absence of a row = New/unreviewed.
- `website_enquiry_lead_state_events` — append-only audit (actor, actor kind,
  previous/new status and quality). No visitor PII.
- Acquisition evidence (`website_enquiries`, `website_enquiry_events`) is never
  altered; lifecycle is a separate table keyed `(enquiry_id, client_id)`.
- RPCs (SECURITY DEFINER, empty search path, `authenticated` execute only):
  - `website_lead_inbox(p_client_id, p_limit, p_before)` — exact-client list/detail,
    labelled answered fields in schema order, attribution, lifecycle.
  - `set_website_lead_lifecycle(p_enquiry_id, p_status, p_quality, p_poor_reason, p_poor_note)`.
  - `website_lead_metrics(p_client_id, p_from, p_to)` — aggregate only: total, new,
    contacted, qualified (= Good leads, including later Won/Lost), won, lost,
    closed-lost, good, poor, unreviewed, qualification rate (= qualified / total,
    null when 0);
    `state = not_connected` when the client has no production endpoint.
- Client identity: `role = 'client'` users are pinned to `profiles.client_id` and
  are rejected (42501) if they name another client; staff
  (`admin|manager|staff|team`, active) must name an active client. Cross-client and
  non-existent lead mutations return the identical error. Preview/staging
  (synthetic) enquiries never appear in the inbox, metrics or mutations.

## UI

- Current month is computed in Africa/Johannesburg (`currentReportingMonth`), not UTC,
  in both the client Leads page and the staff Website Performance panel.
- Client portal: `/client/leads` (nav "Leads") — month metrics, status filter,
  lead list, detail with direct Call (`tel:`), WhatsApp (`wa.me`, only for
  international numbers or SA `0XXXXXXXXX` → `27…`) and Email (`mailto:`) built
  from stored contact fields, single "Lead progress" selector offering only the five valid outcomes.
- Staff: Website Performance panel shows "Website lead outcomes" for the selected
  client/month.
- Truthful states: migration missing → "not activated"; no endpoint →
  "no website enquiry form is connected"; zero rows → "no enquiries". No PII or
  lead events are sent to GA4/analytics.

## Acceptance

```
node --test tests/websiteLeadLifecycle.test.mjs
node scripts/website-lead-lifecycle-acceptance.mjs
```

The acceptance script creates a unique disposable PostgreSQL 17 container,
applies M2A + M2B, submits enquiries only through `submit_website_enquiry`, and
proves: exact-client inbox; synthetic exclusion; poor-reason rules; cross-client
read/mutation rejection; inactive/unauthenticated rejection; staff must name a
client; PII-free metrics; empty-period truth; `not_connected` state; audit trail;
acquisition evidence unchanged.
