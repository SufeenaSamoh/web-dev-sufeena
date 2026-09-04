-- ============================================================================
-- 005_audit_logs.sql
--
-- Purpose: a single, generic, append-only audit table that can log changes
-- to any table via one reusable trigger function (fn_generic_audit_log(),
-- see 009_functions.sql). Adding auditing to a new table later is a
-- one-line `create trigger` in a future migration -- no schema change here.
--
-- Backward compatibility: brand-new table; nothing in the current app reads
-- or writes it. Attaching the audit trigger to existing tables (items,
-- purchases, purchase_items, transactions -- see 010_triggers.sql) only
-- adds an extra INSERT into audit_logs alongside the app's original write;
-- it never rejects or alters the original write.
-- ============================================================================

create table if not exists public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  table_name    text not null,
  record_id     text,          -- text, not uuid: keeps the log genuinely generic even
                                -- for tables whose primary key isn't a uuid `id` column
  action        text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  before_value  jsonb,
  after_value   jsonb,
  user_id       uuid references public.users(id) on delete set null,
  branch_id     uuid references public.branches(id) on delete set null,
  changed_at    timestamptz not null default now()
);

comment on table public.audit_logs is
  'Generic, append-only change log. Populated by fn_generic_audit_log(), '
  'attached explicitly per table (Postgres has no "watch every table" '
  'trigger primitive), but the function itself requires no per-table code -- '
  'it derives table_name/record_id/before/after generically from '
  'TG_TABLE_NAME and row_to_json(OLD/NEW). user_id is nullable because the '
  'application does not yet have real authentication, so writes cannot '
  'currently be attributed to a specific logged-in user.';
