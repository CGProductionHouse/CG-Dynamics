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

## Third-party integrations

- Meta: OAuth flow through Edge Functions, tokens stored server-side.
- Google Ads: OAuth flow through Edge Functions, tokens stored server-side.
- Microsoft: Edge Function with isolated service-role access, no client exposure.
