# #591 — Meta verification and standalone demo prerequisites

Inspected 1 October 2026, from main
`e348c7ac81ef12185cdcaaf08c9bf347d63608d1`, using CA's authenticated Chrome
business portfolio and the existing #505 production evidence. Preparation only:
no provider settings, verification, roles, permissions, OAuth or production writes.
This supplements `INSTAGRAM-META-REVIEW-PREP-2026-10-01.md`, not activation authority.

## 1. Current business verification evidence

[Security Center](https://business.facebook.com/latest/settings/security_center?business_id=3217480521719798)
shows **Eligible for verification**, with **Start verification** enabled.
The selected use case is **App requires access to permissions on Meta for Developers**.
CG Production House's business verification is still **Unverified**.
Start verification was NOT clicked; country-specific wizard fields, matching records,
upload limits and the offered code-delivery methods have not been inspected.

[Business info](https://business.facebook.com/latest/settings/business_info?business_id=3217480521719798)
currently contains the following, observed rather than certified against documents:

| Field | Saved Meta value / CA preparation |
|---|---|
| Portfolio | CG Production House, `3217480521719798` |
| Legal entity | `CG Design Solutions (pty) ltd` — CA must match the registered legal spelling, not substitute the trading/portfolio name |
| Address | `72 Olds Street, Spitskop`; `Bloemfontein, Freestate 9301`; `South Africa` — compare with current official address proof |
| Business phone | `+27608604757` — CA must verify both documented association and ability to receive the offered verification challenge |
| Website | `https://cgproductionhouse.com/` — business website, distinct from Dynamics legal-page domain |
| Profile contact | `info@cgproductionhouse.com` — saved contact, not proof that Meta will offer this exact address for a code |
| Verification | Unverified; primary Page None; no primary business location |

No registered number, certificates or documentary ownership proof was supplied or
invented. Do not upload those privately sensitive documents to GitHub. No business
details were edited. Meta's last-updated attribution is BRAIZE, 17 September 2026;
this does not establish ownership of an Instagram account named BRAIZE.

### Documents/details CA should have ready

The authenticated [official verification guide](https://www.facebook.com/business/help/2058515294227817)
requires portfolio full control, eligible status, exact legal entity details and a
working HTTPS website. It first tries to match business records; uploads may be
required if no exact match exists. The current [official document guide](https://www.facebook.com/business/help/159334372093366)
accepts registration/incorporation proof, authority-issued tax proof or business
bank evidence. Utility evidence may prove address/phone but cannot alone prove the
legal name. Documents must be current, issued by the relevant authority and show
the matching legal name plus official address or telephone as appropriate.

Prepare an official South African company registration/incorporation document
(for example the company's actual CIPC-issued record, **not a claim that a particular
CIPC form has already been accepted**), plus current address/phone proof bearing
the same legal entity. A government-issued business tax certificate or business
bank statement is an alternative supported category; self-filed tax documents are
not supported. Redact unrelated personal identifiers; preserve required business
fields. English is supported; unsupported-language documents require officially
stamped English translations. CA must have access to a verification channel: the
guide lists email, telephone, SMS, WhatsApp or domain verification, but the exact
options offered to CG remain a wizard-time check. Domain ownership proof may be
requested for email verification. No DNS change is authorized by this pack.

These are preparation categories, not a guarantee Meta will accept a particular
document or a claim all documents are mandatory. The guide allows up to 14 business
days for a decision; changing business details may require re-verification.

## 2. Exact URL contract and missing endpoint boundary

App: **CG Dynamics**, `976168728361566`; Instagram product: **CG Dynamics-IG**,
`1383360116973315`. Existing #505 authenticated evidence on this same baseline:

| Meta field | Current saved state | Exact reviewed value / disposition |
|---|---|---|
| Privacy Policy URL | Blank | `https://www.cgdynamics.co.za/privacy-policy` |
| Terms of Service URL | `https://www.facebook.com/` | `https://www.cgdynamics.co.za/terms-of-service` |
| User data deletion: **Data deletion instructions URL** | `https://www.facebook.com/` | `https://www.cgdynamics.co.za/privacy-policy` — existing human instructions and `info@cgproductionhouse.com`; retain instructions mode, subject to Meta validation |
| Saved Instagram OAuth redirect | Correct | `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-oauth-callback` — preserve exactly |
| Instagram login Deauthorize callback URL | Blank | **No canonical implemented value exists. Hold; do not invent a URL.** |
| Instagram login Data deletion request URL / callback | Blank | **No verified machine-handler value exists. Hold; do not reuse the OAuth callback or HTML privacy page as a machine callback.** |

Production Privacy/Terms rendered successfully in the authenticated #505 browser
acceptance. Public routes and the exact revocation/deletion instruction text remain
in `src/App.tsx` and `src/pages/LegalPage.tsx`. Source inspection of `src` and
`supabase/functions` found no `signed_request`, deauthorization or data-deletion
callback handler. Thus these two product callback values cannot honestly be
declared ready. Do not infer that the product accepts an instructions URL simply
because App Basic offers instructions mode. Its machine callback contract must be
confirmed and implemented/reviewed separately if required, including request
authentication and exact-account revocation/deletion semantics. No callback code,
secret/config change or Edge deployment was made in #591.

## 3. Actions available vs blocked

| Action | Current evidence / protected boundary |
|---|---|
| Start business verification | Enabled/eligible now; CA authorization and documentary matching required before clicking |
| Business detail Edit | Enabled; can be corrected before verification, but no save authorized here |
| Basic legal URL fields / Instagram login settings | Editable in #505 inspection; not disabled behind verification; saving remains a protected provider change |
| Access verification | Start disabled until business verification completes |
| Basic scope Advanced Access | Button enabled in #505; no request made. Enabled is not proof all review prerequisites are satisfied |
| Insights Advanced Access | Disabled; requirements explicitly list Business verification, Access verification, App Review |
| Tester enrollment | Empty roster, not proven verification-locked; invitation/acceptance is separately protected |
| App Review | Empty, Not submitted; actual demonstration and reviewer access still missing |
| App Mode | Development; switch visible, not permission to activate |

Only `instagram_business_basic` and `instagram_business_manage_insights` belong
to this read-only standalone use case. Do not copy the generated Embed URL that
includes messaging/comments/publishing scopes. Preserve existing Page permissions.

## 4. Bounded demo-account evidence and minimum fixture

The approved #505 owner-controlled professional evidence is only
**`@cg_production.house`**: owner controls/Professional dashboard were visible, but
Dynamics already has its canonical Page-linked CG Production House mapping.
It cannot truthfully demonstrate a new standalone binding. Do not unlink it or
bind it under a different client to manufacture a demo.

The inspected portfolio's Instagram inventory displayed nine handles:
`local_meat_deli_free_state`, `braize_za`, `tobich_optics_otjiwarongo`, `we_ar_fuels`,
`central_canvas`, `ehrlichparkbutchery`, `bim3dscanningservices`, `nikan.solar`,
`dignitas_za`. The selected first asset says Owned by CG Production House, yet is a
client brand with Login needed. Portfolio asset ownership/access is **not proof of
CG first-party brand ownership, professional type, absent Page link, or client
owner consent**. `braize_za` is not an approved CG-owned demo simply because of its
name or business-history attribution. No asset was logged into, altered or added.
The reviewed eight rollout handles belong to clients, not a consent-free test pool.

Result: **zero proven eligible standalone demo accounts in the inspected approved
evidence**, not a claim that no other account exists globally. No unverified handle
was selected. Local screenshot: `artifacts/issue-591-portfolio-instagram-inventory.png`;
eligibility screenshot: `artifacts/issue-591-verification-eligible.png` (ignored).

Minimum fixture requiring separate CA approval:

1. A real CG-owned professional Business/Creator account with exact owner evidence;
   no existing Facebook Page link or canonical/provider binding. Alternatively CA
   supplies exact owner authorization for a real eligible unmapped client/account.
2. Genuine media/insights sufficient to demonstrate read-only reporting. Missing
   metrics stay unavailable; do not create fake performance or recycle Page data.
3. An isolated review environment using the existing canonical client/package/OAuth
   contracts, coherent test identity and explicit recurring-social eligibility.
   No fake production package, shadow store or cross-client account reuse.
4. Separately approved tester invitation/acceptance, reviewer access and the existing
   secret/config/runtime prerequisites before real OAuth/confirmation recording.

## 5. Next protected session — click-by-click, not executed

1. Read this pack and the #505 review script. CA compares the saved legal details
   above with private original company documents. Resolve mismatches before starting.
2. Business Suite → select **CG Production House** → Settings → Business info.
   If an exact documentary correction is needed, obtain specific save authority,
   Edit only those fields, Save, and read back. Do not set a primary Page as a workaround.
3. Settings → Security Center → Business verification. Confirm the existing developer
   use case and Eligible status. **STOP for explicit Start verification authority.**
4. Once authorized: Start verification → country/entity details → compare matched
   records. Select only the exact legal entity; if absent use the wizard's no-match
   path and supported private uploads. Check actual format/size requirements there.
5. Select a offered owner-controlled confirmation channel; complete its challenge
   with CA. Any DNS/domain change requires its own approval. Submit/Done only with
   verification-submission authority. Record Pending/Verified/Rejected truthfully.
6. After business Verified: Meta Developers → CG Dynamics → App settings → Basic →
   access verification. Obtain separate start/submission authority; complete the
   actual Tech Provider questions truthfully, not assumed prefilled answers.
7. With separate legal-settings authority: App settings → Basic → set Privacy and
   Terms to the exact URLs above; choose Data deletion instructions URL and its
   reviewed value. Save and read back public reachability. Do not change unrelated fields.
8. Instagram → API setup with Instagram login → business-login settings. Verify the
   saved OAuth redirect. **STOP on blank machine callback fields** until their
   accepted contract, implementation and deployment have separate approval/proof.
9. CA supplies/authorizes the coherent fixture in section 4. Verify owner,
   professional status and unmapped/Page-unlinked eligibility before any tester or
   OAuth action. If no such account is supplied, STOP; no client substitution.
10. Separately authorize app role/tester enrollment and owner acceptance, then
    config/runtime activation for the isolated demo. Follow the existing runbook;
    this checklist grants no secrets or Edge authority.
11. Separately authorize genuine OAuth, pending-identity confirmation and read-only
    insights demonstration. Record both scope videos per #505; redact codes/tokens,
    credentials and unrelated clients. Do not fabricate unavailable evidence.
12. With permission-request authority, App Review → Permissions and Features →
    only the two required scopes. Verify actual access prerequisites, attach the
    genuine script/videos/private reviewer access. **STOP before Submit for Review**
    for explicit submission approval. Live mode and rollout require later approval.

No protected step above was performed. Remaining concrete gates: legal entity/doc
validation and verification, access verification, legal saves, missing machine
callback contract, approved standalone fixture/reviewer access, config/runtime and
real demo evidence, scope requests/review submission and eventual Live activation.

## Verification / impact

- Authenticated read-only Security Center, Business info, Instagram inventory and
  official Meta verification/document help inspected; prior same-day #505 legal,
  app-access and canonical mapping browser evidence explicitly distinguished above.
- 34 tests PASS: `instagramLoginFallback`, `instagramReportingCredential`,
  `instagramTokenEncryption`; no test or runtime code changed.
- `npm run build` PASS (TypeScript + Vite); existing large-chunk advisory only.
- `git diff --check` PASS. Scoped code lint not applicable: Markdown-only diff.
- No production/provider/config/data impact. #591 prepares prerequisites; it does
  not resolve or authorize #505's protected activation gates.
