# #505 — current verification evidence and App Review draft

Read-only inspection: 2 October 2026, from 12:16 UTC, from main
`d7fe0ac93e4731223861287157fcde3ba5ca67b8`, authenticated CG Chrome.
Authority: #505 comments 5951941429 / 5951902435. Instagram only.
**Draft complete; NOT submission-ready. No review, verification or OAuth started.**

This supersedes old pending-config/legal statements in the October 1 preparation
and October 2 queue packet. #598 is COMPLETE: do not repeat its seven saves or
#600 crypto work. Existing historical receipts remain intact.

## Fresh provider state

| Surface | Observed current state |
| --- | --- |
| App/product | CG Dynamics `976168728361566`; Instagram Login product CG Dynamics-IG `1383360116973315` |
| Mode | Development; switch untouched |
| Business | CG Production House `3217480521719798`, Unverified |
| Security Center | Eligible for verification; selected use case: App requires access to permissions on Meta for Developers; Start verification enabled, not clicked |
| Access Verification | Tech Provider verification; disabled until business verification. Provider states it reviews submissions/follows up within 5 days; not a completion guarantee |
| Review Requests | Not submitted; Nothing has been added to this submission yet |
| `instagram_business_basic` | Standard access; Ready to use (0); No App Review requested; advanced-request button enabled, not clicked |
| `instagram_business_manage_insights` | Standard access; Ready to use (0); No App Review requested; advanced-request button disabled |
| Advanced-access table | Explicitly requires business and access verification for Tech Providers. The older Oct 1 Insights popover also listed App Review; no new popover observation is claimed |
| Review scope | Requests page says Meta reviews new AND previously approved requests, app icon, privacy URL and other settings; do not remove/expand existing Page permissions |

App Basic reload-read state: Privacy `/privacy-policy`, Terms `/terms-of-service`,
deletion instructions `/privacy-policy`, all on `https://www.cgdynamics.co.za`.
Instagram business-login dialog read-only: existing redirect and deauthorize /
data deletion callbacks below remain correct; Cancel used, no Save.
Secret controls stayed masked. No secret retrieved.

## Verification evidence checklist — observed, conditional, unknown

