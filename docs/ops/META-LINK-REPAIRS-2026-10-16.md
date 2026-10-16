# 16 October — exact-client Meta repairs

Owning issues: #668 / #451; supervisor #381. This supersedes only the mapping
holds identified below in `CLIENT-META-AUDIT-2026-10-16.md`. That earlier audit
remains a historical receipt, not the current integration state.

Source PR#826 merged as `65e91264a8be0a357d0ce1d75a8176108bab5107` after actual
diff review and final verification. No Vercel or Edge deployment followed that
merge. Remaining exact backend release decision is still pending; do not infer
an answer from a preselected option. Routine source merge authority is not
permission for OAuth, publication, recipient exposure or hosting spend.

## Completed in the actual authenticated application

CA requested execution of the repair queue after the ordered audit. Used the
existing admin **Load Meta assets / Save link** workflow, with independently
observed native identity and live provider-discovered IDs. No replacement clients,
guessed IDs, raw SQL writes, new OAuth scope or permission change.

| Existing client UUID | Client | Facebook Page | Added Instagram |
| --- | --- | --- | --- |
| `7b7d244f-77b4-4b2a-88f0-8ce3f7e1c202` | Elcheck | `1299076156631543` | Not exposed; remains unknown |
| `aece5a86-c962-4234-a1fe-7904c20f03ff` | JFJ Electrical | `255953361428538` | `17841430174920917` / `jfj_electrical` |
| `3c20fae1-8e91-41d5-98eb-1c331600e6e3` | Neshora Oxygen | `1340961499097681` | Not exposed; remains unknown |
| `504113ee-fba9-4993-807e-a86066615212` | WiseRide | `727048853820569` | Not exposed; remains unknown |
| `4236a60a-990f-484f-8d19-13d2f92fbe3b` | Novus Steel | Preserved `707165899142393` | `17841475208320793` / `novus_steel` |
| `2b953772-e791-4dff-a278-d4dd3521f02e` | We Ar Fuels | Preserved `101633701368819` | `17841466359920736` / `we_ar_fuels` |

Four missing mappings created; two existing mappings additively corrected.
Independent SELECT readback verifies all six; Novus and We Ar Fuels keep their
existing mapping-row IDs, Facebook Pages and null ad-account bindings. Unknown
Instagram remains `instagram_not_applicable=false`, never an invented exclusion.
Client IDs and CG Hours/timesheet history are unchanged. Fresh authenticated UI
after reload shows **46 linked clients** (previously 42), 15 missing Facebook.

## Actual ingestion and value readback

Saving the links triggered the existing automatic bootstrap. All newly mapped
platform checkpoints completed on 16 October, no error; no fleet resync loop.
The following October account views cover **1–15 October**, not the whole month.

| Client | Facebook views | Instagram views | October imported posts |
| --- | ---: | ---: | ---: |
| Elcheck | 345 | Unknown | 5 |
| JFJ Electrical | 1,301 | 116 | 11 |
| Neshora Oxygen | 574 | Unknown | 5 |
| WiseRide | 4,322 | Unknown | 17 |
| Novus Steel | 2,074 | 374 | Not separately counted in this repair receipt |
| We Ar Fuels | 4,248 | 222 | Not separately counted in this repair receipt |

The first four clients' view totals match the native same-window audit. New
Novus/We Ar Fuels IG values are provider facts, not separately native-accepted
in this repair pass. Checkpoints completed 17:32–17:38 UTC, with next due +6h.
Reports remain **draft**, not published or exposed to clients by this repair.
One explicit existing-connector Elcheck September sync also passed (0 posts,
reused report, 17 followers); its server reported 102 Page tokens loaded.

## Three concrete code defects reproduced and repaired locally

1. `meta-list-assets` only fetched the first 100 Facebook Pages/ad accounts,
   although the server token loader sees 102 Pages. An actual-handler regression
   failed with 100 instead of 101 and missing the Page-101 Instagram account.
   New bounded discovery follows safe cursors, deduplicates IDs, reconstructs the
   original endpoint/fields/token, rejects unsafe targets/repeated cursors, and
   reports partial results as incomplete. No browser token exposure. This fixes
   discovery, not proof that Forklift is one of the extra Pages.
2. The Instagram picker added **all clients' stored IG accounts** to a selected
   Facebook Page's options. A failing-first test executed the actual component's
   picker and reproduced unrelated client/unknown-Page options. Stored fallback
   accounts are now constrained to the selected Facebook Page. Instagram-only
   linking without a selected Page and same-Page existing mappings remain usable.
3. Actual Reports list showed the four new automatically imported reports as
   **Manual fallback**. Independent SELECT verifies all5/11/5/17 posts have
   canonical Meta mappings. Its two unpaginated mapping/post reads stopped at
   the default first1000 rows, causing false manual classification. Both now use
   the existing ordered `fetchAllPages` authority in parallel; errors are surfaced
   as **Source unavailable**, never manual evidence. The actual loader fails
   against1001-row fixtures before the fix and passes afterward. No report source
   rows, report status, metrics or publishing rules were changed.

