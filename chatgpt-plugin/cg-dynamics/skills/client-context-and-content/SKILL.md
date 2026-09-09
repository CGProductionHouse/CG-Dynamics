---
name: client-context-and-content
description: Use to retrieve exact-client context and produce on-brand content (captions, ideas, poster/copy) under the Human Creative Standard, with canonical contacts/footer rules, no cross-client leakage, and live client facts instead of stale Project memory.
---

# Client Context & Content

Exact-client retrieval and content creation for CG Production House work. Live client
facts, the creative standard, and canonical contacts all come from the registered
**CG Dynamics MCP** connection at task time — never from frozen Project text.

## Trigger / user goal

- "Write a caption / content idea / poster copy for <client>."
- "What's the current context for <client> (or <client entity/branch>)?"
- Any content task that must sound like the exact client and use correct current contacts.

## Required inputs

- The exact `client` (and, where the client has entities/sub-brands/branches, the exact
  entity/branch scope). Ask if the client or scope is ambiguous.
- The task type (e.g. caption, content idea, poster copy, factual lookup).
- The supplied creative/brief/artwork context for the specific piece.

## Tool sequence (workflow level)

1. Resolve the **exact client** (and exact scope) via the MCP connection. Do not proceed
   on a fuzzy or sibling match.
2. Retrieve the **compact task-scoped client context packet** for that client + task type.
   It carries the exact-client voice, service facts, the Human Creative Standard, the
   anti-filler rules, the dynamic hashtag limit, and any caption-eligible contacts/footer.
3. Draft using only that packet plus the supplied creative context.
4. Apply the caption/footer contact rule exactly as the packet specifies; if a required
   contact is held/unresolved, follow the packet's fail-closed instruction (see below).

## Output contract

- Content in the exact client's voice, task-appropriate and compact — no generic AI filler.
- Hashtags only up to the packet's current maximum, chosen for the exact topic (never a
  fixed reused bank).
- Footer/contacts included only when the packet marks them caption-approved and current,
  in the packet's specified order/format.
- If context is insufficient, say what's missing rather than inventing it.

## Facts the model must not infer

- Any client's phone, email, address, website, hours, prices, promotions or staff names —
  use only current values the packet marks caption-approved; never guess or reuse an old
  Project value.
- The client's positioning/voice beyond what the packet supplies.
- That two clients (or two entities of one client) share facts — they do not by default.

## Fail-closed on contacts

- If a contact/footer value the caption needs is `possible_change`, `unverified_hold`, or
  in conflict (two plausible current values), **do not choose one**. Produce the content
  and flag that the contact line must be reverified/resolved before publishing.

## When to ask / stop

- Ambiguous client or missing entity/branch scope → ask before retrieving.
- No connection / packet → stop; do not draft from memory.

## Boundaries

- **Exact-client, exact-scope only.** Scoped retrieval must never silently fall back to an
  unscoped, group, national, or sibling record. No cross-client or cross-entity leakage.
- Live-source-first: the current packet overrides anything in the Project or chat history.
- No shadow client-knowledge store; the MCP/client-intelligence runtime is the authority.

See `references/human-creative-standard.md` for the standing quality/anti-filler rules.
