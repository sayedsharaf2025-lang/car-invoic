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
revoke all on function private.handle_new_app_user() from public;
drop trigger if exists on_auth_user_created_app_user on auth.users;
create trigger on_auth_user_created_app_user after insert on auth.users
for each row execute function private.handle_new_app_user();
drop function if exists public.handle_new_app_user();
revoke update on public.app_users from authenticated;
grant update(status,approved_at,display_name) on public.app_users to authenticated;