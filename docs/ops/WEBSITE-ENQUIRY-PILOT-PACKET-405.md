# First production pilot packet — #405 website enquiries

Prepared 2 Oct 2026 from repository truth only (no production reads or writes).
Nothing here has been executed. Every step marked **[CA]** is a protected live gate.

## 1. Pilot site — recommendation

Source: `artifacts/issue-567-cg-built-production-website-fleet.json` (read-only,
27 Sep 2026) + each site repo's `origin/main` on 2 Oct 2026.

| Website | Exact Dynamics client | Current enquiry path | Reporting |
| --- | --- | --- | --- |
| **1 — Piek Group** `www.piekgroup.co.za` | `ed7aa1ae-de21-4151-a8f9-54796b234c1f` | **Correction (2 Oct):** `ContactForm.tsx` (name, email, phone, subject, message; `mailto:` only) exists but is **not rendered** — `/contact` replaced it with a visual in commit `1b4fbcf` (25 Jun 2026). Live site has no form. | identity requires guarded activation |
| 7 — Red Oak `www.redoakgroup.co.za` | `cdb11a82-339e-4b46-9b09-bde1a23efeaf` | **no form**; tel/mailto/booking clicks only (`/api/contact-actions` tracking proxy) | published snapshot proven |
| 6 — Emmanuel Funerals, 8 — All Around PVC | exact active | no form found on `origin/main` | guarded activation |

**Recommended first pilot: Website 1 — Piek Group.** It is the only verified
exact-client CG site with an existing enquiry form, so the pilot changes the submit
transport, not the client's content. Red Oak is the stronger reporting benchmark but
would need a new form approved by the client. Imbewu/Raadzaal excluded (web-only/last).
Supervisor confirms the choice and Piek's package before step 4.

## 2. Intake adapter (M2C) — code PRs, unmerged

1. Dynamics `website-enquiry-intake` — CG-Dynamics #625 (#624). Contract:
   `docs/ops/WEBSITE-ENQUIRY-INTAKE-624.md`. `verify_jwt = false`; sole credential is the
   endpoint `intake_key` in header `x-cg-intake-key`; uses platform `SUPABASE_URL` /
   `SUPABASE_SERVICE_ROLE_KEY` only.
2. Piek site — PiekGroup-Website #17 (#16): same-origin `/api/enquiry` route →
   Dynamics intake; durable `ContactForm`. **Placement decision:** the PR re-introduces a
   form on `/contact` (as a new section below the kept visual); CA/client must confirm
   before merge. Piek **production** Vercel env only (never Preview/Development):
   - `CG_ENQUIRY_INTAKE_URL` = `https://<dynamics-project-ref>.supabase.co/functions/v1/website-enquiry-intake`
   - `CG_ENQUIRY_INTAKE_KEY` = the Piek production endpoint `intake_key` (step 4)
   The route fails closed unless `VERCEL_ENV=production` and both are set.

## 3. Migration / code order [CA]

#614 is merged. Merge #620 → retarget #621 to `main`, merge. Then apply,
in order, after a read-only preflight (`select to_regclass('public.website_enquiries')`
returns null; `clients`/`profiles` columns present):

1. `20261001181932_website_enquiry_transaction.sql`
2. `20261002090000_website_lead_lifecycle.sql`
3. `20261002110000_website_enquiry_delivery_runtime.sql`

Deploy functions: `website-enquiry-intake`, `website-enquiry-delivery-worker`,
`website-enquiry-delivery-webhook` (all `verify_jwt = false` per `supabase/config.toml`).

## 4. Binding configuration [CA] — values to confirm, then insert

Templates use only verified identity; `<…>` values must be supplied/confirmed by CA:

