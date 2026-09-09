# Connection handoff — CG Dynamics ChatGPT plugin

**Status: the connection now exists.** The CG Dynamics MCP is deployed to production and the
communal connector has been created and connected in the company ChatGPT account, so the
real technical app ID is wired into `.app.json` and referenced by the manifest's `apps`
field. Steps 1–5 below are **done**; only the acceptance run and workspace enablement remain.

Never commit an OAuth **secret**, client id, or callback URL to the repo. The technical app
ID below is a non-secret connection identifier.

## Steps (1–5 complete)

1. ✅ **Deploy / verify the real CG Dynamics MCP endpoint.** Deployed to project
   `ehtjfntukiwbgptqgbzy` with OAuth discovery live (protected-resource metadata + Bearer
   challenge).
2. ✅ **Create the custom MCP connection** in ChatGPT **Developer mode**, signed in once as
   the shared company admin (`info@cgproductionhouse.com`).
3. ✅ **Real technical ID assigned:** `plugin_asdk_app_6aa1b73035948191bdb99d322521b977`.
4. ✅ **`.app.json` created** with that exact real ID — no placeholder, no per-staff or
   per-client app ids.
5. ✅ **`apps: "./.app.json"`** wired into `.codex-plugin/plugin.json`.
6. **Install from the personal/private source** and run every prompt in
   `acceptance/GOLDEN-PROMPTS.md` against the live connection, confirming the positive and
   negative/boundary behaviours. Connect **once**, with the communal CG Dynamics admin login
   (`info@cgproductionhouse.com`) — there is deliberately **no per-staff connector**. Then
   verify per-Project scoping (#319): a staff Project returns that staff member's data, a
   client Project returns only that client, and switching Projects does not carry context
   over. See `../PROJECT-CONTEXT.md`.
7. **Only then publish/enable** for the CG Production House company workspace.

## One connection, many Projects

There is **exactly one** connector for the whole communal ChatGPT account. Do **not** create
a second connector, a per-staff connector, or per-staff/per-client app ids. The OAuth
principal is the shared admin account and is only the *connection principal*; which staff
member or client a Project acts for comes from the per-call context contract in
`PROJECT-CONTEXT.md` (#319).

## Guardrails

- No OAuth secrets, client ids, or callback URLs in the repo. The technical app ID is a
  non-secret connection identifier.
- No placeholder ids that could be mistaken for real.
