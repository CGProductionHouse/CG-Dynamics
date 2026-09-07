# CG Dynamics Storage Policy Matrix

Storage buckets are configured in the Supabase project. This document maps
known buckets and their access policies.

## Security note

Supabase Storage does not automatically back up objects when the database is
backed up. Storage backups are a separate operational responsibility.

## Bucket inventory

| Bucket | Public | Usage | SELECT | INSERT | UPDATE | DELETE | MIME restrict | Size limit |
|--------|--------|-------|--------|--------|--------|--------|---------------|------------|
| Operations Hub files | No | Task attachments, admin documents | Signed URL / manager | Manager | Manager | Manager | Not configured | Not configured |
| Client report PDFs | No | Generated report PDFs for client download | Signed URL with TTL | Staff | Staff | Staff | `application/pdf` | Not configured |
| Public assets | Yes | Logos, shared images | Public read | Admin | Admin | Admin | Not configured | Not configured |

## Recommendations

1. Configure MIME type restrictions on upload buckets.
2. Configure file size limits (recommended: 10MB for Operations Hub, 50MB for
   reports).
3. Set up signed URL expiry (recommended: 60 minutes for reports, 24 hours
   for Ops Hub attachments).
4. Document Storage backup procedure (separate from pg_dump).
5. Enable object-level security on private buckets.

## Content review snapshots (#220)

`content-review-snapshots` is private, limited to 50 MB and JPG/PNG/WebP/MP4. Assigned staff or managers upload a new unique path beneath the exact schedule item ID. Authenticated UPDATE/DELETE are restrictively denied, including when another permissive policy exists. Active staff can read; a client can read only a snapshot for their exact client after internal approval and while awaiting client approval or approved. Client UI receives no internal source metadata or review comments. Signed preview URLs expire after ten minutes.

Review revisions are children of `monthly_deliverables`, not a second schedule. RPC-only writes enforce assignment/manager permissions, capture canonical client/date and actual stored media, and audit decisions. Changes require a new immutable revision. Schedule date/title/archive changes invalidate review state; client reassignment with review history is blocked. No existing content is auto-approved or auto-published by the migration. Application-owned Canva OAuth/export refresh and publishing credentials remain separate rollout prerequisites.
