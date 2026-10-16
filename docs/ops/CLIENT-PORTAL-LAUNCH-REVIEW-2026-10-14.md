# Client portal launch review — 14 October 2026

Later strategy-only continuation: the 16 October exact-client connector receipt
is `strategy-review/2026-10-16-november-review-receipt.json`. Eleven November
drafts have targeted improvements and matching v3/unpublished readbacks. It
does not refresh this older access/report/calendar/library inventory or imply
that those protected gates passed. Current engineering/acceptance state is at
the top of `CG-DYNAMICS-OPS-HANDOVER.md`.

This is a read-only production receipt, not a declaration that every client is ready. Source: exact-client admin preview plus SELECT-only checks of the canonical production tables on 14 October (Africa/Johannesburg). No sync, approval, publication, entitlement, portal access, OneDrive permission, mapping or hosting action was performed for this review.

| Gate | Verified state | Next safe action |
| --- | --- | --- |
| Active client identity | 61 active clients | Keep exact-client IDs; do not merge by name. |
| Portal login | 46 active clients have an enabled `client_portal_access` mapping and active client profile | Review the 15 missing clients individually before provisioning or inviting. Existing accounts must be preserved. |
| Recent published performance | 39 active clients have a published report starting on or after 1 September | Review the other 22 individually; no report is not zero performance. |
| October strategy | Piek Group version 3 is the sole published October strategy (13 October 20:35 UTC); 56 other October rows remain drafts | Correct Piek's client-facing copy issue before its client invitation. Review each other exact-client draft semantically; never blanket publish. |
| November strategy | 57 canonical rows, all drafts; zero published | Continue exact-client source and package checks, then editorial review. Do not promote a package-only seed or internal voice rule as a game plan. |
| October posting calendar | Five non-archived, dated `monthly_deliverables` rows across five clients; all five reference the legacy 2025 Client Schedule plan | Reconcile exact dated work in Client Schedule. Teams Planner is operational task truth, not a posting calendar substitute. |
| Brand Hub | `client_portal_libraries` has zero mapping rows (zero verified) | Verify exact client-safe folder, approved finals, and recipient view-only boundary before any mapping or share. Existing OneDrive folders alone do not make the Brand Hub live. |
| Service expansion | No active client has a `client_service_entitlements` row | Keep unknown services hidden. Review exact agreements before labelling a service included or excluded. |

The 15 active clients without an enabled canonical portal-access mapping are: Agri-Secure, Bloem Vascular, Elcheck, Emoya Estate Driving Range, Forklift Trucks, Human Auto, Ipopeng Office Supplies, JFJ Electrical, LHP Student Village & Block, Mimosa Mall, NCNA, Neshora Oxygen, Rusoord Farmstay, VCS Cleaning Solutions, and WiseRide. This is an access inventory, not an instruction to batch-create logins; LHP's once-off scope and Human Auto's research skip/go gate remain intact.

The five clients with any dated October Client Schedule row are Cape Lumber, Ehrlich Park Butchery, Germoparts, Supa Quick Centurion, and TBS Brokers (one row each). That does not prove a complete posting plan for any of them. No other active client's October posting calendar can be presented as populated from this authority.

The authenticated read-only Piek Group admin client preview shows the published October game plan, including confirmed four-video/twelve-poster scope. It also shows “Resolve the publishing-email discrepancy before adding an email address; do not silently substitute a contact” under “What we need from you.” That is internal production wording in a client-facing field. Treat the client copy as requiring targeted editorial correction; do not silently amend or republish the approved snapshot. The admin preview is not proof of client-role authorization.

Read-only OneDrive inspection found the exact `Clients/Braize/A_ClientPortal_Braize` folder, with only the owner returned on its permission listing. It is **not** mapped in Dynamics. Folder existence and owner-only permissions do not prove final-export approval, safe file selection, recipient access or client Brand Hub readiness.

Morning review order: (1) Piek published copy and true client-role view; (2) one exact client Brand Hub folder/finals/recipient pilot under #396; (3) dated October Client Schedule work and current-month publishing truth under #389; (4) exact access review of the 15 unmapped clients; (5) editorial October/November strategy decisions under #731; (6) per-client report and service-entitlement checks under #668/#389. Record each client's pass/hold with an evidence date. No mass approval, guessed package, title-matched Planner import or Vercel release is implied by this receipt.
