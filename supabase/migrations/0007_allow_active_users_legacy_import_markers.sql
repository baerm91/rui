-- A legacy import marker only records whether this browser migration ran. It
-- does not grant permission to create or edit stories, so it must not block an
-- otherwise valid login for active light users. Story writes remain protected
-- by the separate stories policies and private.can_create_stories().
drop policy if exists "active users read own imports" on public.legacy_imports;
create policy "active users read own imports"
  on public.legacy_imports for select to authenticated
  using ((select private.is_active_user()) and user_id = (select auth.uid()));

drop policy if exists "active users create own imports" on public.legacy_imports;
create policy "active users create own imports"
  on public.legacy_imports for insert to authenticated
  with check ((select private.is_active_user()) and user_id = (select auth.uid()));

drop policy if exists "active users update own imports" on public.legacy_imports;
create policy "active users update own imports"
  on public.legacy_imports for update to authenticated
  using ((select private.is_active_user()) and user_id = (select auth.uid()))
  with check ((select private.is_active_user()) and user_id = (select auth.uid()));
