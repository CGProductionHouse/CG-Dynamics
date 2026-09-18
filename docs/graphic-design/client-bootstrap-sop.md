# Client Graphic Design Bootstrap SOP

Last updated: 2026-09-09
Status: one-time setup performed before a client enters normal month-to-month poster production.

## Purpose

Make the first month expensive once, then make every later month faster and smarter.

The bootstrap converts loose historic Canva/OneDrive knowledge into a durable starting state for both ChatGPT and human designers without destructively reorganising client media.

## Bootstrap outputs

A completed client bootstrap produces:

- exact Dynamics client identity + short code;
- exact OneDrive client/Photos/Posters mappings;
- exact Canva master design(s);
- separated brand/sub-brand scopes;
- 3–6 strong style references per active brand scope;
- historical used-media records where practical;
- initial exact/near-duplicate/shoot groups;
- initial person/product/service/branch/concept/mechanism usage history;
- blocked/restricted media state;
- an initial `READY_UNUSED` curation surface;
- a short bootstrap report noting unresolved legacy gaps.

## Step 1 — resolve canonical client identity

Read CG Dynamics first.

Record:

```text
client_id
client_display_name
client_short_code
active package(s)
active brand scopes / sub-brands
active branches/locations
current restrictions
```

Do not invent a new client identity because Canva/OneDrive names are different.

## Step 2 — resolve canonical OneDrive tree

Locate the exact mapped client folder and relevant existing media folders.

Do not fuzzy-match and silently choose a folder when ambiguous. Use durable mapping/IDs when available.

Identify at minimum:

- canonical original photo folders;
- brand identity/logo folder;
- existing Posters tree;
- helper `CG Creative Assistant` tree;
- any edited/final source locations that matter to historic matching.

Do not move originals into the helper workspace.

## Step 3 — resolve Canva master designs

Find the actual current client Canva design(s) used by staff.

Record stable:

```text
canva_design_id
title
purpose
brand_scope(s)
current page count
workflow divider locations if present
```

Prefer stable design/page IDs over title matching once resolved.

## Step 4 — separate brand scopes before visual audit

A parent-client design may contain visually unrelated brands.

Example Piek scopes:

- `PIEK_GROUP`
- `ENGEN`
- `SASOL`
- `GET_TOGETHER`

Do not build one mixed style reference set.

For each relevant Canva page encountered, assign the correct scope or mark it ambiguous/ignore.

## Step 5 — identify Canva workflow/history zones

Where the client's current master file uses dividers such as:

- `TEMPLATES / IN PROGRESS`;
- `TO BE APPROVED`;
- `DRAFTS`;
- `POSTED / SCHEDULED`;

record those page ranges.

Historic usage bootstrap should prioritise `POSTED / SCHEDULED` plus other clearly approved/published work, not unfinished template experiments.

## Step 6 — build style-reference set per brand scope

Select a small deliberate set, normally 3–6 examples.

A reference is chosen because it demonstrates something worth preserving, e.g.:

- strong type behaviour;
- correct colour/gradient balance;
- successful masking/cutout treatment;
- strong photo grading;
- appropriate density/negative space;
- correct logo attribution;
- high craft level;
- useful brand-specific graphic language.

Do not choose six versions of the same layout.

### Reference record

Each saved reference should retain:

```text
brand_scope
canva_design_id
canva_page_id
canva_page_index
captured_date
why_selected
what_to_learn
what_not_to_copy
```

Store generation-ready screenshots/exports under:

`CG Creative Assistant/02_STYLE_REFERENCES/<BRAND_SCOPE>/`

Suggested filename:

`<BRAND_SCOPE>__CANVA_<PAGE_INDEX>__REF_01.png`

This filename is descriptive. Stable Canva design/page metadata remains the real provenance.

## Step 7 — bootstrap historical used-media memory

For published/scheduled poster pages in practical recent history:

1. visually identify hero/support imagery;
2. identify product/service/topic/branch;
3. note visible-person repetition without inventing identity;
4. note headline/concept;
5. classify the creative mechanism;
6. match visible media back to OneDrive where possible.

Matching methods, strongest to weakest:

- exact durable OneDrive item known;
- exact file/content hash;
- same source after crop/export via perceptual similarity;
- same burst/shoot/angle group;
- visual human confirmation.

If the source cannot be resolved, record `legacy_external` / `unresolved_legacy` and keep the Canva page as evidence.

## Step 8 — create freshness state

Initial practical asset states:

- `ready_unused`;
- `used_recent`;
- `used_historic`;
- `near_duplicate_recent`;
- `blocked`;
- `legacy_external`;
- `uncertain`.

Do not hard-code one global “recent = 90 days” rule. Client volume and asset scarcity differ. Store/use last-use evidence and make a reasoned selection.

## Step 9 — blocked/restricted media

If staff/client knowledge says a person, product, branch visual or old offer must not be used, record that explicitly.

Blocking is not the same as deleting.

Examples:

- departed staff member;
- discontinued product;
- old branding/uniform;
- obsolete premises/photo;
- expired offer;
- client-requested exclusion.

Canonical deletion should only happen when separately authorised.

## Step 10 — READY_UNUSED curation

Populate only a useful curated layer for humans/ChatGPT; do not duplicate the entire photo library.

A `READY_UNUSED` item should have:

- known canonical source provenance;
- no known exact recent use conflict;
- acceptable quality/relevance;
- no blocked restriction;
- enough confidence that a designer can consider it safely.

The Dynamics ledger remains long-term truth; `READY_UNUSED` is the staff convenience surface.

## Step 11 — bootstrap report

Save a concise report under `CG Creative Assistant/03_HISTORY/` or Dynamics when implemented.

Include:

```text
bootstrap_date
client / brand scopes
Canva designs audited
page ranges inspected
style refs selected
historic posters catalogued
sources matched exact/high/probable/unresolved
blocked restrictions
known media gaps
areas needing staff confirmation
```

Never imply historical coverage is complete when only part of a huge Canva archive was realistically audited.

## Step 12 — ready-for-month flag

The client is ready for normal monthly poster production when:

- exact client/package identity is known;
- active brand scopes are separated;
- correct Canva master + workflow ranges are known;
- at least a usable recent historical usage baseline exists;
- relevant style references exist;
- current OneDrive media can be selected with reasonable freshness confidence;
- blocked restrictions are represented;
- staff can continue manually from the same state if ChatGPT is unavailable.

## Incremental improvement after bootstrap

The bootstrap does not need to solve all historical years before work can begin.

Use an incremental model:

- audit enough recent history to prevent obvious repetition now;
- add older history when it becomes relevant;
- every new poster is recorded exactly from day one;
- confidence improves automatically month after month.

This avoids spending days mapping five years of archives before the system creates value.

## Piek Group application

Piek must be bootstrapped per visual scope, not as one mixed client aesthetic.

Immediate current priority is `ENGEN` because the first proper November Wave 1 uses Engen.

After that, bootstrap `PIEK_GROUP`, `SASOL` and `GET_TOGETHER` independently using the same underlying Piek client/package identity where Dynamics says they belong to Piek.
