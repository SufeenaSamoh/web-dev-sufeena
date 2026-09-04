-- ============================================================================
-- 018_rbac_purchase_role.sql
--
-- Purpose: Add 'purchase' role (ฝ่ายจัดซื้อ), add 'purchase.edit_own' and 
-- 'purchase.edit_history' permissions, update default role permissions,
-- and enforce same-day editing rule for staff while enabling full cross-branch
-- access for purchase/manager/admin/owner.
-- ============================================================================

-- 1. Insert or update 'purchase' role in public.roles
INSERT INTO public.roles (id, name, description) VALUES
  ('purchase', 'Purchase', 'จัดการใบสั่งซื้อทุกสาขา จัดกลุ่มออเดอร์รายวัน และพิมพ์เอกสารสั่งซื้อ')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

-- 2. Insert new permission codes into public.permissions
INSERT INTO public.permissions (code, category, name, description) VALUES
  ('purchase.edit_own', 'Purchasing', 'Edit Own Purchases (Same Day)', 'Create and edit own branch purchase orders on the same day'),
  ('purchase.edit_history', 'Purchasing', 'Edit Historical Purchases', 'Bypass same-day restriction to edit or cancel past purchase orders across all branches'),
  ('procurement_master:view', 'Purchasing', 'View Procurement Catalog', 'View supplier catalog and price comparisons'),
  ('procurement_master:manage', 'Purchasing', 'Manage Procurement Catalog', 'Manage procurement catalog and supplier items')
ON CONFLICT (code) DO UPDATE SET
  category = EXCLUDED.category,
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- 3. Update role_permissions

-- Owner & Admin get all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'owner', id FROM public.permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'admin', id FROM public.permissions
ON CONFLICT DO NOTHING;

-- Manager gets purchase.edit_own, purchase.edit_history, procurement_master:view, etc.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'manager', id FROM public.permissions
WHERE code IN (
  'purchase:view', 'purchase:create', 'purchase.edit_own', 'purchase.edit_history',
  'procurement_master:view', 'procurement_master:manage'
)
ON CONFLICT DO NOTHING;

-- Purchase role default permissions:
-- dashboard:view, inventory:view, master_items:view, suppliers:view, suppliers:edit,
-- purchase:view, purchase:create, purchase.edit_own, purchase.edit_history,
-- receiving:view, receiving:create, reports:view, reports:export,
-- procurement_master:view, procurement_master:manage
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'purchase', id FROM public.permissions
WHERE code IN (
  'dashboard:view',
  'inventory:view',
  'master_items:view',
  'suppliers:view',
  'suppliers:edit',
  'purchase:view',
  'purchase:create',
  'purchase.edit_own',
  'purchase.edit_history',
  'receiving:view',
  'receiving:create',
  'reports:view',
  'reports:export',
  'procurement_master:view',
  'procurement_master:manage'
)
ON CONFLICT DO NOTHING;

-- Staff gets purchase.edit_own (only same-day purchases for own branch)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'staff', id FROM public.permissions
WHERE code IN ('purchase:view', 'purchase:create', 'purchase.edit_own', 'procurement_master:view')
ON CONFLICT DO NOTHING;

-- 4. Ensure RLS policies on public tables grant access appropriately
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.roles,
  public.permissions,
  public.role_permissions,
  public.user_permissions,
  public.user_branches,
  public.permission_audit_logs
TO anon, authenticated;
