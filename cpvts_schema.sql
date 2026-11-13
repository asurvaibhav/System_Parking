-- =====================================================================
-- CPVTS - Campus Parking & Vehicle Tracking System
-- Supabase (PostgreSQL 15+) schema. Run ONCE on a fresh project:
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- =====================================================================

-- ---------- 1. TABLES ----------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  username    text unique,
  role        text not null default 'guard' check (role in ('guard','admin')),
  approved    boolean not null default true,
  gate_type   text check (gate_type in ('entry','exit','both')),
  gate_name   text default '',
  created_at  timestamptz not null default now()
);

alter table public.profiles add column if not exists username text unique;
alter table public.profiles add column if not exists approved boolean not null default true;
alter table public.profiles alter column approved set default true;
update public.profiles set approved = true where approved is distinct from true;
alter table public.profiles add column if not exists gate_type text check (gate_type in ('entry','exit','both'));
alter table public.profiles add column if not exists gate_name text default '';

create table if not exists public.slots (
  id            uuid primary key default gen_random_uuid(),
  slot_code     text not null unique,
  vehicle_type  text not null check (vehicle_type in ('two_wheeler','four_wheeler')),
  status        text not null default 'available' check (status in ('available','occupied','reserved')),
  -- --- VIP RESERVATION FEATURE START ---
  reserved_reason text,
  reserved_at   timestamptz,
  reserved_by   text
  -- --- VIP RESERVATION FEATURE END ---
);

-- --- VIP RESERVATION FEATURE START ---
alter table public.slots drop constraint if exists slots_status_check;
alter table public.slots add constraint slots_status_check check (status in ('available','occupied','reserved'));
alter table public.slots add column if not exists reserved_reason text;
alter table public.slots add column if not exists reserved_at timestamptz;
alter table public.slots add column if not exists reserved_by text;
-- --- VIP RESERVATION FEATURE END ---

create table if not exists public.tariffs (
  owner_category text not null check (owner_category in ('staff','student','visitor')),
  vehicle_type   text not null check (vehicle_type in ('two_wheeler','four_wheeler')),
  free_minutes   int  not null default 0 check (free_minutes >= 0),
  rate_per_hour  int  not null default 0 check (rate_per_hour >= 0),
  primary key (owner_category, vehicle_type)
);

create sequence if not exists public.ticket_seq;

create table if not exists public.parking_sessions (
  id                    uuid primary key default gen_random_uuid(),
  ticket_no             text not null unique,
  vehicle_number        text not null
    check (vehicle_number ~ '^([A-Z]{2}[0-9]{2}[A-Z]{1,3}[0-9]{4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2})$'),
  vehicle_type          text not null check (vehicle_type in ('two_wheeler','four_wheeler')),
  owner_category        text not null check (owner_category in ('staff','student','visitor')),
  slot_id               uuid not null references public.slots(id),
  entry_time            timestamptz not null default now(),
  exit_time             timestamptz,
  duration_minutes      int,
  free_minutes_applied  int,
  rate_per_hour_applied int,
  fee                   int,
  status                text not null default 'active' check (status in ('active','completed')),
  checked_in_by         uuid references auth.users(id),
  checked_out_by        uuid references auth.users(id),
  constraint exit_not_before_entry check (exit_time is null or exit_time >= entry_time),
  constraint status_consistency check (
    (status = 'active'    and exit_time is null) or
    (status = 'completed' and exit_time is not null and fee is not null)
  )
);

-- One active session per vehicle and per slot (double-booking protection)
create unique index if not exists one_active_session_per_vehicle
  on public.parking_sessions (vehicle_number) where status = 'active';
create unique index if not exists one_active_session_per_slot
  on public.parking_sessions (slot_id) where status = 'active';
create index if not exists parking_sessions_entry_time_idx on public.parking_sessions (entry_time);
create index if not exists parking_sessions_exit_time_idx  on public.parking_sessions (exit_time);

-- Sessions + slot code, used by the app for reading
create or replace view public.session_details with (security_invoker = true) as
select s.*, sl.slot_code
from public.parking_sessions s
join public.slots sl on sl.id = s.slot_id;

-- ---------- 2. SEED DATA ------------------------------------------

-- 100 slots: T-01..T-50 (two-wheeler), F-01..F-50 (four-wheeler), all available
insert into public.slots (slot_code, vehicle_type)
select 'T-' || lpad(g::text, 2, '0'), 'two_wheeler'  from generate_series(1, 50) g
on conflict (slot_code) do nothing;

