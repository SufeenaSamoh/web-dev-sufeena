-- ============================================================================
-- 006_notifications.sql
--
-- Purpose: durable structure for future Low Stock / Near Expiry / Expired /
-- FIFO Warning / Custom alerts, with enough workflow state (resolved,
-- dismissed, created/resolved by) to back a future notification widget.
--
-- Population strategy (future work, not part of this migration): a
-- scheduled/callable function comparing inventory_balance against
-- items.minimum_stock, inventory_lots.expiry_date against today, and
-- out-of-order lot consumption. `type = 'CUSTOM'` requires no schema change
-- for ad-hoc warnings.
--
-- Backward compatibility: brand-new table, not read/written by the current
-- app.
-- ============================================================================

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references public.branches(id) on delete set null,
  type            text not null check (
                    type in ('LOW_STOCK', 'EXPIRY_WARNING', 'EXPIRED', 'FIFO_WARNING', 'CUSTOM')
                  ),
  severity        text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  item_id         uuid references public.items(id) on delete cascade,
  lot_id          uuid references public.inventory_lots(id) on delete cascade,
  message         text not null,
  is_resolved     boolean not null default false,
  resolved_at     timestamptz,
  resolved_by     uuid references public.users(id) on delete set null,
  is_dismissed    boolean not null default false,
  dismissed_at    timestamptz,
  created_by      uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

comment on table public.notifications is
  'Structure only -- no generator job is created by this migration. '
  'is_resolved/is_dismissed are intentionally separate flags (a notification '
  'can be dismissed from view without being marked as actually resolved, '
  'and vice versa), matching common alerting-workflow conventions.';
