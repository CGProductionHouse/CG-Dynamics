# CG Dynamics Data Classification

## Classification levels

### Public / Internal

Data visible to all authenticated staff. No sensitive information.

- `clients` (name, tier — no financial details)
- `planner_boards` (board names and structure)
- `planner_buckets` (bucket names)
- Staff profile names and roles

### Staff Operational

Data visible to all staff, required for daily workflow. May contain client
instructions and task descriptions.

- `command_centre_tasks` where `bucket != 'Admin / To Do'`
- `monthly_deliverables` (operational fields only)
- `client_packages` (package names and structure)
- `package_deliverable_templates`

### Manager / Admin

Data restricted to manager and admin roles.

- `command_centre_tasks` where `bucket = 'Admin / To Do'`
- Package classification fields (`package_action`, `quote_needed`,
  `admin_package_note`)
- `planner_tasks` (INSERT/UPDATE/DELETE)
- Company calendar events (INSERT/UPDATE/DELETE)
- Google Ads account linking

### Client Confidential

Data visible only to the owning client.

- `reports` for own client (published only)
- `posts` for own client (through published reports)
- Own client profile info

### Secret

Never exposed to browser or logs.

- Supabase service-role key
- Meta access tokens and app secrets
- Google Ads OAuth tokens
- Microsoft Graph tokens
- Database connection strings
- Signing secrets

## Storage buckets

| Bucket | Classification | Access |
|--------|---------------|--------|
| Operations Hub files | Manager/Admin | Signed URLs, manager-only |
| Client report PDFs | Client Confidential | Signed URLs with TTL |
| Public assets | Public/Internal | Public read |
