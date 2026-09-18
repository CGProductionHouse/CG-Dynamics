# CG Dynamics Security Architecture

## Backend

Supabase (PostgreSQL, Auth, RLS, Storage, Edge Functions). Supabase is the only
backend. No Convex, no other backend.

## Authentication

- Supabase Auth (email/password).
- Session expiry: Supabase default JWT (1 hour), refresh token rotation enabled.
- Registration: invite-only via `client_invites` + `admin-invite-user` Edge Function.
- Email verification: required for new signups (Supabase Auth settings).

## Authorisation

### Principle

Authentication is NOT treated as authorisation. Every database access is
restricted by Row-Level Security (RLS) policies that check the caller's role
from `public.profiles` (table-driven, not user metadata).

### Role functions (SECURITY DEFINER)

Roles are stored in `public.profiles.role` — populated via the invite+signup
flow, never from editable user metadata. Three security-definer SQL functions
provide role checks for RLS policies:

- `is_staff()` — true for `admin`, `manager`, `staff`, `team` roles
- `is_manager()` — true for `admin`, `manager` roles
- `is_admin()` — true for `admin` role only
- `my_client_id()` — returns the calling user's client_id

### Policy pattern

Every exposed table has RLS enabled. Policies follow least-privilege:

| Role | Command Centre Tasks | Monthly Deliverables | Client Packages | Planner |
|------|---------------------|---------------------|-----------------|---------|
| admin | Full | Full | Full | Full |
| manager | Full | Full | Full | Full |
| staff/team | Operational only (no Admin/To Do) | Read + status updates | Read only | Read only |
| client | No access | No access | No access | No access |

## Data protection

- No service-role key in browser.
- Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are client-side.
- Edge Functions handle privileged operations (Meta sync, Google Ads, invites).
- SECURITY DEFINER RPCs restrict dangerous operations (package classification,
  status changes with assignment verification).
- Client portal calendar RPCs require an active profile and project only the
  caller's client-safe records. Deliverables require explicit sent/approved/
  posted evidence; Calendar events require the separate `client_visible`
  authority. Neither client ownership nor workflow status implies publication.
  Client schedule dates never fall back to internal `due_date`; posted work uses
  the Johannesburg-local `posted_at` date. Deliverables with disclosure history
  reject client reassignment rather than clearing or transferring that history.
- Company Calendar event visibility defaults off and is writable only through
  an active-manager SECURITY DEFINER RPC. Direct browser and Microsoft writes
  cannot modify it. Visible rows require a complete manager/time audit pair;
  hidden rows may be unreviewed or retain a complete explicit-off audit pair.

## Third-party integrations

- Meta: OAuth flow through Edge Functions, tokens stored server-side.
- Google Ads: OAuth flow through Edge Functions, tokens stored server-side.
- Microsoft: Edge Function with isolated service-role access, no client exposure.

## Web Push notifications

- The existing `notifications` row remains the canonical message; Web Push is an additive delivery transport.
- `web_push_subscriptions` and `web_push_deliveries` have RLS enabled and no authenticated table grants. Only narrow own-device RPCs expose registration state.
- Registration requires an active `admin`, `manager`, `staff` or `team` profile. Client profiles are rejected.
- VAPID private keys exist only as Supabase Edge Function secrets. Push endpoints and encryption key material are never returned to another user or included in logs.
- Delivery joins the notification recipient to that recipient's active device subscription. Manager status does not grant access to another user's personal reminders.
- Push failures do not remove in-app notifications. HTTP 404/410 endpoints are deactivated safely.

## Website enquiry intake transaction

- A reviewed `website_enquiry_endpoints` row binds one opaque intake key to the exact
  CG Websites identity, environment, canonical host, and Dynamics client. The browser
  cannot submit a trusted client, site, environment, recipient, workflow state, or
  synthetic/reporting classification.
- Activated form schemas are immutable, versioned, and validate stable field keys.
  Display labels may change between versions without changing the stored answer keys.
- `submit_website_enquiry` is a service-role-only, SECURITY INVOKER transaction. It
  resolves all trusted identity and the current approved recipient configuration on
  the server, then creates the client-scoped contact, distinct enquiry, pending outbox
  jobs, and one canonical `generate_lead` event before returning a receipt.
- Idempotency is scoped to the resolved endpoint. An identical replay returns the
  existing receipt; reuse of the same submission key with different canonical answers
  or attribution raises a conflict. Email identity is never deduplicated across clients.
- Approved recipient configurations and routes are immutable. M2A records delivery
  intent only; it does not send email, select a provider, or expose recipient addresses
  to the public browser.
- Preview and staging classification is derived from the reviewed endpoint environment,
  so non-production submissions are marked synthetic in the reporting event without
  trusting browser input.
