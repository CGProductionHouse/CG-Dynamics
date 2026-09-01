# CG Dynamics Status

Last updated: 2026-09-01 17:00 SAST

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
- remote root and `/health` availability, anonymous OAuth challenge, WAF enforcement and MCP Inspector unauthenticated-handshake verification;
- exact OAuth issuer preservation for ChatGPT/Auth0 discovery compatibility;
- current signed-in ChatGPT web inspection: the CG Production House Plus account exposes Developer mode under Settings > Security, but the switch is off and no custom bridge app is connected.

Authenticated activation completed 1 September 2026:

- Auth0 API `CG Dynamics Owner Dev Bridge` (ID `6a969feab4bdb2e4434921a9`) with `dev:read`/`dev:write` scopes and offline access;
- Auth0 native app `Owner Dev Bridge Inspector` (Client ID `NLu4DYuvyCE31c6PFNaFDkmMQWPcqpw5`) with PKCE and callback `http://localhost:8765/callback`;
- immutable owner subject `google-oauth2|108057987235277623750` allowlisted;
- GitHub App `CG Dynamics Owner Dev Bridge` (App ID `4793002`, Client ID `Iv23liVDQNeBohbITL1d`) installed on `CGProductionHouse/CG-Dynamics` (Installation ID `158229182`);
- repository-scoped permissions: contents (read/write), pull requests (read/write), actions (read/write), checks (read), metadata (read);
- production credentials: `OWNER_BRIDGE_GITHUB_APP_ID`, `OWNER_BRIDGE_GITHUB_PRIVATE_KEY` (PKCS#8), `OWNER_BRIDGE_GITHUB_INSTALLATION_ID`;
- GitHub App JWT/installation token authentication verified locally (201, repo access confirmed);
- live production deployment `dpl_FGHyxUZHUdxZByXfqFCgCXxcoA8Y`: READY;
- `/health` returns `ok`, `/mcp` returns `401` OAuth challenge for unauthenticated requests;

Remaining before ChatGPT Developer mode connection:

- safe one-time preview-isolated authenticated browser QA mechanism;
- ChatGPT custom MCP connection.

## Production impact

- Production SQL/data mutation: none.
- Supabase migration: none.
- Main CG Dynamics production deployment/promotion: none (restored to `dpl_CpnTcou5wyaKsWzkv2Cr4KGoPQJx` after accidental deploy; verified `cg-dynamics.vercel.app` unchanged).
- Isolated Owner Dev Bridge production deployment: `dpl_FGHyxUZHUdxZByXfqFCgCXxcoA8Y`, READY at `https://dev-bridge-kappa.vercel.app`.
- Secrets/auth/provider configuration changed: GitHub App credentials (`OWNER_BRIDGE_GITHUB_APP_ID`, `OWNER_BRIDGE_GITHUB_PRIVATE_KEY`, `OWNER_BRIDGE_GITHUB_INSTALLATION_ID`) added as sensitive production-only variables; OAuth and WAF configuration unchanged.
- Meta PR #202 changed: no.
