# Client Onboarding / Welcome to CG Foundation

Status: draft implementation on `feat/client-onboarding`
Tracking issue: #213

## Product boundary

Welcome to CG is the initial account-free intake for the existing client-facing
Performance experience. Authenticated clients revisit the same safe state as
`Setup` at `/client/setup`. It is not a second portal.

The core completion contract is deliberately small:

- at least one logo file has been received securely;
- services are supplied by text, a quick list, an uploaded document, or any
  combination;
- platform access and optional notes never block completion.

## Security boundary

- `/welcome#token` uses a 256-bit random bearer token. The URL fragment is not
  sent to the host in the HTTP request. Only the token's SHA-256 hash is
  stored. A token identifies one session and derives one canonical `client_id`.
- Tokens expire after 30 days and can be regenerated or revoked. Regeneration
  replaces the hash and invalidates the old link.
- Public requests do not accept `client_id`. Invalid, expired, and revoked links
  receive the same safe error.
- Onboarding tables have RLS enabled and no `anon` or `authenticated` table
  grants. The Edge Function returns narrow DTOs.
- OneDrive drive IDs, item IDs, URLs, folder structure, permissions, and upload
  sessions are never returned to clients.
- Passwords and other credentials are not accepted or persisted. Instagram and
  website guides point to a separate secure handoff because no approved vault
  exists in the repository.
- The route removes the token from the visible address after capture and uses a
  `no-referrer` policy. It does not place the token in local or session storage.

The public Edge Function must be deployed with gateway JWT verification disabled
because the welcome user is intentionally anonymous. The function performs its
own token or Supabase-user validation for every action. Deployment must add
edge/WAF rate limiting before a public rollout.

## OneDrive upload boundary

`client_onboarding_uploads` stores metadata and internal OneDrive references,
not binary files. A row can be `received` only when it has a OneDrive provider,
drive ID, item ID, and upload timestamp.

### Phase 2: scoped upload adapter

The upload adapter (`supabase/functions/client-onboarding/onedrive-adapter.ts`)
uses a dedicated least-privilege Microsoft app for onboarding uploads. It must
never share credentials with the existing `microsoft-transition-sync` connector.

The adapter resolves the exact client's Brand Identity folder through a
`client_onboarding_drive_mapping` table that staff populate when they first set
up a client. The Edge Function:

1. validates file metadata (MIME, extension, size, executable blocking);
2. generates a safe server-side filename;
3. resolves the target Brand Identity folder from the drive mapping;
4. creates a Microsoft Graph resumable upload session;
5. returns the short-lived upload URL to the client;
6. the client uploads directly to Microsoft Graph;
7. the client signals completion, and the Edge Function marks the upload as
   `received`.

### Environment variables

The dedicated upload app requires:

- `ONBOARDING_MS_TENANT_ID`
- `ONBOARDING_MS_CLIENT_ID`
- `ONBOARDING_MS_CLIENT_SECRET`

These MUST be a separate app from `MICROSOFT_TENANT_ID` / `MICROSOFT_CLIENT_ID`
used by `microsoft-transition-sync`. The upload app needs only:

- `Files.ReadWrite.All` (application) scoped to the Brand Identity folder;
- no user delegation; client credentials flow only.

### Server-mediated download

Staff and client downloads go through the Edge Function, which proxies
OneDrive content without exposing drive IDs, item IDs, URLs, paths, or
Microsoft credentials. The `download_file` action is staff-only; the
`portal_download` action is client-only and enforces exact client isolation.

### Resume and cancel

Pending uploads can be cancelled. Expired upload sessions are cleaned up by
Microsoft automatically. The upload record transitions from `pending` to
`received` only after the Edge Function confirms completion.

### Filename safety

The server generates a safe filename by stripping non-word characters, collapsing
underscores, and truncating to 120 characters. The original filename is preserved
in `original_filename` for display. Duplicate filenames within the same folder
are resolved by Microsoft Graph's `conflictBehavior: rename`.

## Credential boundary

There is no credential vault in current CG Dynamics. Do not add Instagram,
website, mailbox, or other passwords to onboarding tables, browser storage,
analytics, logs, errors, notifications, or ordinary API responses. A future
credential handoff must use an independently reviewed encrypted secret system
with one-way submission semantics and tightly audited access.

## Deferred integrations

- secure credential vault/handoff;
- completion email to the configured CG mailbox and Outlook rule;
- voice-note retention and transcription;
- client-package-driven platform defaults beyond staff selection;
- screenshots and centrally maintained current third-party guide details;
- authenticated browser/device acceptance and production rollout.

The migration is proposal-only and must not be applied to production without
explicit CA approval.
