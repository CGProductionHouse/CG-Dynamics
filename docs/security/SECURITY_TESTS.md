# CG Dynamics Security Tests

## Test suites

### opsHubQualityGate.test.mjs

Covers:
- Admin task read isolation (manager can read, staff cannot)
- Staff cannot insert Admin / To Do tasks
- Staff cannot move tasks into Admin / To Do
- Staff can read and create operational tasks
- Client has no access to Operations Hub
- Package classification requires manager role
- Cross-client deliverable link prevention

### clientFacingQualityGate.test.mjs

Covers:
- Client isolation (Client A cannot see Client B data)
- Published-only content access
- Cross-client safety invariants

### adminInvitePolicy.test.mjs

Covers:
- Invite acceptance flow
- Role assignment from invites
- Client_id restriction for client invites

### 405_website_enquiry_transaction_acceptance.sql

Covers:
- Server-side endpoint/client/environment and approved-recipient resolution
- Versioned stable form-field validation
- Identical replay receipt stability and changed-payload conflict
- Concurrent same-key submission serialization
- Atomic rollback when event creation fails
- Tenant-scoped contact identity with no cross-client email deduplication
- One enquiry, exact pending outbox jobs, and one canonical lead event
- Preview/staging synthetic classification derived from server configuration
- Anonymous/authenticated execute and table-read denial

## Running security tests

```bash
npm test
```

Individual suites:

```bash
node --test tests/opsHubQualityGate.test.mjs
node --test tests/clientFacingQualityGate.test.mjs
node --test tests/adminInvitePolicy.test.mjs
node --test tests/websiteEnquiryTransaction.test.mjs
```

The PostgreSQL acceptance suite runs against a disposable Supabase Postgres image
in `.github/workflows/website-enquiry-transaction.yml`; it does not connect to or
mutate production.

## Coverage gaps

1. No automated RPC authorization tests for `admin_set_package_classification`.
2. No Storage policy tests (require Supabase management API access).
3. No SECURITY DEFINER function privilege-escalation tests.
4. No SQL injection tests on dynamic queries.
5. No rate-limiting / brute-force tests.

These gaps are acceptable for controlled beta but should be addressed before
general availability.
