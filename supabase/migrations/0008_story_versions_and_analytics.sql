create table if not exists public.story_versions (
  id bigint generated always as identity primary key,
  story_id text not null references public.stories(id) on delete cascade,
  version_number integer not null,
  snapshot jsonb not null,
  reason text not null default 'autosave'
    check (reason in ('autosave', 'published', 'unpublished', 'before_restore', 'restored')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (story_id, version_number)
);

create index if not exists story_versions_story_created_idx
  on public.story_versions (story_id, created_at desc);

create table if not exists public.story_analytics_events (
  id bigint generated always as identity primary key,
  story_id text not null references public.stories(id) on delete cascade,
  session_id uuid not null,
  event_type text not null
    check (event_type in ('story_view', 'station_view', 'annotation_open', 'story_complete', 'story_exit')),
  station_id text,
  annotation_id text,
  device_class text not null default 'desktop'
    check (device_class in ('mobile', 'tablet', 'desktop')),
  duration_seconds integer check (duration_seconds between 0 and 86400),
  load_ms integer check (load_ms between 0 and 300000),
  occurred_at timestamptz not null default now()
);

create index if not exists story_analytics_story_time_idx
  on public.story_analytics_events (story_id, occurred_at desc);
create index if not exists story_analytics_story_session_idx
  on public.story_analytics_events (story_id, session_id);

alter table public.story_versions enable row level security;
alter table public.story_analytics_events enable row level security;

drop policy if exists "owners and editors read story versions" on public.story_versions;
create policy "owners and editors read story versions"
  on public.story_versions for select to authenticated
  using (
    public.is_story_owner(story_id)
    or exists (
      select 1 from public.story_collaborators
      where story_id = story_versions.story_id
        and user_id = (select auth.uid())
        and role = 'editor'
        and status = 'accepted'
    )
  );

-- Raw analytics stay private. Even collaborators and administrators do not
-- receive access unless they are the story owner.
drop policy if exists "owners read story analytics" on public.story_analytics_events;
create policy "owners read story analytics"
  on public.story_analytics_events for select to authenticated
  using (public.is_story_owner(story_id));

create or replace function private.next_story_version_number(target_story_id text)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select coalesce(max(version_number), 0) + 1
  from public.story_versions
  where story_id = target_story_id;
$$;

create or replace function private.story_version_snapshot(source public.stories)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'slug', source.slug,
    'title', source.title,
    'story', source.story,
    'status', source.status,
    'published_at', source.published_at,
    'captured_updated_at', source.updated_at
  );
$$;

create or replace function public.capture_story_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_reason text := 'autosave';
  latest_version_at timestamptz;
begin
  if old.story is not distinct from new.story
    and old.title is not distinct from new.title
    and old.slug is not distinct from new.slug
    and old.status is not distinct from new.status then
    return new;
  end if;

  if old.status is distinct from new.status then
    snapshot_reason := case when new.status = 'published' then 'published' else 'unpublished' end;
  end if;

  select max(created_at) into latest_version_at
  from public.story_versions where story_id = new.id;

  -- Autosaves are grouped into ten-minute checkpoints. Publication changes
  -- always create a dedicated, immediately restorable version.
  if snapshot_reason <> 'autosave'
    or latest_version_at is null
    or latest_version_at < now() - interval '10 minutes' then
    insert into public.story_versions (
      story_id, version_number, snapshot, reason, created_by
    ) values (
      new.id,
      private.next_story_version_number(new.id),
      case when snapshot_reason = 'autosave'
        then private.story_version_snapshot(old)
        else private.story_version_snapshot(new)
      end,
      snapshot_reason,
      (select auth.uid())
    );

    delete from public.story_versions
    where story_id = new.id
      and id not in (
        select id from public.story_versions
        where story_id = new.id
        order by created_at desc, id desc
        limit 50
      );
  end if;
  return new;
end;
$$;

drop trigger if exists capture_story_version_after_update on public.stories;
create trigger capture_story_version_after_update
  after update on public.stories
  for each row execute procedure public.capture_story_version();

create or replace function public.restore_story_version(target_version_id bigint)
returns public.stories
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_version public.story_versions%rowtype;
  current_story public.stories%rowtype;
  restored_story public.stories%rowtype;
  may_edit boolean;
