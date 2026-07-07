# Workforce roles migration

Run manually in the Supabase SQL editor after review:

```text
supabase/phase-14a-workforce-roles.sql
```

This migration adds the `manager` role to `profiles` and `client_invites`, keeps existing `admin`, `team` and `client` roles working, and refreshes the invite/profile helper functions.

It does not delete rows or touch live data beyond replacing role constraints and helper functions when you run it.

The app can build before this migration is applied, but manager invites and manager profile saves require it.
