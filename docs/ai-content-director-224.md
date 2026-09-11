# AI Content Director (#224)

How a Content Run gets a genuinely client-specific Content Guideline, from the Client Schedule
through to the exact OneDrive production folder. This extends the existing canonical workflow —
there is no second guideline system, no second AI stack and no second schedule authority.

## The chain

```
Client Schedule (monthly_deliverables)   ← read-only here; never written by this flow
        ↓ video/reel slots in the coverage window
Content Run  ──(get_or_create_content_guideline)──▶  ONE canonical Content Guideline
        ↓                                                     ↓
exact OneDrive month folder                     ordered videos: "Video 01 - Descriptive Name"
(Clients/<Client>/Videos/<YYYY>/<YYYY_MM_MON>)   each with script, shot plan, requirements, CTA
```

## Naming: `Video 01 - Descriptive Name`

`src/lib/contentGuidelineNaming.ts` is the single source of that name.

- The number is the video's **1-based place in the saved order**, zero-padded. Reordering renumbers
  every surface at once, because the number is never stored in the title.
- The stored `title` holds only the descriptive name. A legacy prefix (`VIDEO 1 - DULUX`,
  `Video 02 — …`) is stripped when the name is shown; a real name that happens to start with a
  number (`Video 10 Tips for Painters`) is kept.
- The editor, the guideline brief, Shoot Mode and the client portal all call the same helper.
- The database already keeps the order canonical: `reorder_content_guideline_videos` rewrites both
  `position` and `video_number` as 1…n.

## Two reviewable AI steps

`supabase/functions/suggest-content-videos` gained two modes. The shipped single-pass `suggest`
mode is unchanged, so nothing that relied on it breaks.

### Step 1 — `ideas`: plan, don't write

Returns ordered, client-specific **ideas with no scripts**: title, objective, audience, hook,
angle, an optional Client Schedule slot link, a target month, evidence and anything to confirm.

Grounding, in layers:

1. **Exact-client truth** — the client's reviewed `client_guides` projection. The mode refuses to
   run (`CLIENT_CONTEXT_NOT_READY`, 409) when that projection is not `ready`, exactly like
   `get-client-context`. No sibling, group or generic fallback.
2. **Approved CG Marketing Library** — active skill cards for the relevant knowledge layers.
3. **Client Schedule + history** — the coverage window's slots, what the guideline already has,
   and this client's previously approved concepts.
4. **Fresh external research** — see below.

Every idea carries `evidence` labelled `client_fact`, `cg_knowledge`, `fresh_research`,
`inference` or `needs_confirmation`. **`fresh_research` is only kept when it cites a source URI
returned by this session's grounded search**; otherwise it is downgraded to `inference`. Ideas may
only link a real slot from this client's own schedule, each at most once.

### Step 2 — `develop`: write for what CA kept

Reads the guideline's **saved** videos — their saved order and CA's edits are the authority — and
writes the script, shot breakdown, requirements, visual direction and CTA per video. Titles and
order are never changed here.

Applying a draft in the editor:

- empty fields are filled;
- a field CA has already written is **never silently overwritten** — the card names the clashing
  fields and only an explicit "Replace my text" click overwrites them;
- drafts can be discarded without touching the guideline.

Accepting an idea also keeps its objective, hook, angle, audience and confirmation note. (The
previous accept path stored only title/script and dropped the rest, and it wrote a
`Script pending…` placeholder that could satisfy the publish check. Both are fixed: an accepted
idea has no script until step 2, and a placeholder script no longer counts as a script.)

### Fresh research and the trend rule

Research runs through the existing AI router with a new **optional, off-by-default `webSearch`**
flag. Only Gemini routes can serve it (Google Search grounding on the same API key), and the
grounding sources come back with the answer, so findings can be cited and audited.

Findings are **input, not truth**. The prompt requires each trend to be judged for relevance to
this client, brand-voice fit, practicality for CG to shoot, staleness, platform suitability and
music/claim risk — and says plainly that rejecting a trend is a valid outcome.

When no web-grounded provider is configured the step is skipped and the sources block says
`Live external research: NOT PERFORMED — no web-grounded AI provider is configured.`

## OneDrive: one month folder per run

`supabase/functions/content-run-onedrive-folder` links a run to its exact production folder.

- Canonical path: `Clients / <Client> / Videos / <YYYY> / <YYYY_MM_MON>` (e.g. `2026_09_SEP`).
  The month comes from the guideline's coverage month, falling back to the shoot date.
- **No per-video folders.**
- Identity is the durable Graph `driveId` + `itemId`. Names are matched only while an admin is
  linking, and the admin sees and confirms the result.
- The client folder is chosen by an admin from the real children of `Clients` — never guessed.
- A missing canonical year/month folder is created **only** on an explicit confirmed action, and
  create-only (Graph `conflictBehavior: fail`). Nothing renames, moves or deletes.
- Reads are staff-visible; every mapping write is admin-only, matching the existing
  `upsert_client_onedrive_mapping` / `upsert_content_run_onedrive_folder` RPCs.
- The run card checks on demand, so opening a run never calls OneDrive.

## What this flow must never do

- Write to `monthly_deliverables`. The Client Schedule is read-only here; a video links to a
  deliverable, and that is all.
- Create a second guideline per run, or a guideline store outside `content_guide_ideas`.
- Publish anything automatically, or overwrite a human edit.
- Rename, move or delete anything in OneDrive.
- Present another client's material, or invent client facts.

## Gates

| Capability | Gate |
|---|---|
| `ideas` / `develop` live | Deploy `suggest-content-videos` (CA approval) |
| Fresh research actually performed | A web-grounded provider key (Gemini) — production currently reports `PROVIDER_SECRET_MISSING` for Gemini and OpenAI |
| OneDrive month-folder linking | #225 rollout: app registration, secrets, deploy of the OneDrive functions, one-time consent (production has 0 stored tokens) |
| Live client test | Dulux (`client_guides` projection is `ready`) |
