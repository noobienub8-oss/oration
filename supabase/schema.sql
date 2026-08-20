-- Podium — Supabase schema
-- Run this once in your project's SQL Editor (Supabase dashboard -> SQL Editor -> New query).

-- ============================================================
-- profiles — one row per user, extends auth.users with role + gamification state
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  role text not null check (role in ('student','teacher')),
  xp int not null default 0,
  streak_count int not null default 0,
  last_active_date date,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Everyone signed in can see names/roles/xp (needed for the leaderboard and
-- for teachers to see student names on submissions).
create policy "profiles are viewable by any authenticated user"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- You can only ever update your own row (xp, streak, etc).
create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================================
-- auto-create a profile row on signup, reading display_name/role out of the
-- signup metadata passed from the client (supabase.auth.signUp({ options: { data: {...} } }))
-- ============================================================
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Student'),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- submissions — one row per completed speaking exercise
-- ============================================================
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) on delete cascade not null,
  prompt text not null,
  transcript text not null,
  metrics jsonb not null,
  summary jsonb not null,
  recommendations jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.submissions enable row level security;

create policy "students can insert their own submissions"
  on public.submissions for insert
  with check (auth.uid() = student_id);

create policy "students can view their own submissions"
  on public.submissions for select
  using (auth.uid() = student_id);

create policy "teachers can view all submissions"
  on public.submissions for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'teacher'
    )
  );

-- ============================================================
-- Realtime: let the teacher dashboard subscribe to new submissions
-- ============================================================
alter publication supabase_realtime add table public.submissions;
