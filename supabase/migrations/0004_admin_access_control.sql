alter table public.profiles
  add column if not exists role text not null default 'light-user',
  add column if not exists is_blocked boolean not null default false,
  add column if not exists blocked_at timestamptz;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'pro-user', 'light-user'));

create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  registrations_enabled boolean not null default true,
  default_role text not null default 'light-user'
    check (default_role in ('pro-user', 'light-user')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

-- The project owner is the initial administrator. Additional admins can then
-- be appointed from RIU's new administration page.
update public.profiles
set role = 'admin', is_blocked = false, blocked_at = null
where lower(email) = lower('martinbaerjr@gmail.com');

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and not is_blocked
  );
$$;

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select role from public.profiles
    where id = (select auth.uid()) and not is_blocked
  ), 'light-user');
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_user_role() = 'admin';
$$;

create or replace function private.can_create_stories()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_user_role() in ('admin', 'pro-user');
$$;

create or replace function public.get_platform_access()
returns table (registrations_enabled boolean, default_role text)
language sql
stable
security definer
set search_path = ''
as $$
  select settings.registrations_enabled, settings.default_role
  from public.platform_settings settings where settings.id = true;
$$;

create or replace function public.admin_list_users()
returns table (
  id uuid, email text, display_name text, username text, role text,
  is_blocked boolean, created_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Administrator access required'; end if;
  return query
    select p.id, p.email, p.display_name, p.username, p.role,
      p.is_blocked, p.created_at, p.updated_at
    from public.profiles p order by p.created_at desc;
end;
$$;

create or replace function public.admin_update_user(
  target_user_id uuid, new_role text, new_is_blocked boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.profiles%rowtype;
  admin_count integer;
begin
  if not private.is_admin() then raise exception 'Administrator access required'; end if;
  if new_role not in ('admin', 'pro-user', 'light-user') then raise exception 'Invalid role'; end if;
  select * into target from public.profiles where id = target_user_id for update;
  if not found then raise exception 'User not found'; end if;
  if target_user_id = (select auth.uid()) and new_is_blocked then
    raise exception 'You cannot block your own account';
  end if;
  if target.role = 'admin' and (new_role <> 'admin' or new_is_blocked) then
    select count(*) into admin_count from public.profiles
      where role = 'admin' and not is_blocked;
    if admin_count <= 1 then raise exception 'The last administrator cannot be removed'; end if;
  end if;
  update public.profiles set
    role = new_role,
    is_blocked = new_is_blocked,
    blocked_at = case when new_is_blocked then coalesce(blocked_at, now()) else null end,
    updated_at = now()
  where id = target_user_id;
end;
$$;

create or replace function public.admin_update_platform_settings(
  new_registrations_enabled boolean, new_default_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Administrator access required'; end if;
  if new_default_role not in ('pro-user', 'light-user') then raise exception 'Invalid default role'; end if;
  update public.platform_settings set
    registrations_enabled = new_registrations_enabled,
    default_role = new_default_role,
    updated_at = now(),
    updated_by = (select auth.uid())
  where id = true;
end;
$$;

create or replace function public.prevent_profile_access_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.role, old.is_blocked, old.blocked_at) is distinct from
     (new.role, new.is_blocked, new.blocked_at)
     and not private.is_admin() then
    raise exception 'Only administrators can change roles or account status';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_access on public.profiles;
create trigger protect_profile_access before update on public.profiles
  for each row execute procedure public.prevent_profile_access_change();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  assigned_role text;
begin
  if not exists (select 1 from public.profiles where id = new.id) then
    if not coalesce((select registrations_enabled from public.platform_settings where id = true), true) then
      raise exception 'Neue Registrierungen sind derzeit deaktiviert';
    end if;
  end if;
  assigned_role := coalesce((select default_role from public.platform_settings where id = true), 'light-user');
  base_username := regexp_replace(lower(coalesce(
    new.raw_user_meta_data ->> 'user_name', new.raw_user_meta_data ->> 'preferred_username',
    split_part(new.email, '@', 1), 'user'
  )), '[^a-z0-9._-]+', '-', 'g');
  insert into public.profiles (id, email, display_name, username, role)
  values (new.id, new.email, coalesce(
    new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'user_name', split_part(new.email, '@', 1), 'RIU Autor:in'
  ), trim(both '-' from base_username) || '-' || left(new.id::text, 6), assigned_role)
  on conflict (id) do update set email = excluded.email,
    display_name = excluded.display_name, updated_at = now();
  return new;
end;
$$;

alter table public.platform_settings enable row level security;
drop policy if exists "public reads access settings" on public.platform_settings;
create policy "public reads access settings" on public.platform_settings
  for select to anon, authenticated using (true);

drop policy if exists "authenticated profiles are discoverable" on public.profiles;
drop policy if exists "active users discover profiles" on public.profiles;
create policy "active users discover profiles" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_active_user()));
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "active users update own profile" on public.profiles;
create policy "active users update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select private.is_active_user()))
  with check (id = (select auth.uid()) and (select private.is_active_user()));

