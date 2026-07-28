-- ============================================================================
-- 013_fefo_consumption.sql
--
-- Purpose: FEFO (First Expired First Out) inventory consumption. Allocates
-- a requested quantity against public.inventory_lots ordered by
-- expiry_date ASC, then received_date ASC (earliest-expiring stock first;
-- lots with no expiry_date sort last, since Postgres puts NULLs last in an
-- ASC sort by default -- non-expiring stock is correctly consumed after
-- everything that can expire).
--
-- This is deliberately a separate function from the existing
-- fn_consume_fifo() (009_functions.sql), which:
--   (a) orders by received_date only (FIFO, not FEFO), and
--   (b) is only ever invoked from fn_stock_count_approve(), and silently
--       records an "unallocated" movement instead of erroring when lots on
--       hand can't cover the requested quantity.
-- fn_consume_fefo() below is meant to be called directly (via
-- supabase.rpc()) from application code for real-time FEFO consumption,
-- and raises an exception on insufficient stock rather than silently
-- under-allocating.
--
-- Atomicity: a single PL/pgSQL function call runs inside one implicit
-- Postgres transaction. If the RAISE EXCEPTION below fires, every
-- UPDATE/INSERT already performed earlier in this same call is rolled
-- back automatically -- this is what "consumeInventory() must run in a
-- transaction" means in practice for a Supabase/PostgREST client, which
-- cannot open a normal multi-statement transaction itself. `for update`
-- row locks on the selected lots also prevent two concurrent FEFO
-- consumptions from double-allocating the same lot.
--
-- Backward compatibility: brand-new function. Existing tables/columns
-- (inventory_lots, stock_movements, inventory_balance) are unchanged; no
-- existing trigger, policy, or app code is modified.
-- ============================================================================

create or replace function public.fn_consume_fefo(
  p_item_id uuid,
  p_qty numeric,
  p_branch_id uuid default null,
  p_reference_table text default null,
  p_reference_id uuid default null,
  p_movement_type text default 'USAGE',
  p_remark text default null
)
returns table (
  lot_id uuid,
  lot_number text,
  quantity numeric,
  expiry_date date
)
language plpgsql
as $$
declare
  v_remaining numeric := p_qty;
  v_available numeric;
  v_lot       record;
  v_take      numeric;
begin
  if p_item_id is null then
    raise exception 'fn_consume_fefo: item_id is required';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'fn_consume_fefo: quantity must be greater than zero';
  end if;

  -- Total consumable stock (same filter as the lot query below), checked
  -- up front so an insufficient-stock error is raised before touching any
  -- row, and so the error message can report exactly how much is on hand.
  select coalesce(sum(l.qty_remaining), 0)
    into v_available
    from public.inventory_lots l
   where l.item_id = p_item_id
     and l.qty_remaining > 0
     and l.status <> 'expired'
     and (p_branch_id is null or l.branch_id = p_branch_id);

  if v_available < p_qty then
    raise exception
      'Insufficient stock for item %: requested %, available %',
      p_item_id, p_qty, v_available
      using errcode = 'P0001';
  end if;

  for v_lot in
    select l.id, l.lot_number, l.qty_remaining, l.expiry_date
      from public.inventory_lots l
     where l.item_id = p_item_id
       and l.qty_remaining > 0
       and l.status <> 'expired'
       and (p_branch_id is null or l.branch_id = p_branch_id)
     order by l.expiry_date asc, l.received_date asc, l.lot_number asc
     for update
  loop
    exit when v_remaining <= 0;
    v_take := least(v_lot.qty_remaining, v_remaining);

    update public.inventory_lots
       set qty_remaining = qty_remaining - v_take,
           status = case when qty_remaining - v_take <= 0 then 'depleted' else status end,
           updated_at = now()
     where id = v_lot.id;

    insert into public.stock_movements
      (branch_id, item_id, lot_id, movement_type, quantity,
       reference_table, reference_id, movement_date, remark)
    values
      (p_branch_id, p_item_id, v_lot.id, p_movement_type, -v_take,
       p_reference_table, p_reference_id, now(), p_remark);

    perform public.fn_upsert_inventory_balance(p_branch_id, p_item_id, -v_take);

    lot_id := v_lot.id;
    lot_number := v_lot.lot_number;
    quantity := v_take;
    expiry_date := v_lot.expiry_date;
    return next;

    v_remaining := v_remaining - v_take;
  end loop;

  -- v_remaining should always be 0 here since v_available >= p_qty was
  -- already verified above under the same row set; guard anyway in case of
  -- a concurrent consumer racing past the check (the `for update` locks
  -- prevent double-spend, but a concurrent transaction could still commit
  -- and shrink v_available between the check and the lock being taken).
  if v_remaining > 0 then
    raise exception
      'Insufficient stock for item %: requested %, short by %',
      p_item_id, p_qty, v_remaining
      using errcode = 'P0001';
  end if;
end;
$$;

comment on function public.fn_consume_fefo(uuid, numeric, uuid, text, uuid, text, text) is
  'FEFO allocation: consumes p_qty of item p_item_id from inventory_lots '
  'ordered by expiry_date ASC, received_date ASC. Raises an exception '
  '(rolling back the whole call) if there is not enough stock. Returns one '
  'row per lot deducted from, matching the stock_movements rows it creates.';

grant execute on function public.fn_consume_fefo(uuid, numeric, uuid, text, uuid, text, text)
  to anon, authenticated;