insert into public.slots (slot_code, vehicle_type)
select 'F-' || lpad(g::text, 2, '0'), 'four_wheeler' from generate_series(1, 50) g
on conflict (slot_code) do nothing;

-- Tariffs: student = first 120 min free; visitor = no free time; staff = free
insert into public.tariffs (owner_category, vehicle_type, free_minutes, rate_per_hour) values
  ('staff',   'two_wheeler',    0,  0),
  ('staff',   'four_wheeler',   0,  0),
  ('student', 'two_wheeler',  120, 10),
  ('student', 'four_wheeler', 120, 20),
  ('visitor', 'two_wheeler',    0, 20),
  ('visitor', 'four_wheeler',   0, 40)
on conflict (owner_category, vehicle_type) do nothing;

-- ---------- 3. FEE FUNCTION ---------------------------------------
-- fee = ceil(chargeable_minutes * rate_per_hour / 60), whole rupees

create or replace function public.calc_fee(p_category text, p_vtype text, p_minutes int)
returns table (free_min int, rate int, chargeable_min int, amount int)
language plpgsql
stable
set search_path = public
as $$
declare
  t public.tariffs%rowtype;
begin
  select * into t
    from public.tariffs
   where owner_category = p_category and vehicle_type = p_vtype;
  if not found then
    raise exception 'TARIFF_NOT_FOUND';
  end if;

  free_min       := t.free_minutes;
  rate           := t.rate_per_hour;
  chargeable_min := greatest(p_minutes - t.free_minutes, 0);
  amount         := (chargeable_min * t.rate_per_hour + 59) / 60;  -- integer ceil
  return next;
end;
$$;

-- ---------- 4. CHECK-IN -------------------------------------------

create or replace function public.check_in(
  p_vehicle_number text,
  p_vehicle_type   text,
  p_owner_category text,
  p_slot_id        uuid
)
returns public.parking_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num  text := upper(regexp_replace(coalesce(p_vehicle_number, ''), '[^A-Za-z0-9]', '', 'g'));
  v_slot public.slots%rowtype;
  v_row  public.parking_sessions;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if v_num !~ '^([A-Z]{2}[0-9]{2}[A-Z]{1,3}[0-9]{4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2})$' then
    raise exception 'INVALID_VEHICLE_NUMBER';
  end if;

  -- lock the slot row so two gates cannot book it at the same time
  select * into v_slot from public.slots where id = p_slot_id for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND';
  end if;
  if v_slot.vehicle_type <> p_vehicle_type then
    raise exception 'SLOT_TYPE_MISMATCH';
  end if;
  if v_slot.status <> 'available' then
    raise exception 'SLOT_NOT_AVAILABLE';
  end if;

  if exists (select 1 from public.parking_sessions
              where vehicle_number = v_num and status = 'active') then
    raise exception 'DUPLICATE_ACTIVE_VEHICLE';
  end if;

  insert into public.parking_sessions
    (ticket_no, vehicle_number, vehicle_type, owner_category, slot_id, checked_in_by)
  values (
    'CPVTS-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-' ||
      lpad(nextval('public.ticket_seq')::text, 5, '0'),
    v_num, p_vehicle_type, p_owner_category, p_slot_id, auth.uid()
  )
  returning * into v_row;

  update public.slots set status = 'occupied' where id = p_slot_id;

  return v_row;
end;
$$;

-- ---------- 5. CHECK-OUT (preview + confirm) ----------------------

