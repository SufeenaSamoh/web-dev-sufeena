-- ============================================================================
-- 009_functions.sql
--
-- All PL/pgSQL functions backing the new tracking system. Every function is
-- `create or replace`, so this file is safe to re-run. None of these
-- functions are called by the existing application code directly -- they
-- are only invoked by triggers defined in 010_triggers.sql, which fire on
-- INSERT/UPDATE of tables the app already writes to.
--
-- Safety principle applied throughout: a trigger function must NEVER raise
-- an exception in a way that would abort the application's original write.
-- Every function below is written to degrade gracefully (skip, or write an
-- "unallocated" record) rather than fail hard, given the current app has no
-- error handling for a rejected insert.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- generate_lot_number: LOT-YYYYMMDD-NNNN, globally unique, daily-resetting
-- sequence. Serialized per calendar day via a session-level advisory lock so
-- concurrent purchases on the same day don't race for the same number.
-- ----------------------------------------------------------------------------
create or replace function public.generate_lot_number(p_date date default current_date)
returns text
language plpgsql
as $$
declare
  v_prefix text := 'LOT-' || to_char(p_date, 'YYYYMMDD') || '-';
  v_next   int;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_prefix, 0));

  select coalesce(max(substring(lot_number from length(v_prefix) + 1)::int), 0) + 1
    into v_next
    from public.inventory_lots
   where lot_number like v_prefix || '%';

  return v_prefix || lpad(v_next::text, 4, '0');
end;
$$;

comment on function public.generate_lot_number(date) is
  'Generates the next LOT-YYYYMMDD-NNNN for the given date. Uniqueness is '
  'additionally guaranteed by the UNIQUE constraint on inventory_lots.lot_number '
  'as a backstop.';

-- ----------------------------------------------------------------------------
-- calc_expiry_date: explicit expiry wins; otherwise derive from the item's
-- configured shelf life; otherwise NULL (no expiry tracked).
-- ----------------------------------------------------------------------------
create or replace function public.calc_expiry_date(
  p_item_id uuid,
  p_base_date date,
  p_explicit_expiry date default null
)
returns date
language plpgsql
stable
as $$
declare
  v_has_expiry  boolean;
  v_shelf_life  integer;
begin
  if p_explicit_expiry is not null then
    return p_explicit_expiry;
  end if;

  select has_expiry, shelf_life_days
    into v_has_expiry, v_shelf_life
    from public.items
   where id = p_item_id;

  if coalesce(v_has_expiry, false) and v_shelf_life is not null then
    return p_base_date + v_shelf_life;
  end if;

  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- fn_upsert_inventory_balance: the single atomic write path for stock
-- balances, replacing the read-then-write pattern in the application's
-- persistStock(). A no-op (never raises) when branch_id is unknown, so
-- legacy rows with no branch attribution never block the app's write.
-- ----------------------------------------------------------------------------
create or replace function public.fn_upsert_inventory_balance(
  p_branch_id uuid,
  p_item_id uuid,
  p_delta numeric
)
returns void
language plpgsql
as $$
begin
  if p_branch_id is null or p_item_id is null or p_delta is null or p_delta = 0 then
    return;
  end if;

  insert into public.inventory_balance (branch_id, item_id, quantity, updated_at)
  values (p_branch_id, p_item_id, p_delta, now())
  on conflict (branch_id, item_id)
  do update set quantity   = public.inventory_balance.quantity + excluded.quantity,
                updated_at = now();
end;
$$;

-- ----------------------------------------------------------------------------
-- fn_consume_fifo: allocate p_qty of consumption against the oldest active
-- lots first. Only ever called from fn_stock_count_approve() -- never from
-- a plain transactions/usage insert. If lots on hand can't cover the full
-- quantity, the shortfall is recorded as an unallocated movement rather
-- than raising an error.
-- ----------------------------------------------------------------------------
create or replace function public.fn_consume_fifo(
  p_branch_id uuid,
  p_item_id uuid,
  p_qty numeric,
  p_reference_table text,
  p_reference_id uuid,
  p_movement_type text default 'USAGE'
)
returns void
language plpgsql
as $$
declare
  v_remaining numeric := p_qty;
  v_lot       record;
  v_take      numeric;