drop policy if exists "published or permitted stories are readable" on public.stories;
create policy "published or permitted stories are readable" on public.stories for select
  using (status = 'published' or ((select private.is_active_user()) and
    (owner_id = (select auth.uid()) or public.is_story_collaborator(id))));
drop policy if exists "users create owned stories" on public.stories;
drop policy if exists "pro users create owned stories" on public.stories;
create policy "pro users create owned stories" on public.stories for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.can_create_stories()));
drop policy if exists "owners and editors update stories" on public.stories;
drop policy if exists "active owners and editors update stories" on public.stories;
create policy "active owners and editors update stories" on public.stories for update to authenticated
  using ((select private.can_create_stories()) and (owner_id = (select auth.uid()) or exists (
    select 1 from public.story_collaborators where story_id = stories.id
      and user_id = (select auth.uid()) and role = 'editor' and status = 'accepted')))
  with check ((select private.can_create_stories()) and (owner_id = (select auth.uid()) or exists (
    select 1 from public.story_collaborators where story_id = stories.id
      and user_id = (select auth.uid()) and role = 'editor' and status = 'accepted')));
drop policy if exists "owners delete stories" on public.stories;
drop policy if exists "active owners delete stories" on public.stories;
create policy "active owners delete stories" on public.stories for delete to authenticated
  using ((select private.can_create_stories()) and owner_id = (select auth.uid()));

drop policy if exists "participants read collaborations" on public.story_collaborators;
drop policy if exists "active participants read collaborations" on public.story_collaborators;
create policy "active participants read collaborations" on public.story_collaborators for select to authenticated
  using ((select private.is_active_user()) and (user_id = (select auth.uid()) or public.is_story_owner(story_id)));
drop policy if exists "owners create collaborations" on public.story_collaborators;
drop policy if exists "active owners create collaborations" on public.story_collaborators;
create policy "active owners create collaborations" on public.story_collaborators for insert to authenticated
  with check ((select private.can_create_stories()) and public.is_story_owner(story_id));
drop policy if exists "participants update collaborations" on public.story_collaborators;
drop policy if exists "active participants update collaborations" on public.story_collaborators;
create policy "active participants update collaborations" on public.story_collaborators for update to authenticated
  using ((select private.is_active_user()) and (user_id = (select auth.uid()) or public.is_story_owner(story_id)))
  with check ((select private.is_active_user()) and (user_id = (select auth.uid()) or public.is_story_owner(story_id)));
drop policy if exists "owners delete collaborations" on public.story_collaborators;
drop policy if exists "active owners delete collaborations" on public.story_collaborators;
create policy "active owners delete collaborations" on public.story_collaborators for delete to authenticated
  using ((select private.can_create_stories()) and public.is_story_owner(story_id));

drop policy if exists "users read own imports" on public.legacy_imports;
drop policy if exists "active users read own imports" on public.legacy_imports;
create policy "active users read own imports" on public.legacy_imports for select to authenticated
  using ((select private.can_create_stories()) and user_id = (select auth.uid()));
drop policy if exists "users create own imports" on public.legacy_imports;
drop policy if exists "active users create own imports" on public.legacy_imports;
create policy "active users create own imports" on public.legacy_imports for insert to authenticated
  with check ((select private.can_create_stories()) and user_id = (select auth.uid()));
drop policy if exists "users update own imports" on public.legacy_imports;
drop policy if exists "active users update own imports" on public.legacy_imports;
create policy "active users update own imports" on public.legacy_imports for update to authenticated
  using ((select private.can_create_stories()) and user_id = (select auth.uid()))
  with check ((select private.can_create_stories()) and user_id = (select auth.uid()));

drop policy if exists "authors read own preview objects" on storage.objects;
drop policy if exists "active authors read own preview objects" on storage.objects;
create policy "active authors read own preview objects" on storage.objects for select to authenticated
  using ((select private.can_create_stories()) and bucket_id = 'story-previews'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "authors upload story previews" on storage.objects;
drop policy if exists "active authors upload story previews" on storage.objects;
create policy "active authors upload story previews" on storage.objects for insert to authenticated
  with check ((select private.can_create_stories()) and bucket_id = 'story-previews'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "authors update story previews" on storage.objects;
drop policy if exists "active authors update story previews" on storage.objects;
create policy "active authors update story previews" on storage.objects for update to authenticated
  using ((select private.can_create_stories()) and bucket_id = 'story-previews'
    and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check ((select private.can_create_stories()) and bucket_id = 'story-previews'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "authors delete story previews" on storage.objects;
drop policy if exists "active authors delete story previews" on storage.objects;
create policy "active authors delete story previews" on storage.objects for delete to authenticated
  using ((select private.can_create_stories()) and bucket_id = 'story-previews'
    and (storage.foldername(name))[1] = (select auth.uid())::text);

revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_update_user(uuid, text, boolean) from public, anon;
revoke all on function public.admin_update_platform_settings(boolean, text) from public, anon;
grant execute on function public.get_platform_access() to anon, authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_update_user(uuid, text, boolean) to authenticated;
grant execute on function public.admin_update_platform_settings(boolean, text) to authenticated;
grant select on public.platform_settings to anon, authenticated;
