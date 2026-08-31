# CG Dynamics Status

Last updated: 2026-08-31 SAST

## Current product state

- GitHub `main` is the committed source of truth.
- CG Assistant V2 remains active under Issue #208. PR #209 is merged, but real iPhone acceptance found additional conversation, voice, Markdown, progress and composer defects recorded on #208.
- Held Meta Sync PR #202 remains untouched.
- Client Schedule (`monthly_deliverables`) and CG Calendar remain separate.
- Microsoft remains read-only upstream.

## Owner Dev Bridge

Branch `feat/owner-dev-bridge` introduces an isolated remote MCP development control plane under `dev-bridge/`.

Implemented:

- OAuth 2.1/JWKS owner authentication and immutable subject allowlist;
- stateless Streamable HTTP MCP endpoint;
- CG Dynamics repository status/list/search/read/diff/history tools;
- scoped branch creation and atomic branch commits;
- allowlisted GitHub Actions validation/browser runner;
- draft PR creation;
- Vercel deployment/build diagnostics;
- fixed read-only Supabase schema/RLS/policy/function/migration diagnostics;
- path traversal, protected-path, secret redaction, timeout, payload and rate safeguards;
- structured tool audit logs;
- PR/main CI and focused security/transport tests.

Not activated remotely yet:

- owner OAuth provider/client;
- dedicated least-privilege GitHub App;
- isolated Vercel companion project and firewall;
- protected durable audit-log drain/retention sink;
- optional Vercel/Supabase diagnostics credentials;
- safe one-time preview-isolated authenticated browser QA mechanism;
- ChatGPT custom MCP connection.

These require owner-controlled external credentials/configuration. Current OpenAI availability is documented separately in `docs/owner-dev-bridge.md`.

## Production impact

- Production SQL/data mutation: none.
- Supabase migration: none.
- Production deployment/promotion: none.
- Secrets/auth/provider configuration changed: none.
- Meta PR #202 changed: no.
