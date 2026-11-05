
create index if not exists car_documents_car_user_idx on public.car_documents(car_id,user_id);
create index if not exists car_documents_user_idx on public.car_documents(user_id);
create index if not exists debts_user_id_idx on public.debts(user_id);
create index if not exists wallets_user_id_idx on public.wallets(user_id);
create index if not exists transactions_account_user_idx on public.transactions(account_id,user_id);
create index if not exists transactions_debt_user_idx on public.transactions(debt_id,user_id);
create index if not exists transactions_source_user_idx on public.transactions(source_id,user_id);
create index if not exists transactions_to_wallet_user_idx on public.transactions(to_wallet_id,user_id);
create index if not exists transactions_wallet_user_idx on public.transactions(wallet_id,user_id);
