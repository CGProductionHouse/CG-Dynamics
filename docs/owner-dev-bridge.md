# CG Dynamics Owner Dev Bridge

Status: implemented on `feat/owner-dev-bridge`; remote activation requires owner-controlled OAuth, GitHub App and companion Vercel project configuration.

## Purpose

The Owner Dev Bridge is a separate development control plane for building CG Dynamics. It does not replace the embedded CG Assistant and is not a second product backend.

The service lives in `dev-bridge/` and exposes a stateless remote MCP endpoint at `/mcp`. It operates only against `CGProductionHouse/CG-Dynamics` through explicit APIs and isolated GitHub Actions. It never exposes a raw terminal.

## Architecture

```text
ChatGPT custom MCP app
  -> OAuth 2.1 access token (established identity provider)
  -> dedicated dev-bridge Vercel project
  -> owner subject allowlist + dev:read/dev:write scopes
  -> narrow MCP tools
     -> dedicated least-privilege GitHub App
     -> GitHub branches/commits/PRs/Actions
     -> Vercel deployment diagnostics
     -> fixed read-only Supabase catalog diagnostics
```

The existing Vite application remains unchanged and continues using Supabase as its only product backend. The companion service has its own Vercel root directory and dependencies.

The companion includes a minimal no-index static root page because Vercel's Node project packaging requires a `public` output directory. The development API remains in serverless functions and `/mcp` still requires owner authentication.

## Tools

Read-only:

- `dev_repo_status`
- `dev_list_files`
- `dev_search_code`
- `dev_read_file`
- `dev_get_diff`
- `dev_recent_commits`
- `dev_get_check_result`
- `dev_get_deployments`
- `dev_get_build_logs`
- `dev_db_schema`

Normal development writes:

- `dev_create_branch`
- `dev_apply_changes`
- `dev_run_check`
- `dev_create_pr`

`dev_apply_changes` creates one atomic Git commit from up to 20 bounded file changes. It requires the exact branch head SHA inspected by the caller, so concurrent changes fail closed rather than being overwritten.

The bridge deliberately has no tool for:

- arbitrary shell commands;
- arbitrary SQL;
- environment or secret values;
- direct default-branch writes;
- PR merge;
- production deployment/promotion;
- migrations or production data writes;
- auth, permission or secret changes.

## Risk model

Low risk tools are annotated read-only and run normally after authentication.

Normal development writes require the `dev:write` OAuth scope and a valid scoped branch (`feat/`, `fix/`, `docs/`, `test/`, or `chore/`). The normal path is inspect, branch, edit/commit, validate, inspect diff, preview, and draft PR.

High-impact operations are not merely confirmation-gated in this first release. They are absent or hard-denied. Production deploy, merge, database writes, migrations, auth/permissions, secrets and protected control-plane files require a separately reviewed human workflow.

## Authentication

The bridge is an OAuth 2.1 resource server. It publishes RFC 9728 protected-resource metadata at:

```text
https://<bridge-host>/.well-known/oauth-protected-resource/mcp
```

Use an established identity provider that supports MCP OAuth requirements. OpenAI currently recommends this over implementing an authorization server from scratch. Auth0 is the documented reference option.

The access token must pass all checks:

- valid signature from configured JWKS;
- exact issuer;
- exact MCP audience/resource;
- expiry and maximum age;
- `dev:read` scope;
- immutable provider `sub` in `OWNER_BRIDGE_ALLOWED_SUBJECTS`;
- `dev:write` scope for mutation tools.

Email, Auth metadata, request claims such as `owner=true`, and ordinary CG Dynamics staff sessions are not authorization. CG Dynamics has no canonical database `owner` role, so the bridge uses a separate immutable identity-provider subject allowlist.

## Required server configuration

Create a dedicated Vercel project with repository root `dev-bridge`. Configure the names from `dev-bridge/.env.example` in Vercel. Never add values to the main Vite environment or commit them.

Scope all bridge credentials to the protected production environment only. Do not expose OAuth, GitHub App, Vercel or Supabase credentials to branch preview deployments. Control-plane changes under `dev-bridge/`, `.github/`, root execution configuration and `scripts/` are themselves protected from bridge writes and require ordinary human-reviewed development.

### OAuth provider

Required:

- `OWNER_BRIDGE_PUBLIC_URL`
- `OWNER_BRIDGE_OAUTH_ISSUER`
- `OWNER_BRIDGE_OAUTH_AUDIENCE` (the exact `/mcp` resource)
- `OWNER_BRIDGE_OAUTH_JWKS_URI`
- `OWNER_BRIDGE_ALLOWED_SUBJECTS`

Configure authorization-code flow with PKCE S256, OAuth metadata discovery, exact ChatGPT redirect URI, resource indicator propagation, and the `dev:read`/`dev:write` scopes. Use CIMD where the provider supports it; otherwise use DCR or the predefined client configured in ChatGPT.

### GitHub App

Install a dedicated app only on `CGProductionHouse/CG-Dynamics`.

Recommended repository permissions:

- Contents: read/write
- Metadata: read
- Pull requests: read/write
- Actions: read/write
- Checks: read
- Deployments: read

