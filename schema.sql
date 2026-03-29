-- =============================================
-- Dento Egypt - Supabase Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- PATIENTS
create table patients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  first_name text not null,
  last_name text not null,
  phone text not null,
  age integer,
  status text default 'Active' check (status in ('Active','Inactive')),
  notes text default ''
);

-- APPOINTMENTS
create table appointments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  patient_id uuid references patients(id) on delete cascade,
  date date not null,
  time text not null,
  treatment text not null,
  doctor text not null,
  status text default 'Pending' check (status in ('Pending','Confirmed','Cancelled'))
);

-- PAYMENTS
create table payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  patient_id uuid references patients(id) on delete cascade,
  treatment text not null,
  amount numeric(10,2) not null,
  status text default 'Pending' check (status in ('Paid','Pending','Partial')),
  date date default current_date
);

-- ROW LEVEL SECURITY (staff only - authenticated users)
alter table patients enable row level security;
alter table appointments enable row level security;
alter table payments enable row level security;

create policy "Staff can do everything on patients"
  on patients for all to authenticated using (true) with check (true);

create policy "Staff can do everything on appointments"
  on appointments for all to authenticated using (true) with check (true);

create policy "Staff can do everything on payments"
  on payments for all to authenticated using (true) with check (true);

-- INDEX for fast lookups
create index on appointments(date);
create index on appointments(patient_id);
create index on payments(patient_id);
