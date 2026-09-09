-- Add governed email/signature/collateral fields to staff_assistant_profiles.
-- Prepared only. Do not apply to production without explicit CA approval.

-- 1. Add email profile fields
alter table public.staff_assistant_profiles
  add column if not exists preferred_company_from text,
  add column if not exists professional_display_name text,
  add column if not exists role_title text,
  add column if not exists approved_work_phone text,
  add column if not exists signature_text text,
  add column if not exists signature_asset_reference text,
  add column if not exists email_setup_status text not null default 'incomplete'
    check (email_setup_status in ('ready', 'pending_ca_setup', 'incomplete')),
  add column if not exists mail_scope text not null default 'owned_threads_only'
    check (mail_scope in ('company_mail_manager', 'owned_threads_only')),
  add column if not exists approved_collateral_set text[] not null default '{}';

-- 2. Constrain text lengths
alter table public.staff_assistant_profiles
  add constraint staff_assistant_preferred_from_length
    check (char_length(coalesce(preferred_company_from, '')) <= 320),
  add constraint staff_assistant_display_name_length
    check (char_length(coalesce(professional_display_name, '')) <= 120),
  add constraint staff_assistant_role_title_length
    check (char_length(coalesce(role_title, '')) <= 120),
  add constraint staff_assistant_work_phone_length
    check (char_length(coalesce(approved_work_phone, '')) <= 40),
  add constraint staff_assistant_signature_text_length
    check (char_length(coalesce(signature_text, '')) <= 2000),
  add constraint staff_assistant_signature_asset_length
    check (char_length(coalesce(signature_asset_reference, '')) <= 500);

comment on column public.staff_assistant_profiles.preferred_company_from is
  'Approved CG company email identity (From address). Never a raw Gmail sender. Never stores mailbox credentials.';
comment on column public.staff_assistant_profiles.professional_display_name is
  'Staff member professional display name for email correspondence.';
comment on column public.staff_assistant_profiles.role_title is
  'Staff member official role/title for email signatures and correspondence.';
comment on column public.staff_assistant_profiles.approved_work_phone is
  'Approved CG work phone number for email signatures. Never stores personal/mobile unless approved.';
comment on column public.staff_assistant_profiles.signature_text is
  'Approved professional email signature text (name, title, work number, sign-off). No HTML/branding assets.';
comment on column public.staff_assistant_profiles.signature_asset_reference is
  'Governed Google Drive asset reference for approved email signature/banner image. Versioned, never frozen.';
comment on column public.staff_assistant_profiles.email_setup_status is
  'Per-staff email readiness: ready = configured and verified; pending_ca_setup = awaiting CA configuration; incomplete = not yet set up.';
comment on column public.staff_assistant_profiles.mail_scope is
  'Mail authority scope: company_mail_manager = full CG inbox triage (Amonique); owned_threads_only = threads tied to owned leads/tasks only.';
comment on column public.staff_assistant_profiles.approved_collateral_set is
  'List of governed Google Drive asset references/version keys for approved collateral (e.g. CG Business Profile PDF, Wedding Packages PDF). Never frozen into Project Instructions.';
