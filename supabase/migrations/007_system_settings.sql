-- ============================================================================
-- 007_system_settings.sql
--
-- Purpose: simple key/value store for future ERP-style global configuration
-- (default thresholds, lot-number format, etc.), kept separate from the
-- existing `company_settings` (which holds company profile info, not
-- system behavior config -- left untouched).
--
-- Backward compatibility: brand-new table, not read/written by the current
-- app.
-- ============================================================================

create table if not exists public.system_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

comment on table public.system_settings is
  'Generic key/value configuration store, separate from company_settings '
  '(company profile) on purpose to avoid mixing concerns. Seeded with '
  'sensible defaults in 012_seed_system_settings.sql.';