begin
  if p_qty is null or p_qty <= 0 or p_item_id is null then
    return;
  end if;

  for v_lot in
    select id, qty_remaining
      from public.inventory_lots
     where item_id = p_item_id
       and branch_id = p_branch_id
       and status = 'active'
       and qty_remaining > 0
     order by received_date asc, lot_number asc
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
      (branch_id, item_id, lot_id, movement_type, quantity, reference_table, reference_id, movement_date)
    values
      (p_branch_id, p_item_id, v_lot.id, p_movement_type, -v_take, p_reference_table, p_reference_id, now());

    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    insert into public.stock_movements
      (branch_id, item_id, lot_id, movement_type, quantity, reference_table, reference_id, movement_date, remark)
    values
      (p_branch_id, p_item_id, null, p_movement_type, -v_remaining, p_reference_table, p_reference_id, now(),
       'Unallocated: insufficient active lot quantity on hand to fully cover FIFO consumption');
  end if;
end;
$$;

comment on function public.fn_consume_fifo(uuid, uuid, numeric, text, uuid, text) is
  'FIFO allocation engine. Only invoked by fn_stock_count_approve() when a '
  'stock_counts row transitions to status = ''approved'' -- per requirement, '
  'FIFO never consumes lots on a plain usage/adjustment entry.';

-- ----------------------------------------------------------------------------
-- fn_purchase_item_to_lot: AFTER INSERT trigger on purchase_items.
-- Creates the lot, the PURCHASE movement, and bumps the balance.
-- ----------------------------------------------------------------------------
create or replace function public.fn_purchase_item_to_lot()
returns trigger
language plpgsql
as $$
declare
  v_branch_id    uuid;
  v_supplier_id  uuid;
  v_purchase_date date;
  v_expiry       date;
  v_lot_id       uuid;
begin
  select branch_id, supplier_id, coalesce(purchase_date::date, current_date)
    into v_branch_id, v_supplier_id, v_purchase_date
    from public.purchases
   where id = new.purchase_id;

  v_expiry := public.calc_expiry_date(new.item_id, v_purchase_date, new.expiry_date::date);

  insert into public.inventory_lots
    (lot_number, branch_id, item_id, purchase_item_id, supplier_id,
     received_date, expiry_date, unit_cost, qty_received, qty_remaining, status)
  values
    (public.generate_lot_number(v_purchase_date), v_branch_id, new.item_id, new.id, v_supplier_id,
     v_purchase_date, v_expiry, coalesce(new.unit_price, 0), new.quantity, new.quantity, 'active')
  returning id into v_lot_id;

  insert into public.stock_movements
    (branch_id, item_id, lot_id, movement_type, quantity, unit_cost, reference_table, reference_id, movement_date, remark)
  values
    (v_branch_id, new.item_id, v_lot_id, 'PURCHASE', new.quantity, new.unit_price, 'purchase_items', new.id, v_purchase_date, new.remark);

  perform public.fn_upsert_inventory_balance(v_branch_id, new.item_id, new.quantity);

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- fn_transaction_to_movement: AFTER INSERT trigger on transactions.
-- Mirrors legacy beginning/usage/adjustment writes into stock_movements
-- (and, for 'beginning', a new lot). 'purchase' rows are skipped here since
-- fn_purchase_item_to_lot already handles that event from purchase_items.
-- No lot is created and no FIFO consumption happens for 'adjustment' or
-- 'usage' -- only inventory_balance is updated, per requirement.
-- ----------------------------------------------------------------------------
create or replace function public.fn_transaction_to_movement()
returns trigger
language plpgsql
as $$
declare
  v_lot_id uuid;
  v_expiry date;
  v_movement_date date;
