-- Fleet fields: the 15 imported columns live on public.cars.
-- (plate, brand, model_year, vehicle_type, chassis_no, engine_no, traffic_dept, owner_company,
--  license_expiry, license_status, license_supervisor, driver, fire_extinguisher, insurance_status, notes)
alter table public.cars
  add column if not exists brand text not null default '' check (char_length(brand) <= 200),
  add column if not exists model_year text not null default '' check (char_length(model_year) <= 20),
  add column if not exists vehicle_type text not null default '' check (char_length(vehicle_type) <= 200),
  add column if not exists chassis_no text not null default '' check (char_length(chassis_no) <= 200),
  add column if not exists engine_no text not null default '' check (char_length(engine_no) <= 200),
  add column if not exists traffic_dept text not null default '' check (char_length(traffic_dept) <= 200),
  add column if not exists owner_company text not null default '' check (char_length(owner_company) <= 200),
  add column if not exists license_expiry date,
  add column if not exists license_status text not null default '' check (char_length(license_status) <= 200),
  add column if not exists license_supervisor text not null default '' check (char_length(license_supervisor) <= 200),
  add column if not exists fire_extinguisher text not null default '' check (char_length(fire_extinguisher) <= 200),
  add column if not exists insurance_status text not null default '' check (char_length(insurance_status) <= 200),
  add column if not exists notes text not null default '' check (char_length(notes) <= 1000);

alter table public.cars drop constraint if exists cars_driver_check;
alter table public.cars add constraint cars_driver_check check (char_length(driver) <= 200);

-- the old single "name" column becomes "brand"
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='cars' and column_name='name') then
    update public.cars set brand = name where brand = '';
    alter table public.cars drop column name;
  end if;
end $$;

-- one row per plate per user: lets a re-import update instead of duplicating
create unique index if not exists cars_user_plate_key on public.cars (user_id, plate);
create index if not exists cars_user_expiry on public.cars (user_id, license_expiry);
