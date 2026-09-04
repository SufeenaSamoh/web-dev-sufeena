-- ============================================================================
-- 020_production_recipes_and_batches.sql
--
-- Purpose:
--   1. Schema design for Production Recipes (สูตรผลิต / Sub-recipe BOM) for
--      prepared / semi-finished items (item_type = 'prepared' e.g. house-made sauces).
--   2. Schema design for Production Batches (บันทึกประวัติการผลิตจริง) and
--      Production Batch Consumptions (บันทึกการตัดใช้วัตถุดิบแต่ละล็อตเพื่อการตรวจสอบ).
-- ============================================================================

-- 1. Table: production_recipes (หัวสูตรผลิตของสินค้ากึ่งสำเร็จรูป)
CREATE TABLE IF NOT EXISTS public.production_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produced_item_code TEXT NOT NULL,
  yield_quantity NUMERIC(12, 4) NOT NULL DEFAULT 1 CHECK (yield_quantity > 0),
  yield_unit TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Table: production_recipe_ingredients (รายการวัตถุดิบที่ใช้ในสูตรผลิต)
CREATE TABLE IF NOT EXISTS public.production_recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_recipe_id UUID NOT NULL REFERENCES public.production_recipes(id) ON DELETE CASCADE,
  ingredient_code TEXT NOT NULL,
  ingredient_name TEXT NOT NULL,
  quantity NUMERIC(12, 4) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Table: production_batches (ประวัติการผลิตจริงแต่ละครั้ง)
CREATE TABLE IF NOT EXISTS public.production_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produced_item_code TEXT NOT NULL,
  produced_item_name TEXT,
  batch_quantity NUMERIC(12, 4) NOT NULL CHECK (batch_quantity > 0),
  yield_unit TEXT NOT NULL,
  produced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  branch_name TEXT,
  note TEXT,
  created_by TEXT NOT NULL DEFAULT 'Staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Table: production_batch_consumptions (บันทึกการตัดสต็อกวัตถุดิบแต่ละตัวในแต่ละรอบการผลิต)
CREATE TABLE IF NOT EXISTS public.production_batch_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_batch_id UUID NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
  ingredient_code TEXT NOT NULL,
  ingredient_name TEXT NOT NULL,
  quantity_consumed NUMERIC(12, 4) NOT NULL,
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prod_recipes_item_code ON public.production_recipes(produced_item_code);
CREATE INDEX IF NOT EXISTS idx_prod_recipe_ing_recipe_id ON public.production_recipe_ingredients(production_recipe_id);
CREATE INDEX IF NOT EXISTS idx_prod_batches_item_code ON public.production_batches(produced_item_code);
CREATE INDEX IF NOT EXISTS idx_prod_batches_branch_id ON public.production_batches(branch_id);
CREATE INDEX IF NOT EXISTS idx_prod_batches_produced_at ON public.production_batches(produced_at);
CREATE INDEX IF NOT EXISTS idx_prod_batch_cons_batch_id ON public.production_batch_consumptions(production_batch_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.production_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_batch_consumptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies matching previous migrations (read for anon/auth, write for anon/auth)
DROP POLICY IF EXISTS "Allow select for all" ON public.production_recipes;
CREATE POLICY "Allow select for all" ON public.production_recipes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all for authenticated/anon" ON public.production_recipes;
CREATE POLICY "Allow all for authenticated/anon" ON public.production_recipes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select for all" ON public.production_recipe_ingredients;
CREATE POLICY "Allow select for all" ON public.production_recipe_ingredients FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all for authenticated/anon" ON public.production_recipe_ingredients;
CREATE POLICY "Allow all for authenticated/anon" ON public.production_recipe_ingredients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select for all" ON public.production_batches;
CREATE POLICY "Allow select for all" ON public.production_batches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all for authenticated/anon" ON public.production_batches;
CREATE POLICY "Allow all for authenticated/anon" ON public.production_batches FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select for all" ON public.production_batch_consumptions;
CREATE POLICY "Allow select for all" ON public.production_batch_consumptions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all for authenticated/anon" ON public.production_batch_consumptions;
CREATE POLICY "Allow all for authenticated/anon" ON public.production_batch_consumptions FOR ALL USING (true) WITH CHECK (true);
