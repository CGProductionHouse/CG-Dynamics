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
