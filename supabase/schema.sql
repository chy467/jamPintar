-- Schema untuk JAM PINTAR
-- Jalankan di Supabase Dashboard > SQL Editor.
-- Dua tabel: profiles (pengaturan pengguna) dan tracks (aktivitas GPX). Keduanya RLS, data milik pemiliknya sendiri.
-- Boleh dijalankan berulang: bagian alter table bersifat idempotent.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  weight_kg numeric,
  height_cm numeric,
  gender text check (gender in ('male', 'female')),
  age int check (age between 5 and 110),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists weight_kg numeric;
alter table public.profiles add column if not exists height_cm numeric;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null,
  date timestamptz not null,
  distance_m numeric not null check (distance_m > 0),
  duration_s numeric not null,
  avg_pace_s_per_km numeric,
  elev_gain_m numeric,
  elev_loss_m numeric,
  min_ele_m numeric,
  max_ele_m numeric,
  avg_hr numeric,
  max_hr numeric,
  avg_cad numeric,
  resting_hr numeric,
  hr_max_set numeric,
  points jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.tracks add column if not exists resting_hr numeric;
alter table public.tracks add column if not exists hr_max_set numeric;

create index if not exists tracks_user_date_idx on public.tracks (user_id, date desc);

alter table public.tracks enable row level security;

drop policy if exists "tracks_select_own" on public.tracks;
create policy "tracks_select_own"
  on public.tracks for select
  using (auth.uid() = user_id);

drop policy if exists "tracks_insert_own" on public.tracks;
create policy "tracks_insert_own"
  on public.tracks for insert
  with check (auth.uid() = user_id);

drop policy if exists "tracks_update_own" on public.tracks;
create policy "tracks_update_own"
  on public.tracks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "tracks_delete_own" on public.tracks;
create policy "tracks_delete_own"
  on public.tracks for delete
  using (auth.uid() = user_id);