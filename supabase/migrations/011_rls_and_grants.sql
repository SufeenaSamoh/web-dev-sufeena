-- ============================================================================
-- 011_rls_and_grants.sql
--
-- Purpose: enable RLS and mirror the existing permissive `allow_all` policy
-- style already used in SUPABASE_SCHEMA.sql for every other table, so the
-- new tables behave identically to the existing ones from the client's
-- point of view. This is a deliberate, scoped exception to normal security
-- best-practice, made ONLY to satisfy "existing application must continue
-- working after migration" -- the app currently assumes unrestricted access
-- everywhere and has no handling for a permission-denied response.
--
-- IMPORTANT: this is not a security recommendation. audit_logs and
-- stock_movements in particular are meant to be append-only/immutable by
-- design; granting UPDATE/DELETE here only exists for parity with the rest
-- of the current (also permissive) schema. Tighten this -- ideally to
-- INSERT-only for those two tables, and to real per-branch/per-role
-- policies everywhere -- once real Supabase Auth exists (see the earlier
-- architecture review).
-- ============================================================================

alter table public.inventory_balance enable row level security;
alter table public.inventory_lots    enable row level security;
alter table public.stock_movements   enable row level security;
alter table public.stock_counts      enable row level security;
alter table public.stock_count_items enable row level security;
alter table public.audit_logs        enable row level security;
alter table public.notifications     enable row level security;
alter table public.system_settings   enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'inventory_balance', 'inventory_lots', 'stock_movements',
    'stock_counts', 'stock_count_items', 'audit_logs',
    'notifications', 'system_settings'
  ]
  loop
    execute format('drop policy if exists allow_all on public.%I;', t);
    execute format(
      'create policy allow_all on public.%I for all to anon, authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

grant select, insert, update, delete on
  public.inventory_balance,
  public.inventory_lots,
  public.stock_movements,
  public.stock_counts,
  public.stock_count_items,
  public.audit_logs,
  public.notifications,
  public.system_settings
to anon, authenticated;

grant usage on schema public to anon, authenticated;
