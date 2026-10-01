# #505 Instagram-only readiness — 1 October 2026

Baseline: main `2f5d4dad94ecba91f3c3f38a85180fb5c52ac0f9`.
No TikTok/provider permissions, OAuth consent, mappings, secrets, configuration,
sync, production data, migration or Edge deployment changed.

## Read-only live evidence

- Existing Chrome session: CG Production House Admin, `www.cgdynamics.co.za/admin/integrations/meta`.
- Canonical `classifySocialProviderEligibility` executed against SELECT-only live active-client package receipts: 47 eligible / 10 excluded / 0 unresolved; 22 eligible clients mapped. Queue has exactly 25 named unmapped rows, including Neshora and excluding First Technology Central.
- 25 total active-client Instagram mappings includes three excluded clients (Bloem Vascular, Local Deli, Rusoord Farmstay). No existing mapping changed.
- SELECT-only counts: 0 standalone connections / 0 encrypted token rows / 0 pending review.
- OAuth start/callback/confirm ACTIVE v5, `verify_jwt=false` with application-level active-admin/manager authorization. Every downloaded function/dependency source matches baseline main after newline normalization.
- State/token tables RLS enabled and neither anon nor authenticated has SELECT grants. Connection metadata is governed by an active-admin/manager SELECT policy; no client/staff token access. No plaintext token column exists.
- Names-only configuration: six required Instagram names present; `INSTAGRAM_APP_SECRET` absent. Names/presence do not prove values are valid.
- Callback HEAD without state/code: HTTP302 to old Vercel origin with `instagram=activation_blocked`; no exchange/state mutation. Correct shared `APP_PUBLIC_URL` under separate config authorization before live consent.
- Public Privacy/Terms URLs both HTTP200 with app shell; code routes are outside auth guards. Browser legal-page capture later failed when Chrome debugger detached; rendered legal acceptance is not claimed.

## Identity evidence recheck

The eight queue identities exactly match the reviewed source ledger and regressions:

| Client | Exact handle | Existing reviewed evidence |
|---|---|---|
| Bouwer & Coetzee Attorneys | `bouwer_coetzee_attorneys` | reviewed 6 Aug verified-source update (CG-built-site/profile screenshots) |
| Emmanuel Funerals | `emmanuelfunerals` | 22 Sep fleet audit: exact first-party website link |
| Emoya Estate Driving Range | `emoyadrivingrange` | 7 Aug verified-source update: client-supplied live-profile screenshots |
| Novus Steel | `novus_steel` | 22 Sep fleet audit: exact first-party website link |
| Piek Group | `piekgroup` | 22 Sep fleet audit: exact `.co.za` first-party website, not unrelated `.com` |
| Red Oak | `official.redoak` | 22 Sep fleet audit: exact first-party website link |
| Toyota Bloemfontein | `cfaomobilitytoyotabloemfontein` | reviewed #505/#531 exact client evidence preserved in queue |
| We Ar Fuels | `we_ar_fuels` | 22 Sep fleet audit: exact first-party website link |

This rechecks the reviewed identities, not new owner access, fresh provider identity,
Business/Creator classification or Page linkage. No public search candidate was
promoted. The other 17 queue rows remain explicitly unresolved; absence of a handle
is not evidence that no account exists.

## Contract audit / bounded corrections

Start validates UUID, actor, package scope and absent canonical mapping; creates
random hashed client/actor-bound one-time state. Callback atomically consumes
unexpired unused state, rechecks client eligibility, compares token/profile IDs,
requires professional type and both reporting scopes, encrypts before atomic
pending-review persistence. Review RPC rechecks active reviewer and immutable
identity, refuses cross-client reuse/existing mapping, binds canonical asset only
on explicit confirmation. Existing reporting resolves exact client/account/asset
binding, authenticates AES-GCM AAD and keeps Page-linked credentials preferred.
No second reporting store or publishing scope was added.

1. Malformed and out-of-range expiry produced two executable failures before the
   resolver fix; now non-finite/missing/expired timestamps fail closed before
   decryption. Four expiry regressions include exact-now and null.
2. Live UI claimed a saved Page did not expose Instagram even before assets were
   loaded. New pure projection says unchecked until the provider read completes;
   regression covers unchecked/checked/no-Page states.
3. Public Privacy policy omitted Instagram. Added exact reporting fields/use,
   server-encrypted standalone token handling, no passwords/publishing/messaging/
   ads, relevant processing and owner revocation/deletion contact. Existing TikTok
   wording/behavior retained. Regression locks the disclosures/public route.

## Browser evidence

Before fixes: desktop1536 body/root1536; mobile375 body/root360 (scrollbar) with
usable nav/wrapped queue, no horizontal body overflow. Captured console errors:0.
All eight handles and 25 client rows present. No load-assets/OAuth/confirm/sync
button was invoked. Screenshots are pre-fix evidence, not post-merge acceptance:

Workstation-local captures (not committed generated artifacts):
`artifacts/issue-505-instagram-desktop.png` and
`artifacts/issue-505-instagram-375.png`.

## Verification

- 254/254 Instagram + Meta + social-eligibility tests pass (six new regressions).
- Build (`tsc -b && vite build`), scoped ESLint and diff check pass. Existing large-bundle warning only.
- Tests use dummy local Supabase environment values, not production credentials.
- Full repository suite was attempted and failed on the existing unrelated
  `tests/reportPeriodMtd.test.mjs:44` published-versus-draft selection regression;
  it reproduces independently and neither that test nor its source was edited.
  Test-generated strategy artifacts were reverted to their initial contents.
- Browser detached after initial desktop/mobile captures; fresh post-merge UI/legal
  check remains explicitly unverified until extension reconnects.

## Protected remaining order

Use the current activation runbook: authorized owner-controlled review demo and
Meta App Review/Advanced Access → accepted Live state → missing app secret/private
config validation and canonical return-origin correction → separately authorized
expiry-helper deployment to both canonical Meta consumers → activation flag →
one exact-client OAuth → encrypted pending-review acceptance → explicit exact
confirmation → authorized canonical reporting/freshness acceptance → individual
rollout. No successful demo/review/consent is claimed. #505 cannot close yet.
