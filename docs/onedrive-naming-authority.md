# CG OneDrive naming authority

Status: **CA-locked canonical production naming authority**
Confirmed: **18 September 2026**

This document exists so staff, Staff Assistants and implementation agents do not invent or drift from CG Production House's established naming structure.

## Canonical production path

```text
Clients/<Client>/Videos/<YYYY>/<YYYY_MM_MON>/<YYYY_MM_CLIENT_VIDEO_XX>
```

Examples of the structural rules:

- year folder: `YYYY`
- month folder: `YYYY_MM_MON`
- video folder: `YYYY_MM_<CONFIGURED_CLIENT_SHORT_CODE>_VIDEO_<XX>`
- sequence `XX` is zero-padded
- client short code is configured canonical data and must never be guessed from the client display name

Implementation authority: `src/lib/onedriveCanonical.ts`.

## Related naming authorities

Client Schedule task identity:

```text
{CODE} {N} - {CLIENT}
```

Authority: `docs/cg-planner-replacement-architecture.md`.

Content Guideline video display:

```text
Video XX - Descriptive Name
```

Authority: `src/lib/contentGuidelineNaming.ts`.

## Staff Assistant rule

When staff ask an Assistant to create, locate, map or open a OneDrive production folder:

1. Resolve the exact client in CG Dynamics.
2. Resolve the configured canonical client short code.
3. Resolve the exact target month/year and required video sequence.
4. Generate the name through the canonical Dynamics helper/action.
5. Use durable OneDrive/Graph item IDs as identity once mapped.
6. If any required canonical value is missing or ambiguous, **stop and ask/flag it**. Do not improvise.

Never:
- invent a short code;
- change separators/case;
- use an unpadded sequence;
- invent a month abbreviation;
- create a near-match duplicate;
- rename, move or delete an existing folder merely to make it look canonical without explicit review/approval.

Staff Assistants should use narrow CG Dynamics business actions for canonical folder creation/opening rather than generic raw OneDrive folder creation.

## Client Portal Library

The new client-facing library under a client root must not introduce a second naming system for production work. It may expose approved client-safe copies/links, but canonical production identities and schedule relationships remain grounded in the authorities above.

If another final-asset type does not yet have a documented canonical export filename rule, preserve the approved filename + durable item ID and escalate the missing rule to CA rather than inventing one.

## Conflict rule

If older docs/comments say there are no per-video production folders, this document plus CA's confirmed #224 naming correction supersede that wording for naming/creation behaviour.
