create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '',
  username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

create table if not exists public.stories (
  id text primary key,
  slug text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  story jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create unique index if not exists stories_slug_idx on public.stories (slug);
create index if not exists stories_owner_idx on public.stories (owner_id);
create index if not exists stories_status_idx on public.stories (status, published_at desc);

create table if not exists public.story_collaborators (
  story_id text not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'viewer' check (role in ('editor', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (story_id, user_id)
);

create table if not exists public.legacy_imports (
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_key text not null,
  story_ids text[] not null default '{}',
  imported_at timestamptz not null default now(),
  primary key (user_id, source_key)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
begin
  base_username := regexp_replace(
    lower(coalesce(
      new.raw_user_meta_data ->> 'user_name',
      new.raw_user_meta_data ->> 'preferred_username',
      split_part(new.email, '@', 1),
      'user'
    )),
    '[^a-z0-9._-]+', '-', 'g'
  );

  insert into public.profiles (id, email, display_name, username)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'user_name',
      split_part(new.email, '@', 1),
      'RIU Autor:in'
    ),
    trim(both '-' from base_username) || '-' || left(new.id::text, 6)
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_story_owner(target_story_id text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.stories
    where id = target_story_id and owner_id = auth.uid()
  );
$$;

create or replace function public.is_story_collaborator(target_story_id text, accepted_only boolean default true)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.story_collaborators
    where story_id = target_story_id
      and user_id = auth.uid()
      and (not accepted_only or status = 'accepted')
  );
$$;

create or replace function public.prevent_story_identity_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.id <> new.id or old.owner_id <> new.owner_id then
    raise exception 'Story identity and owner cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_story_identity on public.stories;
create trigger protect_story_identity
  before update on public.stories
  for each row execute procedure public.prevent_story_identity_change();

alter table public.profiles enable row level security;
alter table public.stories enable row level security;
alter table public.story_collaborators enable row level security;
alter table public.legacy_imports enable row level security;

drop policy if exists "authenticated profiles are discoverable" on public.profiles;
create policy "authenticated profiles are discoverable"
  on public.profiles for select to authenticated using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "published or permitted stories are readable" on public.stories;
create policy "published or permitted stories are readable"
  on public.stories for select
  using (
    status = 'published'
    or owner_id = auth.uid()
    or public.is_story_collaborator(id)
  );

drop policy if exists "users create owned stories" on public.stories;
create policy "users create owned stories"
  on public.stories for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "owners and editors update stories" on public.stories;
create policy "owners and editors update stories"
  on public.stories for update to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.story_collaborators
      where story_id = stories.id
        and user_id = auth.uid()
        and role = 'editor'
        and status = 'accepted'
    )
  )
  with check (
    owner_id = auth.uid()
    or exists (
      select 1 from public.story_collaborators
      where story_id = stories.id
        and user_id = auth.uid()
        and role = 'editor'
        and status = 'accepted'
    )
  );

drop policy if exists "owners delete stories" on public.stories;
create policy "owners delete stories"
  on public.stories for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "participants read collaborations" on public.story_collaborators;
create policy "participants read collaborations"
  on public.story_collaborators for select to authenticated
  using (user_id = auth.uid() or public.is_story_owner(story_id));

drop policy if exists "owners create collaborations" on public.story_collaborators;
create policy "owners create collaborations"
  on public.story_collaborators for insert to authenticated
  with check (public.is_story_owner(story_id));

drop policy if exists "participants update collaborations" on public.story_collaborators;
create policy "participants update collaborations"
  on public.story_collaborators for update to authenticated
  using (user_id = auth.uid() or public.is_story_owner(story_id))
  with check (user_id = auth.uid() or public.is_story_owner(story_id));

drop policy if exists "owners delete collaborations" on public.story_collaborators;
create policy "owners delete collaborations"
  on public.story_collaborators for delete to authenticated
  using (public.is_story_owner(story_id));

drop policy if exists "users read own imports" on public.legacy_imports;
create policy "users read own imports"
  on public.legacy_imports for select to authenticated using (user_id = auth.uid());

drop policy if exists "users create own imports" on public.legacy_imports;
create policy "users create own imports"
  on public.legacy_imports for insert to authenticated with check (user_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select on public.stories to anon, authenticated;
grant insert, update, delete on public.stories to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.story_collaborators to authenticated;
grant select, insert on public.legacy_imports to authenticated;

