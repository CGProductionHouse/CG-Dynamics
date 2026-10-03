# Resend Free bridge for website-enquiry notifications — #405

Supervisor decision (#405, 3 Oct 2026): use **Resend Free** as the temporary transactional
transport while the SES production-access review continues. This is a provider switch only, on
the existing provider-neutral outbox. SES (identity `notify.cgdynamics.co.za`, SNS, IAM, Vault,
worker schedule, AWS case `179096864300565`) is **left intact**; nothing here touches it.

## Facts (3 Oct 2026)

- Code already supports Resend: worker adapter (`WEBSITE_ENQUIRY_EMAIL_PROVIDER=resend`,
  `WEBSITE_ENQUIRY_RESEND_API_KEY`, idempotent replay via `Idempotency-Key`) and the Svix-signed
  `website-enquiry-delivery-webhook` (`WEBSITE_ENQUIRY_RESEND_WEBHOOK_SECRET`, `verify_jwt=false`).
  The webhook now records `email.complained` as the canonical terminal `complained` state (same as
  SES), alongside `email.delivered` and `email.bounced`.
- Production before this lane: no Resend secrets; the webhook answers `503 Webhook is not
  configured`; the worker answers `disabled` (`WEBSITE_ENQUIRY_EMAIL_ENABLED is not true`).
- Sending subdomain: **`notify.cgproductionhouse.com`** (separate from the SES identity; no
  existing Resend records in public DNS, only the zone's wildcard A). Zone `cgproductionhouse.com`
  is at Afrihost. Its DMARC is `p=quarantine; adkim=s; aspf=s` — Resend signs DKIM as
  `notify.cgproductionhouse.com`, which strictly aligns with `From: leads@notify.cgproductionhouse.com`.
- Resend Free: 3,000 emails/month, 100/day. No paid feature is used (no tracking, no dedicated IP).
- Region `eu-west-1` (closest to South Africa among Resend's regions).

## Human-only gates (smallest set)

1. **Resend API key (CA):** in the Resend dashboard create a **Full access** key for setup only.
   In your own terminal: `export RESEND_SETUP_API_KEY=re_...` (PowerShell: `$env:RESEND_SETUP_API_KEY='re_...'`).
   It is used for the setup calls and never stored; delete it in Resend afterwards.
2. **Run the setup** (CA, or the agent if the variable is set in the agent's environment):
   `node scripts/ops/resend-bridge-setup.mjs` (dry run) then `--apply`. It creates the domain, a
   **sending_access** key restricted to that domain (→ Supabase), and the webhook for
   delivered/bounced/complained (→ signing secret into Supabase). Writes
   `resend-bridge-summary.txt` with the exact DNS records (no secrets).
3. **DNS (CA, Afrihost):** add the records from the summary to the `cgproductionhouse.com` zone
   (DKIM TXT `resend._domainkey.notify`, MX + SPF TXT on `send.notify`).
4. **Switch provider** once Resend shows the domain `verified`:
   `node scripts/ops/resend-bridge-setup.mjs --apply --switch-provider` sets only
   `WEBSITE_ENQUIRY_EMAIL_PROVIDER=resend` and `WEBSITE_ENQUIRY_EMAIL_FROM`. Never the enable flag.
5. **Activation (separate CA approval):** `WEBSITE_ENQUIRY_EMAIL_ENABLED=true`, then the CG-only
   acceptance: one CG-owned real delivery (→ `delivered` via webhook), bounce
   (`bounced@resend.dev`) and complaint (`complained@resend.dev`) test addresses, replay/idempotency
   check, then normal client routing.

## Safety properties (tested in `tests/resendBridgeSetup.test.mjs`)

- Dry run makes only GET calls and stores nothing.
- Guards stop before any Resend call: invalid/missing setup key, unreadable Supabase secret names,
  `WEBSITE_ENQUIRY_EMAIL_ENABLED` present.
- An existing webhook whose signing secret is not in Supabase (Resend returns it only at
  creation), or that lacks the events / is disabled, stops before any change.
- Each created credential is stored the moment it exists, through a 0600 temp env file removed
  immediately; no secret reaches stdout, the summary, an error message or argv.
- Re-runs converge without duplicating keys or webhooks.

## Switching back to SES later

Re-run `bash scripts/ops/ses-af-south-1-setup.sh --apply` (it resets `PROVIDER=ses` and the SES
`FROM`), or set those two secrets directly. Resend secrets can stay or be unset.
