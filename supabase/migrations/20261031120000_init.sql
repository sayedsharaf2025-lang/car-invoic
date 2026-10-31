-- Cashbook schema: every row belongs to one user and is protected by RLS.
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  type text not null check (type in ('visa','cash')),
  opening numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  wallet_id uuid not null,
  account_id uuid not null,
  kind text not null check (kind in ('d','c')),
  amount numeric(14,2) not null check (amount > 0),
  tx_date date not null default current_date,
  note text not null default '' check (char_length(note) <= 120),
  created_at timestamptz not null default now(),
  foreign key (wallet_id, user_id) references public.wallets (id, user_id) on delete restrict,
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete restrict
);
create index on public.transactions (user_id, tx_date desc);

alter table public.wallets enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;

create policy "own rows" on public.wallets for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.accounts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.transactions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.wallets, public.accounts, public.transactions from anon;
