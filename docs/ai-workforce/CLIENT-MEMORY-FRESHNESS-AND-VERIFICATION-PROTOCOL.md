# Client Memory Freshness and Verification Protocol

Last updated: 2026-08-06
Status: Canonical operating rule for CG Dynamics client knowledge, agents and Marketing Library workflows.

## Core rule

Stored client memory is never assumed to be current simply because it exists.

Before an agent uses client-specific facts for strategy, content, reporting, advertising, SEO, website work, quotations, scheduling, contact, recommendations or operational decisions, it must compare the stored knowledge against the latest available authoritative sources.

## Freshness hierarchy

Use the newest trustworthy source in this order where available:

1. client-confirmed information supplied directly to CG;
2. the client's current official website;
3. the client's current official social profiles;
4. the client's current Google Business Profile or equivalent verified listing;
5. current official directories, professional bodies, brand or franchise pages;
6. reliable third-party sources;
7. stored CG Dynamics memory.

Stored memory is the fallback context, not the final authority for changeable facts.

## Facts that require freshness checks

Always re-check:

- physical and postal addresses;
- telephone and WhatsApp numbers;
- email addresses;
- website domains and URLs;
- opening hours;
- staff, directors, practitioners and team roles;
- locations and service areas;
- products and services;
- package inclusions and pricing;
- current offers and promotions;
- qualifications, registrations and accreditations;
- social handles;
- booking and enquiry methods;
- policies, terms and emergency channels;
- brand positioning and current public claims.

## Comparison behaviour

The agent must:

1. retrieve the stored client record and latest source evidence;
2. compare each material fact;
3. preserve the old value as historical audit evidence where useful;
4. mark conflicts rather than silently choosing;
5. prefer a newer authoritative source when the change is clear;
6. create or propose a reviewed memory update;
7. record source URL, source type, observation date and confidence;
8. avoid publishing or acting on an unresolved contact/address conflict;
9. never overwrite verified historical facts without an audit trail.

## Update states

Every mutable client fact should support:

- `current_verified` — matches a recent authoritative source;
- `possible_change` — new evidence conflicts with memory but needs review;
- `stale_unverified` — no recent confirmation exists;
- `historical` — previously true but superseded;
- `rejected` — wrong identity, duplicate or unsupported claim.

## Freshness metadata

Where the data model allows, store:

- `value`;
- `source_url` or internal source reference;
- `source_type`;
- `observed_at`;
- `last_verified_at`;
- `verified_by`;
- `confidence`;
- `supersedes` or historical predecessor;
- `review_state`;
- `notes`.

## Agent response rule

When information has changed, the agent should say what changed and update the review-state memory. It must not continue using a known stale address, number, staff name or service list because it appeared in an older source.

When the latest source cannot be reached, the agent must label the stored value as awaiting revalidation rather than present it as newly verified.

## Scheduled review cadence

Suggested minimum cadence:

- active-package clients: review core contact and service facts monthly;
- campaign launch or major deliverable: re-check immediately before launch;
- healthcare, legal, financial and regulated clients: re-check credentials, locations, people and claims before each material public campaign;
- once-off or paused clients: re-check when work resumes;
- inactive/former clients: retain historical records but do not surface them as active.

## Scope boundary

A detected public-source change does not automatically become approved production knowledge. It enters review state unless the source is authoritative and the update pathway is explicitly authorised.

The system must keep client-specific knowledge isolated. A change discovered for one client may not alter another client's memory or be promoted to general industry truth without separate evidence.

## Acceptance criteria

This protocol is working only when:

- agents compare fresh sources before using mutable facts;
- changed facts generate visible review/update records;
- old values remain auditable;
- stale contact details are not used operationally;
- source dates and provenance are visible;
- unresolved conflicts are surfaced honestly;
- approved AI grounding uses the current reviewed value only.
