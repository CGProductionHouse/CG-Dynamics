-- #269 authorization portion of codex/tiktok-business-agency, adapted to the
-- shared #220 queue. Intentionally omits its obsolete separate publish_jobs.
-- REVIEW ONLY: no production application or OAuth grant.
begin;
create table public.tiktok_business_authorizations (
 id uuid primary key default gen_random_uuid(),
 connection_id uuid not null unique references public.tiktok_connections(id) on delete restrict,
 client_id uuid not null references public.clients(id) on delete restrict,
 business_open_id text not null unique,
 account_handle text not null,
 display_name text,
 status text not null check(status in ('connected','needs_reauth','revoked','pending_review','error')),
 granted_permissions text[] not null default '{}',
 publishing_eligibility text not null default 'not_approved' check(publishing_eligibility in ('not_approved','video_only','photo_only','video_and_photo','suspended')),
 token_expires_at timestamptz not null,refresh_token_expires_at timestamptz not null,
 last_verified_at timestamptz not null default now(),connected_by uuid not null references public.profiles(id),
 refresh_fence uuid,refresh_started_at timestamptz,last_error_code text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index tiktok_business_authorizations_one_active_per_client
 on public.tiktok_business_authorizations(client_id) where status in ('connected','needs_reauth','pending_review');
create table public.tiktok_business_authorization_tokens (
 authorization_id uuid primary key references public.tiktok_business_authorizations(id) on delete restrict,
 access_token text not null check(access_token like 'cg-tiktok-business-token:v1:%'),
 refresh_token text not null check(refresh_token like 'cg-tiktok-business-token:v1:%'),
 updated_at timestamptz not null default now()
);
create table public.tiktok_business_oauth_states (
 id uuid primary key default gen_random_uuid(),state_hash text not null unique check(state_hash ~ '^[a-f0-9]{64}$'),
 client_id uuid not null references public.clients(id),connection_id uuid not null references public.tiktok_connections(id),
 requested_by uuid not null references public.profiles(id),expected_handle text not null,
 expires_at timestamptz not null,used_at timestamptz,completed_at timestamptz,created_at timestamptz not null default now()
);
alter table public.tiktok_business_authorizations enable row level security;
alter table public.tiktok_business_authorization_tokens enable row level security;
alter table public.tiktok_business_oauth_states enable row level security;
revoke all on public.tiktok_business_authorizations,public.tiktok_business_authorization_tokens,public.tiktok_business_oauth_states from public,anon,authenticated;
grant all on public.tiktok_business_authorizations,public.tiktok_business_authorization_tokens,public.tiktok_business_oauth_states to service_role;
grant select(id,connection_id,client_id,business_open_id,account_handle,display_name,status,granted_permissions,
 publishing_eligibility,token_expires_at,refresh_token_expires_at,last_verified_at,connected_by,created_at,updated_at,last_error_code)
 on public.tiktok_business_authorizations to authenticated;
create policy "business authorization active managers" on public.tiktok_business_authorizations for select to authenticated
 using(exists(select 1 from public.profiles where id=(select auth.uid()) and is_active and role in ('admin','manager')));

create function public.guard_tiktok_business_identity() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_table_name='tiktok_connections' then
  if new.client_id is distinct from old.client_id and exists(select 1 from public.tiktok_business_authorizations where connection_id=old.id)
  then raise exception 'Business-authorized TikTok identity cannot be reassigned'; end if;
 elsif not exists(select 1 from public.tiktok_connections where id=new.connection_id and client_id=new.client_id)
 then raise exception 'TikTok Business authorization crosses client boundary'; end if;
 return new;
end $$;
create trigger guard_tiktok_business_authorization_client before insert or update of connection_id,client_id
 on public.tiktok_business_authorizations for each row execute function public.guard_tiktok_business_identity();
create trigger guard_business_authorized_connection_client before update of client_id on public.tiktok_connections
 for each row execute function public.guard_tiktok_business_identity();
revoke all on function public.guard_tiktok_business_identity() from public,anon,authenticated;
grant execute on function public.guard_tiktok_business_identity() to service_role;

create function public.consume_tiktok_business_oauth_state(p_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s public.tiktok_business_oauth_states;
begin
 update public.tiktok_business_oauth_states set used_at=now() where state_hash=p_hash and used_at is null and expires_at>now()
 returning * into s;
 if s.id is null
  or not exists(select 1 from public.profiles where id=s.requested_by and is_active and role in ('admin','manager'))
  or not exists(select 1 from public.clients where id=s.client_id and active)
  or not exists(select 1 from public.tiktok_connections where id=s.connection_id and client_id=s.client_id and status='connected')
 then return null; end if;
 return to_jsonb(s)-'state_hash';
end $$;

-- Atomic metadata + encrypted credentials, with current actor/client/mapping
-- recheck. A failure cannot leave a false 'connected' metadata row.
create function public.complete_tiktok_business_oauth(p_state uuid,p_open_id text,p_handle text,p_display text,
 p_scopes text[],p_access text,p_refresh text,p_access_expiry timestamptz,p_refresh_expiry timestamptz) returns uuid
language plpgsql security invoker set search_path='' as $$
declare s public.tiktok_business_oauth_states; a public.tiktok_business_authorizations; aid uuid;
begin
 select * into s from public.tiktok_business_oauth_states where id=p_state for update;
 perform 1 from public.tiktok_connections where id=s.connection_id for share;
 if s.id is null or s.used_at is null or s.completed_at is not null or s.expires_at<=now()
  or s.expected_handle is distinct from p_handle or nullif(p_open_id,'') is null
  or p_access_expiry<=now() or p_refresh_expiry<=now()
  or not exists(select 1 from public.profiles where id=s.requested_by and is_active and role in ('admin','manager'))
  or not exists(select 1 from public.clients where id=s.client_id and active)
  or not exists(select 1 from public.tiktok_connections where id=s.connection_id and client_id=s.client_id and status='connected')
 then raise exception 'Current exact TikTok authorization required'; end if;
 select * into a from public.tiktok_business_authorizations where connection_id=s.connection_id for update;
 if a.id is not null and (a.business_open_id<>p_open_id or a.client_id<>s.client_id)
 then raise exception 'TikTok account replacement requires explicit mapping review'; end if;
 insert into public.tiktok_business_authorizations(connection_id,client_id,business_open_id,account_handle,display_name,status,
  granted_permissions,token_expires_at,refresh_token_expires_at,connected_by)
 values(s.connection_id,s.client_id,p_open_id,p_handle,left(p_display,200),'connected',p_scopes,p_access_expiry,p_refresh_expiry,s.requested_by)
 on conflict(connection_id) do update set account_handle=excluded.account_handle,display_name=excluded.display_name,
  status='connected',granted_permissions=excluded.granted_permissions,token_expires_at=excluded.token_expires_at,
  refresh_token_expires_at=excluded.refresh_token_expires_at,connected_by=excluded.connected_by,last_verified_at=now(),updated_at=now(),
  refresh_fence=null,refresh_started_at=null,last_error_code=null
 where public.tiktok_business_authorizations.business_open_id=excluded.business_open_id
  and public.tiktok_business_authorizations.client_id=excluded.client_id
 returning id into aid;
 if aid is null then raise exception 'Concurrent TikTok identity conflict'; end if;
 insert into public.tiktok_business_authorization_tokens(authorization_id,access_token,refresh_token)
 values(aid,p_access,p_refresh) on conflict(authorization_id) do update
 set access_token=excluded.access_token,refresh_token=excluded.refresh_token,updated_at=now();
 update public.tiktok_business_oauth_states set completed_at=now() where id=s.id;
 return aid;
end $$;
revoke all on function public.consume_tiktok_business_oauth_state(text),
 public.complete_tiktok_business_oauth(uuid,text,text,text,text[],text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.consume_tiktok_business_oauth_state(text),
 public.complete_tiktok_business_oauth(uuid,text,text,text,text[],text,text,timestamptz,timestamptz) to service_role;

create function public.claim_tiktok_business_refresh(p_authorization uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.tiktok_business_authorizations; encrypted text; fence uuid:=gen_random_uuid();
begin
 select * into a from public.tiktok_business_authorizations where id=p_authorization for update;
 if a.id is null or a.status<>'connected' or a.token_expires_at>now()+interval '10 minutes'
  or not exists(select 1 from public.clients where id=a.client_id and active)
  or not exists(select 1 from public.tiktok_connections where id=a.connection_id and client_id=a.client_id and status='connected') then return null; end if;
 if a.refresh_token_expires_at<=now() or (a.refresh_fence is not null and a.refresh_started_at<now()-interval '2 minutes') then
  update public.tiktok_business_authorizations set status='needs_reauth',last_error_code='REFRESH_OUTCOME_UNVERIFIED' where id=a.id;
  return null;
 end if;
 if a.refresh_fence is not null then return null; end if;
 select refresh_token into encrypted from public.tiktok_business_authorization_tokens where authorization_id=a.id;
 if encrypted is null then return null; end if;
 update public.tiktok_business_authorizations set refresh_fence=fence,refresh_started_at=now() where id=a.id;
 return jsonb_build_object('id',a.id,'connectionId',a.connection_id,'openId',a.business_open_id,'fence',fence,'refresh',encrypted);
end $$;
create function public.save_tiktok_business_refresh(p_authorization uuid,p_fence uuid,p_open_id text,p_access text,p_refresh text,
 p_scopes text[],p_access_expiry timestamptz,p_refresh_expiry timestamptz) returns boolean
language plpgsql security invoker set search_path='' as $$
declare a public.tiktok_business_authorizations;
begin
 select * into a from public.tiktok_business_authorizations where id=p_authorization for update;
 if a.id is null or a.status<>'connected' or a.refresh_fence is distinct from p_fence or p_fence is null
  or a.refresh_started_at<now()-interval '2 minutes' or a.business_open_id is distinct from p_open_id
  or p_access_expiry<=now() or p_refresh_expiry<=now() then return false; end if;
 update public.tiktok_business_authorization_tokens set access_token=p_access,refresh_token=p_refresh,updated_at=now() where authorization_id=a.id;
 if not found then raise exception 'TikTok Business credential receipt missing'; end if;
 update public.tiktok_business_authorizations set granted_permissions=p_scopes,token_expires_at=p_access_expiry,
  refresh_token_expires_at=p_refresh_expiry,refresh_fence=null,refresh_started_at=null,last_error_code=null,last_verified_at=now(),updated_at=now() where id=a.id;
 return true;
end $$;
create function public.fail_tiktok_business_refresh(p_authorization uuid,p_fence uuid) returns void
language sql security invoker set search_path='' as $$
 update public.tiktok_business_authorizations set status='needs_reauth',last_error_code='REFRESH_OUTCOME_UNVERIFIED'
 where id=p_authorization and refresh_fence=p_fence
$$;
revoke all on function public.claim_tiktok_business_refresh(uuid),public.save_tiktok_business_refresh(uuid,uuid,text,text,text,text[],timestamptz,timestamptz),public.fail_tiktok_business_refresh(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_tiktok_business_refresh(uuid),public.save_tiktok_business_refresh(uuid,uuid,text,text,text,text[],timestamptz,timestamptz),public.fail_tiktok_business_refresh(uuid,uuid) to service_role;
commit;
