-- ============================================================================
-- 012_seed_system_settings.sql
--
-- Purpose: sane defaults so expiry/notification logic has something to read
-- from day one, without requiring a UI to configure it first.
--
-- Backward compatibility: idempotent inserts (ON CONFLICT DO NOTHING), safe
-- to re-run. Does not touch any existing table.
-- ============================================================================

insert into public.system_settings (key, value) values
  ('default_expiry_warning_days', '7'),
  ('low_stock_notification_enabled', 'true'),
  ('expiry_notification_enabled', 'true'),
  ('fifo_warning_enabled', 'true'),
  ('lot_number_prefix', '"LOT"'),
  ('fifo_consumption_trigger', '"stock_count_approval"')
on conflict (key) do nothing;
