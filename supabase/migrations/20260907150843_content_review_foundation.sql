-- Creative sources and immutable review revisions belong to Client Schedule.
-- No second schedule; no provider writes or automatic approval of existing work.
create table public.client_canva_workspaces (
 client_id uuid primary key references public.clients(id),
 design_id text not null check (design_id ~ '^[A-Za-z0-9_-]{6,100}$'),
 updated_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now()
);
create table public.deliverable_creative_sources (
 deliverable_id uuid primary key references public.monthly_deliverables(id),
 canva_design_id text check (canva_design_id ~ '^[A-Za-z0-9_-]{6,100}$'),
 canva_page_id text check (length(canva_page_id) between 1 and 200),
 updated_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now(),
 check ((canva_design_id is null) = (canva_page_id is null))
);
create table public.content_review_versions (
 id uuid primary key default gen_random_uuid(),
 deliverable_id uuid not null references public.monthly_deliverables(id),
 client_id uuid not null references public.clients(id),
 title text not null,
 asset_path text not null unique,
 media_type text not null check (media_type in ('image/jpeg','image/png','image/webp','video/mp4')),
 caption text not null check (length(trim(caption)) between 1 and 10000),
 channels text[] not null check (cardinality(channels) between 1 and 5 and channels <@ array['facebook','instagram','tiktok','linkedin','manual']),
 scheduled_date date,
 scheduled_at timestamptz not null,
 source jsonb not null,
 client_approval_required boolean not null default true,
 state text not null default 'internal_review' check (state in ('internal_review','client_review','approved','changes_requested','superseded')),
 submitted_by uuid not null references public.profiles(id),
 submitted_at timestamptz not null default now(),
 internal_approved_by uuid references public.profiles(id),
 internal_approved_at timestamptz,
 client_approved_by uuid references public.profiles(id),
 client_approved_at timestamptz
);
create unique index content_review_one_current on public.content_review_versions(deliverable_id)
 where state in ('internal_review','client_review','approved','changes_requested');
create index content_review_client_state on public.content_review_versions(client_id,state);
create table public.content_review_events (
 id uuid primary key default gen_random_uuid(),
 version_id uuid not null references public.content_review_versions(id),
 actor_id uuid not null references public.profiles(id),
 action text not null,
 note text,
 created_at timestamptz not null default now()
);

alter table public.client_canva_workspaces enable row level security;
alter table public.deliverable_creative_sources enable row level security;
alter table public.content_review_versions enable row level security;
alter table public.content_review_events enable row level security;
revoke all on public.client_canva_workspaces, public.deliverable_creative_sources, public.content_review_versions, public.content_review_events from anon, authenticated;
grant select on public.client_canva_workspaces, public.deliverable_creative_sources, public.content_review_versions, public.content_review_events to authenticated;
create function public.is_active_content_staff() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','manager','staff','team') and is_active is distinct from false);
$$;
revoke all on function public.is_active_content_staff() from public,anon;
grant execute on function public.is_active_content_staff() to authenticated;
create policy "canva workspace staff read" on public.client_canva_workspaces for select to authenticated using (public.is_active_content_staff());
create policy "creative source staff read" on public.deliverable_creative_sources for select to authenticated using (public.is_active_content_staff());
create policy "review version staff read" on public.content_review_versions for select to authenticated using (public.is_active_content_staff());
create policy "review event staff read" on public.content_review_events for select to authenticated using (public.is_active_content_staff());

create function public.can_edit_content_deliverable(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.monthly_deliverables d join public.profiles p on p.id=auth.uid()
 where d.id=p_id and d.archived_at is null and p.is_active is distinct from false
 and (p.role in ('admin','manager') or (p.role in ('staff','team') and
 (d.assigned_to_user_id=p.id or (d.assigned_to_user_id is null and nullif(d.assigned_to_name,'')=p.full_name)))));
$$;

