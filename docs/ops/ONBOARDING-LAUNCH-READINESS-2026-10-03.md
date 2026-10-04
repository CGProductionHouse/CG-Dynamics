# Onboarding launch readiness — 3 October 2026

This is a bounded #213 follow-up, not an overall launch-complete receipt.

## Reproduced code gap and correction

Authenticated CG Production House Admin production `/admin/client-onboarding`
shows 61 active client options and zero onboarding sessions. The source on main
unconditionally disables Generate secure link, even if runtime activation becomes
approved and ready. The backend previously checked only the activation flag.

The existing `client-onboarding` handler now exposes authenticated
`staff_link_readiness` for an exact selected client. Only active admins can obtain
generate capability; active managers receive `admin_required`, and other roles
are rejected. The same read-only capability is rechecked by `staff_generate`
before random token creation or the existing atomic audited session RPC.

Ready requires the existing explicit upload activation flag, configured adapter,
readable/decryptable stored consent, an exact active client, and all three active
nonblank upload-category mappings for that client. No Graph call, token refresh,
token rotation or data write occurs in this readiness action. Missing schema,
failed reads, missing mappings or consent remain blocked, not inferred ready.
The result contains only capability/state, never tokens or durable Drive IDs.

The frontend clears prior readiness and generated links when selecting another
client, ignores superseded async results, and keeps the button disabled during
loading or unavailable readiness. Older deployed handlers that lack the new
action fail closed. Readiness means prerequisites are present, not a claim that
a live upload has succeeded; provider calls retain their existing failure guards.

Actual Deno checking also reproduced pre-existing deployment-path type failures.
Corrections are explicit null-category guarding, the equivalent null thumbnail
range input, nullable synthetic-session expiry typing and an owned Uint8Array
copy for WebCrypto import. No encryption algorithm/key/config or permissions
change.

## Additional reproduced portal resolver defect

Read-only OneDrive evidence confirms Daisy's portal is nested under its exact
bound client root, not directly under global Clients. The existing admin resolver
scanned the wrong parent and would return404 despite a complete existing portal.
It now reads the selected client's canonical production binding, checks exact
client/drive identity and unique folder-ID membership under Clients, and scopes
portal/category discovery to that root. No fuzzy historical-name matching or
folder creation. Ambiguous portal roots stop before category reads or any saves;
existing exact category guards and disabled-by-default registration remain.

Five executable regressions cover the original failure, corrected nested path,
foreign/missing/blank/wrong-drive bindings, durable-ID vs name isolation,
file/duplicate rejection, category completeness and admin-only handler ordering.
The complete61-client read-only physical evidence matrix is recorded in
`CLIENT-SAFE-FOLDER-EVIDENCE-2026-10-03.md`:60 complete exact portals, VCS missing.
Physical evidence is not permission to map/enable/publish libraries or infer
upload destinations.

## Fresh production inventory (SELECT only)

| Authority | Count |
| --- | ---: |
| Active Dynamics clients | 61 |
| Canonical production OneDrive mappings | 61 |
| Active client-login coverage | 46 |
| Canonical client-portal access rows | 46 |
| Onboarding sessions | 0 |
| Onboarding upload mappings | 0 |
| Brand Hub `client_portal_libraries` | 0 |
| Brand Hub category mappings | 0 |

Historical #402/#519 portal **login** provisioning completion remains valid;
it is not evidence that the separate Brand Hub libraries or upload destinations
were activated. Do not reprovision existing users or mistake the 61 production
folder bindings for the different client-safe library/upload contracts.

15 active clients currently lack an active client-role profile: Agri-Secure,
Bloem Vascular, Elcheck, Emoya Estate Driving Range, Forklift Trucks, Human Auto,
Ipopeng Office Supplies, JFJ Electrical, LHP Student Village & Block, Mimosa Mall,
NCNA, Neshora Oxygen, Rusoord Farmstay, VCS Cleaning Solutions, WiseRide.
This is an inventory, not authority to provision every row regardless of service
scope or to disclose/create starter credentials.

## Verification / release gate

- 221 focused onboarding, portal and delegated-adapter regressions passed.
- Actual `deno check --no-lock --node-modules-dir=none` for the complete
  `client-onboarding/index.ts` import closure passed.
- TypeScript/Vite build, emitted onboarding application chunk, scoped lint and
  diff check passed. Full-suite/exact-head Vercel and final browser receipts are
  recorded on the PR and #213 after completion.
- Production behavior was reproduced read-only in the requested info Chrome
  admin session. No secure link was generated and no file was uploaded.

## Still protected, not performed

The new backend capability requires separately scoped approval to deploy the
current `client-onboarding` import closure with its existing auth/JWT contract.
Do not turn on `CLIENT_ONBOARDING_UPLOADS_ENABLED`, refresh/consent OneDrive,
create folders, seed mappings, provision accounts or generate welcome links as
part of this code release. Each missing upload/library mapping must use reviewed
exact-client durable destinations and the canonical privileged flow. No fuzzy
folder/client fallback; no production-folder exposure to clients.

The separate #389 entitlement migrations and #451 three-function rollout remain
at their requested protected packet, not included in this PR. #513 strategy
amendments, approval/publication, CA's #505 provider work and #405 owner lane are
unchanged. Master handover remains supervisor-owned.
