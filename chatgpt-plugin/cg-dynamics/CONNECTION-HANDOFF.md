# Connection handoff — CG Dynamics ChatGPT plugin

This package (manifest + skills + golden prompts) is complete **except** the real MCP
connection mapping, which cannot exist until the live CG Dynamics MCP endpoint is created
in ChatGPT. The steps below are the only remaining work after Codex finishes the
MCP/runtime lanes (#311/#313) and the OneDrive/OAuth lane (#307).

Do **not** perform these steps as part of this packaging lane, and do **not** commit any
connector ID, OAuth secret, or production credential to the repo.

## Remaining steps (in order)

1. **Deploy / verify the real CG Dynamics MCP endpoint** (owned by the #311/#313/#307
   lanes). Confirm it is reachable and staff-authenticated.
2. **Create the custom MCP connection** in ChatGPT **Developer mode** for the CG Dynamics
   MCP endpoint.
3. **Copy the resulting real `plugin_asdk_app...` technical ID** that ChatGPT assigns to
   that connection.
4. **Create `.app.json`** in this package (`chatgpt-plugin/cg-dynamics/.app.json`) mapping
   the plugin to that **exact real** technical ID. Never use a placeholder/fake ID.
5. **Wire `apps: "./.app.json"`** into `.codex-plugin/plugin.json` if the tooling requires
   the field (it is intentionally omitted now so no fake mapping ships).
6. **Install from the personal/private source** and run every prompt in
   `acceptance/GOLDEN-PROMPTS.md` against the live connection, confirming the positive and
   negative/boundary behaviours. Connect **once**, with the communal CG Dynamics admin login
   (`info@cgproductionhouse.com`) — there is deliberately **no per-staff connector**. Then
   verify per-Project scoping (#319): a staff Project returns that staff member's data, a
   client Project returns only that client, and switching Projects does not carry context
   over. See `../PROJECT-CONTEXT.md`.
7. **Only then publish/enable** for the CG Production House company workspace.

## Intentionally missing artifact

- `.app.json` and the `apps` manifest field are **deliberately absent**. Their absence is
  the expected state of this PR. They are added only at step 4–5 above with the real ID.

## Guardrails

- No fake connector IDs, no `plugin_asdk_app...` placeholders that could be mistaken for real.
- No OAuth secrets or production credentials in the repo.
- This package does not create the live connector, deploy, or change permissions.
