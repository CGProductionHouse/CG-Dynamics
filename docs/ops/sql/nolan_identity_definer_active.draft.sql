-- REVIEW ONLY; requires nolan_source_active_reads.draft.sql. No production apply.
-- Preserve existing active-caller visibility and service-role candidate lookup.
-- Target-profile activation is not caller activation. No grant changes.
begin;
do $$
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='cg_staff_identity_candidates' and md5(p.prosrc) in ('0667429d8ae523fd205c3d3005521bf6','aa3f0f50cc3e2482b8efccd1176e6932')) <> 1 then
    raise exception 'Unexpected RPC body: cg_staff_identity_candidates';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='cg_derived_identity_forms' and md5(p.prosrc) in ('31ef1ccb51f7a3e0e8bdca76361bef52','8fbfee3c11d98c437a9aa0b66256250f')) <> 1 then
    raise exception 'Unexpected RPC body: cg_derived_identity_forms';
  end if;
end;
$$;

CREATE OR REPLACE FUNCTION public.cg_staff_identity_candidates()
 RETURNS TABLE(profile_id uuid, form text, rule text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with staff as (
    select id, full_name, email from public.profiles
     where is_active and role in ('admin', 'manager', 'team')
       and (current_setting('role', true) = 'service_role' or public.nolan_source_reader_active())
  ),
  forms as (
    select id, public.cg_normalise_identity(full_name) as form, 'exact_full_name' as rule from staff
    union all
    select id, public.cg_normalise_identity(split_part(email, '@', 1)), 'exact_email_local' from staff
    union all
    -- First token of the display name, e.g. a directory "Ger-Marie Pretorius"
    -- against a profile named "Ger-Marie". Only usable when unique.
    select id, public.cg_normalise_identity(split_part(btrim(full_name), ' ', 1)), 'unique_first_token' from staff
  )
  select id, form, rule from forms where form is not null;
$function$;

CREATE OR REPLACE FUNCTION public.cg_derived_identity_forms(p_profile_id uuid)
 RETURNS TABLE(form text, source_text text, rule text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with p as (select id, full_name, email from public.profiles where id = p_profile_id and public.nolan_source_reader_active()),
  forms as (
    select public.cg_normalise_identity(p.full_name) as form,
           p.full_name as source_text, 'exact_full_name' as rule from p
    union all
    select public.cg_normalise_identity(split_part(p.email, '@', 1)),
           split_part(p.email, '@', 1), 'exact_email_local' from p
    union all
    select public.cg_normalise_identity(split_part(btrim(p.full_name), ' ', 1)),
           split_part(btrim(p.full_name), ' ', 1), 'unique_first_token' from p
  )
  select f.form, min(f.source_text), min(f.rule)
  from forms f
  where f.form is not null
    -- A derived form is only usable if it does not already belong to somebody else.
    and not exists (select 1 from public.cg_staff_identity_candidates() c
                     where c.form = f.form and c.profile_id <> p_profile_id)
  group by f.form;
$function$;
commit;