Fresh [Business info](https://business.facebook.com/latest/settings/business_info?business_id=3217480521719798)
shows legal entity `CG Design Solutions (pty) ltd`, address `72 Olds Street,
Spitskop`, `Bloemfontein, Freestate 9301`, phone `+27608604757`, website
`https://cgproductionhouse.com/`, contact `info@cgproductionhouse.com`.
These are saved values, NOT certified against company documents. Keep business
website distinct from Dynamics public/legal origin. CA must compare actual legal
records before submitting; do not substitute the trading name for the legal name.

Both official guides were read in authenticated Chrome on Oct 2 (public fetch was
login/rate-limited; that is not a dashboard blocker):
[verification](https://www.facebook.com/business/help/2058515294227817),
[documents](https://www.facebook.com/business/help/159334372093366).

- Portfolio full control and eligible status are prerequisites. Legal name,
  address, phone and working HTTPS website must match the actual legal entity.
- Meta first attempts record matching. Document upload is conditional if no exact
  record matches; it is not established that CG must upload every category.
- Supported categories: incorporation/registration or licence; government-issued
  business tax document (not self-filed); business bank statement. Utility bills
  support address/phone only and must bear the legal name; NOT legal-name proof.
- Prepare current authority-issued legal-name proof and matching address/phone
  proof. A genuine company CIPC record is a preparation example, not a claim a
  particular South African form has been accepted. No actual document was supplied.
- English supported; unsupported-language documents require officially stamped
  translation. Mask unrelated personal identifiers; never post documents to GitHub.
- Guide lists email, phone, SMS, WhatsApp or domain challenge. Exact methods offered
  to CG remain UNKNOWN until the authorized wizard. Domain ownership proof may be
  requested for email; no DNS change authorized. Registration number, selected
  country wizard fields, upload limits, matched records and exact channel UNKNOWN.
- Access Verification questionnaire/document requirements remain UNKNOWN behind
  business verification. Prepare truthful Tech Provider purpose, exact services,
  authorized client access/data lifecycle; do not invent certifications/contracts.
- Security Center currently has no mandatory portfolio 2FA/passkey policy; this
  is observed configuration, not authorization to change it or an invented review
  prerequisite. Backup admin is present.

## Eight reviewed handles — ranked evidence suitability, not fixture selection

All eight remain unmapped in Dynamics; none was found under another canonical
client by exact username lookup. Null canonical mapping is NOT proof Page-unlinked.
All are **rejected as executable fixtures today** until exact client ownership,
professional type, owner authorization and no Page/canonical linkage are proven.

| Rank | Exact client / preserved handle | Evidence suitability and rejection boundary |
| --- | --- | --- |
| 1 | Emoya Estate Driving Range / `emoyadrivingrange` | Reviewed driving-range identity; no saved Page. Strongest narrow standalone candidate structurally; professional status, present owner control and global unlinking unproven. Do not use estate account |
| 2 | Toyota Bloemfontein / `cfaomobilitytoyotabloemfontein` | Reviewed exact local dealer; no saved Page. Need exact dealer-owner authority/professional/unlinked proof, not national CFAO account |
| 3 | Emmanuel Funerals / `emmanuelfunerals` | Oct 2 first-party link; saved Page exists. Reject until exact Page linkage/access and owner/professional evidence settled |
| 4 | Novus Steel / `novus_steel` | Oct 2 first-party link; same saved-Page/professional/owner gates |
| 5 | Bouwer & Coetzee Attorneys / `bouwer_coetzee_attorneys` | Reviewed source plus Oct 2 first-party link; same saved-Page/owner/professional gates; reject unrelated Wix link |
| 6 | We Ar Fuels / `we_ar_fuels` | Reviewed handle also present in CG managed portfolio; owner listing is not new client consent or standalone professional proof; saved Page gate |
| 7 | Piek Group / `piekgroup` | Retain Sep 22 reviewed identity; saved Page gate and professional/owner/unlinked evidence missing. No Piek website work |
| 8 | Red Oak / `official.redoak` | First-party reviewed handle; saved Page missing from earlier discovery. Recover/recheck Page access rather than declaring standalone eligibility |

CG's own `cg_production.house` is owner-controlled/professional but already
canonical (`17841453136314815`), so **reject** it as the standalone fixture.
Do not unmap it, attach it to another client or fake a pending-review receipt.
If none of the eight can meet these gates, the minimum alternative is one genuinely
owner-authorized professional account for an exact eligible unmapped client, with
explicit non-Page-linked proof and approved reviewer/tester access. Creating or
altering an account is not authorized here.

## 25-client queue recheck / three safe evidence improvements

Fresh SELECT at 12:19:54 UTC: standalone connections/tokens/states/callback receipts
**0/0/0/0**. Fresh active-client/package/mapping SELECT is identical to earlier Oct 2
canonical evidence: **57 active / 47 eligible / 10 excluded / 0 scope-held;
22 eligible canonical / 25 unmapped**. Three non-social mappings remain excluded,
not incorrectly counted as eligible. No mapping/package write or provider discovery
invocation occurred in this pass. Prior Page-first discovery caveats remain.

| Exact row | Fresh first-party/provider evidence improvement | Remaining boundary |
| --- | --- | --- |
| Central Canvas | CG portfolio lists `central_canvas`, ID `17841437941624033`; public profile/posts name same Bloemfontein business and `centralcanvas.co.za`, phone 051 435 4955/6. Production saved Page names Central Canvas | Managed identity corroborated, not guessed. Connected-assets tab says none in this portfolio view. Professional type, current owner authority and global Page linkage still unproven |
| Ehrlich Park Butchery | CG portfolio `ehrlichparkbutchery`, ID `17841467617815630`; public profile names exact butchery, 5 De Waal Rd, Bloemfontein and `ehpbutchery.co.za`; exact production saved Page | Same boundary; portfolio connected-assets view says none. No bind/login/people assignment |
| Tobich Optics | CG portfolio `tobich_optics_otjiwarongo`, ID `17841468482527003`; public profile explicitly Otjiwarongo, posts use local practice contact/domain; saved production Page is Tobich Optics Otjiwarongo, not Windhoek | Location ambiguity narrowed; no assumption about Windhoek/group. Same professional/owner/global-linkage gate; portfolio connected-assets view says none |

Sources: [CG managed inventory](https://business.facebook.com/latest/settings/instagram_account?business_id=3217480521719798),
[Central](https://www.instagram.com/central_canvas/),
[Ehrlich](https://www.instagram.com/ehrlichparkbutchery/),
[Tobich](https://www.instagram.com/tobich_optics_otjiwarongo/).
Exact IDs/usernames searched against all canonical mappings including inactive
clients: no matches for these three or eight reviewed handles; CG own account
alone matched. Portfolio 'Owned by CG Production House' is NOT a client consent.

Eight reviewed handles remain unchanged in code; three newly corroborated identities
are evidence candidates in this document, **not promoted to reviewed/approved
canonical queue identities**. Remaining 14 identity holds unchanged:
Bloem Action Sports, Bohemia Quick Stop, Daisy & Co, Forklift Trucks, Hino Trucks,
HMHI, Human Auto, Jenkor, Neshora Oxygen, PSG Bloemfontein, Supa Quick BFN,
Supa Quick Centurion, The Staffordshire, WiseRide. See the
[complete ordered 25-row matrix](INSTAGRAM-505-ROLLOUT-MATRIX-2026-10-02.md) for each
exact source/exclusion/action; its stale config gate is superseded by this packet.
**0 CONNECTABLE** and **0 proven standalone review fixtures**; identity improvements
must not be confused with connection authorization.

## Copy-ready App Review draft

Application URL: `https://www.cgdynamics.co.za`. Staff-only integrations; authorized
clients receive only exact-client published reporting. Exactly TWO requested
Instagram Login scopes; do not use Meta's generated multi-scope Embed URL.

### `instagram_business_basic` — purpose and visible usage

CG Dynamics is CG Production House's client reporting and operations platform.
An authorized admin/manager selects an exact recurring-social client. We check the
existing Page-linked route first. Where unavailable and ownership is confirmed,
Instagram Login reads the consenting professional account identity/profile and
media. Returned identity and professional type are checked, credentials encrypted
server-side, and the connection held for explicit same-client staff confirmation.
We never collect Instagram passwords or use this flow to publish/message/advertise.

### `instagram_business_manage_insights` — purpose and visible usage

For the exact consenting, confirmed professional account, the canonical server-side
reporting path reads observed account/media insights. Staff see period/freshness and
availability; clients see only their own published safe report. Missing metrics stay
unavailable rather than fabricated zero. This is read-only reporting, not publishing,
comment moderation, messaging or advertising. Tokens cannot be read by client users.

### Reviewer navigation / access draft

1. Open canonical HTTPS Dynamics origin and sign in with a separately authorized
   limited review identity. **No review identity/password has been provisioned.**
2. Integrations → Meta → exact eligible review client. Show package eligibility and
   Page-first result. Stop if already mapped or Page access is unresolved.
3. After separate fixture/tester/config authority, canonical Connect Instagram;
   provider-owned login/consent showing only the two scopes. Hide password/2FA.
4. Exact callback → real pending identity, returned username/professional type;
   compare approved fixture. Explicit same-client confirm only under authority.
5. Under separate sync/fixture authority, show real canonical observed insights,
   date/timezone/age and unavailable fields; no staged numbers or another account.
6. Show exact-client published projection only if genuinely available and approved;
   do not publish strategy/report just for the video. Show existing Privacy/Terms.
7. Explain revocation/deletion callback behavior from tested contract, not a live
   deletion of client credentials or reports. No real callback execution here.

### Capture manifest (draft storyboard; zero OAuth/demo videos recorded)

| Asset | Planned genuine capture / evidence required | State |
| --- | --- | --- |
| Basic screencast | Login → exact eligible fixture → Page-first → two-scope consent → real pending identity → authorized same-client confirmation | BLOCKED: needs CA instruction for fixture/tester/reviewer/OAuth/confirmation; no fabricated screenshots |
| Insights screencast | Real consented account/media observations → period/null/freshness truth → exact-client safe reporting | BLOCKED: needs CA instruction for real fixture reporting; no Page-linked data relabelled standalone |
| Legal/screenshots | Current legal URLs, product callback values, two Standard scope rows, empty review request, business/access gates | Read-only evidence captured; #598 legal/callback screenshots remain valid |
| Reviewer access/instructions | Canonical origin, exact navigation above, approved limited credentials supplied privately through Meta's approved field | BLOCKED: needs CA instruction; never use CA password or commit credentials |
| Upload metadata | Actual reviewer form questions, permitted formats/duration/size and required per-scope assets | UNKNOWN behind protected request addition; check actual form later, not invented limits |

Canonical URLs: Privacy/deletion instructions
`https://www.cgdynamics.co.za/privacy-policy`; Terms
`https://www.cgdynamics.co.za/terms-of-service`; unchanged OAuth
`https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-oauth-callback`;
Deauthorize `/functions/v1/instagram-deauthorize`; deletion
`/functions/v1/instagram-data-deletion` on that same Supabase HTTPS origin.
Callbacks are already deployed/configured; no redeploy or re-save needed.

## Protected sequence — no approval prompt, no implied authority

1. **BLOCKED: needs CA instruction** — business verification: certify legal facts,
   execute wizard, conditional private documents and exact offered channel. Stop
   on legal mismatch, unavailable channel or unexpected security/terms action.
2. **BLOCKED: needs CA instruction** — Tech Provider Access Verification after
   Business Verified; inspect/fill truthful actual questions, no invented evidence.
3. **BLOCKED: needs CA instruction** — authorize one genuine unmapped professional
   unlinked fixture plus bounded tester/reviewer access and real consent/demo capture.
   Keep production activation OFF until separately authorized; no bypass for video.
4. **BLOCKED: needs CA instruction** — add only two advanced-access requests,
   attach genuine per-scope demos; inspect exact form requirements and whole-app
   review readiness. STOP before Submit for Review without separate instruction.
5. **BLOCKED: needs CA instruction/provider acceptance** — Review submission/approval,
   then Live, then bounded activation, exact one-client OAuth/confirm/sync individually.

At every stage stop on wrong app/product/client, scope/redirect drift, identity/type
mismatch or unexpected write. Preserve 22 canonical mappings. No configuration,
roles, verification, Live, OAuth, provider sync, DB writes or Website/TikTok action.

## Local evidence / verification

Non-secret screenshots under
`C:/Users/chris/.codex/artifacts/issue-505-review-2026-10-02/`:
`two-scopes-standard.jpg`, `review-empty.jpg`, `business-eligible.jpg`,
`basic-verification-gates.jpg`, `central-managed-linkage.jpg`,
`tobich-managed-linkage.jpg`, `tobich-public-identity.jpg`.
These are preparation, not review uploads or successful standalone consent proof.
Eight focused queue/login/crypto-fixture/credential/callback/eligibility/reporting
suites: **136 tests, 120 passed / 16 disposable-DB integration skips / 0 failed**.
Initial reporting run lacked local Vite public env; rerun with explicitly fake
`example.supabase.co` / test-only public key passed; no production credential or DB
test substituted. TypeScript/Vite build PASS (existing large-chunk advisory), scoped
ESLint on queue/eligibility/login/encryption PASS, `git diff --check` PASS.
No runtime code change; no production UI/mobile acceptance claim.
