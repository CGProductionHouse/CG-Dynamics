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

This foundation intentionally does not upload bytes. The current Microsoft
transition connector is read-only and no approved Graph write permission or
client-folder resolver exists. The UI therefore states that a selected file was
not uploaded and does not allow logo completion from local metadata. Staff link
generation and the server action both fail closed until
`CLIENT_ONBOARDING_UPLOADS_ENABLED=true`; that gate must not be enabled before
the approved adapter and its security tests exist.

Approved follow-up work must provide a server-only adapter with:

1. exact-client folder resolution against the existing CG OneDrive structure;
2. small-file and Graph upload-session/chunked paths;
3. MIME, extension, size, executable and archive validation;
4. idempotency, retry and safe failure state;
5. no internal reference in any client response;
6. explicit Microsoft permission review and CA approval before deployment.

## Credential boundary

There is no credential vault in current CG Dynamics. Do not add Instagram,
website, mailbox, or other passwords to onboarding tables, browser storage,
analytics, logs, errors, notifications, or ordinary API responses. A future
credential handoff must use an independently reviewed encrypted secret system
with one-way submission semantics and tightly audited access.

## Deferred integrations

- actual OneDrive uploads and internal file-open actions;
- secure credential vault/handoff;
- completion email to the configured CG mailbox and Outlook rule;
- voice-note retention and transcription;
- client-package-driven platform defaults beyond staff selection;
- screenshots and centrally maintained current third-party guide details;
- authenticated browser/device acceptance and production rollout.

The migration is proposal-only and must not be applied to production without
explicit CA approval.
