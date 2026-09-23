# Active-client package evidence matrix

Issue: #500

The Clients workspace now projects one evidence-review row for every active client. It does not add a package table, evidence table, or confirmation path.

## Evidence rules

- `clients.package_settings` plus its #494 confirmation receipt remains package authority.
- Active `client_packages` and their active `package_deliverable_templates` are the only sources allowed to prefill matching quantities.
- A missing template remains unknown. Its absence never becomes zero.
- Multiple simultaneously current package rows are a conflict and prefill nothing.
- Existing unverified `clients.package_settings` values are compared with direct package evidence. A mismatch becomes a conflict and prefill is withheld.
- Recent `monthly_deliverables`, including existing Microsoft mirror IDs/timestamps, are supporting cadence evidence only. They never establish contractual scope.
- Ready client guides and incorporated client-context updates are supporting exact-client references only.
- Historical/ended package rows remain visible as supporting evidence and do not become current scope.

## Review workflow

Admins can open the complete active-client matrix, select the next alphabetical unconfirmed client, inspect direct and supporting evidence, resolve every unknown/conflict, and explicitly confirm through the existing `confirm_client_package_settings` RPC. The UI then advances to the next unconfirmed client.

Confirmation remains exact-client, active-admin-only, audited and server-authoritative. No client is bulk-confirmed and no production write occurs merely by opening the matrix.
