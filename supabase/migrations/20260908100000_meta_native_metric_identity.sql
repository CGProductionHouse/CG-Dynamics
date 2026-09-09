-- #236: preserve Meta metric identity. Metadata only; no historical fact rewrite.
begin;

insert into public.metric_registry
  (metric_key, platform, source_metric, display_label, definition, aggregation,
   includes_paid, client_safe, cross_platform_additive, comparable_group, notes)
values
  ('post_engagements', 'facebook', 'page_post_engagements', 'Facebook post engagements',
   'Meta Page post engagements, including clicks. This is not Business Suite Content interactions.',
   'sum', 'both', true, false, 'fb_interactions_v1',
   'Historical content_interactions/page_post_engagements facts retain their provenance; the application displays them as Post engagements.'),
  ('unfollows', 'instagram', 'follows_and_unfollows', 'Instagram unfollows',
   'The NON_FOLLOWER component of Meta follow_type for the requested reporting period.',
   'sum', 'organic', true, false, 'ig_unfollows_v1',
   'Never substitute the combined follows_and_unfollows total for this component.')
on conflict (platform, metric_key, source_metric) do update set
  display_label = excluded.display_label, definition = excluded.definition,
  notes = excluded.notes, updated_at = now();

-- Keep this legacy key readable while correcting its misleading definition.
update public.metric_registry
set display_label = 'Facebook post engagements',
    definition = 'Meta Page post engagements, including clicks. This is not Business Suite Content interactions.',
    notes = 'Legacy semantic key. New connector facts use post_engagements.',
    updated_at = now()
where platform = 'facebook' and metric_key = 'content_interactions'
  and source_metric = 'page_post_engagements';

commit;
