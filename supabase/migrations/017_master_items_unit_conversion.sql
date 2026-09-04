-- ============================================================================
-- 017_master_items_unit_conversion.sql
--
-- Master Item Unit Conversion Architecture
--
-- Purpose:
--   1. Add stock_unit, recipe_unit, conversion_factor, and item_type columns to public.items.
--   2. Preserve existing `unit` column for backward compatibility.
--   3. Provide sensible defaults and backfill existing items safely.
-- ============================================================================

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS stock_unit text DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS recipe_unit text DEFAULT 'g',
  ADD COLUMN IF NOT EXISTS conversion_factor numeric DEFAULT 1 CHECK (conversion_factor > 0),
  ADD COLUMN IF NOT EXISTS item_type text DEFAULT 'raw' CHECK (item_type IN ('raw', 'prepared')),
  ADD COLUMN IF NOT EXISTS barcode text DEFAULT '',
  ADD COLUMN IF NOT EXISTS description text DEFAULT '';

-- Backfill existing records where new columns might be unpopulated
UPDATE public.items
SET
  stock_unit = COALESCE(NULLIF(stock_unit, ''), unit, 'kg'),
  recipe_unit = COALESCE(NULLIF(recipe_unit, ''), unit, 'g'),
  conversion_factor = COALESCE(conversion_factor, 1),
  item_type = COALESCE(NULLIF(item_type, ''), 'raw')
WHERE stock_unit IS NULL
   OR recipe_unit IS NULL
   OR conversion_factor IS NULL
   OR item_type IS NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_items_item_type ON public.items(item_type);
