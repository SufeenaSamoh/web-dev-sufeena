-- ============================================================================
-- 004_stock_counts.sql
--
-- Purpose: a real, structured Stock Count workflow (header + lines) to
-- eventually replace the current practice of writing loose `adjustment`
-- transactions. Carries period_start/period_end so Inventory Analysis can
-- compute Beginning/Purchases/Ending/Usage for an exact date range, and a
-- count/approval user pair for a future approval workflow.
--
-- This table is NOT yet wired to the UI (StockCountPage / InventoryOpsPage
-- still write to `transactions` as before) -- that is deliberately out of
-- scope for this database-only migration. FIFO consumption only activates
-- once a row here is moved to status = 'approved' (see 010_triggers.sql).
--
-- Backward compatibility: brand-new tables, untouched by the current app.
-- ============================================================================

create table if not exists public.stock_counts (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid not null references public.branches(id) on delete restrict,
  count_date        date not null default current_date,
  period_start      date not null,
  period_end        date not null,
  status            text not null default 'draft'
                       check (status in ('draft', 'submitted', 'approved', 'rejected')),
  count_user_id     uuid references public.users(id) on delete set null,
  approval_user_id  uuid references public.users(id) on delete set null,
  remark            text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint stock_counts_period_valid check (period_end >= period_start)
);

comment on table public.stock_counts is
  'Header for a physical stock count covering [period_start, period_end]. '
  'Inventory Analysis should read Beginning/Purchases/Ending/Usage for that '
  'branch+period from stock_movements bounded by these dates. FIFO '
  'consumption for the whole count is allocated exactly once, by trigger, '
  'the moment status transitions into ''approved'' -- see fn_stock_count_approve().';

comment on column public.stock_counts.branch_id is
  'NOT NULL + ON DELETE RESTRICT is safe here (unlike other new tables) '
  'because this table is not yet written to by the existing app -- there is '
  'no legacy-data risk, and there is currently no deleteBranch() in the app '
  'to conflict with it.';

create table if not exists public.stock_count_items (
  id              uuid primary key default gen_random_uuid(),
  stock_count_id  uuid not null references public.stock_counts(id) on delete cascade,
  item_id         uuid not null references public.items(id) on delete cascade,
  system_qty      numeric not null default 0,   -- what inventory_balance expected before the physical count
  counted_qty     numeric not null default 0,   -- the physical Ending Count
  variance        numeric generated always as (counted_qty - system_qty) stored,
  remark          text,
  created_at      timestamptz not null default now(),
  unique (stock_count_id, item_id)
);

comment on table public.stock_count_items is
  'One line per item counted. variance is a generated column (never stored '
  'redundantly by the app) so it can never drift from counted_qty - system_qty. '
  'Usage for the period = system_qty - counted_qty (i.e. -variance), computed '
  'and allocated to FIFO lots only on count approval.';
