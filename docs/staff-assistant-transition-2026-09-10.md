# Staff Assistant transition — Teams-primary daily ops + CG-native content pipeline

> **SUPERSEDED IN PART — updated 10 September 2026 (#325).**
> CG Dynamics is **no longer** a fallback-only/cross-check source. Every normal Staff
> Assistant daily update MUST cross-reference **both** live Microsoft and CG Dynamics until
> CA explicitly ends coexistence. Teams/Planner and Outlook remain the *freshness authority*
> for Microsoft-backed records, but Dynamics is always read too: it holds the linked mirror
> plus Dynamics-only recurring/daily work, client/package/Client Schedule obligations,
> Content Runs, Guidelines, OneDrive mappings and leads context.
> The canonical machine-readable policy is returned by `get_my_assistant_bootstrap`
> (`supabase/functions/cg-dynamics-mcp/coexistencePolicy.ts`, versioned + effective-dated)
> and overrides any wording below that still says "fallback".

Effective: **10 September 2026**
Owner decision: CA

This document is a current operating override for Staff Assistant daily briefing and the Microsoft-to-Dynamics transition. It does not replace the durable CG Dynamics product model for clients, packages, Client Schedule, Content Runs, Content Guidelines or OneDrive.

## 1. Daily Staff Assistant source precedence during transition

Until CA explicitly confirms that staff task/calendar operations have fully moved from Microsoft into CG Dynamics:

### Primary live sources

- **Teams / Planner / connected Microsoft work sources** are the primary source of truth for staff task state.
- **Connected Microsoft calendar** is the primary source of truth for staff meetings/calendar commitments.
- The daily brief must read these live sources first whenever authorised and available.

### Dynamics role during transition

CG Dynamics is:

- the exact staff identity / Project-context authority;
- the canonical source for client/package data;
- the canonical source for `monthly_deliverables` / Client Schedule;
- the canonical source for Content Runs and Content Guidelines;
- the canonical source for content-production state and history;
- the canonical source for exact OneDrive mappings and upload/closeout evidence;
- a **mandatory cross-referenced source** for staff task/calendar data until cutover (#325). Not fallback-only.

A Dynamics-imported Microsoft task/calendar copy must not override a fresher live Microsoft state.

## 2. Daily brief behaviour from 10 September 2026

For each Staff Assistant Project:

1. Resolve the exact staff Project context through CG Dynamics.
2. Read the live Microsoft/Teams/Planner work state for that staff member.
3. Read the live Microsoft calendar for that staff member when available.
4. Read CG Dynamics for CG-native work: Client Schedule, package deliverables, Content Runs, Content Guidelines, leads/CRM context and content-production state.
5. Read Dynamics task/calendar mirrors **always** (#325): the linked mirror for reconciliation AND Dynamics-only work that has no Microsoft counterpart.
6. Deduplicate mirrored Microsoft work so one real task appears once.
7. If Microsoft and Dynamics disagree on a mirrored staff task/calendar item, prefer the live Microsoft state during this transition and flag Dynamics as stale.
8. The normal work queue shows **active work only**: To do / Not started, In progress, Waiting / Blocked, or another explicitly active state.
9. Done/completed/cancelled historical items stay in history but do not clutter the default daily queue.
10. An old due date alone is never evidence that a task is still outstanding.

## 3. Microsoft → Dynamics reconciliation and cleanup

The goal is for Dynamics to increasingly reflect Teams/Planner accurately while Microsoft remains the live staff task/calendar authority.

### Cleanup principle

Do **not** solve the current mess by blindly deleting history.

For Microsoft-imported task records:

- preserve completed history where useful/auditable;
- suppress completed/done/cancelled items from default active views and Staff Assistant daily queues;
- archive or mark historical completed mirrors where the current model supports it;
- ensure stale imported records cannot masquerade as active work;
- deduplicate multiple imported copies of the same Microsoft task using durable Microsoft identifiers where available;
- preserve direct links/source IDs needed for reconciliation;
- never infer completion from age or due date;
- never reopen a Microsoft-completed task because Dynamics has an older status.

### Sync expectation

- Staff Assistant daily briefing must read Microsoft live, so it does not depend on a stale Dynamics import.
- Dynamics should still reconcile from Microsoft frequently enough that the fallback view is useful and the CG Dynamics UI does not drift badly.
- At minimum, reconciliation must be available before/around the daily work cycle and on demand; implementation may add a safe recurring refresh cadence after verifying rate limits, pagination and idempotency.
- No Microsoft write-back is introduced by this decision.

## 4. CG-native content workflow should continue now

Do **not** wait for the full task/calendar migration before finishing the CG-native content production chain.

The intended canonical relationship is:

```text
Client
  -> active Package
    -> package deliverable entitlement/template
      -> Monthly Deliverable / Client Schedule item
        -> operational assignment / calendar task reference
        -> Content Run (where the deliverable is produced)
          -> canonical Content Guideline
            -> ordered video/content guideline items
          -> exact OneDrive dated/month folder mapping
            -> uploaded raw media evidence
          -> content-run closeout / reshoots / missed items
        -> downstream edit / approval / scheduled / published state
```

### Required linkage behaviour

For package-driven video/content work:

- Every future monthly deliverable must retain the exact `client_id`, package/template provenance and month.
- A real shoot/content-run item must be linked to the correct monthly deliverable(s), not matched by free-text title alone.
- The Content Run must link to one canonical Content Guideline in Dynamics.
- Individual planned videos/content items in the guideline should link to their originating deliverable where applicable.
- The Content Run must link to the exact authorised OneDrive folder for the client/month/run.
- One real shoot folder may contain footage for several videos from the same Content Run; do not create unnecessary per-video subfolders if that is not the real workflow.
- The operational task/calendar item should be able to navigate to the associated client, monthly deliverable, Content Run, Content Guideline and exact OneDrive evidence without duplicating those records.
- OneDrive IDs/URLs remain internal and must never leak to client-facing surfaces.
- Upload verification uses durable mapping, never folder-name guessing at runtime.
- Package changes affect future work only and must not destroy completed historical runs/guidelines.

### Calendar/task transition rule

While Microsoft remains the staff task/calendar source of truth:

- the Microsoft/Teams task may remain the live staff-facing work item;
- Dynamics should store/link the corresponding canonical client/package/monthly-deliverable/content records;
- imported/mirrored Microsoft identifiers should provide the bridge between the live task and the CG-native content record;
- when CG later moves staff task/calendar authority fully into Dynamics, the linked content records must already be usable without rebuilding the content model.

## 5. Staff Assistant output implication

A staff brief should therefore distinguish:

- **Microsoft live work** — what the staff member must actually do now;
- **CG-native content/client commitments** — package/Client Schedule/Content Run obligations that Dynamics owns;
- **Reconciliation warning** — where Dynamics mirrors are stale or an expected Microsoft task is missing;
- **Content-production readiness** — whether the correct guideline and OneDrive mapping exist for upcoming content work.

Do not dump every historical imported task into the staff brief.

## 6. Acceptance for transition readiness

The transition is behaving correctly when:

- a task marked complete in Microsoft no longer appears as active merely because its Dynamics mirror is stale;
- active Microsoft tasks appear once in the daily queue;
- If Microsoft is temporarily unavailable, use Dynamics but EXPLICITLY report degraded source coverage (#325) rather than implying the normal dual-source check happened;
- Client Schedule remains sourced from `monthly_deliverables` rather than Microsoft Planner;
- a package-driven monthly video deliverable can trace to its Content Run, Content Guideline and exact OneDrive mapping;
- upcoming staff briefs can show live work plus CG-native content obligations without mixing their source-of-truth boundaries;
- no client-facing response exposes raw OneDrive references.