create or replace function public.preview_checkout(p_query text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q    text := upper(regexp_replace(coalesce(p_query, ''), '[^A-Za-z0-9]', '', 'g'));
  v_s    public.parking_sessions;
  v_code text;
  v_now  timestamptz := now();
  v_min  int;
  v_f    record;
begin
  -- Match by vehicle number, ticket number, or slot code
  select s.* into v_s
    from public.parking_sessions s
    left join public.slots sl on sl.id = s.slot_id
   where s.status = 'active'
     and (
       upper(regexp_replace(s.vehicle_number, '[^A-Za-z0-9]', '', 'g')) = v_q
       or upper(regexp_replace(s.ticket_no, '[^A-Za-z0-9]', '', 'g')) = v_q
       or (sl.slot_code is not null and upper(regexp_replace(sl.slot_code, '[^A-Za-z0-9]', '', 'g')) = v_q)
     )
   order by s.entry_time desc
   limit 1;

  if v_s.id is null then
    raise exception 'NO_ACTIVE_SESSION';
  end if;

  select slot_code into v_code from public.slots where id = v_s.slot_id;

  v_min := greatest(floor(extract(epoch from (v_now - v_s.entry_time)) / 60)::int, 0);
  select * into v_f from public.calc_fee(v_s.owner_category, v_s.vehicle_type, v_min);

  return jsonb_build_object(
    'session_id',         v_s.id,
    'ticket_no',          v_s.ticket_no,
    'vehicle_number',     v_s.vehicle_number,
    'vehicle_type',       v_s.vehicle_type,
    'owner_category',     v_s.owner_category,
    'slot_code',          v_code,
    'entry_time',         v_s.entry_time,
    'exit_time',          v_now,
    'duration_minutes',   v_min,
    'free_minutes',       v_f.free_min,
    'rate_per_hour',      v_f.rate,
    'chargeable_minutes', v_f.chargeable_min,
    'fee',                v_f.amount
  );
end;
$$;

create or replace function public.confirm_checkout(
  p_session_id uuid,
  p_exit_time timestamptz,
  p_payment_method text default 'cash'
)
returns public.parking_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s    public.parking_sessions;
  v_exit timestamptz;
  v_min  int;
  v_f    record;
  v_method text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_payment_method is null or p_payment_method not in ('cash', 'upi') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  select * into v_s
    from public.parking_sessions
   where id = p_session_id and status = 'active'
   for update;
  if v_s.id is null then
    raise exception 'NO_ACTIVE_SESSION';
  end if;

  -- reuse the exit time shown in the preview if it is recent and valid,
  -- otherwise use the current server time
  v_exit := p_exit_time;
  if v_exit is null
     or v_exit > now()
     or v_exit < now() - interval '10 minutes'
     or v_exit < v_s.entry_time then
    v_exit := now();
  end if;

  v_min := greatest(floor(extract(epoch from (v_exit - v_s.entry_time)) / 60)::int, 0);
  select * into v_f from public.calc_fee(v_s.owner_category, v_s.vehicle_type, v_min);

  v_method := case when v_f.amount = 0 then 'free' else p_payment_method end;

  update public.parking_sessions
     set exit_time = v_exit,
         duration_minutes = v_min,
         free_minutes_applied = v_f.free_min,
         rate_per_hour_applied = v_f.rate,
         fee = v_f.amount,
         payment_method = v_method,
         status = 'completed',
         checked_out_by = auth.uid()
   where id = v_s.id
   returning * into v_s;

  update public.slots set status = 'available' where id = v_s.slot_id;

  return v_s;
end;
$$;

-- ---------- 6. DASHBOARD SUMMARY ----------------------------------

create or replace function public.dashboard_summary()
returns jsonb
language sql
stable
set search_path = public
as $$
  with b as (
    select date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' as d0
  )
  select jsonb_build_object(
    'two_wheeler', jsonb_build_object(
      'total',    (select count(*) from public.slots where vehicle_type = 'two_wheeler'),
      'occupied', (select count(*) from public.slots where vehicle_type = 'two_wheeler' and status = 'occupied')),
    'four_wheeler', jsonb_build_object(
      'total',    (select count(*) from public.slots where vehicle_type = 'four_wheeler'),
      'occupied', (select count(*) from public.slots where vehicle_type = 'four_wheeler' and status = 'occupied')),
    'vehicles_today', (select count(*) from public.parking_sessions s, b where s.entry_time >= b.d0),
    'fees_today',     (select coalesce(sum(s.fee), 0) from public.parking_sessions s, b
                        where s.status = 'completed' and s.exit_time >= b.d0)
  )
  from b;
$$;

-- ---------- 7. PROFILES AUTO-CREATE & REGISTRATION RPCs ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, approved, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), true, 'guard')
  on conflict (id) do update set approved = true;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Check if username is available (3-20 chars: a-z 0-9 . _)
