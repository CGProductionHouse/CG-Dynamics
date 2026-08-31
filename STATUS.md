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

Remote endpoint: `https://dev-bridge-kappa.vercel.app/mcp`

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
- structured host logs plus production-only private Blob audit retention using rotating Vercel OIDC credentials;
- PR/main CI and focused security/transport tests;
- isolated production Vercel companion project connected to the GitHub repository with root `dev-bridge`;
- production-only canonical public URL configuration;
- live Vercel WAF fixed-window limit of 30 `/mcp` requests per IP per 60 seconds;
- remote root and `/health` availability, anonymous OAuth challenge, WAF enforcement and MCP Inspector unauthenticated-handshake verification.

Remote state is deployed but intentionally fail-closed. Authenticated tools are not active yet because these owner-controlled gates remain:

- owner OAuth provider/client;
- dedicated least-privilege GitHub App;
- optional Vercel/Supabase diagnostics credentials;
- safe one-time preview-isolated authenticated browser QA mechanism;
- ChatGPT custom MCP connection.

The OAuth and GitHub App credentials do not exist in connected access and cannot be created by the current GitHub token. Current OpenAI availability and the exact remaining owner actions are documented in `docs/owner-dev-bridge.md`.

## Production impact

- Production SQL/data mutation: none.
- Supabase migration: none.
- Main CG Dynamics production deployment/promotion: none.
- Isolated Owner Dev Bridge production deployment: `dpl_8PusXuZKwSqpeYHsMzEtQV57EJhw`, READY.
- Secrets/auth/provider configuration changed: no owner/provider or long-lived Blob secret configured; the non-secret bridge public URL, WAF rule and production-only private Blob/OIDC store binding were added.
- Meta PR #202 changed: no.
