# CG Dynamics Owner Dev Bridge

Status: deployed fail-closed on `feat/owner-dev-bridge`; authenticated activation requires owner-controlled OAuth and GitHub App configuration.

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

## Current remote state

Verified on 1 September 2026:

- production endpoint: `https://dev-bridge-kappa.vercel.app/mcp`;
- health endpoint: `https://dev-bridge-kappa.vercel.app/health`;
- Vercel project: `cg-dynamics-projects/dev-bridge`;
- repository integration: `CGProductionHouse/CG-Dynamics`, root directory `dev-bridge`, production branch `main`;
- production deployment `dpl_6s65tVcjxbwyY6yJmyxsT9wQh5HT`: READY;
- `OWNER_BRIDGE_PUBLIC_URL` is configured only in production as a non-secret;
- anonymous MCP initialization returns `401` with the correct RFC 9728 discovery challenge;
- MCP Inspector CLI reaches the endpoint and reports `auth_required` rather than a transport/server failure;
- the live WAF rule matches exactly `/mcp` and enforces 30 requests per IP per 60-second fixed window; a 35-request probe returned 29 `401` responses followed by 6 `429` responses because one request had already consumed the same window;
- private production-only Vercel Blob store `cg-dynamics-owner-dev-audit` (`store_WtZpOHplAIANmBoD`) is connected for durable audit retention through rotating Vercel OIDC credentials;
- production resolves `BLOB_STORE_ID` and Vercel OIDC with no static Blob token; a local SDK write was rejected as the disallowed `development` environment, confirming the production-only access boundary;
- no OAuth, GitHub App, Vercel diagnostic, Supabase diagnostic or long-lived Blob secret is configured.

The endpoint is intentionally not usable for authenticated tools until the mandatory identity gates below are complete. Missing provider configuration fails closed; it is not replaced with development credentials or a weaker authentication mode.

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

Preserve the authorization server's issuer exactly as advertised by its discovery document, including any trailing slash. ChatGPT validates that identifier as an exact string. Request `offline_access` and configure refresh-token issuance so the connection survives access-token expiry.

The smallest remaining owner action is to create or select an Auth0 tenant and configure one API:

1. Open `https://manage.auth0.com/` and create an API named `CG Dynamics Owner Dev Bridge`.
2. Set its identifier/audience to exactly `https://dev-bridge-kappa.vercel.app/mcp`, signing algorithm RS256, and add permissions `dev:read` and `dev:write`.
3. In the API settings, enable **Allow Offline Access** and the **Resource Parameter Compatibility Profile** so ChatGPT can request refresh tokens and RFC 8707's `resource` value becomes the token audience.
4. Set that API identifier as the tenant default audience so Auth0 issues a locally verifiable RS256 JWT.
5. In tenant settings, enable **Client ID Metadata Document Registration**. Import the exact ChatGPT client metadata URL shown by ChatGPT app management; use `https://chatgpt.com/oauth/client.json` only when that page confirms the stable-client mode.
6. Grant that CIMD client authorization-code and refresh-token grants, user-delegated access to both bridge permissions, and assign both permissions to CA's Auth0 user. Ensure the issued access token contains the space-delimited `scope` claim.
7. Record the exact discovery-document issuer and CA user's immutable Auth0 `user_id` (`sub`). Do not remove the issuer's trailing slash and do not use email as the allowlist value.
8. Add the issuer, exact audience, tenant JWKS URL and immutable subject to the four corresponding production-only Vercel variables. No Auth0 client secret belongs in this bridge when CIMD/PKCE is used.

The app management page's exact client metadata and redirect URLs override generic examples. OpenAI currently uses `https://chatgpt.com/connector_platform_oauth_redirect` only when the authorization server fully supports RFC 9207 issuer identification; otherwise it supplies a callback-specific URL.

### GitHub App

Create the dedicated app under the `CGProductionHouse` GitHub user account and install it only on `CGProductionHouse/CG-Dynamics`.

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

GitHub confirms that `CGProductionHouse` is a user account (not an organisation), the signed-in identity has repository admin permission, and personal GitHub App registration is available. App creation, installation and private-key generation are still confirmation-gated credential actions. The current GitHub CLI token has `repo`, `workflow` and `read:org` scopes but cannot create or enumerate GitHub Apps. The smallest remaining owner action is:

1. Open `https://github.com/settings/apps/new` while signed in as `CGProductionHouse`.
2. Create `CG Dynamics Owner Dev Bridge`, use `https://dev-bridge-kappa.vercel.app` as its homepage, disable webhooks and allow installation only on this account.
3. Grant only Contents read/write, Pull requests read/write, Actions read/write, Checks read and Deployments read. Leave all organisation, administration, environment, secret, member and package permissions unset.
4. Install it only on `CGProductionHouse/CG-Dynamics` and generate one private key.
5. Add the App ID and installation ID to their production-only Vercel variables and add the private key as a sensitive production-only variable. Delete any workstation copy after Vercel confirms the value is stored.

