# SES setup — af-south-1 (Cape Town), à-la-carte, shared IPs — #405

Runtime is already merged and deployed **inert** (#636 → `52de088`; migration `20261002160000`
ledger-exact; `website-enquiry-delivery-worker` v2, `website-enquiry-ses-events` v1). This is
the AWS / DNS / secrets activation. Sending stays **disabled** throughout:
`WEBSITE_ENQUIRY_EMAIL_ENABLED` is never set here.

## Why CA runs the setup script

The agent has no AWS access in this environment (no AWS CLI, profile, credentials or console
session) and may not sign in, create accounts, or handle API keys/passwords. So the whole AWS +
Supabase-secrets setup is one reviewed, tested script that CA runs with CA's own sessions. It
never prints a secret: the SES sending key and worker secret go from generation straight into
Supabase secrets / Vault through a 0600 temp file that is removed on exit.

## Facts established 2 Oct 2026

- **Since 21 Jul 2026 new SES accounts start on the Essentials plan ($0.16/1,000)**, not
  à-la-carte. Plans are per account *and per region*. À-la-carte = `PricingAttributes.CurrentPlan
  = NONE`; change it in SES console → Pricing plan → **Cancel plan** (a defaulted plan's first
  cancellation is immediate). The script refuses to change anything unless it reads `NONE`.
- af-south-1 is an AWS **opt-in region**; it must show `ENABLED` (enabling is free).
- `cgdynamics.co.za` DNS is hosted by **Afrihost** (SOA `support.afrihost.com`, NS
  `ns.dns1.co.za`/`otherdns`). The agent has no Afrihost access; CA adds the records.
- `*.cgdynamics.co.za` is a **wildcard A** (`102.222.124.101`). Harmless: the explicit
  CNAME/MX/TXT records below take precedence for their names.
- Parent DMARC is `p=none; adkim=s; aspf=s`: **strict alignment with a non-enforcing `p=none`
  policy** (`adkim=s; aspf=s` set strict alignment; `p=none` is monitoring, not enforcement).
  From `leads@notify.cgdynamics.co.za` is DKIM-signed as `notify.cgdynamics.co.za`, so strict DKIM
  alignment passes; the MAIL FROM `mail.notify…` does not strictly align SPF, which is fine because
  DMARC passes on DKIM alone.
- DKIM CNAME targets are taken from SES (`DkimAttributes.SigningHostedZone`), never guessed.

## Exact order

1. **AWS account (CA):** confirm af-south-1 is `ENABLED`; SES → af-south-1 → **Pricing plan**:
   if a plan is shown, **Cancel plan** → à-la-carte. No dedicated IPs, VDM or other add-ons.
