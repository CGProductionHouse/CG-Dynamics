# Authorized launch backend rollout — 7 October 2026

CA approved the two named migrations and necessary completion work in this chat.
Source target: `f4a2fab34018c683abd8562bebc8cfbd94013114`.
No Vercel operation, secret/config/scheduler/provider change, sync, generation,
OneDrive write or strategy/file/package approval/publication occurred.

## Applied migration receipts

Applied separately through Supabase's migration tool, verifying each before the
next. The tool assigns deployment-time versions; these names/body receipts—not
an absent original timestamp alone—prove application. **Do not replay them or run
a blanket `db push`.** No migration history repair was performed.

| Repository migration | Live ledger name | Live version | Repository body SHA256 (local CRLF bytes) |
| --- | --- | --- | --- |
| `20261007100000_client_portal_post_assets.sql` | `client_portal_post_assets` | `20261007141122` | `d33cbd7754ba3f9722ecfec62d9b400674a4061912a52e394f6582a5a16f938f` |
| `20261007102349_skill_card_review_revision_binding.sql` | `skill_card_review_revision_binding` | `20261007141211` | `d22eeb8c031bff7a322d46ae38bf48b2aa733a55aa6f80b7a9be9f4cfdd0c057` |

Verified actual schema, prerequisite types/functions and no dependent objects
blocking the RPC replacements before apply. Post-apply: post-assets RPC exists;
exact-client ownership precedes catalogue read; anon EXECUTE false/authenticated
true; empty search path. Review columns and three enabled guards exist; five-
argument snapshot-fenced review RPC exists and old four-argument overload is
absent. Review/snapshot/queue RPCs deny anon; trigger helpers deny authenticated
execution. Unauthenticated review snapshot read was executed in a READ ONLY
transaction and rejected with `Admin access required`.

All 56 historical cards retain null hashes/binding; all 72 reviews remain audit
history, with zero human content-review bindings. No backfill, review, activation
or new readiness certification. Old frontend review calls fail closed until the
reviewed frontend is released; do not weaken that boundary for compatibility.

## Protected data/access before-and-after proof

Same counts and fingerprints before both migrations, after each, and after Edge
rollout. Hashes exclude only the newly added review-binding columns/defaults.
These are comparison receipts, not security digests or marketing-quality scores.

| Surface | Rows | Unchanged fingerprint |
| --- | ---: | --- |
| Skill Cards (original fields) | 56 | `def99062998ffe4c6998860054eb0d38` |
| Reviews (original fields) | 72 | `c4f424b3a0e4472bc9b94ca0841da580` |
| Monthly deliverables | 3,654 | `1c6d8d39103610d3b5499fb4013705f9` |
| Portal assets | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| Existing table grants | — | `d9859ceae6996e2f7dd4b1410f4f0d20` |
| Existing RLS policies | — | `91c54a521cf9fd10599daea66cf5c57d` |

RLS remains enabled on cards, reviews and portal assets. No global grant/RLS
widening and no content/package/report/provider mutation was made by this rollout.

## Deployed dependent functions

Full relative dependency closure supplied from the target source. Fresh combined
Deno 2.5.1 check PASS before deployment; existing local tested source unchanged.
Each release individually downloaded/read back. Byte-exact runtime file parity
PASS; Supabase may normalize the download root. The pure, erased `import type`
of `src/types/reportPlatform.ts` is omitted from the monthly bundle download;
its nine runtime files match exactly and full type closure passed locally.

| Function | Previous version | New version | JWT verification |
| --- | ---: | ---: | --- |
| client-onboarding | 27 | 28 | false, existing in-handler/session/stream auth preserved |
| get-client-context | 27 | 28 | true |
| suggest-content-videos | 36 | 37 | true |
| cg-assistant-chat | 36 | 37 | true |
| marketing-workflow | 34 | 35 | true |
| monthly-strategy-autopilot | 25 | 26 | true + existing internal worker check |

All six unauthenticated POST probes return 401; no authorized generation,
reconciliation, upload, sync or worker invocation occurred. Inventory remains
47 functions; the other 41 retain identical version/JWT/bundle hash. No function,
credential or scheduler was added. Activation/config values were not changed.

Previous source versions were captured for comparison. Do not restore unsafe
historical approval authority as rollback. On a real failure, hold affected reads/
knowledge use fail-closed and perform a reviewed forward repair; a compatible
rollback requires preserving the current snapshot/approval boundary and schema.

## Still incomplete — do not manufacture acceptance

- Frontend release remains **NOT DONE** under the explicit no-Vercel instruction.
  Build one production-configured artifact only in the authorized #679 release
  window; never upload fixture-configured dist. Changed frontend authenticated
  acceptance cannot be claimed from backend source readback or old live UI.
- The later 7 October work Chrome connection supersedes the earlier missing-tab
  receipt: genuine CG Production House Admin read-only navigation now resolves.
  Sampled exact-client switches, reports, Content/Calendar/Work/Marketing were
  inspected on the existing frontend; no profile impersonation or token copy.
  This is NOT changed-frontend acceptance or a client/staff-role login proof.
  Local mobile launcher and My Day defects are addressed by #691/#692 under the
  no-Vercel hold. Final changed-runtime role acceptance remains pending release.
- Four packages still need genuine exact evidence/confirmation: Elcheck, JFJ
  Electrical, LHP Student Village & Block, VCS Cleaning Solutions. Preserve nulls.
- 72 v3 +22 held v2 target strategies remain drafts, not semantically certified
  or published. Actual reviewed research/marketing choices/learning and human
  acceptance are not replaced by guardrails, regexes or a blanket authorization.
- Zero published portal assets: obtain genuine final files and exact deliverable
  associations before explicit publication. No title matching or fabricated files.
- Current-content knowledge requires individual real human review before
  activation; migration application did not approve old cards.
- Provider owner/consent and sustainable client-site hosting remain separately
  owned. This rollout does not authorize provider changes or financial actions.
