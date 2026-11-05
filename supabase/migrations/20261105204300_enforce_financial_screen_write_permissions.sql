
drop policy if exists "workspace finance screens" on public.wallets;
create policy "finance wallets select" on public.wallets for select to authenticated
using (user_id=private.current_workspace_owner() and (
 private.has_screen_permission('exp') or private.has_screen_permission('add') or private.has_screen_permission('log') or private.has_screen_permission('manage') or private.has_screen_permission('report')
));
create policy "finance wallets insert" on public.wallets for insert to authenticated
with check (user_id=private.current_workspace_owner() and private.has_screen_permission('manage'));
create policy "finance wallets update" on public.wallets for update to authenticated
using (user_id=private.current_workspace_owner() and private.has_screen_permission('manage'))
with check (user_id=private.current_workspace_owner() and private.has_screen_permission('manage'));
create policy "finance wallets delete" on public.wallets for delete to authenticated
using (user_id=private.current_workspace_owner() and private.has_screen_permission('manage'));

drop policy if exists "workspace finance screens" on public.accounts;
create policy "finance accounts select" on public.accounts for select to authenticated
using (user_id=private.current_workspace_owner() and (
 private.has_screen_permission('exp') or private.has_screen_permission('add') or private.has_screen_permission('log') or private.has_screen_permission('manage') or private.has_screen_permission('report')
));
create policy "finance accounts insert" on public.accounts for insert to authenticated
with check (user_id=private.current_workspace_owner() and (
 private.has_screen_permission('exp') or private.has_screen_permission('manage')
));
create policy "finance accounts update" on public.accounts for update to authenticated
using (user_id=private.current_workspace_owner() and private.has_screen_permission('manage'))
with check (user_id=private.current_workspace_owner() and private.has_screen_permission('manage'));
create policy "finance accounts delete" on public.accounts for delete to authenticated
using (user_id=private.current_workspace_owner() and private.has_screen_permission('manage'));

drop policy if exists "workspace finance screens" on public.transactions;
create policy "finance transactions select" on public.transactions for select to authenticated
using (user_id=private.current_workspace_owner() and (
 private.has_screen_permission('exp') or private.has_screen_permission('add') or private.has_screen_permission('log') or private.has_screen_permission('manage') or private.has_screen_permission('report')
));
create policy "finance transactions insert" on public.transactions for insert to authenticated
with check (user_id=private.current_workspace_owner() and (
 private.has_screen_permission('exp') or private.has_screen_permission('add') or private.has_screen_permission('manage')
));
create policy "finance transactions update" on public.transactions for update to authenticated
using (user_id=private.current_workspace_owner() and (
 private.has_screen_permission('log') or private.has_screen_permission('manage')
))
with check (user_id=private.current_workspace_owner() and (
 private.has_screen_permission('log') or private.has_screen_permission('manage')
));
create policy "finance transactions delete" on public.transactions for delete to authenticated
using (user_id=private.current_workspace_owner() and (
 private.has_screen_permission('log') or private.has_screen_permission('manage')
));

drop policy if exists "workspace money sources" on public.money_sources;
create policy "money sources select" on public.money_sources for select to authenticated
using (user_id=private.current_workspace_owner() and (
 private.has_screen_permission('exp') or private.has_screen_permission('add') or private.has_screen_permission('log') or private.has_screen_permission('manage') or private.has_screen_permission('report')
));
create policy "money sources insert" on public.money_sources for insert to authenticated
with check (user_id=private.current_workspace_owner() and (
 private.has_screen_permission('exp') or private.has_screen_permission('add') or private.has_screen_permission('manage')
));
create policy "money sources update" on public.money_sources for update to authenticated
using (user_id=private.current_workspace_owner() and private.has_screen_permission('manage'))
with check (user_id=private.current_workspace_owner() and private.has_screen_permission('manage'));
create policy "money sources delete" on public.money_sources for delete to authenticated
using (user_id=private.current_workspace_owner() and private.has_screen_permission('manage'));

drop policy if exists "workspace debts" on public.debts;
create policy "debts select" on public.debts for select to authenticated
using (user_id=private.current_workspace_owner() and (
 private.has_screen_permission('exp') or private.has_screen_permission('add') or private.has_screen_permission('log') or private.has_screen_permission('manage') or private.has_screen_permission('report')
));
create policy "debts insert" on public.debts for insert to authenticated
with check (user_id=private.current_workspace_owner() and private.has_screen_permission('add'));
create policy "debts update" on public.debts for update to authenticated
using (user_id=private.current_workspace_owner() and private.has_screen_permission('manage'))
with check (user_id=private.current_workspace_owner() and private.has_screen_permission('manage'));
create policy "debts delete" on public.debts for delete to authenticated
using (user_id=private.current_workspace_owner() and private.has_screen_permission('manage'));