Do not grant Administration, Environments, Secrets, Members, Organization Administration, or package permissions.

Set:

- `OWNER_BRIDGE_GITHUB_APP_ID`
- `OWNER_BRIDGE_GITHUB_INSTALLATION_ID`
- `OWNER_BRIDGE_GITHUB_PRIVATE_KEY`

### Optional diagnostics

Vercel diagnostics require a token restricted to the CG Dynamics project/team plus project/team IDs.

Supabase live schema diagnostics require a management access token and project ref. The model can select only a fixed diagnostic enum. It cannot supply SQL, table names, predicates or mutation statements. If a genuinely read-only Supabase role becomes available later, prefer it over a broad management token.

## Audit and limits

Every tool call writes a structured host log containing timestamp, request ID, immutable actor subject, tool, risk, target, outcome and duration. It excludes token values, source contents and raw arguments. GitHub commits, Actions runs and PRs provide additional durable write evidence. Before production activation, configure a protected Vercel log drain or equivalent owner-controlled retention sink so read-only calls are not dependent on short-lived serverless log retention.

The service enforces:

- 1 MB request limit;
- 30 authenticated requests per subject per warm instance/minute;
- strict path traversal and secret-path blocking;
- output and line limits;
- 250 KB per changed file;
- 20 files per atomic commit;
- external request timeouts;
- secret-pattern redaction;
- CG Dynamics repository/project/preview allowlists.

Configure a Vercel Firewall rate rule for the `/mcp` endpoint before production activation because in-memory serverless limits are defense-in-depth, not a global distributed quota.

## Validation runner

`.github/workflows/owner-dev-bridge.yml` accepts one enum action only:

- `typecheck`
- `lint`
- `test`
- `build`
- `full`
- `browser`

There is no command or shell input. The workflow has read-only repository permissions and a 25-minute limit.

Each bridge dispatch includes an opaque correlation ID in the workflow run name. GitHub's dispatch endpoint returns no run body, so `dev_run_check` resolves the asynchronously created run when possible and always returns the correlation ID; `dev_get_check_result` accepts either that ID or the numeric GitHub run ID.

The browser action accepts only the production CG Dynamics host or the exact CG Dynamics Vercel preview naming family. It checks desktop and iPhone viewports, HTTP status, protected-route redirection, page/console errors, horizontal overflow and screenshots.

The committed workflow intentionally performs unauthenticated route/security and visual smoke checks only. Reusable credentials are never passed to branch-controlled code or preview deployments. Authenticated automation remains gated until a one-time, preview-isolated QA identity and trusted harness can be provisioned without creating credentials that branch code could capture. CA's or another staff member's password must never be used.

## Immediate value

The repository gains focused bridge CI plus application typecheck/build checks on PRs and `main` immediately after this work lands. The dispatch workflow also exposes the existing full lint/test suite as explicit diagnostics. Any pre-existing baseline failures remain visible rather than being suppressed or misreported as bridge failures.

The bridge itself can be run locally and tested with MCP Inspector. Remote read/write tools become usable after the companion Vercel project, OAuth provider and GitHub App are configured.

## ChatGPT availability as of 30 August 2026

OpenAI currently documents full custom MCP, including write/modify tools, as a beta for ChatGPT Business, Enterprise and Edu on ChatGPT web.

- Business: workspace admins/owners enable developer mode and deploy the custom app.
- Enterprise/Edu: developer mode can be assigned through RBAC; admins/owners publish.
- Personal Plus: OpenAI does not currently document developer mode or arbitrary custom MCP access. Do not represent it as available.
- Mobile and desktop: the current custom-MCP article says web only. Ordinary approved plugins/apps may have broader client availability, but that does not enable this custom MCP.
- Write actions remain subject to ChatGPT confirmation, app permissions and safety controls; especially risky actions may be blocked.

These client limitations do not change the server architecture. Once OpenAI enables the same custom MCP actions on personal/mobile clients, the remote endpoint and OAuth contract can be used without rebuilding the development tools.

Official references:

- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/plugins/build/auth
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta
- https://platform.openai.com/docs/mcp

## ChatGPT connection

After remote activation:

1. In an eligible Business/Enterprise/Edu web workspace, enable developer mode.
2. Add a custom MCP app using `https://<bridge-host>/mcp`.
3. Complete OAuth as the allowlisted owner identity.
4. Review the discovered tools and scopes.
5. Run read-only status/search/read tests first.
6. Create a test branch, apply a harmless documentation change, run checks and inspect the diff.
7. Refresh tool metadata after schema changes.

Use MCP Inspector against the same URL before connecting ChatGPT.

## Remaining activation gates

- Provision the established OAuth provider/client and owner subject.
- Create/install the least-privilege GitHub App.
- Create the isolated `dev-bridge` Vercel project and set server secrets.
- Add a Vercel Firewall rate rule.
- Configure a protected durable audit-log drain/retention sink.
- Provision a one-time, preview-isolated QA identity and trusted harness before enabling authenticated browser automation.
- Optionally provide read-only Vercel/Supabase diagnostic credentials.
- Validate the protected preview with MCP Inspector, then connect from an eligible ChatGPT web workspace.

No production database migration is required by this bridge implementation.
