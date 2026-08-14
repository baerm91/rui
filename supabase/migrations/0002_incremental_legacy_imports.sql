drop policy if exists "users update own imports" on public.legacy_imports;
create policy "users update own imports"
  on public.legacy_imports for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant update on public.legacy_imports to authenticated;
