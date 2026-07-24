-- ============================================================================
-- 003_stock_movements.sql
--
-- Purpose: the central, structured ledger of every inventory movement.
-- Every purchase, beginning entry, adjustment, and (in future) transfer or
-- return produces exactly one or more rows here. Future reports/dashboards
-- should read from this table instead of the legacy `transactions` table.
--
-- Backward compatibility: brand-new table, populated exclusively by trigger
-- functions attached to existing tables (purchase_items, transactions) and
-- to the new stock_counts approval workflow. The application never writes
-- to it directly, so nothing in the current UI can break because of it.
-- ============================================================================

create table if not exists public.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references public.branches(id) on delete set null,
  item_id         uuid not null references public.items(id) on delete cascade,
  lot_id          uuid references public.inventory_lots(id) on delete set null,
  movement_type   text not null check (
                    movement_type in (
                      'PURCHASE', 'USAGE', 'ADJUSTMENT', 'STOCK_COUNT',
                      'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN', 'BEGINNING'
                    )
                  ),
  quantity        numeric not null,           -- signed: positive = in, negative = out
  unit_cost       numeric,
  reference_table text,                        -- e.g. 'purchase_items', 'transactions', 'stock_count_items'
  reference_id    uuid,                        -- id of the row in reference_table that caused this movement
  movement_date   timestamptz not null default now(),
  remark          text,
  created_by      uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

comment on table public.stock_movements is
  'Central, append-only movement ledger. lot_id is NULL for movements that '
  'are not yet allocated to a specific lot (e.g. legacy adjustment inserts, '
  'or a stock-count variance that found more stock than expected) -- this is '
  'expected and intentional, not a data-quality bug: FIFO allocation only '
  'happens through fn_consume_fifo(), triggered by stock_counts approval.';

comment on column public.stock_movements.reference_table is
  'Loosely-typed pointer (no FK, since it can point at several different '
  'tables) back to the row that caused this movement, e.g. '
  '''purchase_items'', ''transactions'', or ''stock_count_items''.';
