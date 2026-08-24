-- OAuth users created during an incomplete deployment can exist in auth.users
-- without the public profile required by the application. Repair those users
-- before installing the hardened trigger below.
insert into public.profiles (id, email, display_name, username, role)
select
  users.id,
  users.email,
  coalesce(
    users.raw_user_meta_data ->> 'full_name',
    users.raw_user_meta_data ->> 'name',
    users.raw_user_meta_data ->> 'user_name',
    split_part(users.email, '@', 1),
    'RIU Autor:in'
  ),
  trim(both '-' from regexp_replace(lower(coalesce(
    users.raw_user_meta_data ->> 'user_name',
    users.raw_user_meta_data ->> 'preferred_username',
    split_part(users.email, '@', 1),
    'user'
  )), '[^a-z0-9._-]+', '-', 'g')) || '-' || left(users.id::text, 6),
  coalesce((select default_role from public.platform_settings where id = true), 'light-user')
from auth.users users
where not exists (select 1 from public.profiles profiles where profiles.id = users.id)
on conflict (id) do nothing;

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
  if not exists (select 1 from public.profiles where id = new.id)
     and not coalesce((select registrations_enabled from public.platform_settings where id = true), true) then
    raise exception 'Neue Registrierungen sind derzeit deaktiviert';
  end if;

  assigned_role := coalesce(
    (select default_role from public.platform_settings where id = true),
    'light-user'
  );
  base_username := regexp_replace(lower(coalesce(
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'preferred_username',
    split_part(new.email, '@', 1),
    'user'
  )), '[^a-z0-9._-]+', '-', 'g');

  insert into public.profiles (id, email, display_name, username, role)
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
    trim(both '-' from base_username) || '-' || left(new.id::text, 6),
    assigned_role
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
