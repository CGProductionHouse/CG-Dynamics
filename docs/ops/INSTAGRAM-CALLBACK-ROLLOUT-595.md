# #595 — standalone Instagram callback rollout

## Current production state — Phase B completed under explicit CA authority

1 October 2026, verified 16:27 SAST. Deployed from exact accepted main
`ad95c9de0c75e81cebb0799cc179e474b0575b28`; runtime/SQL are unchanged from the
Phase A reviewed `63c6fe4b40be957aaeb9a8a32eed6c093cedf98d` target.

Only `20261001131621_instagram_provider_callbacks.sql` was applied, using its
unmodified SQL through the single-migration management operation. Supabase assigned
live ledger version **`20261001142241`**, name `instagram_provider_callbacks`.
This is the approved file's application receipt, not a second migration. Do not
reapply the repository filename or repair the ledger to make timestamps match.
The three prerequisite ledger entries/hashes and existing RPC/grants/RLS, zero
standalone rows, OAuth v5 hash, missing secret and blocked activation were freshly
revalidated before apply. No precondition mismatch occurred.

Schema verification passed before deployment:

- Nullable text app namespace, numeric check and exact partial unique app/user index.
- Receipt RLS enabled, owner-only table ACL, no policies or direct privileges for
  PUBLIC/anon/authenticated/service-role, including DML/TRUNCATE/reference/trigger.
- Three public RPCs service-only with empty search paths; original 12-argument
  public signature absent and renamed helper owner-only. Existing connection/token/
  OAuth-state grants, RLS and manager-read policy unchanged.
- New SQL function bodies match the approved migration exactly (MD5): wrapper
  `17dbee45e7a8b791d73df7008130a4f8`; apply `42bad6c0774d6cecb765225f3611f336`;
  status `31a98b7ebe534c747cce8a96d3185a84`.
- Connections / encrypted tokens / standalone bindings / callback receipts /
  unnamespaced connections remain **0 / 0 / 0 / 0 / 0** after harmless acceptance.
  No backfill, valid callback, revoke/delete, consent or provider request ran.

Sequential deployment and deployed-source/dependency parity passed:

| Function | Live version | JWT verification | Deployed bundle SHA256 |
|---|---|---|---|
| `instagram-oauth-callback` | ACTIVE v6 | false | `f2ee94b5a260a5fe907197057fcfe7caa96cb3b0365d945f7395e808b468c3d2` |
| `instagram-deauthorize` | ACTIVE v1 | false | `824259d3d0d75ea998ab0a35a6187dd95a09d309af5e345d7aee4e44bbd8e451` |
| `instagram-data-deletion` | ACTIVE v1 | false | `391917292d95cd5fc8500048a0fb258b6983363d026275d750ac2d61d29131ba` |

All six OAuth files and three files per new handler matched pinned repository
contents after LF normalization. The management API returns the new handlers'
paths rooted at `functions/`; those paths were resolved under repository `supabase/`
before content comparison. This was only artifact-path normalization, not a source
change. OAuth entrypoint hash matches the Phase A target; new entrypoints are
`674c47f0b6087e9a08632425e186deb6484d4cadfb1a335c6bef6bcdc6498517` (deauthorize)
and `4e415bf755c43195204d7204249a055917fb0a869aba6db53521cac0b926761b` (deletion).
Shared runtime/verifier hashes respectively:
`e7de6d5158568ef6229f1ae40e7c3c198fe8adbd6448c108018d2bea812b9999` /
`67aa21965ef98fc940e05444018940d1f4d0da8d659770cbe8ca1e44c5f6b747`.
No other deployed function's version/hash/JWT setting changed, including OAuth start
and connection confirm (both remain v5).

Eight harmless HTTP checks passed:

- OAuth GET without code/state: **302 `activation_blocked`**, before DB/provider path.
- Unsigned and forged-invalid POSTs to each callback: **503**, no completion.
  `INSTAGRAM_APP_SECRET` is still absent. This is expected configuration fail-closed,
  NOT a successful live signature-verification/real-provider acceptance claim.
- Unknown 64-zero, malformed and absent deletion status codes: **404**.

Names-only config presence is unchanged; no secret values were read and no secret,
config or flag was written. Strict consent activation remains effectively OFF.
Bounded logs 14:22–14:27:01 UTC returned 6 function-edge and 10 function-runtime
events, with zero matched Uncaught/Unhandled/BOOT_ERROR/WORKER_ERROR/function-failed/
SyntaxError signatures. Fresh local callback suite: 32 PASS, no failures/skips.
No production mutation RPC was called and no Meta dashboard field was saved.

