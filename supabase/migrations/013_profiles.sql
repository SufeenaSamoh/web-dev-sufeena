-- ============================================================================
-- 013_profiles.sql
--
-- Purpose: back the User Management screen with a real, RLS-protected
-- `public.profiles` table, one row per Supabase Auth user.
--
-- Schema (as specified):
--   id          -- same uuid as auth.users.id (1:1, FK, cascade delete)
--   email
--   full_name
--   role        -- 'owner' | 'admin' | 'manager' | 'staff'
--   active      -- boolean; false = disabled
--   created_at
--
-- Design notes
-- ------------
-- * `profiles.id` IS `auth.users.id` (not a separate uuid). A row can only
--   exist once a real Supabase Auth account exists, which `handle_new_user()`
--   guarantees by inserting a profile immediately after every auth.users
--   insert (role defaults to the lowest privilege, 'staff').
-- * The browser only ever holds the anon/publishable key, which cannot call
--   the Auth Admin API (that needs the service role key and must stay
--   server-side). "Create user" in the UI instead uses a throwaway,
--   non-persistent Supabase client to call the *public* `auth.signUp()`
--   API — this creates a real auth.users row (so `id` matches this schema
--   exactly) without ever touching the admin's own logged-in session. See
--   src/services/profiles.ts (`createProfile`) for the client-side half of
--   this flow. The existing login/session code (src/lib/auth.tsx) is not
--   touched by any of this.
-- * `current_profile_role()` is a `security definer` helper so RLS policies
--   can check "is the caller an Owner/Admin" without the classic Postgres
--   RLS infinite-recursion problem (a policy on `profiles` that queries
--   `profiles` to evaluate itself).
-- * A BEFORE UPDATE guard trigger stops a non-owner/admin from changing
--   their own role/active flag via the "update your own row" policy, and
--   stops anyone but an existing Owner from granting the 'owner' role. A
--   BEFORE DELETE guard trigger stops self-deletion and stops anyone but
--   an Owner deleting another Owner.
--
-- Backward compatibility: brand-new table, does not touch the legacy
-- `public.users` table (still used elsewhere, e.g. Settings backup export).
-- ============================================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text not null default '',
  role        text not null default 'staff'
                check (role in ('owner', 'admin', 'manager', 'staff')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is
  'One row per Supabase Auth user (id = auth.users.id). Created automatically '
  'by handle_new_user() on sign up; role is set afterwards by an Owner/Admin '
  'via the Users screen.';

-- ----------------------------------------------------------------------------
-- current_profile_role(): the calling user's role, or null if they have no
-- profile row yet. security definer + a pinned search_path so it can read
-- public.profiles regardless of the caller's own row-level permissions.
-- ----------------------------------------------------------------------------
create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_profile_role() to authenticated;

-- ----------------------------------------------------------------------------
-- handle_new_user(): runs after Supabase Auth creates a row in auth.users.
-- Always defaults to role 'staff' + active so nobody can grant themselves
-- elevated access by signing up directly; an Owner/Admin promotes the row
-- afterwards from the Users screen.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'staff',
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- fn_profiles_guard_self_update(): a non-owner/admin can only ever change
-- their own full_name via the self-update policy below -- this snaps
-- role/active back to their previous value if a non-privileged actor tries
-- to change them, and refuses to let anyone but an existing Owner promote a
-- row to 'owner'.
-- ----------------------------------------------------------------------------
create or replace function public.fn_profiles_guard_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text := public.current_profile_role();
begin
  if v_caller_role is distinct from 'owner' and v_caller_role is distinct from 'admin' then
    new.role := old.role;
    new.active := old.active;
  end if;

  if new.role = 'owner' and old.role is distinct from 'owner' and v_caller_role is distinct from 'owner' then
    new.role := old.role;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_guard_self_update on public.profiles;
create trigger trg_profiles_guard_self_update
  before update on public.profiles
  for each row execute function public.fn_profiles_guard_self_update();

-- ----------------------------------------------------------------------------
-- fn_profiles_guard_delete(): nobody can delete their own account from the
-- Users screen, and only an existing Owner can delete another Owner.
-- ----------------------------------------------------------------------------
create or replace function public.fn_profiles_guard_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.id = auth.uid() then
    raise exception 'You cannot delete your own account.';
  end if;

  if old.role = 'owner' and public.current_profile_role() is distinct from 'owner' then
    raise exception 'Only an Owner can delete another Owner.';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_profiles_guard_delete on public.profiles;
create trigger trg_profiles_guard_delete
  before delete on public.profiles
  for each row execute function public.fn_profiles_guard_delete();

-- Generic append-only audit trail (fn_generic_audit_log already defined in
-- 009_functions.sql; see 005_audit_logs.sql / 010_triggers.sql for the
-- pattern this follows).
drop trigger if exists trg_audit_log on public.profiles;
create trigger trg_audit_log
  after insert or update or delete on public.profiles
  for each row execute function public.fn_generic_audit_log();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Read: yourself, or everything if you're an Owner/Admin.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.current_profile_role() in ('owner', 'admin')
  );

-- Insert: Owner/Admin only. Not used by the normal "Create user" flow
-- (rows are created by handle_new_user() as security definer, which
-- bypasses RLS) — kept as a defensive escape hatch for manual fixes.
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert
  to authenticated
  with check (
    public.current_profile_role() in ('owner', 'admin')
  );

-- Update: Owner/Admin can update any row (role, active, full_name). This is
-- how "Create user" sets the chosen role right after sign up, and how
-- "Edit user" / "Disable user" work.
drop policy if exists profiles_update_privileged on public.profiles;
create policy profiles_update_privileged on public.profiles
  for update
  to authenticated
  using (public.current_profile_role() in ('owner', 'admin'))
  with check (public.current_profile_role() in ('owner', 'admin'));

-- Update: everyone can also update their own row (full_name only -- role
-- and active changes are reverted by the guard trigger above unless the
-- caller is also Owner/Admin).
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Delete: Owner/Admin only (further restricted by the guard trigger above).
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete
  to authenticated
  using (public.current_profile_role() in ('owner', 'admin'));

-- Deliberately NOT granted to `anon`: profiles hold PII and access roles,
-- unlike the rest of this schema's permissive tables.
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant usage on schema public to authenticated;
