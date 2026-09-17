# Client Onboarding / Welcome to CG Foundation

Status: draft implementation on `feat/client-onboarding`
Tracking issue: #213

## Product boundary

Welcome to CG is the initial account-free intake for the existing client-facing
Performance experience. Authenticated clients revisit the same safe state as
`Setup` at `/client/setup`. It is not a second portal.

Staff manage onboarding from the first-class `Client Onboarding` destination in
the Performance zone. The Performance dashboard surfaces its status, and both
Clients and Client Preview provide an exact selected-client `Setup` preview.
That preview uses the same presentation as `/client/setup`, but authenticates as
staff and never broadens the selected client's data scope.

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

The adapter resolves an exact existing destination for each upload category
through `client_onboarding_drive_mapping`. Staff populate separate `logo`,
`services`, and `optional` mappings when they set up a client; CG Dynamics does
not invent or create OneDrive folders. The Edge Function:

1. validates file metadata (MIME, extension, size, executable blocking);
2. generates a safe server-side filename;
3. resolves the category's target folder from the exact-client drive mapping;
4. creates a Microsoft Graph resumable upload session;
5. returns the short-lived upload URL to the client;
6. the client uploads directly to Microsoft Graph in sequential 10 MB chunks;
7. the client submits the final Graph DriveItem ID;
8. the Edge Function fetches that exact item, verifies its parent drive/folder
   and byte size, then persists Graph's actual metadata and marks it `received`.

### Environment variables

