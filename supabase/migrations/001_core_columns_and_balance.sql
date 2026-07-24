-- ============================================================================
-- 001_core_columns_and_balance.sql
--
-- Purpose:
--   1. Add nullable, additive expiry-configuration columns to `items`.
--   2. Deprecate `items.current_stock` as the stock source of truth
--      (kept in place, still written by the existing app -- NOT dropped).
--   3. Add a nullable `branch_id` to `transactions` so legacy inserts can
--      optionally carry branch attribution once the UI is updated.
--   4. Create `inventory_balance`: the new per-branch, per-item source of
--      truth for current stock.
--
-- Backward compatibility:
--   - All new columns are nullable / have safe defaults. No existing column
--     is renamed, retyped, or dropped. No existing row is modified.
--   - `inventory_balance` is a brand-new table; nothing in the current app
--     reads or writes it yet, so this file cannot change existing behavior.
-- ============================================================================

-- 1 & 2. items: expiry config + deprecation notice on current_stock
alter table public.items
  add column if not exists has_expiry boolean not null default false,
  add column if not exists shelf_life_days integer,
  add column if not exists expiry_warning_days integer;

comment on column public.items.current_stock is
  'DEPRECATED as of 001_core_columns_and_balance.sql. Do not use as the '
  'source of truth for stock levels -- use inventory_balance (branch_id, '
  'item_id) instead. Retained only because the existing application still '
  'reads/writes this column; do not remove without updating the app.';

comment on column public.items.has_expiry is
  'Whether this item is expiry-tracked. Used to auto-calculate '
  'inventory_lots.expiry_date when a purchase/beginning entry does not '
  'supply one explicitly.';

comment on column public.items.shelf_life_days is
  'Default shelf life in days from receive date, used to auto-calculate '
  'expiry_date when has_expiry is true and no explicit expiry is given.';

comment on column public.items.expiry_warning_days is
  'How many days before expiry a near-expiry notification should be raised. '
  'NULL means fall back to the system_settings default.';

-- 3. transactions: optional branch attribution (nullable, additive)
alter table public.transactions
  add column if not exists branch_id uuid references public.branches(id) on delete set null;

comment on column public.transactions.branch_id is
  'Optional branch attribution for legacy ledger rows. Nullable because the '
  'current UI (BeginningStockPage / StockCountPage / InventoryOpsPage) does '
  'not yet persist a structured branch reference here -- it is embedded as '
  'free text in `remark` instead. Populate this going forward wherever the '
  'UI is updated to pass it through.';

-- 4. inventory_balance: real per-branch stock (the new source of truth)
create table if not exists public.inventory_balance (
  branch_id  uuid not null references public.branches(id) on delete cascade,
  item_id    uuid not null references public.items(id) on delete cascade,
  quantity   numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (branch_id, item_id)
);

comment on table public.inventory_balance is
  'Source of truth for current stock, one row per (branch, item). '
  'Maintained exclusively by trigger functions (fn_upsert_inventory_balance, '
  'fn_stock_count_approve) -- never written to directly by the application. '
  'Intentionally has no quantity >= 0 check constraint: the legacy '
  '`transactions`-driven adjustment path does not validate against '
  'available stock before writing, and a hard constraint here could abort '
  'an otherwise-successful application write. Revisit once the legacy '
  'write path is fully migrated to the new workflow.';

comment on column public.inventory_balance.item_id is
  'ON DELETE CASCADE intentionally matches the existing cascade behavior of '
  'purchase_items.item_id / transactions.item_id, so that the existing '
  'deleteItem() flow in the app continues to succeed unchanged.';
