# Manual Action Guidance Rule

Last updated: 28 July 2026

This rule is part of the CG Dynamics delivery workflow.

Whenever CA must complete a manual action outside ChatGPT or a coding agent, the handoff must include:

- the exact application or website;
- the exact page or direct link where possible;
- the exact tab or section;
- the exact button or menu item to select;
- the expected result after the action;
- whether CA should stop and send a screenshot before continuing;
- any risk, irreversible effect or prerequisite that matters.

Do not say only “merge it”, “open GitHub”, “deploy it”, “check Vercel” or similar vague instructions.

If the manual interface state is uncertain, ask for or inspect a screenshot before sending CA through another loop.

This applies to GitHub, Supabase, Vercel, Microsoft, Meta, Google, Adobe, DNS, hosting and any other external system used by CG Dynamics.
