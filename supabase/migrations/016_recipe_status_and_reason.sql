-- ============================================================================
-- 016_recipe_status_and_reason.sql
--
-- Phase 1 Recipe Status, Soft Delete and Reason Tracking Enhancements
--
-- Purpose:
--   1. Add `is_deleted`, `status`, `reason`, and `action_timestamp` columns to `public.recipes`.
--   2. Ensure `public.recipes` supports active/inactive toggling with reasons,
--      soft-deletion (archive for audit history) with reason, and full data persistence.
-- ============================================================================

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS reason text DEFAULT '',
  ADD COLUMN IF NOT EXISTS action_timestamp timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_recipes_status ON public.recipes(status);
CREATE INDEX IF NOT EXISTS idx_recipes_is_deleted ON public.recipes(is_deleted);
