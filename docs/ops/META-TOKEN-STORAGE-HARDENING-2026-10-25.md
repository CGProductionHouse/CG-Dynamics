# Meta token storage — staged source packet, NOT production apply

**Later25October status override:** CA explicitly approved and the exact staged
backend/key rollout was executed. All four readers were verified first, dedicated
key/version privately saved, callback released last. Final versions/readbacks and
rollback constraints are in
[PROVIDER-BACKEND-ROLLOUT-ACCEPTANCE-2026-10-25.md](PROVIDER-BACKEND-ROLLOUT-ACCEPTANCE-2026-10-25.md).
Existing token remains legacy raw until owner Facebook consent completes; do not
claim encrypted-row acceptance or repeat deployment. The preparation text below
records the original source-only boundary, not current hosted status.

Refs #505/#668. Current live warning is genuine: the legacy
`meta_connection_tokens.encrypted_access_token` text column holds plaintext under
server-only access. The word "encrypted" in its name is not encryption evidence.
Do not hide that warning or mark the production gate complete from local tests.

## Prepared implementation

- Shared `metaTokenStorage.ts`: AES-256-GCM, random 96-bit IV, 128-bit tag,
  versioned envelope with authenticated exact connection UUID and key version.
  Uses native Web Crypto; no new package, SQL, grants or client exposure.
- All four credential consumers understand both legacy raw tokens and the new
  envelope: `meta-list-assets`, `meta-connection-status`, `meta-sync` and
  `meta-sync-worker`. A broken/missing key or unauthenticated envelope returns
  a sanitized server-storage failure before provider use; it does not mark the
  Facebook connection expired or overwrite credentials. Worker releases its lane.
- Callback preflights storage configuration **before** consuming OAuth state,
  provider exchange or connection metadata writes. Its token upsert has no
  plaintext fallback. Existing OAuth scopes/state/permissions remain unchanged.
- Status returns only an actual successfully decoded row's boolean security
  state. Legacy raw rows still explicitly report `server_only_plaintext`, even
  when an encryption key exists. No auto-encryption in read/status requests.
- Baseline main's worker produced22 Deno errors with the cached SDK versions:
  generic `ReturnType<typeof createClient>` inferred an unusable unknown schema,
  and JSR/ESM copies of the same SDK have incompatible nominal types. Worker now
  uses explicit `SupabaseClient`; shared fact/post writers accept a minimal
  structural query port rather than a particular SDK's protected class members.
  Both existing runtime SDK imports are preserved, including the worker's JSR
  deployment contract. The port and two result assertions are type-only; shared
  helper emitted runtime is unchanged. Two Instagram branches explicitly reject
  an absent asset. No new package/API/permission/auth authority or lease algorithm.
  The hosted SDK/import closure must still be preserved/reviewed in the exact
  deployment packet; source checking does not authorise replacing dependencies.

## Protected rollout order — exact CA approval required

1. Read back current hosted files, configuration/JWT settings and dependency
   versions for all five endpoints. Preserve unrelated hosted files/changes.
   Produce exact candidate/rollback hashes and Deno-check that actual packet.
2. Release the shared helper plus **all four readers first**, still reading the
   unchanged live raw row. Preserve auth/JWT, scopes and mapping. Verify normal
   status/discovery and bounded sync credential handling; no broad resync.
3. Generate a dedicated random32-byte key directly into protected server secret
   storage (`META_TOKEN_ENCRYPTION_KEY_B64`) and set a reviewed key version
   (`META_TOKEN_ENCRYPTION_KEY_VERSION`, e.g. `v1`). Keep values out of chat,
   terminals, screenshots, logs, GitHub and browser client bundles. Key creation
   and production secret changes are NOT performed/approved by this document.
4. Release callback last. Privately renew the existing connection with previous
   settings unchanged under the separately approved provider action; this safely
   replaces its own row with an envelope. No plaintext export/backfill script.
   Verify encrypted status, unchanged connection/mapping counts and exact-client
   reads. OAuth renewal is still human/provider acceptance, not an invented fact.
5. Keep the key available. Once any envelope exists, **never roll readers back**
   to plaintext-only versions or remove/replace the active key. Callback rollback
   must not restore a raw-token writer. Prefer forward repair; any emergency
   credential replacement/rotation needs its own protected plan. Multi-key
   rotation is not implemented or authorised by this bounded packet.

No production key/config/SQL/Edge/data/provider/permissions change, reconnect or
Vercel action occurred here. This does not upgrade partial Meta metric coverage.

## Verification and references

Deterministic tests cover round-trip/random IV, exact-connection and key-version
isolation, wrong/missing key, tampered/truncated data, valid legacy reads, no raw
writer, actual OAuth/status/discovery handlers and both actual sync credential
blocks. Role denials, zero provider work on storage failure, no secret/ciphertext
responses, lane release and no false reauth writes are included. Fresh complete
supported local acceptance is recorded on the exact candidate PR; prior suites
must not be attributed to a later untested head.

- [Web Crypto AES-GCM parameters](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)

Changelog checked25October; the upcoming TLS cipher removal is unrelated to this
native encryption/storage change. No CLI/platform rollout is inferred from docs.
