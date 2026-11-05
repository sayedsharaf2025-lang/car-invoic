create table if not exists public.money_sources (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default private.current_workspace_owner() references auth.users(id),
 name text not null check (char_length(name) between 1 and 100),
 source_type text not null default 'other' check (source_type in ('salary','colleague','mobile_invoice','custody','customer','supplier','other')),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(id,user_id),
 unique(user_id,name)
);
alter table public.transactions add column if not exists source_id uuid;
alter table public.transactions add column if not exists debt_id uuid;
alter table public.transactions add column if not exists debt_action text not null default 'none';
alter table public.transactions add constraint transactions_debt_action_check check (debt_action in ('none','issued','repayment'));
alter table public.transactions add constraint transactions_source_id_user_fkey foreign key (source_id,user_id) references public.money_sources(id,user_id);
create table if not exists public.debts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default private.current_workspace_owner() references auth.users(id),
 person_name text not null check (char_length(person_name) between 1 and 120),
 initial_amount numeric not null check (initial_amount > 0),
 debt_date date not null default current_date,
 note text not null default '' check (char_length(note)<=300),
 created_at timestamptz not null default now(),
 unique(id,user_id)
);
alter table public.transactions add constraint transactions_debt_id_user_fkey foreign key (debt_id,user_id) references public.debts(id,user_id);
create index if not exists transactions_source_date_idx on public.transactions(source_id,tx_date);
create index if not exists transactions_debt_idx on public.transactions(debt_id,debt_action);
alter table public.money_sources enable row level security;
alter table public.debts enable row level security;
drop policy if exists "workspace money sources" on public.money_sources;
create policy "workspace money sources" on public.money_sources for all to authenticated
using (user_id=private.current_workspace_owner() and (
 private.has_screen_permission('exp') or private.has_screen_permission('add') or private.has_screen_permission('log') or private.has_screen_permission('manage') or private.has_screen_permission('report')
))
with check (user_id=private.current_workspace_owner() and (
 private.has_screen_permission('exp') or private.has_screen_permission('add') or private.has_screen_permission('log') or private.has_screen_permission('manage') or private.has_screen_permission('report')
));
drop policy if exists "workspace debts" on public.debts;
create policy "workspace debts" on public.debts for all to authenticated
using (user_id=private.current_workspace_owner() and (
 private.has_screen_permission('exp') or private.has_screen_permission('add') or private.has_screen_permission('log') or private.has_screen_permission('manage') or private.has_screen_permission('report')
))
with check (user_id=private.current_workspace_owner() and (
 private.has_screen_permission('exp') or private.has_screen_permission('add') or private.has_screen_permission('log') or private.has_screen_permission('manage') or private.has_screen_permission('report')
));
grant select,insert,update,delete on public.money_sources,public.debts to authenticated;

insert into public.money_sources(user_id,name,source_type)
select distinct t.user_id,btrim(t.source),'other'
from public.transactions t
where t.kind='c' and nullif(btrim(t.source),'') is not null and t.source <> 'تحويل داخلي'
on conflict (user_id,name) do nothing;

update public.transactions t set source_id=s.id
from public.money_sources s
where t.kind='c' and t.source_id is null and nullif(btrim(t.source),'') is not null
  and s.user_id=t.user_id and s.name=btrim(t.source);