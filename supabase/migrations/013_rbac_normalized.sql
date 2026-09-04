-- ============================================================================
-- 013_rbac_normalized.sql
--
-- Purpose: Create normalized RBAC tables (roles, permissions, role_permissions,
-- user_permissions, user_branches, permission_audit_logs) and seed default data.
-- ============================================================================

-- 1. Roles Table
CREATE TABLE IF NOT EXISTS public.roles (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Permissions Table
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  category text NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- 3. Role Permissions Table (Default permission set for a role)
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id text REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

-- 4. User Permissions Table (Per-user custom overrides)
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES public.permissions(id) ON DELETE CASCADE,
  is_granted boolean NOT NULL DEFAULT true,
  granted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT user_permissions_user_perm_unique UNIQUE (user_id, permission_id)
);

-- 5. User Branches Table (Explicit per-user branch access assignment)
CREATE TABLE IF NOT EXISTS public.user_branches (
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, branch_id)
);

-- 6. Permission Audit Logs Table
CREATE TABLE IF NOT EXISTS public.permission_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  permission_code text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS & set permissive policies (matching app setup)
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'roles', 'permissions', 'role_permissions',
    'user_permissions', 'user_branches', 'permission_audit_logs'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS allow_all ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY allow_all ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
      t
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.roles,
  public.permissions,
  public.role_permissions,
  public.user_permissions,
  public.user_branches,
  public.permission_audit_logs
TO anon, authenticated;

-- Seed Default Roles
INSERT INTO public.roles (id, name, description) VALUES
  ('owner', 'Owner', 'Full system access to all branches, settings, and user management'),
  ('admin', 'Admin', 'Manages inventory, purchasing, and reports across all branches'),
  ('manager', 'Manager', 'Manages operations and approves transactions for assigned branches'),
  ('staff', 'Staff', 'Creates daily transactions for assigned branches')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Seed Default Permissions
INSERT INTO public.permissions (code, category, name, description) VALUES
  ('dashboard:view', 'Dashboard', 'View Dashboard', 'Access operational dashboard and metrics'),
  ('inventory:view', 'Inventory', 'View Inventory', 'View current stock levels and inventory balances'),
  ('master_items:view', 'Master Items', 'View Master Items', 'View product catalog and master items'),
  ('master_items:edit', 'Master Items', 'Edit Master Items', 'Create, edit, or toggle active state of items'),
  ('suppliers:view', 'Suppliers', 'View Suppliers', 'View supplier records and directory'),
  ('suppliers:edit', 'Suppliers', 'Edit Suppliers', 'Create and edit supplier details'),
  ('beginning_stock:view', 'Beginning Stock', 'View Beginning Stock', 'View initial stock entries'),
  ('beginning_stock:create', 'Beginning Stock', 'Create Beginning Stock', 'Input initial beginning stock levels'),
  ('purchase:view', 'Purchasing', 'View Purchases', 'View purchase orders and history'),
  ('purchase:create', 'Purchasing', 'Create Purchases', 'Create purchase orders'),
  ('receiving:view', 'Receiving', 'View Receiving', 'View received items and history'),
  ('receiving:create', 'Receiving', 'Create Receiving', 'Process receiving of purchases'),
  ('stock_count:view', 'Stock Count', 'View Stock Count', 'View physical stock count sheets'),
  ('stock_count:create', 'Stock Count', 'Create Stock Count', 'Submit physical stock count results'),
  ('reports:view', 'Reports', 'View Reports', 'Access report pages and summaries'),
  ('reports:financial', 'Reports', 'View Financial Reports', 'View cost, price, and usage monetary values'),
  ('reports:export', 'Reports', 'Export Reports', 'Export data to Excel, CSV, or PDF'),
  ('import_data:execute', 'Data', 'Import Data', 'Batch import master items or inventory data'),
  ('user_management:manage', 'System', 'Manage Users', 'Create, edit, and assign permissions to users'),
  ('settings:manage', 'System', 'Manage Settings', 'Update company settings and system configuration'),
  ('approval:execute', 'Operations', 'Approve Operations', 'Approve adjustments, counts, or purchases'),
  ('delete_records:execute', 'Operations', 'Delete Records', 'Delete transactions or master records'),
  ('modify_cost:execute', 'Financials', 'Modify Cost', 'Modify item cost prices'),
  ('modify_selling_price:execute', 'Financials', 'Modify Selling Price', 'Modify selling prices')
ON CONFLICT (code) DO UPDATE SET
  category = EXCLUDED.category,
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Seed Default Role Permissions
-- Owner gets ALL permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'owner', id FROM public.permissions
ON CONFLICT DO NOTHING;

-- Admin gets all permissions except owner-exclusive if any (by default all operational + management)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'admin', id FROM public.permissions
ON CONFLICT DO NOTHING;

-- Manager gets view, create, reports, export, and approval for daily ops
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'manager', id FROM public.permissions
WHERE code IN (
  'dashboard:view', 'inventory:view', 'master_items:view', 'suppliers:view',
  'beginning_stock:view', 'purchase:view', 'purchase:create', 'receiving:view',
  'receiving:create', 'stock_count:view', 'stock_count:create', 'reports:view',
  'reports:financial', 'reports:export', 'approval:execute'
)
ON CONFLICT DO NOTHING;

-- Staff gets daily creation and basic viewing (no financials, no export, no approval, no settings, no users)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'staff', id FROM public.permissions
WHERE code IN (
  'dashboard:view', 'inventory:view', 'master_items:view', 'suppliers:view',
  'beginning_stock:view', 'purchase:view', 'purchase:create', 'receiving:view',
  'receiving:create', 'stock_count:view', 'stock_count:create', 'reports:view'
)
ON CONFLICT DO NOTHING;