### Exact remaining gates — NOT authorized by Phase B

1. CA privately verifies the approved Instagram app identity and separately
   authorizes provisioning **`INSTAGRAM_APP_SECRET`**. Callback POSTs cannot become
   functional until then; do not bypass missing configuration with another secret.
2. After that approval, repeat harmless unsigned/forged checks (400/401 expected),
   unknown status 404, deployed parity and zero mutation counts; keep consent OFF.
3. Separately authorize saving the exact Instagram product Deauthorize/Data deletion
   URLs from #593. No App Mode, permissions, Facebook routes or scopes changed here.
4. Establish an exact owner-authorized coherent standalone fixture and separately
   authorize real OAuth/provider callback/removal/deletion acceptance. No production
   client, canonical Page-linked account or guessed identity may serve as a fixture.
5. Business verification, reviewer/tester access, Advanced Access/App Review,
   submission, Live mode and eventual standalone consent activation remain protected.

The schema/Edge rollout gate is complete; #505 provider/config/owner gates remain.
Rollback remains coordinated as documented below: never roll OAuth back alone to
v5 after the namespaced migration, automatically reverse SQL, or delete receipts.

## Historical Phase A evidence and approved execution checklist

Observed 1 October 2026. Source target: accepted main
`63c6fe4b40be957aaeb9a8a32eed6c093cedf98d` (PR #594).
At this Phase A observation, Phase B was not yet authorized/executed. The current
status above supersedes the historical pending-state statements below.

## Live production evidence

Project: `ehtjfntukiwbgptqgbzy`. Supabase migration/function metadata, catalog
SELECTs, names-only secrets listing and one no-code/no-state public callback GET
were inspected. No provider request, OAuth start, real signed callback or write ran.

| Repository prerequisite | Production ledger version / name |
|---|---|
| `20260922140000_instagram_login_fallback_foundation.sql` | `20260923083506` / `instagram_login_fallback_foundation` |
| `20260922144059_standalone_instagram_token_encryption.sql` | `20260923083514` / `standalone_instagram_token_encryption` |
| `20260923120000_instagram_connection_review_binding.sql` | `20260923104013` / `instagram_connection_review_binding` |

Do NOT replay prerequisites because their ledger timestamps differ from repository
filenames. The actual reviewed 12-argument persistence RPC exists, is security
definer with empty search path and only postgres/service-role EXECUTE. Its live
definition MD5 is `e5f96e757ad4d42d46a1177c359c5425`; inspected checks retain active
client, active admin/manager actor, professional identity, exact reporting scopes,
encrypted-token shape, canonical-mapping refusal and cross-client ownership denial.
Connections, tokens and OAuth-state tables have RLS enabled. This rollout does not
change their existing grants/policies.

`20261001131621_instagram_provider_callbacks.sql` is absent from the ledger.
The namespace column, receipt table and three new/scoped RPC signatures are absent.
Connections = **0**, encrypted token rows = **0**, standalone asset bindings = **0**.
No historical namespace backfill is required or permitted. Recheck immediately
before apply; if new unnamespaced rows appear, STOP for exact provenance review.

| Edge function | Live state |
|---|---|
| `instagram-oauth-callback` | ACTIVE v5, JWT verification false; old unnamespaced RPC call |
| `instagram-deauthorize` | absent |
| `instagram-data-deletion` | absent |

OAuth v5 deployed bundle SHA256:
`9243eb66ebf59f7b0457f65e27d60ec50ba77a37fbb1c701729814f4795afd19`.
LF-normalized entrypoint SHA256:
`a74de224712eb35bb63ba00f7df9bfce384a8cec440bf6649f05ab6422502e9e`.
Target LF-normalized entrypoint SHA256:
`9bed43b87f0e80b41ec78ccbf8dc550af27ccd26c5b17702fb330873ac6f537d`.
The exact entrypoint difference is the added `p_instagram_app_id: appId` argument.
Its encryption dependency also has the accepted ArrayBuffer typing-only correction.
Bundle hashes and normalized source hashes are different measurements, not expected
to equal one another. Retrieve deployed files after deployment and compare their
normalized contents against the pinned target, including shared dependencies.

Names-only configuration inspection:

- PRESENT: `INSTAGRAM_APP_ID`, `INSTAGRAM_REDIRECT_URI`, `INSTAGRAM_GRAPH_VERSION`,
  `INSTAGRAM_TOKEN_ENCRYPTION_KEY_B64`, `INSTAGRAM_TOKEN_ENCRYPTION_KEY_VERSION`,
  `INSTAGRAM_STANDALONE_LIVE_ACTIVATION_ENABLED`, `APP_PUBLIC_URL`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- ABSENT: **`INSTAGRAM_APP_SECRET`**. No value was fetched or exposed. Names existing
  does not prove their values are correct; exact app/secret pairing requires the
  separate private CA verification/secret gate.
- No-code/no-state GET returned HTTP **302**, status **`activation_blocked`**.
  Inspected deployed source returns this before creating a Supabase client or any
  provider request. The strict enable predicate accepts only the literal `true`;
  this proves the effective current runtime is OFF, without retrieving its value.

## SQL replacement / privilege safety

The exact migration is transactional. It adds a nullable app namespace and a
partial unique app/user index without historical inference. It renames the
reviewed persistence implementation, revokes direct execution from all public
and service roles, and exposes only the new required-namespace service wrapper.
The wrapper retains original checks and adds exact app/user validation and shared
advisory locking. OAuth v5 cannot persist through the renamed old contract after
apply; keep consent OFF and deploy the updated callback before any future consent.

The receipt table has RLS and no PUBLIC/anon/authenticated/service-role direct
privileges. New wrapper/apply/status RPCs have empty search paths and service-only
EXECUTE plus explicit service-role checks. The unscoped helper is owner-only.
No client/report RLS, queue, scheduler, provider worker or global grant is changed.
Exact standalone binding/generation locks and atomic receipts fail closed on
ambiguous identity, Page binding, reconnect and persistence error. Revocation
retains the credential route to prevent legacy-token fallback. Deletion does not
touch unrelated clients, reports/posts/snapshots or Facebook identity/credentials.

Fresh Phase A signature/HTTP/security tests: **32/32 PASS**, no skips/failures.
The accepted #593 baseline separately has 16 real disposable PostgreSQL tests,
141 focused and 3347 full-suite tests, build/Deno/lint/diff PASS. Those historical
results are not a fresh Phase A production SQL/apply test.

## Exact protected Phase B execution plan — do not run without CA approval

1. Refetch main and pin the accepted runtime target above; STOP on callback/SQL
   drift, live schema/identity drift or activation no longer blocked. Retain the
   currently deployed v5 source bundle privately for comparison/rollback planning.
2. CA approves **only** `20261001131621_instagram_provider_callbacks.sql`, followed
   by these three Edge deployments. Use a single exact migration apply with that
   file's full reviewed SQL, migration name `instagram_provider_callbacks`.
   Do NOT use a blanket `db push`, replay prerequisite files or repair history.
3. Immediately run the catalog verification below. STOP on any mismatch.
4. From the pinned target, deploy exactly, sequentially (CLI v2.115 help verified):

   ```powershell
   npx supabase functions deploy instagram-oauth-callback --project-ref ehtjfntukiwbgptqgbzy --no-verify-jwt --use-api
   npx supabase functions deploy instagram-deauthorize --project-ref ehtjfntukiwbgptqgbzy --no-verify-jwt --use-api
   npx supabase functions deploy instagram-data-deletion --project-ref ehtjfntukiwbgptqgbzy --no-verify-jwt --use-api
   ```

   No omitted function name, deploy-all or prune. No cron/secret/flag change.
5. Read function metadata and deployed source. All three must be ACTIVE,
   `verify_jwt=false`, with exact target source/dependency parity. OAuth must now
   call the required namespaced RPC. Repeat the no-code/no-state GET: still 302 /
   `activation_blocked`, before any database/provider action.
6. Only unsigned/forged requests and unknown status codes are allowed in this
   phase. Never generate a valid production signature, invent a user ID or invoke
   callback mutation RPCs to test. While the app secret is absent, callback POST
   must fail closed with **503**, not claim signature acceptance or completion.
   This is unavailable configuration, NOT successful HMAC acceptance. Once the
   secret is separately authorized/configured, unsigned/forged requests must
   fail 400/401 without any receipt/connection mutation. Unknown valid-shaped
   confirmation-code GET must be 404 once the status RPC is reachable.
7. Recheck connections/tokens/bindings/receipts remain zero and logs show no
   runtime/database contract error or sensitive payload. Record new versions,
   source parity and exact health results in #595/#505/#381 and handover.

Exact harmless HTTP probes after authorized deployment (no valid signature or
OAuth code/state; do not follow redirects):

```powershell
curl.exe --silent --show-error --include "https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-oauth-callback"
curl.exe --silent --show-error --include --request POST --data-urlencode "signed_request=invalid" "https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-deauthorize"
curl.exe --silent --show-error --include --request POST --data-urlencode "signed_request=invalid" "https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-data-deletion"
curl.exe --silent --show-error --include "https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-data-deletion?code=0000000000000000000000000000000000000000000000000000000000000000"
```

Expected now: 302 activation-blocked, 503, 503, 404 respectively. An HTTP success
from a forged POST, completion receipt, or activated OAuth is a STOP condition.
After a separately authorized secret correction, forged POSTs should instead be
400/401, never 200; valid production signed mutation fixtures are still excluded.

Post-apply SELECTs (read-only; expected results below):

```sql
select version, name from supabase_migrations.schema_migrations
where name = 'instagram_provider_callbacks';
select column_name, is_nullable from information_schema.columns
where table_schema='public' and table_name='meta_instagram_connections'
  and column_name='instagram_app_id';
select count(*) as connections,
  count(*) filter (where instagram_app_id is null) as unnamespaced
from public.meta_instagram_connections;
select c.relrowsecurity, c.relacl from pg_class c
where c.oid='public.meta_instagram_callback_receipts'::regclass;
select role_name,
  has_table_privilege(role_name,'public.meta_instagram_callback_receipts','SELECT') as can_read,
  has_table_privilege(role_name,'public.meta_instagram_callback_receipts','INSERT') as can_insert
from unnest(array['anon','authenticated','service_role']) as role_name;
select p.proname, pg_get_function_identity_arguments(p.oid), p.prosecdef,
  p.proconfig, p.proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'complete_instagram_login_connection',
  'complete_instagram_login_connection_unscoped',
  'apply_instagram_provider_callback','instagram_data_deletion_status');
select count(*) from public.meta_instagram_callback_receipts;
```

Expected: one new migration receipt; nullable namespace; 0/0 connection counts;
receipt RLS true with owner-only ACL; 13-argument namespaced wrapper and apply/status
service-only; 12-argument unscoped helper owner-only; all empty search path; zero
callback receipts. Recheck tokens/bindings and existing RLS/policy/ACL baseline too.
All three receipt-table direct-access checks must be false. Verify effective RPC
EXECUTE with `has_function_privilege(role_name, p.oid, 'EXECUTE')` for the same role
matrix: anon/authenticated false throughout, service true for the three new public
RPCs and false for the unscoped helper. PUBLIC must not have an EXECUTE grant.

## Rollback / stop rules

- Migration failure must roll back its transaction; verify old 12-argument RPC and
  original schema remain intact. Do not proceed to deployments on partial/mismatched
  state, and do not bypass a failed validation.
- After successful migration, an old v5 OAuth rollback alone is incompatible with
  the renamed/revoked RPC. Leave activation OFF; stop and correct/redeploy the pinned
  namespaced callback under deployment authority. A coupled schema reversal requires
  separately reviewed CA approval; no automatic down migration or receipt deletion.
- On failed new-handler deployment/parity, do not save Meta URLs. Keep disabled
  consent, stop the sequence, retain evidence and request bounded corrective authority.
- Never restore secrets, broaden grants, backfill namespaces or delete audit/data to
  make the checks pass. Any new live identity, unexpected receipt or report change
  stops the rollout for investigation.

**Remaining gates:** CA migration/three-function deploy authorization; separately
authorized correct Instagram app secret; exact Meta product callback saves; coherent
owner-authorized standalone fixture; real consent/removal/deletion acceptance; business
verification/reviewer access/App Review/Live mode and eventual consent activation.
No Phase A finding grants any of these permissions. Canonical URLs and response
contracts remain in `INSTAGRAM-PROVIDER-CALLBACKS-593.md`. Current Supabase
[function configuration documentation](https://supabase.com/docs/guides/functions/function-configuration)
confirms the per-function JWT configuration; handler HMAC authentication remains mandatory.
