-- Sailing AI production schema
-- Apply this after creating/linking the Sailing AI Supabase project.
create extension if not exists pgcrypto;

create type public.app_role as enum ('user','content_manager','admin','owner');
create type public.subscription_status as enum ('trial','active','expired','suspended');
create type public.payment_status as enum ('pending','paid','rejected','refunded');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status public.subscription_status not null default 'trial',
  trial_ends_at timestamptz not null default (now() + interval '30 days'),
  current_period_end timestamptz,
  plan_code text not null default 'monthly',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'LYD',
  plan_code text not null default 'monthly',
  method text,
  proof_url text,
  status public.payment_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id boolean primary key default true check (id),
  background_color text not null default '#06111d',
  primary_color text not null default '#1aa8b9',
  monthly_price numeric(12,2) not null default 10,
  trial_days integer not null default 30,
  updated_at timestamptz not null default now()
);

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  image_url text,
  published boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text,
  body text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.site_settings enable row level security;
alter table public.news enable row level security;
alter table public.notes enable row level security;

-- Authorization must come from profiles.role, not user-editable user_metadata.
create or replace function public.is_admin()
returns boolean language sql stable security invoker
as $$ select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','owner')); $$;

create policy "profiles self read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles admin update" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "subscriptions self read" on public.subscriptions for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "payments self read" on public.payments for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "payments self insert" on public.payments for insert to authenticated with check (user_id = auth.uid());
create policy "payments admin update" on public.payments for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "settings public read" on public.site_settings for select to anon, authenticated using (true);
create policy "settings admin update" on public.site_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "news public read" on public.news for select to anon, authenticated using (published = true or public.is_admin());
create policy "news admin insert" on public.news for insert to authenticated with check (public.is_admin());
create policy "news admin update" on public.news for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "news admin delete" on public.news for delete to authenticated using (public.is_admin());

create policy "notes admin all" on public.notes for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.site_settings (id) values (true) on conflict (id) do nothing;
