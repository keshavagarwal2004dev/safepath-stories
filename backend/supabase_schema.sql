create extension if not exists pgcrypto;

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  ngo_id text not null,
  title text not null,
  topic text not null,
  age_group text not null,
  language text not null,
  region_context text,
  description text not null,
  moral_lesson text,
  character_count int not null default 1,
  status text not null default 'draft',
  students_reached int not null default 0,
  completion_rate int not null default 0,
  cover_image_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.story_slides (
  id bigint generated always as identity primary key,
  story_id uuid not null references public.stories(id) on delete cascade,
  position int not null,
  image_url text,
  text text not null,
  choices jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists story_slides_story_position_idx
  on public.story_slides (story_id, position);

create table if not exists public.student_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age_group text not null,
  avatar text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ngo_accounts (
  id uuid primary key default gen_random_uuid(),
  org_name text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.ngo_accounts enable row level security;
alter table public.student_profiles enable row level security;

do $$
begin
  create policy ngo_accounts_select_public
    on public.ngo_accounts
    for select
    to anon, authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy ngo_accounts_insert_public
    on public.ngo_accounts
    for insert
    to anon, authenticated
    with check (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy student_profiles_insert_public
    on public.student_profiles
    for insert
    to anon, authenticated
    with check (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy student_profiles_select_public
    on public.student_profiles
    for select
    to anon, authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;