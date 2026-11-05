create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  role text not null default 'user' check (role in ('admin','user')),
  workspace_owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists app_users_workspace_idx on public.app_users(workspace_owner_id,status);

create table if not exists public.user_screen_permissions (
  user_id uuid not null references public.app_users(user_id) on delete cascade,
  screen_key text not null,
  created_at timestamptz not null default now(),
  primary key(user_id,screen_key)
);

create or replace function private.current_workspace_owner()
returns uuid language sql stable security definer set search_path = ''
as $$
  select u.workspace_owner_id
  from public.app_users u
  where u.user_id = (select auth.uid()) and u.status = 'approved'
  limit 1
$$;

create or replace function private.is_workspace_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.app_users u
    where u.user_id = (select auth.uid())
      and u.status = 'approved' and u.role = 'admin'
  )
$$;

revoke all on function private.current_workspace_owner() from public;
revoke all on function private.is_workspace_admin() from public;
grant execute on function private.current_workspace_owner() to authenticated;
grant execute on function private.is_workspace_admin() to authenticated;

create or replace function private.handle_new_app_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  admin_id uuid := 'a74a8bf0-cdfd-4cb5-bd0f-30e5b0129290'::uuid;
begin
  insert into public.app_users(user_id,email,display_name,status,role,workspace_owner_id)
  values (new.id, coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'name',''), 'pending','user',admin_id)
  on conflict (user_id) do update set email=excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_app_user on auth.users;
create trigger on_auth_user_created_app_user
after insert on auth.users
for each row execute function private.handle_new_app_user();

insert into public.app_users(user_id,email,display_name,status,role,workspace_owner_id,approved_at)
values ('a74a8bf0-cdfd-4cb5-bd0f-30e5b0129290'::uuid,
        'fathisaberali@outlook.com','المدير الرئيسي','approved','admin',
        'a74a8bf0-cdfd-4cb5-bd0f-30e5b0129290'::uuid,now())
on conflict (user_id) do update
set status='approved', role='admin', workspace_owner_id=excluded.workspace_owner_id;

alter table public.app_users enable row level security;
alter table public.user_screen_permissions enable row level security;

drop policy if exists "app users read own or admin" on public.app_users;
create policy "app users read own or admin" on public.app_users
for select to authenticated
using (user_id = (select auth.uid()) or private.is_workspace_admin());

drop policy if exists "app users admin update" on public.app_users;
create policy "app users admin update" on public.app_users
for update to authenticated
using (private.is_workspace_admin())
with check (private.is_workspace_admin());

drop policy if exists "screen permissions read own or admin" on public.user_screen_permissions;
create policy "screen permissions read own or admin" on public.user_screen_permissions
for select to authenticated
using (user_id = (select auth.uid()) or private.is_workspace_admin());

drop policy if exists "screen permissions admin insert" on public.user_screen_permissions;
create policy "screen permissions admin insert" on public.user_screen_permissions
for insert to authenticated with check (private.is_workspace_admin());

drop policy if exists "screen permissions admin delete" on public.user_screen_permissions;
create policy "screen permissions admin delete" on public.user_screen_permissions
for delete to authenticated using (private.is_workspace_admin());

grant select, update on public.app_users to authenticated;
grant select, insert, delete on public.user_screen_permissions to authenticated;

do $$
declare t text;
begin
  foreach t in array array['wallets','accounts','transactions','cars','car_documents'] loop
    execute format('alter table public.%I alter column user_id set default private.current_workspace_owner()', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('drop policy if exists "workspace approved users" on public.%I', t);
    execute format(
      'create policy "workspace approved users" on public.%I for all to authenticated using (user_id = private.current_workspace_owner()) with check (user_id = private.current_workspace_owner())',
      t
    );
  end loop;
end $$;

drop policy if exists "car-docs own files" on storage.objects;
create policy "car-docs approved workspace files" on storage.objects
for all to authenticated
using (
  bucket_id = 'car-docs'
  and (storage.foldername(name))[1] = private.current_workspace_owner()::text
)
with check (
  bucket_id = 'car-docs'
  and (storage.foldername(name))[1] = private.current_workspace_owner()::text
);