```sql
-- One reviewed binding (starts disabled).
insert into public.website_enquiry_endpoints
  (client_id, website_editor_website_id, environment, canonical_host)
values ('ed7aa1ae-de21-4151-a8f9-54796b234c1f', '1', 'production', 'www.piekgroup.co.za')
returning id, intake_key;  -- intake_key -> Piek Vercel env only

-- Form contract mirroring ContactForm.tsx exactly.
insert into public.website_form_schemas
  (endpoint_id, schema_key, version, field_definitions, contact_name_key, contact_email_key, contact_phone_key)
values ('<endpoint_id>', 'contact_form', 1, '[
  {"key":"name","label":"Name","type":"text","required":true,"max_length":120},
  {"key":"email","label":"Email","type":"email","required":true,"max_length":320},
  {"key":"phone","label":"Phone","type":"tel","required":false,"max_length":80},
  {"key":"subject","label":"Subject","type":"text","required":false,"max_length":200},
  {"key":"message","label":"Message","type":"textarea","required":true,"max_length":4000}
]'::jsonb, 'name', 'email', 'phone');

-- Recipient: client-confirmed address (site currently shows admin@piekgroup.co.za;
-- do NOT use it until Piek confirms it is the lead inbox).
insert into public.website_enquiry_recipient_configurations (endpoint_id, version) values ('<endpoint_id>', 1) returning id;
insert into public.website_enquiry_recipient_routes (recipient_configuration_id, route_key, recipient_email, recipient_name)
values ('<config_id>', 'primary', '<client-confirmed-email>', '<name>');

-- Activation (reviewer = an active CG admin/manager profile id).
update public.website_enquiry_recipient_configurations set status='approved', approved_by='<reviewer>', approved_at=now() where id='<config_id>';
update public.website_form_schemas set status='active', activated_by='<reviewer>', activated_at=now() where endpoint_id='<endpoint_id>';
update public.website_enquiry_endpoints set enabled=true, verified_by='<reviewer>', verified_at=now() where id='<endpoint_id>';
```

Also required: Piek client-portal user exists with `profiles.role='client'`,
`client_id = ed7aa1ae-…` (for the Lead Inbox).

## 5. Provider/config [CA]

Approve Resend (or another provider) → verify CG sending domain (SPF/DKIM — a DNS
gate) → set the six secrets in `WEBSITE-ENQUIRY-DELIVERY-405.md` → register the
Resend webhook (`email.delivered`, `email.bounced`) to
`/functions/v1/website-enquiry-delivery-webhook` → schedule the worker (every 1 min,
`x-worker-secret`).

## 6. Real acceptance sequence

1. Submit one real test enquiry on `www.piekgroup.co.za/contact` with a CG-controlled
   visitor address → site shows receipt reference.
2. Durable enquiry: `select receipt_id, environment from website_enquiries where client_id='ed7aa1ae-…' order by accepted_at desc limit 1;` → production row; one `generate_lead` event; one pending job per route.
3. Email: worker run → job `accepted` with provider id; client mailbox receives it,
   From = CG sender, Reply-To = test visitor; webhook moves job to `delivered`.
4. Lead Inbox: sign in as the Piek client user → `/client/leads` shows the enquiry with
   Call/WhatsApp/Email actions.
5. Mark **Poor** without reason → rejected; mark **Good** + Qualified → saved.
6. Website Performance (staff, Piek, current month) → total 1, qualified 1,
   qualification rate 100%.
7. Cross-client: sign in as another client (e.g. Red Oak) → `/client/leads` shows no Piek
   lead; `set_website_lead_lifecycle('<piek enquiry id>', …)` → `Not authorized for this lead`.
8. Then mark the test lead `closed_lost` / Poor / `other` + note "pilot test" so it is
   visibly a test, not a won client lead (no deletion — evidence is append-only).

## 7. Rollback / recovery

- Stop intake instantly: `update website_enquiry_endpoints set enabled=false where id='<endpoint_id>';`
  (site route must then show the phone/email fallback). Replays of already-accepted
  submission keys still return their receipt.
- Stop email: set `WEBSITE_ENQUIRY_EMAIL_ENABLED=false` (worker claims nothing; jobs
  wait as `pending`, nothing lost).
- Wrong recipient: retire the approved configuration and approve a new version; already
  created jobs keep their snapshot — set affected `pending` jobs aside before re-enabling.
- Ambiguous sends: inspect `delivery_state='reconcile'`; within 23h the worker replays
  with the same idempotency key; older ones need manual provider lookup and
  `resolve_website_enquiry_delivery_reconcile(job,'found'|'absent',id)`.
- Code: revert the site's form to the current `mailto:` component. Migrations are
  additive; do not drop tables holding real enquiries.
