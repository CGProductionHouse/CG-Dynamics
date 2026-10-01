# #505 Meta App Review preparation — 1 October 2026

Code baseline: `60093376d8b363aad894d70ea74767896bb44dbc`.
Authenticated read-only Chrome inspection; no provider/config/data writes.
This packet supersedes assumed dashboard readiness in the September packet.
**NOT submission-ready; Submit for Review was not reached or clicked.**

## Exact dashboard evidence

| Surface | Observed state |
|---|---|
| Existing app | CG Dynamics, Meta app `976168728361566`, Business type, managed by CG Production House |
| Mode | Development; Live switch left untouched |
| Instagram product | API setup with Instagram business login; CG Dynamics-IG, Instagram app `1383360116973315` |
| Saved OAuth redirect | `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-oauth-callback` |
| Submission | Not submitted; Nothing has been added to this submission yet |
| `instagram_business_basic` | Standard access; Ready to use (0); No App Review requested; advanced-access button enabled, not clicked |
| `instagram_business_manage_insights` | Standard access; Ready to use (0); No App Review requested; advanced-access button disabled |
| Insights Advanced Access requirements | Business verification, Access verification, App Review (requirements popover) |
| Business verification | CG Production House portfolio `3217480521719798`: Unverified |
| Access verification | Cannot start until business verification; Start verification disabled |
| App Privacy URL | Blank |
| App Terms URL | `https://www.facebook.com/` — not Dynamics Terms |
| App data deletion instructions URL | `https://www.facebook.com/` — not Dynamics instructions |
| Instagram login deauthorize / deletion request URLs | Both blank; not the OAuth callback |
| Instagram Testers tab | Empty roster; ordinary Testers also 0/50; no tester invited |

The product's auto-generated Embed URL includes basic, messages, comments,
content_publish and insights. **Do not copy/use it.** The canonical Dynamics
`INSTAGRAM_LOGIN_SCOPES` and authorization builder in
`supabase/functions/_shared/instagramLogin.ts` request only
`instagram_business_basic` + `instagram_business_manage_insights`.
Those are the two permissions required for this standalone identity/media/insights
use case; existing Page/ads permissions are a separate path and were not changed.
Meta reviews the entire app, including existing access/settings, according to the
Requests page notice. Do not remove existing permissions or assume this narrow
request avoids whole-app review.

## Public legal acceptance

Rendered production Privacy and Terms both passed in Chrome on this baseline:

- https://www.cgdynamics.co.za/privacy-policy — Instagram reporting, ciphertext
  tokens, no passwords/publishing, owner revocation/deletion contact present.
- https://www.cgdynamics.co.za/terms-of-service — public Terms render correctly.

Public pages existing does **not** mean Meta has their URLs configured or accepted.
An authorized operator must correct Meta's Privacy/Terms/deletion fields. Privacy
contains human deletion instructions via `info@cgproductionhouse.com`; do not claim
it is a machine callback or invent a callback endpoint. Determine Meta's accepted
deauthorization/deletion contract before configuring those blank product fields.
No settings were entered or saved in this preparation.

## Selected owner-controlled account and exact demo constraint

Selected account: **CG Production House — `@cg_production.house`**.
Live authenticated Instagram profile shows Edit profile, View archive and
Professional dashboard; Dynamics shows the same exact handle on CG Production
House's existing canonical Page-linked mapping. This proves an owner-controlled
professional session, not newly granted standalone scopes or an exact Business vs
Creator API response. No account type conversion or consent occurred.

This account can safely demonstrate existing reporting and owner control, but
**cannot currently demonstrate a new standalone connection for its Dynamics client**:
the canonical start contract refuses already-mapped clients. Do not deactivate its
mapping, select another client for this account, bypass Page-first, or fabricate a
pending-review screenshot. CA must separately authorize a coherent isolated review
fixture/test environment or provide an exact owner-controlled professional account
for a genuinely unmapped eligible client, then authorize tester/consent/config steps.

## Reviewer text — ready to copy after prerequisites pass

### `instagram_business_basic`

CG Dynamics is CG Production House's staff-only reporting and operations platform.
An active admin/manager selects one exact recurring-social client. We prefer the
existing Facebook Page-linked route. Where that route provides no Instagram account,
Instagram Login identifies the consenting professional account and reads its profile
and media. We verify returned account identity and professional type, encrypt the
token and hold the identity for explicit staff confirmation before canonical binding.
We do not collect Instagram passwords or publish, message, advertise or moderate.