create function public.save_content_creative_source(p_deliverable_id uuid, p_design_id text, p_page_id text, p_set_client_workspace boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare d public.monthly_deliverables; source_changed boolean;
begin
 if not public.can_edit_content_deliverable(p_deliverable_id) then raise exception 'Only the assigned staff member or a manager can edit this content'; end if;
 select * into d from public.monthly_deliverables where id=p_deliverable_id for update;
 if nullif(trim(p_design_id),'') is null or nullif(trim(p_page_id),'') is null then raise exception 'Choose an exact Canva design and page'; end if;
 select not exists(select 1 from public.deliverable_creative_sources where deliverable_id=d.id and canva_design_id=trim(p_design_id) and canva_page_id=trim(p_page_id)) into source_changed;
 insert into public.deliverable_creative_sources(deliverable_id,canva_design_id,canva_page_id,updated_by)
 values(d.id,trim(p_design_id),trim(p_page_id),auth.uid()) on conflict(deliverable_id) do update set
 canva_design_id=excluded.canva_design_id,canva_page_id=excluded.canva_page_id,updated_by=auth.uid(),updated_at=now();
 -- A changed source requires a fresh snapshot and approval.
 if source_changed then
 insert into public.content_review_events(version_id,actor_id,action)
 select id,auth.uid(),'source_changed' from public.content_review_versions where deliverable_id=d.id and state in ('internal_review','client_review','approved','changes_requested');
 update public.content_review_versions set state='superseded' where deliverable_id=d.id and state in ('internal_review','client_review','approved','changes_requested');
 if found then update public.monthly_deliverables set production_status='in_progress',internal_approved_at=null,client_approved_at=null where id=d.id; end if;
 end if;
 if p_set_client_workspace then
   if not public.is_manager() then raise exception 'Only managers can set the client Canva workspace'; end if;
   insert into public.client_canva_workspaces(client_id,design_id,updated_by) values(d.client_id,trim(p_design_id),auth.uid())
   on conflict(client_id) do update set design_id=excluded.design_id,updated_by=auth.uid(),updated_at=now();
 end if;
end $$;

create function public.can_upload_content_snapshot(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select case when split_part(p_path,'/',1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 then public.can_edit_content_deliverable(split_part(p_path,'/',1)::uuid) else false end;
$$;
revoke all on function public.can_upload_content_snapshot(text) from public,anon;
grant execute on function public.can_upload_content_snapshot(text) to authenticated;

-- INSERT only, unique paths, no overwrite/delete: reviewed media remains immutable.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('content-review-snapshots','content-review-snapshots',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4']);
create policy "review snapshot assigned upload" on storage.objects for insert to authenticated
 with check(bucket_id='content-review-snapshots' and public.can_upload_content_snapshot(name));
create function public.can_read_content_snapshot(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active is distinct from false and
 (p.role in ('admin','manager','staff','team') or (p.role='client' and exists(
 select 1 from public.content_review_versions v where v.asset_path=p_path and v.client_id=p.client_id
 and v.client_approval_required and v.state in ('client_review','approved') and v.internal_approved_at is not null))));
$$;
create policy "review snapshot authorised read" on storage.objects for select to authenticated
 using(bucket_id='content-review-snapshots' and public.can_read_content_snapshot(name));
-- Restrictive guards also protect against unrelated broad permissive policies.
create policy "review snapshot no overwrite" on storage.objects as restrictive for update to authenticated
 using(bucket_id <> 'content-review-snapshots') with check(bucket_id <> 'content-review-snapshots');
create policy "review snapshot no delete" on storage.objects as restrictive for delete to authenticated
 using(bucket_id <> 'content-review-snapshots');
create policy "review snapshot read boundary" on storage.objects as restrictive for select to authenticated
 using(bucket_id <> 'content-review-snapshots' or public.can_read_content_snapshot(name));
create policy "review snapshot insert boundary" on storage.objects as restrictive for insert to authenticated
 with check(bucket_id <> 'content-review-snapshots' or public.can_upload_content_snapshot(name));

create function public.submit_content_review(p_deliverable_id uuid,p_asset_path text,p_caption text,p_channels text[],p_scheduled_at timestamptz,p_client_required boolean default true)
returns uuid language plpgsql security definer set search_path='' as $$
declare d public.monthly_deliverables; s public.deliverable_creative_sources; v_id uuid; mime text; source_data jsonb; video_id uuid;
begin
 if not public.can_edit_content_deliverable(p_deliverable_id) then raise exception 'Only the assigned staff member or a manager can submit this content'; end if;
 if not p_client_required and not public.is_manager() then raise exception 'A manager must choose internal approval only'; end if;
 select * into d from public.monthly_deliverables where id=p_deliverable_id for update;
 if d.client_id is null then raise exception 'Link the schedule item to a client first'; end if;
 if d.posted_at is not null or d.production_status in ('posted','scheduled') then raise exception 'Resolve published or scheduled content through Client Schedule before submitting a new review'; end if;
 if d.scheduled_date is null or (p_scheduled_at at time zone 'Africa/Johannesburg')::date is distinct from d.scheduled_date then raise exception 'Review time must match the canonical Client Schedule date'; end if;
 if p_scheduled_at <= now() then raise exception 'Choose a future publication time'; end if;
 if split_part(p_asset_path,'/',1) <> d.id::text then raise exception 'Review file belongs to another schedule item'; end if;
 select metadata->>'mimetype' into mime from storage.objects where bucket_id='content-review-snapshots' and name=p_asset_path;
 if mime is null then raise exception 'Upload the final review file first'; end if;
 select * into s from public.deliverable_creative_sources where deliverable_id=d.id;
 select id into video_id from public.content_guide_ideas where deliverable_id=d.id and client_id=d.client_id and content_guideline_id is not null and status <> 'archived';
 if d.deliverable_type in ('video','reel') then
   if video_id is null then raise exception 'Link the canonical guideline video first'; end if;
   source_data=jsonb_build_object('type','content_guideline_video','video_id',video_id);
 else
   if s.canva_design_id is null then raise exception 'Link the exact Canva page first'; end if;
   source_data=jsonb_build_object('type','canva_page','design_id',s.canva_design_id,'page_id',s.canva_page_id);
 end if;
 update public.content_review_versions set state='superseded' where deliverable_id=d.id and state in ('internal_review','client_review','approved','changes_requested');
 insert into public.content_review_versions(deliverable_id,client_id,title,asset_path,media_type,caption,channels,scheduled_date,scheduled_at,source,client_approval_required,submitted_by)
 values(d.id,d.client_id,d.title,p_asset_path,mime,trim(p_caption),p_channels,d.scheduled_date,p_scheduled_at,source_data,p_client_required,auth.uid()) returning id into v_id;
 update public.monthly_deliverables set production_status='ready_internal_review',internal_approved_at=null,client_approved_at=null where id=d.id;
 insert into public.content_review_events(version_id,actor_id,action) values(v_id,auth.uid(),'submitted');
 return v_id;
end $$;

create function public.decide_content_review(p_version_id uuid,p_approve boolean,p_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v public.content_review_versions; d public.monthly_deliverables; p public.profiles;
begin
 if p_approve is null then raise exception 'Choose approve or request changes'; end if;
 select * into p from public.profiles where id=auth.uid() and is_active is distinct from false;
 if p.id is null then raise exception 'Active account required'; end if;
 -- Same lock order as submission and schedule edits.
 select * into d from public.monthly_deliverables where id=(select deliverable_id from public.content_review_versions where id=p_version_id) for update;
 select * into v from public.content_review_versions where id=p_version_id for update;
 if v.id is null or d.archived_at is not null or d.client_id is distinct from v.client_id or d.scheduled_date is distinct from v.scheduled_date then raise exception 'Content changed; request a new review'; end if;
 if p_approve and v.scheduled_at <= now() then raise exception 'Publication time has passed; reschedule and submit a new review'; end if;
 if v.state='internal_review' and p.role in ('admin','manager') then
   update public.content_review_versions set state=case when not p_approve then 'changes_requested' when client_approval_required then 'client_review' else 'approved' end,
    internal_approved_by=case when p_approve then p.id end,internal_approved_at=case when p_approve then now() end where id=v.id;
 elsif v.state='client_review' and p.role='client' and p.client_id=v.client_id then
   update public.content_review_versions set state=case when p_approve then 'approved' else 'changes_requested' end,
    client_approved_by=case when p_approve then p.id end,client_approved_at=case when p_approve then now() end where id=v.id;
 else raise exception 'This review is not awaiting your approval'; end if;
 update public.monthly_deliverables set
 production_status=case when not p_approve then case when v.state='internal_review' then 'internal_changes' else 'client_changes' end
   when v.state='internal_review' and v.client_approval_required then 'waiting_client' else 'approved' end,
 internal_approved_at=case when v.state='internal_review' and p_approve then now() else internal_approved_at end,
 sent_to_client_at=case when v.state='internal_review' and p_approve and v.client_approval_required then now() else sent_to_client_at end,
 client_approved_at=case when v.state='client_review' and p_approve then now() else client_approved_at end
 where id=d.id;
 if not p_approve and nullif(trim(p_note),'') is null then raise exception 'Add a short change request'; end if;
 insert into public.content_review_events(version_id,actor_id,action,note) values(v.id,p.id,
   case when v.state='internal_review' then 'internal_' else 'client_' end || case when p_approve then 'approved' else 'changes_requested' end,left(p_note,2000));
end $$;

create function public.client_content_review_queue() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'asset_path',v.asset_path,'media_type',v.media_type,'caption',v.caption,'channels',v.channels,'scheduled_at',v.scheduled_at,'state',v.state) order by v.scheduled_at),'[]'::jsonb)
 from public.content_review_versions v join public.profiles p on p.id=auth.uid() and p.role='client' and p.is_active is distinct from false
 where v.client_id=p.client_id and v.client_approval_required and v.state in ('client_review','approved') and v.internal_approved_at is not null;
$$;

create function public.invalidate_content_review_schedule() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.client_id is distinct from old.client_id and exists(select 1 from public.content_review_versions where deliverable_id=old.id) then
 raise exception 'A schedule item with review history cannot change client'; end if;
 if new.scheduled_date is distinct from old.scheduled_date or new.title is distinct from old.title or new.archived_at is distinct from old.archived_at then
 if exists(select 1 from public.content_review_versions where deliverable_id=old.id and state in ('internal_review','client_review','approved','changes_requested')) then
 new.internal_approved_at=null; new.client_approved_at=null;
 if new.production_status not in ('posted','scheduled') then new.production_status='in_progress'; end if;
 end if;
 update public.content_review_versions set state='superseded' where deliverable_id=old.id and state in ('internal_review','client_review','approved','changes_requested'); end if;
 return new;
end $$;
create trigger invalidate_content_review_schedule before update on public.monthly_deliverables for each row execute function public.invalidate_content_review_schedule();

revoke all on function public.can_edit_content_deliverable(uuid),public.can_read_content_snapshot(text),public.save_content_creative_source(uuid,text,text,boolean),public.submit_content_review(uuid,text,text,text[],timestamptz,boolean),public.decide_content_review(uuid,boolean,text),public.client_content_review_queue() from public,anon;
grant execute on function public.can_edit_content_deliverable(uuid),public.can_read_content_snapshot(text),public.save_content_creative_source(uuid,text,text,boolean),public.submit_content_review(uuid,text,text,text[],timestamptz,boolean),public.decide_content_review(uuid,boolean,text),public.client_content_review_queue() to authenticated;
revoke all on function public.invalidate_content_review_schedule() from public,anon,authenticated;

-- Client and anonymous access must never inherit a broad unrelated storage policy.
create policy "review snapshot anonymous boundary" on storage.objects as restrictive for select to anon
 using(bucket_id <> 'content-review-snapshots');
create function public.guard_content_review_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Review history is immutable'; end if;
 if (to_jsonb(new) - array['state','internal_approved_by','internal_approved_at','client_approved_by','client_approved_at'])
 is distinct from (to_jsonb(old) - array['state','internal_approved_by','internal_approved_at','client_approved_by','client_approved_at']) then
 raise exception 'Submit a new review version to change approved content'; end if;
 return new;
end $$;
create trigger guard_content_review_immutable before update or delete on public.content_review_versions
 for each row execute function public.guard_content_review_immutable();
revoke all on function public.guard_content_review_immutable() from public,anon,authenticated;

-- Editing the linked video source invalidates the prior review, without altering
-- the immutable export or silently approving the replacement creative.
create function public.invalidate_content_review_video() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.script is distinct from old.script or new.title is distinct from old.title
 or new.deliverable_id is distinct from old.deliverable_id or new.content_guideline_id is distinct from old.content_guideline_id then
 update public.content_review_versions set state='superseded'
 where deliverable_id in (old.deliverable_id,new.deliverable_id) and state in ('internal_review','client_review','approved','changes_requested');
 end if;
 return new;
end $$;
create trigger invalidate_content_review_video before update on public.content_guide_ideas
 for each row execute function public.invalidate_content_review_video();
revoke all on function public.invalidate_content_review_video() from public,anon,authenticated;