Focused Meta tests:69 pass /0 fail; five report-source/workspace tests also pass.
An initial extra focused run without fixture public configuration failed in SSR;
it was rerun with the existing isolated fixture environment, not relaxed tests.
Local TypeScript/Vite build, emitted application
chunks, scoped component lint, Deno handler typecheck and diff checks pass.
Initial full supported run:3,893 pass /17 skips /2 failures. Both failures are
optional disposable PostgreSQL/Docker fixtures while Docker Desktop is stopped;
the new23 tests pass. A full rerun explicitly marks those two optional checks
skipped (`CG_RUN_LOCAL_DB=0`), preserving all assertions and production isolation.
Final supported-suite result: **3,915 total /3,896 pass /19 intentional skips /
0 failures /0 cancelled /0 todo**. Log:
`C:/Users/chris/AppData/Local/Temp/cg-meta-launch-repairs-full-suite-verified.log`.
The two unavailable Docker checks are counted as skips, not passes. Actual review
of all11 changed files found no blocking correctness/security/scope issue; no
claim that local fixtures establish production client-role acceptance.

Additional actual production staff preview: JFJ exact client identity persists
between Overview and Plan; current/next strategy month buttons are October and
November. Package shows1video+6combinedposters, with no unconfirmed extras.
Existing bottom phone navigation/More menu and Plan sections are usable at
375/390/430px; document widths360/375/415 respectively, no horizontal overflow,
phone navigation tap targets56px high. More exposes the exact JFJ Brand Hub link.
Viewport reset after checks. October strategy is still under review, not silently
published; no claim of every tab or genuine client-role acceptance for61 clients.

Review: source authority remains `reports`/`posts`/`meta_content_mappings`, with
the existing `fetchAllPages` helper; no new table, RPC, scope or dependency.
Only two existing admin TSX components changed, with no layout/route/client shell
changes. React review keeps the two independent paginated reads parallel and
narrows data to IDs; errors cannot be read as manual-source evidence. Scoped lint
has zero errors and the pre-existing ReportsManagement `load` effect-dependency
warning. The existing large-bundle warning also remains; neither was suppressed.

Fresh existing-connector provider-health read confirms46 mapped clients /74
platforms:20PASS,53PARTIAL,1STALE. This grades metric coverage, not native-post
completeness or launch clearance. AV/Zooz Facebook still fail and Red Oak has no
verified checkpoint; no duplicate grant-recovery loop was triggered. Public
permalink searches for all five older missing-photo suffixes also returned no
stored row. Bounded exact-client/date reads preserve those omissions, rather
than claiming the wrong native object-ID shape has already been ruled out.

### Separate runtime gates

At inspection `meta-list-assets` is live **v64 / verify_jwt=false**, with its
existing internal JWT verification and admin/manager role gate. Its four shared
dependencies differ from current repository helpers. Do not bundle unrelated
helper changes opportunistically. An exact release must preserve those deployed
dependencies except the identical duplicate-key removal described below,
adding only the new collector and changed handler;
typecheck that exact packet and recheck auth before release. No secrets/config/
permissions or JWT-setting changes. Await the requested exact CA release decision.
Preparing that packet reproduced a **pre-existing duplicate `availability` key**
in the deployed shared helper's fact payload (TS1117). Removed only the second
identical `availability: probe.availability` property in the local packet, retaining
the first and all other helper source. Exact packet Deno check now passes.
The candidate/rollback manifest is
`strategy-review/2026-10-16-meta-asset-runtime-packet.json`; all other deployed
dependencies are unchanged. This is preparation, not a production deployment.
No Edge deployment has occurred in this receipt. Frontend picker release remains
under #679's separate conservative Vercel packet; **zero Vercel operations**.

## Remaining exact holds — continue, do not redo solved clients

- Forklift native FB `1702158976724640` / IG `forklift_truck_ofs` is verified,
  but current provider picker does not expose it. After authorised discovery
  release, check once for that exact identity; do not guess or widen permissions.
- AV, Red Oak and Zooz/WFF stored-grant recovery remains separate from native
  browser access. No consent or token copying attempted.
- Ehrlich, HMHI, SecuriForce and Vrystaat older native post omissions remain
  provider-object/edge investigations. SELECT across `meta_content_mappings` for
  all five missing object suffixes also returned no rows: not just reused CSV
  post IDs. Do not switch to visitor feed or insert fabricated post metrics.
- Account totals do not prove all post coverage. Same-day posts beyond the
  completed-Pacific-day window remain distinct from those older omissions.
- October/November editorial/source holds, actual schedule disclosure, Brand Hub
  final assets/recipient acceptance, client-role/device acceptance and protected
  frontend release remain distinct. This is not all-client launch clearance.
- Existing PR owners #775/#662/#618 remain untouched. Google Control Centre
  exact reference is still unavailable; no replacement tracker was invented.

Local screenshot receipt (not committed):
`C:/Users/chris/AppData/Local/Temp/cg-meta-links-repaired-2026-10-16.jpg`.
