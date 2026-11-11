# MSI video history reconciliation — 11 November 2026

CA requested that every MSI-edited client film be tracked in Dynamics to prevent
repeat work. Sixteen exact-client append-only updates were saved through the
governed connector and independently retrieved from `get_client_context`.
They cover sixteen film attempts across fourteen clients, plus two preparation
lanes. These are saved client intelligence, **not sixteen new pipeline rows**.

Company pickup remains the existing [video reconciliation task](https://www.cgdynamics.co.za/admin/work?tab=board&id=7f413d31-17cd-4761-b2e9-a031c1343444).
Three bounded comments, each read back, contain the current/historical register,
limitations and all receipt IDs. Its ongoing `in_progress` status is preserved.

| Client | Existing work reconciled | Dynamics client update |
| --- | --- | --- |
| Piek Group | December R16 owner-approved; exact portal MP4/cover/caption verified | `6072e258-f976-4563-a350-119f8ea4ba10` |
| TBS Brokers | November equipment V11 approved; distinct festive transit release R04 internal review; June advice withdrawn | `979a738f-f961-4815-b030-801a533dd0c1` |
| Daisy & Co | November Se dankie R05 final orientation amendment sent; exact revised approval not inferred | `a30f6744-8596-4cdb-88f5-86f2d3bdd207` |
| WiseRide | November Skoonma toets release R03 = private build R22; Delivered | `73a21085-7165-430d-96b4-d010d21f40e6` |
| Ehrlich Park Butchery | November Good food R16 Delivered; R15 withdrawn | `d5e2ab5d-f8a2-42d4-8d1e-1ca60d78fed2` |
| Bloem Action Sports | CA owner-approved/sent-to-client; strongest MSI replacement receipt R16 identified; forwarded hash still unverified | `cc105463-6415-4f5a-be2a-4e66c15cc0cf` |
| PSG Bloemfontein | MSI October business master and approved November crop film; separate from PC November excess R09 and KG festive | `39b1bd55-eb1f-40ec-a004-c75e840c8547` |
| Watch Addict | December MSI Christmas R09 already has correct pipeline row; preserve November PC R09B | `527bd2f0-4055-4e5b-9956-745cc33b94e8` |
| We Ar Fuels | October Big week ahead Revision03 sent; older D4 kit pointer stale | `c46e4535-8f37-4656-9b8d-5c0363700961` |
| Emoya Estate Driving Range | October Next round V8 owner-self-chat Read; not a group/client approval | `94cdab3c-c078-4ae2-ad62-4da548754de3` |
| Econofoods | October rejected relay study closed; Franco's finished submission separate | `65a85f81-0ec8-4c99-8ea8-92c6006ae9b2` |
| JFJ Electrical | October Your land named master retained; current transport/approval unknown | `8fcc7421-c547-48af-ac75-954ed0b26a87` |
| Toyota Bloemfontein | October You win either way package says review-ready/not sent | `5b05beed-81b3-49b6-b1a3-0cb34bf84270` |
| Novus Steel | Source preparation only; no finished MSI film established | `24c0552e-295e-47e5-92dd-eabc10f38cae` |
| The Staffordshire | Fight Night deferred; source fragment is not a completed trailer | `4d395a16-4151-4b8f-83e6-9a3b9c85e6f9` |
| Bloem Marble & Granite | October Enjoy the everyday v18 historical master; separate from PC November R07 | `f2c59a59-06cd-4719-b0db-66efdbd2a9fb` |

Exact filenames, hashes, source/handoff evidence, supersession and limitations
are in those client updates. Private media remains outside Git. Older uncertain
approvals are explicitly unresolved rather than downgraded or fabricated.

## Board gap remains open

The live [Video Pipeline](https://www.cgdynamics.co.za/admin/content?tab=pipeline)
was inspected: 37 to shoot, zero editing, seven internal review, one client
review, zero approved. This is not a complete inventory of actual edited films.
Several MSI films, including approved Piek, are absent. Watch December remains
on `7ebe75d8-5388-45bd-9b61-a84d8afd28b1`; the Action Sports sent-to-client row
beginning `3aac7c13` remains separate from archived rejected PC R08B.

The connector exposes run-linked draft creation, not standalone historical-film
registration or pipeline transitions. The live add-video form belongs to an
exact Content Run. These archive films have no verified owning run. No arbitrary
October/November shoot, July planning card or posting slot was invented.
The existing edit form also shows external editor names such as Nolan MSI as
Unassigned; saving risks clearing that name. No pipeline lifecycle/editor fields
were changed. Product follow-up belongs to the existing content workflow lane:
governed idempotent standalone backfill and preservation of external editor names,
not another tracker or direct SQL workaround.

Until repaired, dispatch reads **both** the exact client's recorded updates and
the existing reconciliation task alongside pipeline and current ownership.
Client histories are persisted; board population is explicitly incomplete.

## Verification boundaries

- All sixteen creation receipts returned PASS and all sixteen update IDs/titles
  were independently found under the correct client context.
- Six current/historical final MP4s were rehashed locally, including both latest
  EHP/TBS transit packages; other hashes came from exact retained release receipts.
- Shared task readback verified all three new comments and ongoing status.
- First attempts to link the company-wide task as a client follow-up were refused
  by the same-client guard, with no records created. Corrected writes reference
  that task in prose, never as a false client linkage. A >4,000-character task
  comment was refused; three bounded comments succeeded.
- Both connector selections resolve to the same company-admin principal; no
  account, access, ownership or permission was changed.
- No new WhatsApp/history/audio review, client/public send, posting date, portal
  publication, schedule mutation, production SQL, schema change or deployment.