### Optional diagnostics

Vercel diagnostics require a token restricted to the CG Dynamics project/team plus project/team IDs.

Supabase live schema diagnostics require a management access token and project ref. The model can select only a fixed diagnostic enum. It cannot supply SQL, table names, predicates or mutation statements. If a genuinely read-only Supabase role becomes available later, prefer it over a broad management token.

## Audit and limits

Every tool call writes a structured host log and one private durable JSON record containing timestamp, request ID, immutable actor subject, tool, risk, target, outcome and duration. It excludes token values, source contents and raw arguments. Each record has a unique date/request path, cannot overwrite an existing object, and must persist before the tool returns. Tool execution fails closed before work begins when the production Blob/OIDC binding is unavailable. GitHub commits, Actions runs and PRs provide additional durable write evidence.

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

This rule is active on the isolated companion project. Vercel counters are per region and per IP on the connected Hobby plan; the authenticated in-process subject limit remains defense-in-depth behind it.

The connected Vercel team is confirmed as Hobby. Vercel Drains are available only on paid Pro/Enterprise plans, so the bridge instead uses the private `cg-dynamics-owner-dev-audit` Blob store in `iad1`. Hobby Blob is free within its included limits and stops accepting access rather than creating overage charges. The store is connected only to the isolated bridge production environment. The official Blob SDK uses Vercel's rotating OIDC token plus `BLOB_STORE_ID`; the CLI-created long-lived `BLOB_READ_WRITE_TOKEN` was removed immediately. Preview/development deployments have no store binding, and the bridge exposes no audit-read or audit-delete MCP tool. Store retention and any owner deletion remain controlled in the Vercel project.

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

## ChatGPT availability as of 1 September 2026

OpenAI currently documents full custom MCP, including write/modify tools, as a beta for ChatGPT Business, Enterprise and Edu on ChatGPT web.

- Business: workspace admins/owners enable developer mode and deploy the custom app.
- Enterprise/Edu: developer mode can be assigned through RBAC; admins/owners publish.
- The signed-in CG Production House Personal Plus account now shows a Developer mode switch on ChatGPT web, but it is off and no CG Dynamics custom app has been added. This observed UI does not override OpenAI's public plan documentation or guarantee write-tool access; complete the connection test before treating Plus as an activated client.
- Mobile and desktop: the current custom-MCP article says web only. Ordinary approved plugins/apps may have broader client availability, but that does not enable this custom MCP.
- Write actions remain subject to ChatGPT confirmation, app permissions and safety controls; especially risky actions may be blocked.

These client limitations do not change the server architecture. Once OpenAI enables the same custom MCP actions on personal/mobile clients, the remote endpoint and OAuth contract can be used without rebuilding the development tools.

Official references:

- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/plugins/build/auth
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta
- https://platform.openai.com/docs/mcp

## ChatGPT connection

After remote activation:

1. In ChatGPT web, enable developer mode for the owner account/workspace. The current CG Production House Plus account exposes this switch under Settings > Security, but it remains owner-controlled and must be tested for write-tool support.
2. Add a custom MCP app using `https://<bridge-host>/mcp`.
3. Complete OAuth as the allowlisted owner identity.
4. Review the discovered tools and scopes.
5. Run read-only status/search/read tests first.
6. Create a test branch, apply a harmless documentation change, run checks and inspect the diff.
7. Refresh tool metadata after schema changes.

Use MCP Inspector against the same URL before connecting ChatGPT.

Credential-free transport/authentication verification can be repeated with:

```powershell
npx --yes @modelcontextprotocol/inspector --cli `
  --server-url "https://dev-bridge-kappa.vercel.app/mcp" `
  --transport http --method tools/list --stored-auth-only --format json
```

Before OAuth is provisioned, the correct result is `auth_required`. After OAuth and the GitHub App are configured, complete interactive Inspector login, list all tools, call `dev_repo_status`, create a harmless test branch, run an allowlisted check and inspect its result before connecting ChatGPT.

## Remaining activation gates

- Provision the Auth0 API/CIMD client and immutable owner subject, then set its production-only Vercel configuration.
- Create/install the least-privilege GitHub App and set its production-only Vercel configuration.
- Provision a one-time, preview-isolated QA identity and trusted harness before enabling authenticated browser automation.
- Optionally provide read-only Vercel/Supabase diagnostic credentials.
- Complete authenticated MCP Inspector tool-list/read/write/check validation, then connect from an eligible ChatGPT web workspace.

Completed activation gates:

- isolated Vercel project deployed at the stable production URL;
- GitHub repository integration with `dev-bridge` root and `main` production branch;
- production-only canonical public URL;
- public root and health endpoint verification;
- correct unauthenticated OAuth challenge and fail-closed behavior;
- live and measured WAF rate limiting;
- credential-free MCP Inspector transport/authentication handshake;
- production-only private Blob durable audit store with OIDC-only application access and fail-closed tool preflight.

No production database migration is required by this bridge implementation.
