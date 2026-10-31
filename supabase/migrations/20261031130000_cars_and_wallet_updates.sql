-- Wallets: opening -> opening_balance, allow the 'bank' type
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='wallets' and column_name='opening') then
    alter table public.wallets rename column opening to opening_balance;
  end if;
end $$;
alter table public.wallets drop constraint if exists wallets_type_check;
alter table public.wallets add constraint wallets_type_check check (type in ('visa','cash','bank'));

-- Transactions: mark rows created by balance reconciliation
alter table public.transactions add column if not exists is_adjustment boolean not null default false;

-- Cars module
create table public.cars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  plate text not null check (char_length(plate) between 1 and 30),
  driver text not null default '' check (char_length(driver) <= 80),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index on public.cars (user_id, created_at desc);

-- One image per document type per car; `path` is the object path inside the car-docs bucket
create table public.car_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  car_id uuid not null,
  doc_type text not null check (doc_type in ('car_license','driver_license','entity_license')),
  path text not null,
  created_at timestamptz not null default now(),
  foreign key (car_id, user_id) references public.cars (id, user_id) on delete cascade,
  unique (car_id, doc_type)
);

alter table public.cars enable row level security;
alter table public.car_documents enable row level security;
create policy "own rows" on public.cars for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.car_documents for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.cars, public.car_documents from anon;

-- Private storage bucket; each user can only touch files under their own <user_id>/ folder
insert into storage.buckets (id, name, public)
values ('car-docs', 'car-docs', false)
on conflict (id) do nothing;

create policy "car-docs own files" on storage.objects for all to authenticated
  using (bucket_id = 'car-docs' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'car-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