begin
  select * into selected_version
  from public.story_versions where id = target_version_id;
  if not found then raise exception 'Version not found'; end if;

  select * into current_story
  from public.stories where id = selected_version.story_id for update;
  may_edit := current_story.owner_id = (select auth.uid()) or exists (
    select 1 from public.story_collaborators
    where story_id = current_story.id
      and user_id = (select auth.uid())
      and role = 'editor' and status = 'accepted'
  );
  if not may_edit or not private.can_create_stories() then
    raise exception 'Story edit permission required';
  end if;

  insert into public.story_versions (story_id, version_number, snapshot, reason, created_by)
  values (
    current_story.id,
    private.next_story_version_number(current_story.id),
    private.story_version_snapshot(current_story),
    'before_restore',
    (select auth.uid())
  );

  update public.stories set
    slug = coalesce(selected_version.snapshot ->> 'slug', current_story.slug),
    title = coalesce(selected_version.snapshot ->> 'title', current_story.title),
    story = jsonb_set(
      coalesce(selected_version.snapshot -> 'story', current_story.story),
      '{updatedAt}', to_jsonb(now()::text), true
    ),
    updated_at = now()
  where id = current_story.id
  returning * into restored_story;

  return restored_story;
end;
$$;

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
  if selected_story.owner_id = (select auth.uid()) then return false; end if;

  if target_event_type in ('story_view', 'story_complete', 'story_exit') and exists (
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
    greatest(0, least(coalesce(target_duration_seconds, 0), 86400)),
    greatest(0, least(coalesce(target_load_ms, 0), 300000))
  );
  return true;
end;
$$;

create or replace function public.get_story_analytics(target_story_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_story_owner(target_story_id) then
    raise exception 'Story owner access required';
  end if;

  with events as (
    select * from public.story_analytics_events where story_id = target_story_id
  ), sessions as (
    select
      session_id,
      min(occurred_at) as started_at,
      max(occurred_at) as ended_at,
      bool_or(event_type = 'story_complete') as completed,
      max(duration_seconds) filter (where event_type = 'story_exit') as exit_duration
    from events group by session_id
  ), summary as (
    select jsonb_build_object(
      'views', (select count(distinct session_id) from events where event_type = 'story_view'),
      'completed', count(*) filter (where completed),
      'completionRate', case when count(*) = 0 then 0 else
        round(100.0 * count(*) filter (where completed) / count(*), 1) end,
      'averageDurationSeconds', coalesce(round(avg(coalesce(exit_duration,
        extract(epoch from (ended_at - started_at))))), 0),
      'annotationOpens', (select count(*) from events where event_type = 'annotation_open'),
      'averageLoadMs', coalesce((select round(avg(load_ms)) from events
        where event_type = 'story_view' and load_ms is not null), 0)
    ) as value from sessions
  ), station_rows as (
    select
      station.value ->> 'id' as station_id,
      coalesce(nullif(station.value ->> 'title', ''), 'Station ' || station.ordinality) as title,
      station.ordinality as position,
      count(distinct events.session_id) as views
    from public.stories story,
      jsonb_array_elements(coalesce(story.story -> 'stations', '[]'::jsonb))
        with ordinality as station(value, ordinality)
    left join events on events.event_type = 'station_view'
      and events.station_id = station.value ->> 'id'
    where story.id = target_story_id
    group by station.value, station.ordinality
    order by station.ordinality
  ), daily_rows as (
    select date_trunc('day', occurred_at)::date as day, count(distinct session_id) as views
    from events
    where event_type = 'story_view' and occurred_at >= now() - interval '30 days'
    group by 1 order by 1
  ), device_rows as (
    select device_class, count(distinct session_id) as views
    from events where event_type = 'story_view'
    group by device_class order by views desc
  )
  select jsonb_build_object(
    'summary', (select value from summary),
    'stations', coalesce((select jsonb_agg(jsonb_build_object(
      'stationId', station_id, 'title', title, 'position', position, 'views', views
    ) order by position) from station_rows), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'views', views) order by day)
      from daily_rows), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('device', device_class, 'views', views))
      from device_rows), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on public.story_versions from anon, authenticated;
revoke all on public.story_analytics_events from anon, authenticated;
grant select on public.story_versions to authenticated;
grant execute on function public.restore_story_version(bigint) to authenticated;
grant execute on function public.record_story_analytics_event(text, uuid, text, text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.get_story_analytics(text) to authenticated;
