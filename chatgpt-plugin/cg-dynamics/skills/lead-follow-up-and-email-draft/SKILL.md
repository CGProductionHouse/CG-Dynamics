---
name: lead-follow-up-and-email-draft
description: Use for business-development lead research, status and follow-up, and a governed DRAFT-ONLY email workflow. Gmail remains the real draft system; staff manually verify the correct CG From identity and approved signature and manually send. This skill never sends.
---

# Lead Follow-up & Email Draft (DRAFT ONLY)

Business-development lead workflow plus a **draft-only** email step. Lead data comes from
the CG Dynamics MCP connection; the actual email draft lives in **Gmail**. This skill
prepares a draft for the staff member to review — it **never sends** and never asserts a
send happened.

## Trigger / user goal

- "Research this lead and draft the follow-up email."
- "What's the status of <lead> and what's the next follow-up?"

## Required inputs

- The exact lead (resolved via the MCP connection) owned by the signed-in staff member.
- The signed-in staff identity (for ownership scope and the correct CG From identity).

## Tool sequence (workflow level)

1. Resolve the exact **lead** and its current status/history via the MCP connection,
   scoped to the signed-in staff member's owned leads.
2. Summarise research/status and the recommended next follow-up step.
3. Prepare a **draft** follow-up email (subject + body) grounded only in resolved lead
   facts. Create it as a Gmail **draft** where that tool is available; otherwise present
   the draft text for the staff member to paste.
4. Hand off for manual review — do not send.

## Output contract

- Lead summary: who, current status, last touch, recommended next step.
- A ready-to-review email draft (subject + body), professional CG tone, no invented facts.
- An explicit review checklist the staff member must complete **before** sending manually:
  - correct **CG From identity** for this client/context;
  - correct, **approved signature**;
  - recipient address and any attachments;
  - no unverified claims, prices, or commitments.

## Facts the model must not infer

- Lead contact details, deal terms, prices, or history not returned by the connection.
- The correct From identity/signature — flag it for manual verification; do not assert it.
- That an email was sent — it was not; this skill stops at draft.

## When to ask / stop

- Ambiguous lead, or a lead not owned by the signed-in staff member → ask/decline; stay in
  exact-staff ownership scope.
- Any instruction to actually send, schedule-send, or auto-reply → **refuse**; restate that
  this is draft-only and the staff member sends manually after verifying identity/signature.
- No connection / no Gmail draft tool → provide the draft text and say it wasn't saved.

## Boundaries

- **DRAFT ONLY. No send action, ever.** Gmail is the real mail system; this never becomes a
  parallel mailer or a shadow CRM.
- Exact-staff ownership scope; never act on another staff member's leads or identity.
- No lead/contact values are frozen into this skill — always retrieve them live.
