-- ============================================================================
-- 010_triggers.sql
--
-- Attaches the functions from 009_functions.sql to tables. Every trigger is
-- dropped-if-exists before being (re)created, so this file is safe to re-run.
--
-- Backward compatibility: these triggers fire AFTER the application's own
-- INSERT/UPDATE succeeds (or, for updated_at, adjust the row BEFORE the
-- write completes) -- in both cases within the same transaction the app
-- initiated. None of them can change the row values the app itself sees
-- back, except fn_touch_updated_at, which only ever touches the new
-- `updated_at` column on brand-new tables the app doesn't use yet.
-- ============================================================================

-- purchase_items -> lot + PURCHASE movement + balance
drop trigger if exists trg_purchase_item_to_lot on public.purchase_items;
create trigger trg_purchase_item_to_lot
  after insert on public.purchase_items
  for each row execute function public.fn_purchase_item_to_lot();

-- transactions -> movement (+ lot for 'beginning') + balance
drop trigger if exists trg_transaction_to_movement on public.transactions;
create trigger trg_transaction_to_movement
  after insert on public.transactions
  for each row execute function public.fn_transaction_to_movement();

-- stock_counts -> FIFO consumption + balance finalization, only on approval
drop trigger if exists trg_stock_count_approve on public.stock_counts;
create trigger trg_stock_count_approve
  after update on public.stock_counts
  for each row execute function public.fn_stock_count_approve();

-- updated_at maintenance on the new tables that have it
drop trigger if exists trg_touch_updated_at on public.inventory_lots;
create trigger trg_touch_updated_at
  before update on public.inventory_lots
  for each row execute function public.fn_touch_updated_at();

drop trigger if exists trg_touch_updated_at on public.stock_counts;
create trigger trg_touch_updated_at
  before update on public.stock_counts
  for each row execute function public.fn_touch_updated_at();

-- Generic audit logging, attached explicitly per table (Postgres requires
-- one trigger per table; the underlying function is fully reusable).
-- Scoped to tables with a uuid `id` primary key.
do $$
declare
  t text;
begin
  foreach t in array array[
    'items', 'purchases', 'purchase_items', 'transactions',
    'inventory_lots', 'stock_movements', 'stock_counts', 'stock_count_items'
  ]
  loop
    execute format('drop trigger if exists trg_audit_log on public.%I;', t);
    execute format(
      'create trigger trg_audit_log after insert or update or delete on public.%I
       for each row execute function public.fn_generic_audit_log();',
      t
    );
  end loop;
end $$;