2. **Dry run (CA):** `bash scripts/ops/ses-af-south-1-setup.sh` — read-only checks and plan.
3. **Apply (CA):** `REQUEST_PRODUCTION_ACCESS=yes bash scripts/ops/ses-af-south-1-setup.sh --apply`
   (omit the variable to defer the production-access request). Before any change it fails closed
   (exit 2) if: the region is not enabled; the plan is not `NONE`; dedicated IP pools or VDM exist;
   Supabase secret names cannot be listed; `WEBSITE_ENQUIRY_EMAIL_ENABLED` exists; or
   `cg-dynamics-ses-sender` already has access keys while `WEBSITE_ENQUIRY_SES_ACCESS_KEY_ID` and
   `WEBSITE_ENQUIRY_SES_SECRET_ACCESS_KEY` are not both set in Supabase. AWS never returns an
   existing secret key, so that last state is unrecoverable: deactivate and delete the unused
   key(s) in IAM (after confirming nothing uses them) and re-run. If both secret names exist, a
   re-run reuses the existing key. Then it converges:
   - configuration set `cg-dynamics-events` (no dedicated pool / VDM / reputation options);
   - identity `notify.cgdynamics.co.za` (Easy DKIM, default configuration set) + MAIL FROM
     `mail.notify.cgdynamics.co.za` (`USE_DEFAULT_VALUE` on MX failure);
   - SNS topic `cg-dynamics-ses-events` with **`SignatureVersion=2`** and a policy allowing only
     `ses.amazonaws.com` from this account's configuration set;
   - event destination `cg-dynamics-sns`: SEND, DELIVERY, BOUNCE, COMPLAINT, REJECT → topic;
   - Supabase `WEBSITE_ENQUIRY_SES_SNS_TOPIC_ARN` **before** the HTTPS subscription (the endpoint
     confirms only its configured topic, after verifying the SNS certificate chain);
   - IAM user `cg-dynamics-ses-sender` with inline policy: `ses:SendEmail` on exactly this
     identity + configuration set, `ses:FromAddress = leads@notify.cgdynamics.co.za`;
   - secrets: `WEBSITE_ENQUIRY_EMAIL_PROVIDER=ses`, `WEBSITE_ENQUIRY_EMAIL_FROM`,
     `WEBSITE_ENQUIRY_SES_REGION=af-south-1`, `WEBSITE_ENQUIRY_SES_CONFIGURATION_SET`,
     `WEBSITE_ENQUIRY_SES_ACCESS_KEY_ID`, `WEBSITE_ENQUIRY_SES_SECRET_ACCESS_KEY`,
     `WEBSITE_ENQUIRY_WORKER_SECRET` (also Vault `website_enquiry_worker_secret`);
   - optional TRANSACTIONAL production-access request with a truthful use case;
   - writes `ses-af-south-1-setup-summary.txt` (**no secrets**): topic ARN + exact DNS records.
4. **DNS (CA, Afrihost):** add the 3 DKIM CNAMEs, the MAIL FROM MX and TXT from the summary.
5. **Share the summary on #405.** The agent then runs
   `node scripts/ops/ses-setup-verify.mjs <summary>` (public DNS via 8.8.8.8 and 1.1.1.1 +
   secret *names*), confirms the SNS subscription was confirmed by the deployed endpoint (logs),
   creates the `pg_cron` worker schedule reading the Vault secret, and confirms the worker
   reports `state: disabled`.
6. **Activation (separate CA approval):** only after SES shows the identity verified and
   production access granted (or a sandbox-verified CG inbox): set
   `WEBSITE_ENQUIRY_EMAIL_ENABLED=true`, one **CG-owned** acceptance send (→ delivered via SNS),
   then SES mailbox simulator `bounce@simulator.amazonses.com` / `complaint@simulator.amazonses.com`.
   No client-facing send until all three pass.

## Rollback

Unset `WEBSITE_ENQUIRY_EMAIL_PROVIDER` (worker returns `disabled`); delete the IAM access key;
disable the event destination; unsubscribe the endpoint. No data is lost: enquiries and Lead
Inbox never depend on email.

## Script tests

`node --test tests/sesSetupScript.test.mjs` runs the script against stub `aws`/`supabase` CLIs:
dry run makes zero mutating calls; each cost/region/ENABLED guard stops before any change;
apply converges in the safe order with least-privilege policies; secrets reach Supabase/Vault
but never stdout, the summary or a command line; existing keys are never duplicated and are
reused only when both SES credential secrets exist, otherwise the run stops before any change
(also when the secret list is unreadable); production access only on explicit opt-in.

## Lessons from the first live run (2 Oct 2026)

- Vault write: `vault.update_secret` returns `void` and `vault.create_secret` returns `uuid`, so they
  cannot share one `CASE` (Postgres 42804). The script now issues two statements and calls
  `supabase db query --linked --project-ref` (`--project-ref` alone is rejected by the CLI).
- af-south-1 SNS signing certificates are issued to `sns-signing.af-south-1.amazonaws.com` /
  `sns.af-south-1.amazonaws.com` only (no `sns.amazonaws.com` SAN). Trust accepts a regional SAN
  only when it equals the validated SigningCertURL host; the Amazon chain and pinned roots are
  unchanged. Before this fix the endpoint answered the SubscriptionConfirmation with
  `401 untrusted_certificate`, leaving the subscription `PendingConfirmation`.
