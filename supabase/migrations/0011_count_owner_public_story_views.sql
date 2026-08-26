-- Public story routes are visitor experiences even when the visitor happens to
-- be the owner. Studio routes disable analytics in the client, so counting an
-- owner here makes dashboard testing reliable without counting editor usage.
create or replace function public.record_story_analytics_event(
  target_story_id text,
  target_session_id uuid,
  target_event_type text,
  target_station_id text default null,
  target_annotation_id text default null,
  target_device_class text default 'desktop',
  target_duration_seconds integer default null,
  target_load_ms integer default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_story public.stories%rowtype;
begin
  if target_event_type not in ('story_view', 'station_view', 'annotation_open', 'story_complete', 'story_exit') then
    raise exception 'Invalid analytics event';
  end if;
  if target_device_class not in ('mobile', 'tablet', 'desktop') then
    raise exception 'Invalid device class';
  end if;

  select * into selected_story from public.stories where id = target_story_id;
  if not found or selected_story.status <> 'published' then return false; end if;

  if target_event_type = 'story_view' and exists (
    select 1 from public.story_analytics_events
    where story_id = target_story_id
      and session_id = target_session_id
      and event_type = target_event_type
  ) then
    if target_load_ms is not null then
      update public.story_analytics_events
      set load_ms = greatest(0, least(target_load_ms, 300000))
      where story_id = target_story_id
        and session_id = target_session_id
        and event_type = 'story_view';
    end if;
    return false;
  end if;
  if target_event_type in ('story_complete', 'story_exit') and exists (
    select 1 from public.story_analytics_events
    where story_id = target_story_id
      and session_id = target_session_id
      and event_type = target_event_type
  ) then return false; end if;
  if target_event_type = 'station_view' and exists (
    select 1 from public.story_analytics_events
    where story_id = target_story_id
      and session_id = target_session_id
      and event_type = target_event_type
      and station_id is not distinct from target_station_id
  ) then return false; end if;

  insert into public.story_analytics_events (
    story_id, session_id, event_type, station_id, annotation_id,
    device_class, duration_seconds, load_ms
  ) values (
    target_story_id, target_session_id, target_event_type,
    left(target_station_id, 160), left(target_annotation_id, 160),
    target_device_class,
    case when target_duration_seconds is null then null
      else greatest(0, least(target_duration_seconds, 86400)) end,
    case when target_load_ms is null then null
      else greatest(0, least(target_load_ms, 300000)) end
  );
  return true;
end;
$$;

grant execute on function public.record_story_analytics_event(text, uuid, text, text, text, text, integer, integer)
  to anon, authenticated;
