# Connection handoff — CG Dynamics ChatGPT plugin

**Status: the canonical company connection now exists and Project-context resolution is proven live.** The CG Dynamics MCP is deployed to production and the communal connector has been recreated inside the actual CG Production House ChatGPT account, so the canonical company-owned technical app ID is wired into `.app.json`. The resolver acceptance test has succeeded for Franco; the remaining work is the full bootstrap/golden-prompt acceptance pass and workspace enablement.

Never commit an OAuth **secret**, client id, or callback URL to the repo. The technical app ID below is a non-secret connection identifier.

## Steps

1. ✅ **Deploy / verify the real CG Dynamics MCP endpoint.** Deployed to project
   `ehtjfntukiwbgptqgbzy` with OAuth discovery live (protected-resource metadata + Bearer
   challenge).
2. ✅ **Create the custom MCP connection** in ChatGPT **Developer mode**, signed in once as
   the shared company admin (`info@cgproductionhouse.com`).
3. ✅ **Canonical company-account technical ID assigned:** `plugin_asdk_app_6aa1d01bafe081918b5738396d72ff17`.
4. ✅ **`.app.json` updated** with that exact company-account ID — no placeholder, no per-staff or
   per-client app ids.
5. ✅ **`apps: "./.app.json"`** remains wired into `.codex-plugin/plugin.json`.
6. ✅ **Project-context resolver acceptance proven live:** in `Franco CG Assistant`,
   `resolve_project_context` returned exact staff context
   `{"context_kind":"staff","staff_profile_id":"479f2789-3699-4f74-933c-b93fd2062e09"}`.
   This proves the communal OAuth principal is no longer being used as Franco's staff identity.
7. ⏳ **Run the remaining prompts in** `acceptance/GOLDEN-PROMPTS.md` against the canonical
   company connection, including bootstrap/day read, company-admin read, client isolation,
   stale-context prevention and negative/boundary behaviour.
8. ⏳ **Only then publish/enable** for the CG Production House company workspace.

## Superseded connector IDs

The following earlier CG Dynamics app objects are superseded and must not be treated as canonical:

- `plugin_asdk_app_6aa1b2c996488191aa84714527880b0e` — stale company-account app object that retained the pre-#319 tool snapshot.
- `plugin_asdk_app_6aa1b73035948191bdb99d322521b977` — earlier development/personal-account connector used during implementation and #321 verification.

The canonical connector for the actual communal CG Production House ChatGPT account is now only:

`plugin_asdk_app_6aa1d01bafe081918b5738396d72ff17`

## One connection, many Projects

There is **exactly one** canonical connector for the whole communal ChatGPT account. Do **not** create
a second connector, a per-staff connector, or per-staff/per-client app ids. The OAuth
principal is the shared admin account and is only the *connection principal*; which staff
member or client a Project acts for comes from the per-call context contract in
`PROJECT-CONTEXT.md` (#319).

## Guardrails

- No OAuth secrets, client ids, or callback URLs in the repo. The technical app ID is a
  non-secret connection identifier.
- No placeholder ids that could be mistaken for real.
- Never reuse one Project's resolved context in another Project.
- Staff Project calls must use that exact staff profile id; client Project calls must use that exact client id; company-admin must be explicit.
