-- User profiles: store onboarding and preferences linked to auth.users
create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  onboarding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "Users can read and update own profile"
  on public.user_profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, full_name, onboarding)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    '{}'::jsonb)
  on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