> **Corrected 2026-09-09 (#225): the OneDrive is a PERSONAL Microsoft account — delegated OAuth,
> not app-only.** See `docs/onboarding/ONEDRIVE-PRODUCTION-MAPPING-225.md`.

The dedicated OneDrive app (delegated) requires:

- `ONEDRIVE_MS_CLIENT_ID`
- `ONEDRIVE_MS_CLIENT_SECRET`
- `ONEDRIVE_MS_REDIRECT_URI`
- `ONEDRIVE_MS_AUTHORITY` (default `https://login.microsoftonline.com/consumers`)
- `ONEDRIVE_TOKEN_ENC_KEY` (base64 32-byte AES-256-GCM key for the encrypted token store)
- `ONEDRIVE_OAUTH_SETUP_TOKEN` (gates the one-time consent starter)

These MUST be a separate app from `MICROSOFT_TENANT_ID` / `MICROSOFT_CLIENT_ID`
used by `microsoft-transition-sync`. The delegated app needs only:

- delegated scopes `Files.ReadWrite offline_access openid profile` — the user's own
  OneDrive only, **not** tenant-wide, **not** `Files.ReadWrite.All`;
- a one-time interactive consent by the personal `info@` account that mints a refresh
  token (stored encrypted, rotated on use); app-only/client-credentials is not supported.

(The former app-only `ONBOARDING_MS_TENANT_ID/CLIENT_ID/CLIENT_SECRET` +
`Files.ReadWrite.All` model does not work for a personal Microsoft account and is retired.)

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

## Product decisions captured from the manual onboarding bridge — 17 Sep 2026

CG is using a polished universal onboarding PDF as a temporary operational bridge
while the in-app onboarding remains deferred in the launch order. The PDF is not
a second product and should not be copied 1:1 into the app. It clarified the
client-facing information architecture, access rules and relationship language
that the app should inherit when onboarding resumes.

### Welcome / relationship framing

- Lead with **Welcome to CG**, not a sterile setup form.
- Explain that the client can send the material they already have and CG will
  help identify gaps and organise the rest.
- Ask for practical business details, brand assets and service information before
  access setup.
- CG researches and verifies public social links; clients should not be asked to
  manually type every public profile URL unless genuinely needed.
- A permanent CG Production House profile is available at
  `https://www.cgproductionhouse.com/company-profile`. The onboarding experience
  may link to it for clients who want to understand more of CG's capabilities,
  rather than duplicating a long brochure inside Dynamics.

### Platform access rules

Meta / Facebook is an **either/or** route, never both:

1. **Preferred when a Meta Business Portfolio already exists:** add CG Production
   House as a partner using Business ID `3217480521719798`, then assign the
   relevant Page and agreed assets/permissions.
2. **Simple fallback when the client is not properly set up in Meta:** give
   **Christie-Ann Groenewald** full Facebook Page access. Once that access is
   active the client stops there and CG organises the remaining Meta structure.

Other platform rules:

- **Instagram:** CG requires direct account login access for day-to-day management
  even when the account is connected to Meta. Collect username/login email as
  ordinary onboarding data, but the password must use the separate secure
  credential handoff and must never be stored by onboarding until an approved
  vault exists. Two-factor approval may be required once.
- **TikTok:** same direct-login rule and same secure credential boundary as
  Instagram unless CG explicitly agrees another access method with the client.
- **Google:** use `info@cgproductionhouse.com` for the relevant services. Current
  operating roles are Business Profile = **Manager**, Google Analytics =
  **Editor**, Search Console = **Full user**, Google Ads = **Standard**.
- **LinkedIn:** Company Pages do not use a separate Page password. An existing
  Super admin should add **Christie-Ann Groenewald** as **Super admin** for
  onboarding/optimisation. LinkedIn Ads / Campaign Manager access is separate
  and should be requested only when relevant.
- **Website:** if CG is taking over an existing site, request the highest practical
  administrator/collaborator access plus domain/DNS, hosting, Analytics/Search
  Console and integration access where applicable. Do not tell a client to cancel
  the old provider or hosting before continuity/access is verified. If CG is
  rebuilding the site, the client should understand that CG handles the new
  technical foundation and launch once required domain ownership/access is in place.
- **Email / Outlook:** for CG-hosted IMAP mailboxes, Outlook Classic remains the
  supported setup path. Current universal settings are IMAP port **993 + SSL/TLS**,
  SMTP port **465 + SSL/TLS**, with SPA unticked. Mailbox-specific email, server
  name and password are supplied separately and must not be embedded in the
  universal onboarding experience.

Platform access remains optional to the core completion contract because not
every client uses every platform or buys every service. The client should always
be able to skip non-relevant platforms.

### Website / AI education direction

The manual onboarding work confirmed that website education is a valuable part of
Welcome to CG, especially for clients deciding whether CG should merely take over
an old site or rebuild it properly. Keep this concise in-app, but the product may
explain that a CG rebuild treats the website as a connected technical foundation,
not only a visual redesign.

Relevant capability language includes:

- modern responsive structure and conversion-focused user journeys;
- on-page SEO foundations;
- Answer Engine Optimisation (AEO) foundations for AI-powered search;
- Generative Engine Optimisation (GEO) foundations for generative discovery;
- search engine and AI crawler accessibility;
- structured data/schema where applicable;
- page titles, descriptions, metadata and content hierarchy;
- XML sitemap and robots.txt configuration;
- Google indexing and Search Console setup/connection;
- analytics and conversion measurement;
- clear service, location and business-entity signals;
- launch QA across desktop/tablet/mobile, browsers, links, forms, media and
  crawler/indexing checks.

Use the client question **“Can AI find your business — and can it understand what
you do?”** as a useful educational framing. Do not promise rankings or AI citations.
The goal is a technically clean, machine-readable source of truth designed for how
modern discovery works.

### Connected digital system

Onboarding should help clients understand that CG does not treat website, Google,
social, captions, hashtags, ads and analytics as isolated tasks. They reinforce a
shared set of business/brand signals and should be planned as one connected digital
system so the brand is easier to find, understand and measure.

### How CG works with the client each month

The manual guide also clarified the service process that removes uncertainty after
onboarding. This belongs in the Welcome/Setup education layer, not as another legal
terms document:

1. **Monthly direction:** the client can supply a theme, promotion, event, product
   or priority for the month.
2. **Research + game plan:** if there is no requested theme, CG researches the
   industry, audience, season and market and builds the monthly plan.
3. **Content guideline before every shoot:** CG sends the intended capture/ideas
   before the shoot so the client knows what is planned and what may be needed.
4. **Production:** CG shoots/designs/edits, writes captions and hashtags and
   prepares each piece for the relevant platforms.
5. **WhatsApp approval:** finished content/copy is sent to the client WhatsApp
   group for approval before posting.
6. **Changes are welcome:** the client can request changes in the group; CG makes
   them and sends the updated version back for approval.
7. **Publish + improve:** only approved content is scheduled/published, and
   performance learning feeds the next cycle where reporting is in scope.

Client reassurance to preserve: **nothing goes live without client approval**.
The intended experience is “no uncertainty, no surprises”.

## Deferred integrations

- secure credential vault/handoff;
- completion email to the configured CG mailbox and Outlook rule;
- voice-note retention and transcription;
- client-package-driven platform defaults beyond staff selection;
- screenshots and centrally maintained current third-party guide details;
- production-authenticated browser/device acceptance and production rollout.

The migration is proposal-only and must not be applied to production without
explicit CA approval.
