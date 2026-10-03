-- Client registry history safety: no backfill, renames, merges or deletions.
-- Exact trimmed/case-insensitive name collisions fail for every insert/update,
-- including simultaneous admin and CG Hours bridge writes. Archived clients
-- remain reserved: restore the original UUID instead of recreating its name.
-- If legacy collisions exist, the unique-index build fails; never clean them
-- up destructively to make this migration pass.
create unique index clients_exact_name_unique
  on public.clients (lower(btrim(name)));

-- Browser admins may archive/restore, but may not erase client-linked history.
-- Privileged maintenance remains separate and requires explicit approval.
revoke delete on public.clients from public, anon, authenticated;
