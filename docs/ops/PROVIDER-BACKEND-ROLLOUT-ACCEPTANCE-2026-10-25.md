# Provider backend rollout and local acceptance — 25 October 2026

Client lane only, source `8353e75fd944dc038fbe7403a0013e9c1219b328`.
CA explicitly approved the exact Google safeguard and then the staged Meta
encryption rollout in this chat. These are Supabase-only authorisations, not a
Vercel release or permission to change campaigns, mappings, scopes or content.

## Google safeguard — released and read back

Existing `google-ads-sync` v53 was released once as v54, changing only PR885's
`index.ts` and `_shared/google-ads.ts`. All five other hosted files were retained.
Actual seven-file readback matches the reviewed candidate; JWT remains true and
import-map false. Anonymous and invalid-JWT POSTs both return401.

The later approved Meta secret save advanced the same Google bundle to v55;
its bundle hash remained unchanged. This was not a second code deployment.
Read-only before/after fingerprints match: seven campaign links,139 daily metric
rows, zero dedicated links. No manual sync or production SQL/schema/data write.
The safeguard rejects malformed successful provider data before replacement;
it does not invent missing data for paused/removed campaigns.

Fresh focused verification:66 Google tests, scoped lint, TypeScript/Vite392module
actual-app build, diff check and actual hosted-derived cached-only Deno closure.
Earlier89-test PR885 receipt remains separately scoped.

## Meta — backend/key setup released; existing token renewal still pending

1. Read back all five current hosted functions; source/config matched the saved
   baseline. Preserve older hosted callback/assets helpers, not wholesale main.
2. Released and verified all four dual-format readers first: worker74→75,
   manual-sync87→88, assets70→71 and status66→67. Actual signed-in admin health
   stayed Connected/valid/reporting access granted with47 linked clients.
3. Created a dedicated random32-byte key in memory and saved only
   `META_TOKEN_ENCRYPTION_KEY_B64` and `META_TOKEN_ENCRYPTION_KEY_VERSION=v1`
   through the legitimate Supabase dashboard. Values were never printed,
   committed, written to files or passed through chat. Name/digest readback
   verified saving; the in-memory key reference was cleared. No Instagram key
   reuse, provider secret replacement or client exposure.
4. Supabase advanced function environment revisions after the secret save. The
   callback drift guard stopped on70→71, then confirmed its bundle hash, all six
   source files and auth/import settings were byte-identical before proceeding.
5. Released callback LAST as72. Exact seven-file readback includes the reviewed
   ciphertext-only writer and explicitly approved removal of the legacy
   identical duplicate `availability` property. No other callback helper changes.
6. All four anonymous reader canaries return401; callback missing-state GET
   redirects302 to the established `meta=error` route without consuming state.
   Actual signed-in status stillConnected; read-only Load Meta assets succeeds.
   No suggested mappings were saved, sync invoked or standalone consent started.

The hosted dependency graph omits `metaDatabaseClient.ts` from worker/manual
readback: it emits only `export {};` and has no executable code. Every returned
runtime source file matches; no executable dependency is missing. Cached-only
Deno checks passed the full offline candidate including that type interface.
Initial private-manifest hash rechecks needed the documented canonical form
LF/trim-end/one-final-newline; all56 candidate and49 baseline hashes then matched.
No code-content mismatch was bypassed.

### Final hosted snapshot

| Function | Version | Returned runtime source files | JWT | Bundle SHA256 |
| --- | --- | --- | --- | --- |
| google-ads-sync |55|7|true|`3bbb4fbdb28f0218a734538a919b8264a70b62c8fe6e2b4d391539ae555aca47`|
| meta-sync-worker |76|17|false|`a9d34605edc64806f151ffc60c6346254a01f15af9b0c0e75fee20d003740428`|
| meta-sync |89|12|false|`8a5735a4688804112dbb2d7ffa58b3b4f114362d97b5e6a59d78cab965695238`|
| meta-list-assets |72|7|false|`eafb9a8a2eb1826b2d0b2ade9691209b08d8fac2232f2260b59c7625d7cd46e3`|
| meta-connection-status |68|11|false|`6b66985fd8b4250d5dcc90e130b3876e980a6daf073e266431b07b28fd72c01a`|
| meta-oauth-callback |72|7|false|`157b4976e07f035c16f00e965b0f330981a3f032fa01e0f11b51d37913c1d602`|

**Not complete:** the existing live token remains one legacy raw row and zero
envelopes. Key configuration is NOT encryption evidence.47 asset mappings and
the existing connection retained identical before/after fingerprints. The usual
Christie-Ann reconnect was started with unchanged scopes, but Facebook's business
consent panel stays blank after one bounded reload. The handoff tab is left open;
CA consent remains required. Do not hide the plaintext warning, claim encrypted
storage, export/backfill the old token or expand permissions to bypass this.

After consent: SELECT only the envelope boolean/count, verify actual status says
server-only encrypted, recheck mappings, then perform read-only discovery. Do not
claim full metric coverage from a working credential. Never remove/replace the
key or revert readers to plaintext-only after any envelope exists; never restore
the raw-token writer. Any further credential change needs its own exact authority.

## Docker-enabled local acceptance

CA started Docker; no shared engine restart/reset or stack install was performed.
Frozen8353e75f canonical `local-launch-acceptance.mjs --run` completed with:

- 4208 total /4184 pass /24 explicit skips /0fail/cancel/todo.
- Actual disposable PostgreSQL calendar post-assets ownership/publication/RLS
  and skill-card revision/trigger/concurrent-CAS tests now pass (previously skipped).
- TypeScript/Vite actual app, all20 canonical desktop/mobile browser fixtures
  at1440/375/390/430 and stable source tree pass.
- Private receipt `%TEMP%/cg-local-launch-8353e75fd944.json`, SHA256
  `7895EBB3FEA96845DC68C6FD22BEE51C5082298C0252821C31F52D289C97C7E3`.
  Start17:49:22.827UTC; completion18:12:03.400UTC.

Separately enabled existing local fixtures:16/16 Instagram callback PostgreSQL
tests pass, including exact-app/client isolation, permissions, replay, stale
callbacks, concurrent revocation/deletion and real persistence races; isolated
client-registry PostgreSQL test1/1 passes. Only test-owned disposable containers
were created/removed, network disabled, no ports or production credentials.
The16+1 checks were skipped in the full receipt; do not rewrite that receipt or
add the counts as new distinct full-suite tests. Seven optional staff PGlite
groups still require their separate module/owner and are not relabelled passed.
The pre-existing unsupported Windows Bash SES fixture remains excluded, not
passed; its exclusion is explicit in the canonical receipt.

The fixture-configured dist is NOT a deployment artifact. Zero Vercel operations.
No production migration, SQL/data reconciliation, campaign/mapping/permission,
strategy approval/publication or Brand Hub publication. Staff/Teams/calendar and
normal ChatGPT strategy owners unchanged. Genuine client passwords, physical
phones, source/editorial/asset decisions and separately authorised frontend
release remain distinct from local engineering acceptance.

Owning issue receipts: #435 comment6401264747 and #505 comment6401265039.
Supabase's monitoring incident was read before continuation; bounded deployment
and hosted readbacks succeeded, with no management-API retry loop.
