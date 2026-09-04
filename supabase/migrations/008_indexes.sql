-- ============================================================================
-- 008_indexes.sql
--
-- Purpose: indexes to support the query patterns the new tables/triggers
-- introduce. Postgres does not auto-index foreign key columns, so several
-- of these (e.g. purchase_items.item_id) close real gaps even on existing
-- tables -- added here as plain indexes, not constraints, so they cannot
-- change behavior, only speed.
--
-- Backward compatibility: pure performance additions; no existing query or
-- write path is affected.
-- ============================================================================

-- inventory_balance
create index if not exists idx_inventory_balance_item on public.inventory_balance (item_id);

-- inventory_lots
create index if not exists idx_inventory_lots_branch_item_status on public.inventory_lots (branch_id, item_id, status);
create index if not exists idx_inventory_lots_fifo_order on public.inventory_lots (item_id, branch_id, received_date, lot_number);
create index if not exists idx_inventory_lots_expiry on public.inventory_lots (expiry_date) where expiry_date is not null;
create index if not exists idx_inventory_lots_purchase_item on public.inventory_lots (purchase_item_id);

-- stock_movements
create index if not exists idx_stock_movements_branch_item_date on public.stock_movements (branch_id, item_id, movement_date);
create index if not exists idx_stock_movements_lot on public.stock_movements (lot_id);
create index if not exists idx_stock_movements_reference on public.stock_movements (reference_table, reference_id);
create index if not exists idx_stock_movements_type on public.stock_movements (movement_type);

-- stock_counts / stock_count_items
create index if not exists idx_stock_counts_branch_status on public.stock_counts (branch_id, status);
create index if not exists idx_stock_counts_period on public.stock_counts (period_start, period_end);
create index if not exists idx_stock_count_items_item on public.stock_count_items (item_id);

-- audit_logs
create index if not exists idx_audit_logs_table_record on public.audit_logs (table_name, record_id);
create index if not exists idx_audit_logs_changed_at on public.audit_logs (changed_at);

-- notifications
create index if not exists idx_notifications_branch on public.notifications (branch_id);
create index if not exists idx_notifications_open on public.notifications (is_resolved, is_dismissed);
create index if not exists idx_notifications_type on public.notifications (type);

-- new column on an existing table
create index if not exists idx_transactions_branch on public.transactions (branch_id);

-- pre-existing tables missing FK indexes that the new triggers now query heavily
create index if not exists idx_purchase_items_item on public.purchase_items (item_id);
create index if not exists idx_purchase_items_purchase on public.purchase_items (purchase_id);