create or replace function public.username_available(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_u text := lower(trim(coalesce(p_username, '')));
begin
  if v_u = '' or v_u !~ '^[a-z0-9._]{3,20}$' then
    return false;
  end if;
  return not exists (
    select 1 from public.profiles where lower(username) = v_u
  );
end;
$$;

-- Lookup email by username for login
create or replace function public.login_email(p_username text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_u text := lower(trim(coalesce(p_username, '')));
begin
  if v_u = '' then
    return null;
  end if;

  select u.email into v_email
    from auth.users u
    join public.profiles p on p.id = u.id
   where lower(p.username) = v_u;

  return v_email;
end;
$$;

-- Complete registration RPC
create or replace function public.complete_registration(
  p_full_name  text,
  p_username   text,
  p_role       text,
  p_gate_type  text,
  p_gate_name  text,
  p_code       text
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid  uuid := auth.uid();
  v_u    text := lower(trim(coalesce(p_username, '')));
  v_name text := trim(coalesce(p_full_name, ''));
  v_code text := trim(coalesce(p_code, ''));
  v_prof public.profiles;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if v_name = '' then
    raise exception 'INVALID_NAME';
  end if;

  if v_u = '' or v_u !~ '^[a-z0-9._]{3,20}$' then
    raise exception 'INVALID_USERNAME';
  end if;

  if exists (select 1 from public.profiles where lower(username) = v_u and id <> v_uid) then
    raise exception 'USERNAME_TAKEN';
  end if;

  -- No access code required: all accounts are auto-approved directly without any code

  update public.profiles
     set full_name = v_name,
         username  = v_u,
         role      = p_role,
         gate_type = case when p_role = 'admin' then null else p_gate_type end,
         gate_name = coalesce(p_gate_name, ''),
         approved  = true
   where id = v_uid
   returning * into v_prof;

  if v_prof.id is null then
    insert into public.profiles (id, full_name, username, role, gate_type, gate_name, approved)
    values (v_uid, v_name, v_u, p_role, case when p_role = 'admin' then null else p_gate_type end, coalesce(p_gate_name, ''), true)
    returning * into v_prof;
  end if;

  return v_prof;
end;
$$;

-- ---------- 8. SECURITY (RLS + permissions) -----------------------

alter table public.profiles         enable row level security;
alter table public.slots            enable row level security;
alter table public.tariffs          enable row level security;
alter table public.parking_sessions enable row level security;

-- Table payment_settings (single row, id = 1): payee_name, payee_vpa, online_payments_enabled. Readable by approved users; only admin can update.
create table if not exists public.payment_settings (
  id int primary key default 1 check (id = 1),
  payee_name text not null default 'Campus Parking',
  payee_vpa text not null default '',
  online_payments_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.payment_settings (id, payee_name, payee_vpa, online_payments_enabled)
values (1, 'Campus Parking', '', false)
on conflict (id) do nothing;

alter table public.payment_settings enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_select_anon on public.profiles
  for select to anon using (true);
create policy slots_select on public.slots
  for select to anon, authenticated using (true);
create policy tariffs_select on public.tariffs
  for select to anon, authenticated using (true);
create policy sessions_select on public.parking_sessions
  for select to anon, authenticated using (true);

create policy tariffs_admin_update on public.tariffs
  for update to authenticated
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy payment_settings_select on public.payment_settings
  for select to anon, authenticated using (true);

create policy payment_settings_admin_update on public.payment_settings
  for update to authenticated
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Allow read access for terminals and public views
grant select on public.slots, public.session_details, public.tariffs,
              public.parking_sessions, public.payment_settings to anon, authenticated;

-- Direct writes restricted (writes go through security-definer RPC functions)
revoke insert, update, delete on public.slots, public.parking_sessions, public.profiles from anon, authenticated;
revoke insert, delete on public.tariffs, public.payment_settings from anon, authenticated;

grant select, update on public.payment_settings to authenticated;

-- Grant execution on RPC procedures to both terminal (anon) and authenticated operators
grant execute on function public.calc_fee(text, text, int)             to anon, authenticated;
grant execute on function public.check_in(text, text, text, uuid)      to anon, authenticated;
grant execute on function public.preview_checkout(text)                to anon, authenticated;
grant execute on function public.confirm_checkout(uuid, timestamptz, text) to anon, authenticated;
grant execute on function public.dashboard_summary()                   to anon, authenticated;
grant execute on function public.username_available(text)             to anon, authenticated;
grant execute on function public.login_email(text)                    to anon, authenticated;
grant execute on function public.complete_registration(text, text, text, text, text, text) to anon, authenticated;

-- ---------- 9. REALTIME -------------------------------------------

alter publication supabase_realtime add table public.slots, public.parking_sessions;
