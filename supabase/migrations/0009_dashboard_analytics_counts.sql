create or replace function public.get_owned_story_view_counts()
returns table (story_id text, views bigint, last_viewed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    stories.id as story_id,
    count(distinct events.session_id) filter (where events.event_type = 'story_view') as views,
    max(events.occurred_at) filter (where events.event_type = 'story_view') as last_viewed_at
  from public.stories stories
  left join public.story_analytics_events events on events.story_id = stories.id
  where stories.owner_id = (select auth.uid())
  group by stories.id
  order by stories.updated_at desc;
$$;

revoke execute on function public.get_owned_story_view_counts() from public, anon;
grant execute on function public.get_owned_story_view_counts() to authenticated;

