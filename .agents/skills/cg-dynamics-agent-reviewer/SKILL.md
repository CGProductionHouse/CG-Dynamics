---
name: cg-dynamics-agent-reviewer
description: Use when reviewing completed agent work (a branch, PR or diff) before merge — checking correctness, safety, source-of-truth integrity, build health and scope discipline.
---

# CG Dynamics Agent Reviewer

Gate agent work before it merges to `main`.

## Review checklist

**Build & bundle**
- `npm run build` passes.
- The emitted `dist/assets/*.js` actually contains app code (grep a known app
  string). A green exit with a vendor-only bundle is a FAIL.

**Source of truth**
- No new/duplicate schedule table. `monthly_deliverables` stays the one truth.
- Client Schedule remains the editor; client-ready calendar stays read-only.
- Shared helpers reused from `src/lib/planner.ts`, not re-copied.

**Safety**
- No Edge Function secrets / service-role keys / Meta tokens exposed, logged or
  committed. Client code uses only the publishable key.
- No live Supabase writes or SQL run without approval. Migration files are
  review-only.
- No ignored files committed (`.env.local`, `dist/`, `node_modules/`,
  generated artifacts).
- No guessed `client_id`; client links only on explicit save.

**Client-safe surfaces**
- Client-facing views hide assignees, helpers, notes, codes, priorities, IDs.

**Scope & quality**
- Diff matches the stated task; no unrelated rewrites.
- Empty/loading/error states present; mobile considered.
- TypeScript clean under `noUnusedLocals`/`noUnusedParameters`.
- Commit messages clear; branch focused.

## Output

A verdict (approve / request changes) with a ranked list of blocking issues
(file:line + concrete failure) separated from nice-to-haves. If nothing blocks,
say so plainly and note residual risks.
