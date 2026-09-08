# CG client directory — confirmed canonical decisions — 2026-09-08

Status: **CA-confirmed naming decisions applied to live CG Hours and CG Dynamics**

Authority rule: CG Hours is the primary client naming source. Client IDs and linked records must remain stable when names change. CG Dynamics should mirror the same canonical name and retain prior names as aliases where useful for matching/import continuity.

## Confirmed canonical names

| Canonical name | Previous CG Hours name | Previous CG Dynamics name | ChatGPT project variant(s) seen | Notes |
|---|---|---|---|---|
| The Staffordshire | The Staffy | The Staffy | Staffy's | Dynamics keeps `The Staffy` and historical Staffordshire spelling variants as aliases. |
| Dulux Paint & Paper Bloemfontein | Dulux Bloemfontein | Dulux Bloemfontein | Dulux; Dulux Paint & Paper Bloemfontein | Duplicate ChatGPT Projects still need consolidation. |
| Econofoods | Econo Foods (active) | Econo | Econo | In CG Hours, the active `Econo Foods` row was renamed in place. The separate archived `Econo` row remains untouched for later historical cleanup. |
| First Technology Central | First Tech | First Tech | First Technology | Keep active through September 2026. Archive after September, preserving all linked records/history. |
| TBS Brokers | TBS | TBS | TBS Brokers | Canonical confirmed by CA. |
| All Around PVC | PVC All Around | PVC All Around | All Around PVC Bloemfontein | Canonical confirmed by CA. |
| Toyota Bloemfontein | Toyota Bloemfontein | Toyota Bloemfontein | Toyota; Toyota Bloemfontein | No database rename required. Duplicate ChatGPT Projects still need consolidation. |
| Bloem Action Sports | Action Sport | Action Sport | Bloem Action Sport | Canonical confirmed by CA. |
| Bohemia Quick Stop | Bohemia | Bohemia | Bohemia | Canonical confirmed by CA. |
| SecuriForce | Securiforce | Securiforce | Securiforce | Case/style correction only. |
| Cape Lumber | Cape Lumber | Cape Lumber | Cape Lumber | No database rename required. |
| PSG Bloemfontein | PSG | PSG | PSG | Canonical confirmed by CA. |

## Database safety rule applied

The live updates changed only the existing client record names. They did **not** create replacement client records, change client UUIDs, delete client rows, or reassign linked work/time records.

This is especially important in CG Hours: time entries, timesheet rows, projects and related finance/payroll-linked records continue to reference the same `client_id` values as before.

CG Dynamics old canonical names were retained as aliases where useful so historical imports, staff wording and integrations can continue resolving to the same client record.

## First Technology Central lifecycle

- Canonical name: `First Technology Central`
- Status now: active
- September 2026 is the final service month.
- After September 2026, archive the same client record in CG Hours and CG Dynamics. Do not create a replacement record and do not alter historical linked records.

## Next reconciliation work

1. Review remaining CG Hours vs CG Dynamics naming/status discrepancies.
2. Correct active/archive status for former clients.
3. Resolve duplicate ChatGPT Projects before any mass rename/delete.
4. Rename current ChatGPT Projects only after a one-to-one client identity match is confirmed.
5. Preserve internal/non-client ChatGPT Projects outside the canonical client directory.
