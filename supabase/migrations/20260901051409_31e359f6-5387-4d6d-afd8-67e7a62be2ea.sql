-- ============ roles & profiles ============
create type public.app_role as enum ('admin','staff');

create table public.profiles (
  id uuid primary key,
  email text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
$$;

create policy "profiles readable by owner or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles updatable by owner or admin" on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles insert self" on public.profiles
  for insert to authenticated with check (id = auth.uid() or public.is_admin());

create policy "roles readable by owner or admin" on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ============ staff ============
create table public.staff (
  id text primary key,
  auth_user_id uuid unique,
  name text not null,
  role text,
  department text,
  email text,
  phone text,
  join_date date,
  status text not null default 'active',
  avatar_color text,
  login_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.staff to authenticated;
grant all on public.staff to service_role;
alter table public.staff enable row level security;

create or replace function public.my_staff_id()
returns text language sql stable security definer set search_path = public as $$
  select id from public.staff where auth_user_id = auth.uid() limit 1
$$;

create policy "staff readable by self or admin" on public.staff
  for select to authenticated using (auth_user_id = auth.uid() or public.is_admin());
create policy "staff insert admin only" on public.staff
  for insert to authenticated with check (public.is_admin());
create policy "staff update self or admin" on public.staff
  for update to authenticated using (auth_user_id = auth.uid() or public.is_admin());
create policy "staff delete admin only" on public.staff
  for delete to authenticated using (public.is_admin());

-- Non-admins may only ever change their own contact details.
create or replace function public.staff_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  new.id := old.id;
  new.auth_user_id := old.auth_user_id;
  new.name := old.name;
  new.role := old.role;
  new.department := old.department;
  new.join_date := old.join_date;
  new.status := old.status;
  new.login_id := old.login_id;
  new.avatar_color := old.avatar_color;
  return new;
end $$;
create trigger staff_guard_trg before update on public.staff
  for each row execute function public.staff_guard();

-- ============ attendance ============
create table public.attendance (
  id text primary key,
  staff_id text not null references public.staff(id) on delete cascade,
  date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  status text,
  login_status text,
  late_minutes integer not null default 0,
  logout_status text,
  early_minutes integer not null default 0,
  required_minutes integer,
  worked_minutes integer,
  working_hours_diff integer,
  note text not null default '',
  marked_by jsonb,
  corrected_by jsonb,
  corrected_at timestamptz,
  clock_in_location jsonb,
  clock_out_location jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, date)
);
create index attendance_date_idx on public.attendance (date);
create index attendance_staff_idx on public.attendance (staff_id);
grant select, insert, update, delete on public.attendance to authenticated;
grant all on public.attendance to service_role;
alter table public.attendance enable row level security;

create policy "attendance readable by owner or admin" on public.attendance
  for select to authenticated using (staff_id = public.my_staff_id() or public.is_admin());
create policy "attendance insert own or admin" on public.attendance
  for insert to authenticated with check (staff_id = public.my_staff_id() or public.is_admin());
create policy "attendance update own or admin" on public.attendance
  for update to authenticated using (staff_id = public.my_staff_id() or public.is_admin());
create policy "attendance delete admin only" on public.attendance
  for delete to authenticated using (public.is_admin());

-- ============ leaves ============
create table public.leaves (
  id text primary key,
  staff_id text not null references public.staff(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  days integer not null default 1,
  reason text not null default '',
  type text not null default 'leave',
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  requested_by jsonb,
  decided_at timestamptz,
  decided_by jsonb,
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leaves_staff_idx on public.leaves (staff_id);
grant select, insert, update, delete on public.leaves to authenticated;
grant all on public.leaves to service_role;
alter table public.leaves enable row level security;

create policy "leaves readable by owner or admin" on public.leaves
  for select to authenticated using (staff_id = public.my_staff_id() or public.is_admin());
create policy "leaves insert own or admin" on public.leaves
  for insert to authenticated with check (staff_id = public.my_staff_id() or public.is_admin());
create policy "leaves update own or admin" on public.leaves
  for update to authenticated using (staff_id = public.my_staff_id() or public.is_admin());
create policy "leaves delete admin only" on public.leaves
  for delete to authenticated using (public.is_admin());

-- Staff may only withdraw their own pending request; approvals are admin-only.
create or replace function public.leaves_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  new.staff_id := old.staff_id;
  new.decided_at := old.decided_at;
  new.decided_by := old.decided_by;
  new.admin_note := old.admin_note;
  if new.status <> old.status and not (old.status = 'pending' and new.status = 'cancelled') then
    new.status := old.status;
  end if;
  return new;
end $$;
create trigger leaves_guard_trg before update on public.leaves
  for each row execute function public.leaves_guard();

-- ============ reference data (admin managed, all staff readable) ============
create table public.departments (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.leave_types (
  id text primary key,
  name text not null,
  color text,
  paid boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.leave_reasons (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.holidays (
  id text primary key,
  name text not null,
  description text not null default '',
  type text not null default 'public',
  date date not null,
  recurring boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.departments to authenticated;
grant select, insert, update, delete on public.leave_types to authenticated;
grant select, insert, update, delete on public.leave_reasons to authenticated;
grant select, insert, update, delete on public.holidays to authenticated;
grant select, insert, update, delete on public.app_settings to authenticated;
grant all on public.departments, public.leave_types, public.leave_reasons, public.holidays, public.app_settings to service_role;

alter table public.departments enable row level security;
alter table public.leave_types enable row level security;
alter table public.leave_reasons enable row level security;
alter table public.holidays enable row level security;
alter table public.app_settings enable row level security;

create policy "departments readable" on public.departments for select to authenticated using (true);
create policy "departments admin write" on public.departments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "leave_types readable" on public.leave_types for select to authenticated using (true);
create policy "leave_types admin write" on public.leave_types for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "leave_reasons readable" on public.leave_reasons for select to authenticated using (true);
create policy "leave_reasons admin write" on public.leave_reasons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "holidays readable" on public.holidays for select to authenticated using (true);
create policy "holidays admin write" on public.holidays for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "settings readable" on public.app_settings for select to authenticated using (true);
create policy "settings admin write" on public.app_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============ login activity ============
create table public.login_events (
  id text primary key,
  type text not null,
  user_id text,
  user_name text,
  user_login_id text,
  role text,
  department text,
  at timestamptz not null default now(),
  location jsonb,
  device jsonb,
  reason text,
  closed_at timestamptz,
  logout_event_id text,
  duration_minutes integer,
  created_at timestamptz not null default now()
);
create index login_events_at_idx on public.login_events (at desc);
grant select, insert, update on public.login_events to authenticated;
grant insert on public.login_events to anon;
grant all on public.login_events to service_role;
alter table public.login_events enable row level security;

create policy "login events readable by owner or admin" on public.login_events
  for select to authenticated using (public.is_admin() or user_id = public.my_staff_id() or user_id = auth.uid()::text);
create policy "login events insert authenticated" on public.login_events
  for insert to authenticated with check (true);
create policy "failed login attempts insert" on public.login_events
  for insert to anon with check (type = 'failed_login');
create policy "login events update own or admin" on public.login_events
  for update to authenticated using (public.is_admin() or user_id = public.my_staff_id() or user_id = auth.uid()::text);

-- ============ shared updated_at trigger ============
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create trigger touch_staff before update on public.staff for each row execute function public.touch_updated_at();
create trigger touch_attendance before update on public.attendance for each row execute function public.touch_updated_at();
create trigger touch_leaves before update on public.leaves for each row execute function public.touch_updated_at();
create trigger touch_departments before update on public.departments for each row execute function public.touch_updated_at();
create trigger touch_leave_types before update on public.leave_types for each row execute function public.touch_updated_at();
create trigger touch_leave_reasons before update on public.leave_reasons for each row execute function public.touch_updated_at();
create trigger touch_holidays before update on public.holidays for each row execute function public.touch_updated_at();
create trigger touch_profiles before update on public.profiles for each row execute function public.touch_updated_at();

-- ============ seed data ============
insert into public.departments (id, name) values
  ('dep_seed1','Operations'), ('dep_seed2','Retail'), ('dep_seed3','Logistics');

insert into public.leave_types (id, name, color, paid) values
  ('lvt_seed1','Casual Leave','moss',true),
  ('lvt_seed2','Sick Leave','rust',true),
  ('lvt_seed3','Earned Leave','honey',true),
  ('lvt_seed4','Unpaid Leave','ink',false);

insert into public.leave_reasons (id, name) values
  ('lvr_seed1','Family event'), ('lvr_seed2','Medical appointment'),
  ('lvr_seed3','Personal work'), ('lvr_seed4','Travel'), ('lvr_seed5','Other');

insert into public.holidays (id, name, description, type, date, recurring) values
('hol_seed1','New Year''s Day','','public','2025-01-01',true),
('hol_seed2','Independence Day','India''s Independence Day','public','2025-08-15',true),
('hol_seed3','Founders'' Day','Company anniversary','company','2025-03-10',true),
('hol_republic_day','Republic Day','Commemorates the adoption of the Constitution of India','public','2025-01-26',true),
('hol_gandhi_jayanti','Gandhi Jayanti','Birth anniversary of Mahatma Gandhi, Father of the Nation','public','2025-10-02',true),
('hol_shastri_punyatithi','Lal Bahadur Shastri Punyatithi','Death anniversary of India''s 2nd Prime Minister','observance','2025-01-11',true),
('hol_bose_jayanti','Netaji Subhas Chandra Bose Jayanti (Parakram Diwas)','Birth anniversary of Netaji Subhas Chandra Bose','observance','2025-01-23',true),
('hol_gandhi_punyatithi','Martyrs'' Day (Gandhi Punyatithi)','Death/martyrdom anniversary of Mahatma Gandhi','observance','2025-01-30',true),
('hol_shaheed_diwas','Shaheed Diwas – Bhagat Singh, Rajguru & Sukhdev','Martyrdom day of Bhagat Singh, Rajguru and Sukhdev','observance','2025-03-23',true),
('hol_ambedkar_jayanti','Dr. B.R. Ambedkar Jayanti','Birth anniversary of Dr. Bhimrao Ramji Ambedkar','observance','2025-04-14',true),
('hol_asr_punyatithi','Alluri Sitarama Raju Punyatithi','Death anniversary of the Telugu freedom fighter who led the Rampa Rebellion','observance','2025-05-07',true),
('hol_telangana_formation','Telangana State Formation Day','Marks the formation of Telangana state','regional','2025-06-02',true),
('hol_asr_jayanti','Alluri Sitarama Raju Jayanti','Birth anniversary of the Telugu freedom fighter who led the Rampa Rebellion','observance','2025-07-04',true),
('hol_komaram_bheem','Komaram Bheem Remembrance Day','Death anniversary of the Telangana tribal freedom fighter, known for "Jal, Jangal, Zameen"','observance','2025-10-27',true),
('hol_patel_jayanti','Sardar Vallabhbhai Patel Jayanti (National Unity Day)','Birth anniversary of Sardar Vallabhbhai Patel','observance','2025-10-31',true),
('hol_ap_formation','Andhra Pradesh State Formation Day','Marks the formation of Andhra Pradesh state','regional','2025-11-01',true),
('hol_nehru_jayanti','Jawaharlal Nehru Jayanti (Children''s Day)','Birth anniversary of India''s first Prime Minister','observance','2025-11-14',true),
('hol_ambedkar_mahaparinirvan','Dr. B.R. Ambedkar Mahaparinirvan Din','Death anniversary of Dr. Bhimrao Ramji Ambedkar','observance','2025-12-06',true),
('hol_potti_sreeramulu','Potti Sreeramulu Punyatithi','Death anniversary of the freedom fighter whose fast led to the formation of Andhra state','observance','2025-12-15',true),
('hol_bhogi_2026','Bhogi','First day of the Sankranti festival cluster','festival','2026-01-13',false),
('hol_sankranti_2026','Makara Sankranti (Pedda Panduga)','The biggest harvest festival for Telugu households','festival','2026-01-14',false),
('hol_kanuma_2026','Kanuma','Third day of Sankranti, honoring cattle and farm animals','festival','2026-01-15',false),
('hol_shivaratri_2026','Maha Shivaratri','Festival dedicated to Lord Shiva','festival','2026-02-15',false),
('hol_holi_2026','Holi','Festival of colors','festival','2026-03-03',false),
('hol_ugadi_2026','Ugadi','Telugu New Year — marks the start of the Telugu Panchangam calendar','festival','2026-03-19',false),
('hol_rama_navami_2026','Sri Rama Navami','Celebrates the birth of Lord Rama','festival','2026-03-26',false),
('hol_varalakshmi_2026','Varalakshmi Vratam','Puja performed by married women seeking blessings of Goddess Lakshmi','festival','2026-08-21',false),
('hol_bonalu_2026','Bonalu','Telangana festival honoring Goddess Mahakali, celebrated through Ashada masam','festival','2026-08-10',false),
('hol_janmashtami_2026','Sri Krishna Janmashtami','Celebrates the birth of Lord Krishna','festival','2026-09-04',false),
('hol_vinayaka_chavithi_2026','Vinayaka Chavithi','Ganesh Chaturthi — celebrates the birth of Lord Ganesha','festival','2026-09-14',false),
('hol_bathukamma_start_2026','Bathukamma Starting Day (Engili Pula Bathukamma)','First day of the nine-day Telangana flower festival','festival','2026-10-11',false),
('hol_saddula_bathukamma_2026','Saddula Bathukamma (Durgashtami)','Final day of Bathukamma, coinciding with Durgashtami','festival','2026-10-19',false),
('hol_dasara_2026','Vijaya Dasami (Dasara)','Marks the triumph of good over evil — Durga''s victory over Mahishasura and Rama''s victory over Ravana','festival','2026-10-20',false),
('hol_diwali_2026','Deepavali (Diwali)','Festival of lights','festival','2026-11-08',false);

insert into public.app_settings (key, value) values ('global', '{}'::jsonb);

insert into public.staff (id, name, role, department, email, phone, join_date, status, avatar_color, login_id) values
  ('stf_seed1','Amara Whitfield','Floor Supervisor','Operations','amara.whitfield@example.com','555-0142','2023-02-14','active','#120D9E','STF001'),
  ('stf_seed2','Devon Okafor','Cashier','Retail','devon.okafor@example.com','555-0198','2023-06-01','active','#13A870','STF002'),
  ('stf_seed3','Priya Nair','Warehouse Lead','Logistics','priya.nair@example.com','555-0110','2022-11-20','active','#E14868','STF003'),
  ('stf_seed4','Marcus Lee','Barista','Retail','marcus.lee@example.com','555-0176','2024-01-09','inactive','#7B7FA0','STF004');

-- Sample attendance for the last three weeks (weekdays only) for the active staff.
insert into public.attendance (
  id, staff_id, date, clock_in, clock_out, status, login_status, late_minutes,
  logout_status, early_minutes, required_minutes, worked_minutes, working_hours_diff, note, marked_by
)
select
  'att_seed_' || s.id || '_' || to_char(d.day, 'YYYYMMDD'),
  s.id,
  d.day::date,
  (d.day::date + time '09:30') + make_interval(mins => v.late),
  (d.day::date + time '18:00') + make_interval(mins => v.extra),
  case when v.late > 15 then 'late' else 'present' end,
  case when v.late > 15 then 'late' else 'on_time' end,
  greatest(v.late - 15, 0),
  case when v.extra < 0 then 'early' else 'normal' end,
  greatest(-v.extra, 0),
  510,
  510 + v.extra - v.late,
  v.extra - v.late,
  '',
  '{"id":"seed","name":"System seed","role":"admin"}'::jsonb
from public.staff s
cross join generate_series(current_date - 20, current_date - 1, interval '1 day') as d(day)
cross join lateral (
  select ((extract(day from d.day)::int * 7 + length(s.id)) % 28) - 4 as late,
         ((extract(day from d.day)::int * 5) % 40) - 10 as extra
) v
where s.status = 'active'
  and extract(isodow from d.day) < 6;