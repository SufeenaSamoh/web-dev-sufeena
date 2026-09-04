-- ============================================================================
-- 015_phase1_recipe_and_sales_records.sql
--
-- Phase 1 Recipe-Based Usage System Migration (Revised & Secured)
--
-- Purpose:
--   1. Create `public.recipes` table for Menu Recipe Master management.
--   2. Create `public.sales_records` table for Daily/Weekly Sales Imports.
--   3. Safely establish foreign key relationships with `public.items(code)` and `public.branches(id)`.
--   4. Ensure trigger helper function `public.fn_touch_updated_at()` exists.
--   5. Add performance indexes for Recipe lookups and Sales analytical queries.
--   6. Enable RLS with strict write protections for unauthenticated (`anon`) users.
--   7. Optionally seed RBAC permissions if normalized RBAC tables exist.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 0. Ensure Trigger Function Exists
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 1. Recipe Master (`public.recipes`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_code       text NOT NULL,
  menu_name       text NOT NULL,
  ingredient_code text NOT NULL,
  ingredient_name text NOT NULL,
  quantity        numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit            text NOT NULL DEFAULT 'g',
  sub_recipe_code text DEFAULT '',
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Ensure required columns exist if table pre-existed
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS menu_code text,
  ADD COLUMN IF NOT EXISTS menu_name text,
  ADD COLUMN IF NOT EXISTS ingredient_code text,
  ADD COLUMN IF NOT EXISTS ingredient_name text,
  ADD COLUMN IF NOT EXISTS quantity numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit text DEFAULT 'g',
  ADD COLUMN IF NOT EXISTS sub_recipe_code text DEFAULT '',
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Ensure public.items(code) has a unique constraint before foreign key referencing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'items'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'items'
      AND constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      AND constraint_name = 'items_code_key'
  ) THEN
    BEGIN
      ALTER TABLE public.items ADD CONSTRAINT items_code_key UNIQUE (code);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Skipped adding items_code_key constraint: %', SQLERRM;
    END;
  END IF;
END $$;

-- Foreign Key: recipes.ingredient_code -> items.code
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'items'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_recipes_ingredient_code'
      AND table_name = 'recipes'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.recipes
      ADD CONSTRAINT fk_recipes_ingredient_code
      FOREIGN KEY (ingredient_code) REFERENCES public.items(code)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped fk_recipes_ingredient_code creation: %', SQLERRM;
END $$;

-- Indexes for recipes
CREATE INDEX IF NOT EXISTS idx_recipes_menu_code ON public.recipes(menu_code);
CREATE INDEX IF NOT EXISTS idx_recipes_ingredient_code ON public.recipes(ingredient_code);
CREATE INDEX IF NOT EXISTS idx_recipes_menu_ing ON public.recipes(menu_code, ingredient_code);
CREATE INDEX IF NOT EXISTS idx_recipes_active ON public.recipes(active);

-- Trigger to update updated_at on recipes
DROP TRIGGER IF EXISTS trg_touch_updated_at ON public.recipes;
CREATE TRIGGER trg_touch_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Sales Records (`public.sales_records`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date          text NOT NULL,
  menu_code     text NOT NULL,
  menu_name     text NOT NULL,
  quantity_sold numeric NOT NULL DEFAULT 0 CHECK (quantity_sold >= 0),
  branch_id     uuid,
  branch_name   text DEFAULT 'สาขาหลัก',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Ensure required columns exist if table pre-existed
ALTER TABLE public.sales_records
  ADD COLUMN IF NOT EXISTS date text,
  ADD COLUMN IF NOT EXISTS menu_code text,
  ADD COLUMN IF NOT EXISTS menu_name text,
  ADD COLUMN IF NOT EXISTS quantity_sold numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS branch_id uuid,
  ADD COLUMN IF NOT EXISTS branch_name text DEFAULT 'สาขาหลัก',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Foreign Key: sales_records.branch_id -> branches.id (if branches table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'branches'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_sales_records_branch_id'
      AND table_name = 'sales_records'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.sales_records
      ADD CONSTRAINT fk_sales_records_branch_id
      FOREIGN KEY (branch_id) REFERENCES public.branches(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped fk_sales_records_branch_id creation: %', SQLERRM;
END $$;

-- Indexes for sales_records
CREATE INDEX IF NOT EXISTS idx_sales_records_date ON public.sales_records(date);
CREATE INDEX IF NOT EXISTS idx_sales_records_menu_code ON public.sales_records(menu_code);
CREATE INDEX IF NOT EXISTS idx_sales_records_branch_id ON public.sales_records(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_records_date_branch ON public.sales_records(date, branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_records_dedup ON public.sales_records(date, branch_id, menu_code);

-- Trigger to update updated_at on sales_records
DROP TRIGGER IF EXISTS trg_touch_updated_at ON public.sales_records;
CREATE TRIGGER trg_touch_updated_at
  BEFORE UPDATE ON public.sales_records
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Security: Row Level Security (RLS) & API Grants
-- ----------------------------------------------------------------------------
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_records ENABLE ROW LEVEL SECURITY;

-- Clean up any legacy unrestricted policies if present
DROP POLICY IF EXISTS allow_all ON public.recipes;
DROP POLICY IF EXISTS allow_all ON public.sales_records;

-- Read-only policy for anon + authenticated
DROP POLICY IF EXISTS recipes_select_policy ON public.recipes;
CREATE POLICY recipes_select_policy ON public.recipes
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS sales_records_select_policy ON public.sales_records;
CREATE POLICY sales_records_select_policy ON public.sales_records
  FOR SELECT TO anon, authenticated
  USING (true);

-- Full write access restricted strictly to authenticated users
DROP POLICY IF EXISTS recipes_auth_write_policy ON public.recipes;
CREATE POLICY recipes_auth_write_policy ON public.recipes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS sales_records_auth_write_policy ON public.sales_records;
CREATE POLICY sales_records_auth_write_policy ON public.sales_records
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Data API permissions: anon gets SELECT only; authenticated gets SELECT, INSERT, UPDATE, DELETE
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.recipes, public.sales_records TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes, public.sales_records TO authenticated;
GRANT ALL ON public.recipes, public.sales_records TO service_role;

-- ----------------------------------------------------------------------------
-- 4. RBAC Permission Integration (If permissions system is present)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'permissions') THEN
    INSERT INTO public.permissions (code, category, name, description) VALUES
      ('recipes:view', 'Recipes', 'View Recipes', 'View menu recipes and ingredient mappings'),
      ('recipes:edit', 'Recipes', 'Edit Recipes', 'Create, edit, or import menu recipes'),
      ('sales:view', 'Sales', 'View Sales Records', 'View imported weekly sales data'),
      ('sales:import', 'Sales', 'Import Sales Records', 'Upload and import sales Excel records')
    ON CONFLICT (code) DO UPDATE SET
      category = EXCLUDED.category,
      name = EXCLUDED.name,
      description = EXCLUDED.description;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_permissions') THEN
      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT r.role_id, p.id
      FROM (VALUES ('owner'), ('admin'), ('manager')) AS r(role_id)
      CROSS JOIN public.permissions p
      WHERE p.code IN ('recipes:view', 'recipes:edit', 'sales:view', 'sales:import')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;
