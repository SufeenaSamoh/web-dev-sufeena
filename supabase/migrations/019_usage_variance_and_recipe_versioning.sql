-- ============================================================================
-- 019_usage_variance_and_recipe_versioning.sql
--
-- Purpose: Schema design for Actual Usage vs Theoretical Usage (BOM)
-- Reconciliation, Reason Tracking, Stock Adjustments, and Recipe Versioning.
-- ============================================================================

-- 1. Table: usage_variance_periods (งวดการเปรียบเทียบ)
CREATE TABLE IF NOT EXISTS public.usage_variance_periods (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  branch_name TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'closed')),
  total_theoretical_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_actual_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_variance_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
  abnormal_items_count INTEGER NOT NULL DEFAULT 0,
  adjusted_items_count INTEGER NOT NULL DEFAULT 0,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  closed_at TIMESTAMPTZ,
  closed_by TEXT,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Table: usage_variance_items (รายการวัตถุดิบและผลต่างต่องวด)
CREATE TABLE IF NOT EXISTS public.usage_variance_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  period_id TEXT REFERENCES public.usage_variance_periods(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  branch_name TEXT,
  ingredient_id TEXT NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  ingredient_code TEXT NOT NULL,
  ingredient_name TEXT NOT NULL,
  category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
  category_name TEXT,
  unit TEXT NOT NULL,
  purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  
  -- Core Formula Fields
  beginning_qty NUMERIC(12, 4) NOT NULL DEFAULT 0,
  beginning_count_date DATE,
  purchase_qty NUMERIC(12, 4) NOT NULL DEFAULT 0,
  ending_actual_qty NUMERIC(12, 4) NOT NULL DEFAULT 0,
  ending_count_date DATE,
  actual_usage_qty NUMERIC(12, 4) NOT NULL DEFAULT 0,
  theoretical_usage_qty NUMERIC(12, 4) NOT NULL DEFAULT 0,
  
  -- Discrepancy & Anomaly Detection
  diff_qty NUMERIC(12, 4) NOT NULL DEFAULT 0,
  diff_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
  diff_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
  is_abnormal BOOLEAN NOT NULL DEFAULT false,
  threshold_pct NUMERIC(6, 2) NOT NULL DEFAULT 5.0,
  threshold_value NUMERIC(12, 2) NOT NULL DEFAULT 100.0,
  
  -- Review & Adjustment Status
  status TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'abnormal_unreviewed', 'abnormal_reviewed', 'adjusted')),
  current_reason_code TEXT,
  current_reason_label TEXT,
  current_reason_note TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  
  is_adjusted BOOLEAN NOT NULL DEFAULT false,
  adjusted_qty NUMERIC(12, 4),
  adjusted_at TIMESTAMPTZ,
  adjusted_by TEXT,
  adjustment_ref_id TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Table: usage_variance_reasons (Audit Trail ประวัติการบันทึกเหตุผลผลต่าง)
CREATE TABLE IF NOT EXISTS public.usage_variance_reasons (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  variance_item_id TEXT NOT NULL,
  period_id TEXT,
  ingredient_id TEXT NOT NULL,
  ingredient_code TEXT NOT NULL,
  ingredient_name TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  reason_label TEXT NOT NULL,
  reason_note TEXT,
  previous_reason_code TEXT,
  recorded_by TEXT NOT NULL,
  recorded_by_name TEXT NOT NULL,
  recorded_by_role TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Table: stock_adjustments (บันทึกการปรับปรุงสต็อกที่เกิดจาก Variance Review)
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ingredient_id TEXT NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  ingredient_code TEXT NOT NULL,
  ingredient_name TEXT NOT NULL,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  branch_name TEXT NOT NULL,
  qty_delta NUMERIC(12, 4) NOT NULL,
  unit TEXT NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL DEFAULT 'variance_review',
  reference_id TEXT,
  reason_code TEXT NOT NULL,
  reason_label TEXT NOT NULL,
  reason_note TEXT,
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Table: recipe_versions (ประวัติและเวอร์ชันสูตรอาหาร BOM Versioning)
CREATE TABLE IF NOT EXISTS public.recipe_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  menu_code TEXT NOT NULL,
  menu_name TEXT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  version_tag TEXT NOT NULL DEFAULT 'v1.0',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  change_summary TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_menu_version UNIQUE (menu_code, version_number)
);

-- 6. Indexes for High-Speed Lookups
CREATE INDEX IF NOT EXISTS idx_usage_variance_periods_dates ON public.usage_variance_periods(branch_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_usage_variance_items_period ON public.usage_variance_items(period_id, ingredient_id);
CREATE INDEX IF NOT EXISTS idx_usage_variance_items_abnormal ON public.usage_variance_items(is_abnormal, status);
CREATE INDEX IF NOT EXISTS idx_usage_variance_reasons_item ON public.usage_variance_reasons(variance_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_branch_item ON public.stock_adjustments(branch_id, ingredient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_recipe_versions_menu_effective ON public.recipe_versions(menu_code, effective_date);

-- 7. Grant Permissions for Application Access
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.usage_variance_periods,
  public.usage_variance_items,
  public.usage_variance_reasons,
  public.stock_adjustments,
  public.recipe_versions
TO anon, authenticated;
