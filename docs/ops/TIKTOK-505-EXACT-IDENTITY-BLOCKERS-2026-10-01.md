# #505 TikTok-only exact-account evidence — 1 October 2026

Baseline: `2ca36c926dcddb33b2caffe2f2ea2b9c62fbb43f`.
Existing CG Production House Admin staff Chrome session, canonical production
`/admin/integrations/tiktok` queue. Direct read-only connection-table check agrees.

## Final counts

- 57 active assessed; 47 recurring-social eligible; 10 excluded; 0 scope-held.
- 10 connected; 0 reconnect; 37 not connected; **0 newly connected** this pass.
- All 37 now have a bounded evidence disposition: 4 `CLIENT_HELP_REQUIRED`,
  2 exact local-record provider-login blockers, 31 exact-account evidence gaps.
- An evidence gap does **not** mean the client has no TikTok account.

## Sources and boundary

1. Live production queue (1 October), corroborated with a SELECT-only exact-client
   `clients` / `tiktok_connections` join. No token value selected.
2. Approved local source's three-page **CLIENT / INSTAGRAM / TIK TOK** structure.
   Only client labels and whether the TikTok cell contains actual content beyond
   the Username/Password placeholders were returned. No credential values are in
   this ledger, GitHub, screenshots or repository. Instagram cells were not used.
3. Current exact-client `artifacts/client-strategy-dossiers/issue-513/` and
   `docs/ai-workforce/client-intelligence/` evidence. No exact official TikTok
   profile URL was found for the 31 unresolved rows. Generic TikTok/Reels strategy
   mentions are not account identity. No similar-name public search was trusted.
4. #505 supervisor authority: comments 5796745927, 5797080164, 5801396530,
   5856840670 and 5857076015. Older failed-refresh and package-scope gates are
   superseded by live connected counts and confirmed social scope.

`BLANK_TIKTOK_RECORD`: a relevant local client label exists (some historical
business-label aliases are supporting only), but its TikTok field contains only
empty login placeholders. No authoritative TikTok identity in reviewed dossier.

`NO_TIKTOK_SOURCE_ROW`: no clearly corresponding local row; no authoritative
TikTok identity in reviewed dossier. Do not substitute Instagram credentials.

Both require the exact account owner's current TikTok identity and authorised
provider login. No account creation, password reset or account-type conversion
is authorised. A candidate public handle alone cannot authorise binding.

## Every not-connected row

