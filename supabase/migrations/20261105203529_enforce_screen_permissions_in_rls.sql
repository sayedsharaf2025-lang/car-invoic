create or replace function private.has_screen_permission(p_screen text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.app_users u
    where u.user_id=(select auth.uid()) and u.status='approved' and u.role='admin'
  ) or exists (
    select 1 from public.user_screen_permissions p
    join public.app_users u on u.user_id=p.user_id
    where p.user_id=(select auth.uid()) and p.screen_key=p_screen and u.status='approved'
  )
$$;
revoke all on function private.has_screen_permission(text) from public;
grant execute on function private.has_screen_permission(text) to authenticated;

drop policy if exists "workspace approved users" on public.wallets;
create policy "workspace finance screens" on public.wallets for all to authenticated
using (user_id=private.current_workspace_owner() and (
  private.has_screen_permission('exp') or private.has_screen_permission('add') or
  private.has_screen_permission('log') or private.has_screen_permission('manage') or
  private.has_screen_permission('report')
))
with check (user_id=private.current_workspace_owner() and (
  private.has_screen_permission('exp') or private.has_screen_permission('add') or
  private.has_screen_permission('log') or private.has_screen_permission('manage') or
  private.has_screen_permission('report')
));

drop policy if exists "workspace approved users" on public.accounts;
create policy "workspace finance screens" on public.accounts for all to authenticated
using (user_id=private.current_workspace_owner() and (
  private.has_screen_permission('exp') or private.has_screen_permission('add') or
  private.has_screen_permission('log') or private.has_screen_permission('manage') or
  private.has_screen_permission('report')
))
with check (user_id=private.current_workspace_owner() and (
  private.has_screen_permission('exp') or private.has_screen_permission('add') or
  private.has_screen_permission('log') or private.has_screen_permission('manage') or
  private.has_screen_permission('report')
));

drop policy if exists "workspace approved users" on public.transactions;
create policy "workspace finance screens" on public.transactions for all to authenticated
using (user_id=private.current_workspace_owner() and (
  private.has_screen_permission('exp') or private.has_screen_permission('add') or
  private.has_screen_permission('log') or private.has_screen_permission('manage') or
  private.has_screen_permission('report')
))
with check (user_id=private.current_workspace_owner() and (
  private.has_screen_permission('exp') or private.has_screen_permission('add') or
  private.has_screen_permission('log') or private.has_screen_permission('manage') or
  private.has_screen_permission('report')
));

drop policy if exists "workspace approved users" on public.cars;
create policy "workspace cars screen" on public.cars for all to authenticated
using (user_id=private.current_workspace_owner() and private.has_screen_permission('cars'))
with check (user_id=private.current_workspace_owner() and private.has_screen_permission('cars'));

drop policy if exists "workspace approved users" on public.car_documents;
create policy "workspace car documents screen" on public.car_documents for all to authenticated
using (user_id=private.current_workspace_owner() and private.has_screen_permission('cars'))
with check (user_id=private.current_workspace_owner() and private.has_screen_permission('cars'));

drop policy if exists "car-docs approved workspace files" on storage.objects;
create policy "car-docs workspace cars screen" on storage.objects for all to authenticated
using (bucket_id='car-docs' and (storage.foldername(name))[1]=private.current_workspace_owner()::text and private.has_screen_permission('cars'))
with check (bucket_id='car-docs' and (storage.foldername(name))[1]=private.current_workspace_owner()::text and private.has_screen_permission('cars'));