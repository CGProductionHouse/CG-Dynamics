# CG Dynamics — private ChatGPT plugin package

Packaging + skills layer for the private CG Production House ChatGPT workspace
integration. Issue **#314**. Isolated, non-overlapping lane: **no** MCP runtime, OAuth,
OneDrive, migrations, Supabase functions, or production changes live here.

Live data, authorization and all actions come from the registered **CG Dynamics MCP**
connection (built by the #311/#313 runtime lane and #307 OneDrive/OAuth lane). This
package only supplies the plugin manifest and the workflow **skills** that shape how staff
use those tools.

## Layout

```
chatgpt-plugin/cg-dynamics/
  .codex-plugin/plugin.json          # required manifest (identity, capabilities, prompts, skills path)
  README.md                          # this file
  CONNECTION-HANDOFF.md              # final steps after the real MCP connection exists
  skills/
    staff-assistant-daily-ops/       # bootstrap, today view, work queue, daily brief
    client-context-and-content/      # exact-client context + Human Creative Standard + contacts/footer
      references/human-creative-standard.md
    content-run-closeout/            # plan vs captured, upload VERIFIED/MISSING/PARTIAL/UNVERIFIED (abstract MCP contract)
    lead-follow-up-and-email-draft/  # lead follow-up + DRAFT-ONLY email
  acceptance/GOLDEN-PROMPTS.md       # representative positive + negative/boundary prompts
```

## Design principles

- **Focused skills, not one instruction dump.** Each `SKILL.md` defines trigger, inputs,
  workflow-level tool sequence, output contract, facts-not-to-infer, when to ask/stop, and
  exact-client / exact-staff boundaries.
- **Live-source-first.** No mutable tasks, leads, contacts, prices, schedules, or OneDrive
  IDs are frozen into the package — always retrieved live from the MCP connection.
- **No shadow systems.** Planner/Work, CG Calendar, Client Schedule, client intelligence,
  OneDrive and Gmail remain their own authorities; skills orchestrate, never duplicate.
- **Draft-only email.** Gmail is the real mailer; the lead skill never sends.

## Intentionally missing

The real `.app.json` MCP mapping and the `apps` manifest field are **deliberately absent**
until the live CG Dynamics MCP connection is created in ChatGPT Developer mode and a real
`plugin_asdk_app...` technical ID exists. See `CONNECTION-HANDOFF.md`.

## Boundaries (do not change here)

`supabase/functions/cg-dynamics-mcp/*`, OneDrive/OAuth implementation, migrations/schema,
and anything owned by #311/#313/#307. This lane is packaging, skills, metadata, validation
and connection handoff only.