| Exact active client | Disposition | Exact evidence / required next action |
| --- | --- | --- |
| All Around PVC | BLANK_TIKTOK_RECORD | Local page 1, ALL AROUND PVC; obtain exact owner account/login |
| AV Event Life | BLANK_TIKTOK_RECORD | Local page 1, AV EVENT LIVE historical label, no TikTok contents; exact owner identity needed |
| Bat Hill Royale | PROVIDER_ACCOUNT_NOT_FOUND | Local page 1 exact TikTok record; one signed-out provider login returned **Account doesn't exist**. Owner must validate/update that exact TikTok record |
| Bloem Action Sports | BLANK_TIKTOK_RECORD | Local page 1, BLOEM ACTION SPORTS; exact owner identity needed |
| Bloem Marble & Granite | BLANK_TIKTOK_RECORD | Local page 1, BLOEM MARBLE label; exact owner identity needed |
| Bohemia Quick Stop | BLANK_TIKTOK_RECORD | Local page 1, BOHEMIA QUICK STOP; dossier also explicitly unresolved |
| Bouwer & Coetzee Attorneys | BLANK_TIKTOK_RECORD | Local page 1, BOUWER COETZEE label; exact owner identity needed |
| C&L Innovations | BLANK_TIKTOK_RECORD | Local page 1, C&L INNOVATIONS; exact owner identity needed |
| Cape Lumber | BLANK_TIKTOK_RECORD | Local page 1, CAPE LUMBER; exact owner identity needed |
| Case Bloemfontein | BLANK_TIKTOK_RECORD | Local page 1, CASE label; exact branch/account identity needed |
| Central Canvas | BLANK_TIKTOK_RECORD | Local page 1, CANTRAL CANVAS historical spelling; exact owner identity needed |
| Daisy & Co | BLANK_TIKTOK_RECORD | Local page 1, DAISY&CO; exact owner identity needed |
| Delta Gas | BLANK_TIKTOK_RECORD | Local page 2, DELTA GAS; exact owner identity needed |
| Ehrlich Park Butchery | BLANK_TIKTOK_RECORD | Local page 2, EHP SLAGHUIS label; exact owner identity needed |
| Emmanuel Funerals | CLIENT_HELP_REQUIRED | Keep supervisor hold; populated page 2 TikTok record does not resolve outstanding owner login/session/consent. No new attempt |
| Emoya Estate Driving Range | CLIENT_HELP_REQUIRED | Keep supervisor hold; exact owner-side login/approval/2FA/provider interaction remains unresolved. No new attempt |
| Germoparts | BLANK_TIKTOK_RECORD | Local page 2, GERMOPARTS; dossier explicitly unresolved |
| Hino Trucks | NO_TIKTOK_SOURCE_ROW | Exact branch/account owner identity/login needed |
| HMHI | BLANK_TIKTOK_RECORD | Local page 2, HMHI; exact owner identity needed |
| Human Auto | NO_TIKTOK_SOURCE_ROW | Exact owner account/login needed; no automatic new research lane started |
| Jenkor | BLANK_TIKTOK_RECORD | Local page 2, JENKOR; exact owner identity needed |
| Loraclox | BLANK_TIKTOK_RECORD | Local page 2, LORACLOX; exact owner identity needed |
| Novus Steel | BLANK_TIKTOK_RECORD | Local page 2, NOVUS STEEL; exact owner identity needed |
| Peyper Bonds | BLANK_TIKTOK_RECORD | Local page 2, PEYPER BONDS; exact owner identity needed |
| Piek Group | CLIENT_HELP_REQUIRED | Keep supervisor hold; page 3 TikTok field blank; no owner-side resolution |
| PSG Bloemfontein | BLANK_TIKTOK_RECORD | Local page 3, PSG label; exact local branch account identity needed |
| RC-Polypipe | BLANK_TIKTOK_RECORD | Local page 3, RC POLYPIPE; exact owner identity needed |
| SecuriForce | BLANK_TIKTOK_RECORD | Local page 3, SECURIFORCE; exact owner identity needed |
| Supa Quick BFN | NO_TIKTOK_SOURCE_ROW | Exact BFN branch account/login needed; not Centurion reuse |
| Supa Quick Centurion | NO_TIKTOK_SOURCE_ROW | Exact Centurion branch account/login needed; not BFN reuse |
| TBS Brokers | BLANK_TIKTOK_RECORD | Local page 3, TBS BROKERS; exact owner identity needed |
| Tobich Optics | BLANK_TIKTOK_RECORD | Local page 3, TOBICH OPTICS; exact owner identity needed |
| Toyota Bloemfontein | NO_TIKTOK_SOURCE_ROW | Exact Bloemfontein dealer account/login needed; do not infer national dealer identity |
| Vrystaat Kunstefees | NO_TIKTOK_SOURCE_ROW | Exact owner account/login needed |
| We Ar Fuels | CLIENT_HELP_REQUIRED | Keep supervisor hold; no new exact owner evidence supplied |
| WiseRide | PROVIDER_CREDENTIAL_REJECTED | Local page 3 exact TikTok record; one signed-out login returned **Username or password doesn't match our records. Try again.** Owner must update authorised login; no password reset or retry |
| Zooz Lifestyle WFF | NO_TIKTOK_SOURCE_ROW | Exact owner account identity needed; do not confuse ZooZ and WFF assets |

## Provider execution evidence

- Opened only TikTok's provider-owned login, verified signed-out **Log in to TikTok**
  before entering either record. No CGPH account consent/session was reused.
- Bat Hill and WiseRide each received one bounded login attempt using only their
  exact populated TikTok-column record. Values stayed in local process memory and
  provider form, never emitted. Both failed before authentication.
- Cleared both form fields and closed the provider tab. No OAuth start, token
  exchange, mapping, consent, scope expansion, sync or business-account change.
- Four client-help holds were not retried. All other ordinary rows lacked a usable
  exact TikTok-specific record; no generic/Instagram credential was tried.
- All ten existing connected clients preserved: CG Production House, Red Oak,
  Braize, Forklift Trucks, Wiseman Group, Dulux Paint & Paper Bloemfontein,
  Watch Addict, Madison Wear, The Staffordshire, Neshora Oxygen.
- Final production queue remains 47 / 10 / 0 eligibility and 10 / 0 / 37 connections.
  Final SQL returns only `connected: 10`. No app console error captured.

## Remaining action

Verification: 116/116 TikTok queue/provider/freshness/recovery/guarded-recovery
and social-eligibility regressions passed. TypeScript/Vite build, scoped ESLint
on canonical TikTok read/OAuth/eligibility files, and `git diff --check` passed.
No runtime code changed. Existing build bundle-size advisory remains unchanged.

CA/client owners must resolve the two rejected local records and provide exact
TikTok identity/login for the 31 evidence-gap rows. The four existing client-help
holds require owner interaction. Continue one exact client at a time; verify the
provider-returned identity before canonical read-only OAuth binding. No publishing
or ad scope. #505 stays OPEN; this ledger does not declare global provider closure.

No Instagram/Meta dashboard, App Review, secret, OAuth/config, strategy approval,
publication, migration, deployment or protected production data mutation occurred.
