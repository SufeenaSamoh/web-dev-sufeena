-- ============================================================================
-- 014_seed_existing_users.sql
--
-- Purpose: Convert existing public.users into normalized RBAC user_branches,
-- ensure role integrity, and create an automated trigger for user branch sync.
-- ============================================================================

-- 1. Normalize existing roles in public.users to match valid role IDs ('owner', 'admin', 'manager', 'staff')
UPDATE public.users
SET role = LOWER(TRIM(role))
WHERE role IS NOT NULL AND LOWER(TRIM(role)) IN ('owner', 'admin', 'manager', 'staff');

UPDATE public.users
SET role = 'staff'
WHERE role IS NULL OR LOWER(TRIM(role)) NOT IN ('owner', 'admin', 'manager', 'staff');

-- 2. Seed user_branches for existing users
-- 2a. For users with role 'owner' or 'admin', assign all existing branches
INSERT INTO public.user_branches (user_id, branch_id)
SELECT u.id, b.id
FROM public.users u
CROSS JOIN public.branches b
WHERE u.role IN ('owner', 'admin')
ON CONFLICT (user_id, branch_id) DO NOTHING;

-- 2b. For users with specific branch_id assigned, insert into user_branches
INSERT INTO public.user_branches (user_id, branch_id)
SELECT u.id, u.branch_id
FROM public.users u
WHERE u.branch_id IS NOT NULL
ON CONFLICT (user_id, branch_id) DO NOTHING;

-- 3. Create Trigger Function to automatically sync user_branches when a user is created or updated
CREATE OR REPLACE FUNCTION public.sync_user_branches_on_change()
RETURNS trigger AS $$
BEGIN
  -- 1. Always clear existing user_branches for this user first
  DELETE FROM public.user_branches WHERE user_id = NEW.id;

  -- 2. If role is 'owner' or 'admin', grant access to all existing branches
  IF NEW.role IN ('owner', 'admin') THEN
    INSERT INTO public.user_branches (user_id, branch_id)
    SELECT NEW.id, b.id
    FROM public.branches b
    ON CONFLICT (user_id, branch_id) DO NOTHING;
  -- 3. Otherwise, if a specific branch_id is provided, insert into user_branches
  ELSIF NEW.branch_id IS NOT NULL THEN
    INSERT INTO public.user_branches (user_id, branch_id)
    VALUES (NEW.id, NEW.branch_id)
    ON CONFLICT (user_id, branch_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create Trigger on public.users table
DROP TRIGGER IF EXISTS trg_sync_user_branches ON public.users;

CREATE TRIGGER trg_sync_user_branches
AFTER INSERT OR UPDATE OF role, branch_id ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_branches_on_change();