### `instagram_business_manage_insights`

After exact owner consent and staff identity confirmation, the existing server-side
Meta reporting path reads the professional account/media insights for that exact
client. Staff use observed metrics for reporting; clients see only their own safe
published report projection. Missing/unavailable metrics remain unavailable, not
invented zero. This permission is used for read-only performance reporting, not
publishing, messaging, comment management or advertising. Tokens remain encrypted
server-side and cannot be read by client users.

## Screencast script / capture manifest

Meta's observed review dialog requires an externally testable app, clear use-case
details, step-by-step instructions and screen recordings demonstrating **each**
permission. No file-size/duration/format limit was verified; use the current upload
form's actual limits when separately authorized. Suggested two recordings below;
they are scripts, **not recorded videos or successful OAuth proof**.

| Capture | Exact action / narration | Status |
|---|---|---|
| Basic clip 00:00–00:25 | Show CG Dynamics login and authorized admin; exact review client and confirmed social scope | Script prepared; login not recorded |
| 00:25–00:50 | Show saved Page route checked/no account, without borrowing another client's identity | Requires authorized exact fixture/account |
| 00:50–01:30 | Launch canonical Connect flow; provider-owned login, only the two reporting scopes; omit password/2FA footage | OAuth prohibited this pass |
| 01:30–02:00 | Return via exact callback; show real username/professional type in pending review | Requires successful consent; never stage/fake |
| 02:00–02:30 | Explicit reviewer confirms exact identity; show canonical same-client mapping | Protected confirmation, not performed |
| Insights clip 00:00–01:00 | Read account/media insights via canonical sync/reporting, show observed periods/values and missing/null truth | Protected authorized read/sync fixture needed |
| 01:00–01:30 | Show exact published client-safe projection, no other client/internal IDs/token; explain no publish permission | Cannot fabricate standalone attribution using Page-linked data |
| 01:30–01:50 | Show public Privacy/Terms and owner revocation/deletion instructions | Live screenshots available |

Reviewer navigation: production app → staff login → Integrations → Meta → exact
client → Page-linked check → standalone only if unavailable → provider consent →
pending identity review → explicit same-client confirmation → canonical reporting.
No reviewer credentials have been created/shared; external reviewer access remains
a separately approved prerequisite. Never put staff passwords in this packet.

Workstation-local screenshots (ignored, not committed, not uploaded to Meta):

- `artifacts/issue-505-meta-business-login.png` — saved redirect / blank product callbacks.
- `artifacts/issue-505-meta-review-not-submitted.png` — empty submission / Development.
- `artifacts/issue-505-meta-basic-settings.png` — legal/business verification gaps.
- `artifacts/issue-505-meta-two-scopes.png` — filtered access table.
- `artifacts/issue-505-meta-insights-requirements.png` — exact three Advanced Access prerequisites.
- `artifacts/issue-505-owner-professional-account.png` — CG owner controls/professional dashboard.
- `artifacts/issue-505-review-privacy.png`, `artifacts/issue-505-review-terms.png` — rendered public pages.

Screenshots substantiate preparation only; they do not replace required screencasts.
No secrets were revealed. Masked secret controls remained masked; Show not clicked.

## Protected completion order / hard stop

1. CA resolves business verification and Tech Provider access verification.
2. CA authorizes exact public legal/deletion/deauthorization settings corrections.
3. Resolve coherent unmapped owner-controlled demo fixture/reviewer access and tester
   enrollment. Authorize missing app-secret/config/origin/runtime prerequisites only
   through the existing runbook; do not bypass production activation for a video.
4. With separate authority, record real consent/confirmation/reporting demonstrations,
   privately review/redact credentials/2FA/state/code/tokens and unrelated client data.
5. With separate permission-change authority, add only the two required requests;
   attach genuine videos/instructions and verify all dashboard prerequisites pass.
6. **STOP before Submit for Review.** Obtain explicit CA submission authorization.
7. After provider acceptance, follow separately authorized Live/config/activation and
   exact-client rollout gates. Do not conflate review submission with approval.

Current stop is **earlier than Submit for Review**: empty request, verification/legal
gaps, no consent demo or reviewer access. No safe code change can remove those gates.
Only documentation corrections were made; #505 remains OPEN.
