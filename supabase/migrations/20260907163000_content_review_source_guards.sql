-- Keep canonical approval state consistent and preserve scheduled/posted history.
create or replace function public.save_content_creative_source(p_deliverable_id uuid, p_design_id text, p_page_id text, p_set_client_workspace boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare d public.monthly_deliverables; source_changed boolean;
begin
 if not public.can_edit_content_deliverable(p_deliverable_id) then raise exception 'Only the assigned staff member or a manager can edit this content'; end if;
 select * into d from public.monthly_deliverables where id=p_deliverable_id for update;
 if d.posted_at is not null or d.production_status in ('posted','scheduled') then raise exception 'Resolve published or scheduled content through Client Schedule before changing its source'; end if;
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
create or replace function public.invalidate_content_review_video() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.script is distinct from old.script or new.title is distinct from old.title
 or new.deliverable_id is distinct from old.deliverable_id or new.content_guideline_id is distinct from old.content_guideline_id
 or new.status is distinct from old.status and new.status='archived' then
 -- Lock canonical schedule rows before their review rows, matching submission.
 perform id from public.monthly_deliverables
 where id in (old.deliverable_id,new.deliverable_id) order by id for update;
 if exists(select 1 from public.monthly_deliverables d join public.content_review_versions v on v.deliverable_id=d.id
 where d.id in (old.deliverable_id,new.deliverable_id) and v.state in ('internal_review','client_review','approved','changes_requested')
 and (d.posted_at is not null or d.production_status in ('posted','scheduled'))) then
 raise exception 'Resolve published or scheduled content through Client Schedule before changing its source';
 end if;
 update public.monthly_deliverables d set production_status='in_progress',internal_approved_at=null,client_approved_at=null
 where d.id in (old.deliverable_id,new.deliverable_id) and exists(
 select 1 from public.content_review_versions v where v.deliverable_id=d.id and v.state in ('internal_review','client_review','approved','changes_requested'));
 insert into public.content_review_events(version_id,actor_id,action)
 select id,auth.uid(),'source_changed' from public.content_review_versions
 where deliverable_id in (old.deliverable_id,new.deliverable_id) and state in ('internal_review','client_review','approved','changes_requested') and auth.uid() is not null;
 update public.content_review_versions set state='superseded'
 where deliverable_id in (old.deliverable_id,new.deliverable_id) and state in ('internal_review','client_review','approved','changes_requested');
 end if;
 return new;
end $$;