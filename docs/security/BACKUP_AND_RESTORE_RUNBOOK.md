# CG Dynamics Backup and Restore Runbook

## Current status

| Item | Status |
|------|--------|
| Supabase plan | Free tier / Pro (verify in Supabase dashboard) |
| Automatic DB backups | Supabase Pro: daily backups, 7-day retention. Free tier: no automated backups. |
| Point-in-time recovery | Supabase Pro: yes (with add-on). Free tier: no. |
| Storage backup | NOT automatic. Separate process required. |
| Migration history | Git-tracked in `supabase/*.sql` |
| Restore tested | Not verified in current project |
| Monitoring | Not configured |
| Error reporting | Not configured |
| Spending alerts | Not configured |
| Infrastructure owner | CA (info@cgproductionhouse.com) |
| Billing | CA |

## Database backup

### Via Supabase dashboard

1. Go to https://supabase.com/dashboard/project/ehtjfntukiwbgptqgbzy
2. Navigate to Database → Backups
3. Click "Download backup" for the desired backup

### Via pg_dump (manual)

```bash
pg_dump --no-owner --no-acl \
  "postgresql://postgres:[PASSWORD]@db.ehtjfntukiwbgptqgbzy.supabase.co:5432/postgres" \
  > cg-dynamics-backup-$(date +%Y-%m-%d).sql
```

**Never commit the backup file to git or share the connection string.**

## Storage backup

Supabase Storage is NOT automatically backed up with the database.

To back up Storage:

1. Use Supabase CLI: `supabase storage download <bucket-name>`
2. Or use the Supabase JS client to list and download objects programmatically
3. Store backups in a secure location separate from the project

## Restore procedure

### 1. Database restore

1. Create a new Supabase project (or use a staging project).
2. Run the backup SQL file in the new project's SQL editor.
3. Verify data integrity with a test query.

### 2. Migration reconciliation

After restore, apply any migrations that were created after the backup:

```bash
# List migrations in order from supabase/*.sql
# Apply each migration in order via SQL editor
```

### 3. Storage restore

Manually upload backed-up Storage objects to the new project's Storage buckets.

### 4. Environment update

Update Vercel environment variables to point to the new Supabase project:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### 5. Validation

1. Run `npm run build` — must pass.
2. Run `npm test` — all tests must pass.
3. Smoke-test the production app:
   - Login
   - Ops Hub loads
   - Client portal loads
   - Reports render
   - Calendar loads

## Rollback criteria

Roll back if any of:
- Staff cannot log in
- Client data visible to wrong user
- More than 5 tests fail
- Build fails
- Migration error during apply

## Responsible owner

CA (info@cgproductionhouse.com) — currently the only project owner.