begin
  if new.type = 'purchase' then
    return new;
  end if;

  v_movement_date := coalesce(new.date::date, current_date);

  if new.type = 'beginning' then
    v_expiry := public.calc_expiry_date(new.item_id, v_movement_date, new.expiry_date::date);

    insert into public.inventory_lots
      (lot_number, branch_id, item_id, purchase_item_id, supplier_id,
       received_date, expiry_date, unit_cost, qty_received, qty_remaining, status)
    values
      (public.generate_lot_number(v_movement_date), new.branch_id, new.item_id, null, new.supplier_id,
       v_movement_date, v_expiry, coalesce(new.unit_price, 0), new.quantity, new.quantity, 'active')
    returning id into v_lot_id;

    insert into public.stock_movements
      (branch_id, item_id, lot_id, movement_type, quantity, unit_cost, reference_table, reference_id, movement_date, remark)
    values
      (new.branch_id, new.item_id, v_lot_id, 'BEGINNING', new.quantity, new.unit_price, 'transactions', new.id, v_movement_date, new.remark);

  elsif new.type = 'adjustment' then
    insert into public.stock_movements
      (branch_id, item_id, lot_id, movement_type, quantity, unit_cost, reference_table, reference_id, movement_date, remark)
    values
      (new.branch_id, new.item_id, null, 'ADJUSTMENT', new.quantity, new.unit_price, 'transactions', new.id, v_movement_date, new.remark);

  elsif new.type = 'usage' then
    insert into public.stock_movements
      (branch_id, item_id, lot_id, movement_type, quantity, unit_cost, reference_table, reference_id, movement_date, remark)
    values
      (new.branch_id, new.item_id, null, 'USAGE', new.quantity, new.unit_price, 'transactions', new.id, v_movement_date, new.remark);
  end if;

  perform public.fn_upsert_inventory_balance(new.branch_id, new.item_id, new.quantity);

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- fn_stock_count_approve: AFTER UPDATE trigger on stock_counts. The ONLY
-- place FIFO consumption is triggered. Fires once, exactly when status
-- transitions into 'approved'. For each line: usage = system_qty - counted_qty.
-- Positive usage is allocated FIFO across lots; negative usage (count found
-- more stock than expected) is logged as a STOCK_COUNT movement without lot
-- allocation. inventory_balance is then set directly to counted_qty (the
-- physical count is authoritative and becomes the next period's Beginning
-- Stock), eliminating any possibility of drift from accumulated deltas.
-- ----------------------------------------------------------------------------
create or replace function public.fn_stock_count_approve()
returns trigger
language plpgsql
as $$
declare
  v_item  record;
  v_usage numeric;
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    for v_item in
      select id, item_id, system_qty, counted_qty
        from public.stock_count_items
       where stock_count_id = new.id
    loop
      v_usage := v_item.system_qty - v_item.counted_qty;

      if v_usage > 0 then
        perform public.fn_consume_fifo(new.branch_id, v_item.item_id, v_usage, 'stock_count_items', v_item.id, 'USAGE');
      elsif v_usage < 0 then
        insert into public.stock_movements
          (branch_id, item_id, lot_id, movement_type, quantity, reference_table, reference_id, movement_date, remark)
        values
          (new.branch_id, v_item.item_id, null, 'STOCK_COUNT', -v_usage, 'stock_count_items', v_item.id, now(),
           'Count found more stock than system expected');
      end if;

      insert into public.inventory_balance (branch_id, item_id, quantity, updated_at)
      values (new.branch_id, v_item.item_id, v_item.counted_qty, now())
      on conflict (branch_id, item_id)
      do update set quantity = excluded.quantity, updated_at = now();
    end loop;
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- fn_generic_audit_log: reusable AFTER INSERT/UPDATE/DELETE trigger function.
-- Attach to any table with a uuid `id` primary key with a single
-- `create trigger` -- see 010_triggers.sql. Never raises: the cast of the
-- primary key to text (not uuid) means it works uniformly regardless of the
-- target table's exact key type.
-- ----------------------------------------------------------------------------
create or replace function public.fn_generic_audit_log()
returns trigger
language plpgsql
as $$
declare
  v_record_id text;
  v_before    jsonb;
  v_after     jsonb;
begin
  if tg_op = 'DELETE' then
    v_before := to_jsonb(old);
    v_record_id := v_before ->> 'id';
  elsif tg_op = 'INSERT' then
    v_after := to_jsonb(new);
    v_record_id := v_after ->> 'id';
  else
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_record_id := coalesce(v_after ->> 'id', v_before ->> 'id');
  end if;

  insert into public.audit_logs (table_name, record_id, action, before_value, after_value, changed_at)
  values (tg_table_name, v_record_id, tg_op, v_before, v_after, now());

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- fn_touch_updated_at: generic BEFORE UPDATE helper for the new tables that
-- carry an updated_at column.
-- ----------------------------------------------------------------------------
create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
