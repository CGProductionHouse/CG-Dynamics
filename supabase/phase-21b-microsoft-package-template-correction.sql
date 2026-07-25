-- ============================================================================
-- phase-21b-microsoft-package-template-correction.sql
--
-- Server-side apply path for the `package_template_create` reconciliation action.
-- A supported source task (e.g. Action Sport "VIDEO - ACTION") can prove that an
-- active package is missing exactly one deterministic template (canonical
-- "Video 1"). This RPC inserts that single template, idempotently and with strict
-- guards, so the dependent monthly deliverable can then be created/linked.
--
-- Admin-only (SECURITY DEFINER + is_admin) and bound to an active, applying
-- Microsoft sync run — mirroring apply_microsoft_sync_item's authority model.
--
-- Guards: package must exist, be active and belong to the client; a canonical
-- code/type/instance are required; if the exact template already exists it is
-- returned unchanged (idempotent); if ANY compatible active template of the same
-- type already exists the correction is rejected (never ambiguous, never a second
-- template, never inferred from package totals).
--
-- Additive and idempotent. No existing object is modified. Depends on phase-17a.
-- ============================================================================

create or replace function public.apply_microsoft_package_template_correction(
  p_run_id uuid,
  p_package_id uuid,
  p_client_id uuid,
  p_code text,
  p_deliverable_type text,
  p_instance_number integer
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_template_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  if not exists (
    select 1 from public.microsoft_sync_settings where id = true and transition_status = 'active'
  ) then
    raise exception 'Microsoft transition sync is not active';
  end if;

  if not exists (
    select 1 from public.microsoft_sync_runs where id = p_run_id and status = 'applying'
  ) then
    raise exception 'Microsoft sync run is not applying';
  end if;

  if p_code is null or btrim(p_code) = '' or p_deliverable_type is null
     or p_instance_number is null or p_instance_number < 1 then
    raise exception 'A canonical code, deliverable type and positive instance are required';
  end if;

  -- Package must exist, be active and belong to the exact client.
  if not exists (
    select 1 from public.client_packages
    where id = p_package_id and client_id = p_client_id and status = 'active'
  ) then
    raise exception 'Active package not found for client';
  end if;

  -- Idempotent: the exact canonical template already exists -> return it.
  select id into v_template_id
  from public.package_deliverable_templates
  where package_id = p_package_id and active
    and deliverable_type = p_deliverable_type
    and lower(btrim(code)) = lower(btrim(p_code))
  limit 1;
  if found then return v_template_id; end if;

  -- Reject when a compatible active template of the same type already exists:
  -- the correction only applies to a genuinely missing template.
  if exists (
    select 1 from public.package_deliverable_templates
    where package_id = p_package_id and active and deliverable_type = p_deliverable_type
  ) then
    raise exception 'A compatible active template already exists; template correction not applicable';
  end if;

  -- Insert exactly one template. count_per_month = 1 (never adds package quantity).
  insert into public.package_deliverable_templates
    (package_id, code, deliverable_type, title_template, count_per_month, active)
  values
    (p_package_id, btrim(p_code), p_deliverable_type, btrim(p_code), 1, true)
  returning id into v_template_id;

  return v_template_id;
end;
$$;

revoke all on function public.apply_microsoft_package_template_correction(uuid,uuid,uuid,text,text,integer) from public;
revoke all on function public.apply_microsoft_package_template_correction(uuid,uuid,uuid,text,text,integer) from anon;
grant execute on function public.apply_microsoft_package_template_correction(uuid,uuid,uuid,text,text,integer) to authenticated;
