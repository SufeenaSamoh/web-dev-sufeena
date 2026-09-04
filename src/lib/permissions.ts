import { supabase } from "./supabase";
import type {
  Branch,
  Permission,
  PermissionCode,
  RolePermission,
  User,
  UserBranch,
  UserPermission,
} from "./types";

/**
 * Calculates the effective set of permission codes for a given user.
 * 1. Starts with role-level default permissions.
 * 2. Applies explicit user-level override additions and subtractions.
 * 3. Owners always receive all system permissions.
 */
export function calculateEffectivePermissions(
  roleId: string,
  rolePermissions: RolePermission[],
  permissions: Permission[],
  userPermissions: UserPermission[],
  userId: string,
): Set<string> {
  const permMap = new Map<string, Permission>();
  permissions.forEach((p) => permMap.set(p.id, p));

  const effectiveCodes = new Set<string>();

  // Owners and IT get all permissions by default
  if (roleId === "owner" || roleId === "it") {
    permissions.forEach((p) => effectiveCodes.add(p.code));
    return effectiveCodes;
  }

  // 1. Role-based default permissions
  rolePermissions
    .filter((rp) => rp.roleId === roleId)
    .forEach((rp) => {
      const p = permMap.get(rp.permissionId);
      if (p) {
        effectiveCodes.add(p.code);
      }
    });

  // Default baseline permissions for Staff
  if (roleId === "staff") {
    effectiveCodes.add("stock_count:view");
    effectiveCodes.add("stock_count:create");
    effectiveCodes.add("stock_count:print");
    effectiveCodes.add("stock_count.print");
    effectiveCodes.add("stock_count.edit_own");
    effectiveCodes.add("stock:write");
  }

  // 2. User-specific custom overrides
  userPermissions
    .filter((up) => up.userId === userId)
    .forEach((up) => {
      const p = permMap.get(up.permissionId);
      if (p) {
        if (up.isGranted) {
          effectiveCodes.add(p.code);
        } else {
          effectiveCodes.delete(p.code);
        }
      }
    });

  return effectiveCodes;
}

/**
 * Checks if a user has a specific permission code granted.
 */
export function hasPermission(user: User | null, permissionCode: PermissionCode | string): boolean {
  if (!user || user.status === "inactive") return false;

  // Owners and IT have full access
  if (user.role === "owner" || user.role === "it") return true;

  // Staff, Managers, Purchase, and Admins can view expiring items and FEFO lots
  if (
    permissionCode === "inventory:view_fefo" ||
    permissionCode === "expiry:view" ||
    permissionCode === "inventory:view_expiry"
  ) {
    if (
      user.role === "staff" ||
      user.role === "manager" ||
      user.role === "purchase" ||
      user.role === "admin"
    ) {
      return true;
    }
  }

  // Staff, Managers, Admins can view, add data, print, and manage stock counts
  if (
    permissionCode === "stock_count:view" ||
    permissionCode === "stock_count:create" ||
    permissionCode === "stock_count:print" ||
    permissionCode === "stock_count.print" ||
    permissionCode === "stock_count.edit_own" ||
    permissionCode === "stock:write"
  ) {
    if (
      user.role === "staff" ||
      user.role === "manager" ||
      user.role === "admin" ||
      user.role === "owner" ||
      user.role === "it"
    ) {
      return true;
    }
  }

  // Check calculated effective permissions set if available and non-empty
  if (user.permissionCodes && user.permissionCodes.size > 0) {
    if (
      (permissionCode === "inventory:view_fefo" || permissionCode === "expiry:view") &&
      (user.permissionCodes.has("inventory:view") || user.role === "staff")
    ) {
      return true;
    }
    return user.permissionCodes.has(permissionCode);
  }

  // Fallback defaults if permissionCodes set is not populated yet
  if (user.role === "admin") return true;
  if (user.role === "purchase") {
    return [
      "dashboard:view",
      "inventory:view",
      "inventory:view_fefo",
      "expiry:view",
      "master_items:view",
      "suppliers:view",
      "suppliers:edit",
      "purchase:view",
      "purchase:create",
      "purchase.edit_own",
      "purchase.edit_history",
      "receiving:view",
      "receiving:create",
      "reports:view",
      "reports:export",
      "procurement_master:view",
      "procurement_master:manage",
    ].includes(permissionCode);
  }
  if (user.role === "manager") {
    return !["user_management:manage", "settings:manage", "delete_records:execute"].includes(
      permissionCode,
    );
  }
  if (user.role === "staff") {
    return [
      "dashboard:view",
      "inventory:view",
      "inventory:view_fefo",
      "expiry:view",
      "master_items:view",
      "suppliers:view",
      "beginning_stock:view",
      "purchase:view",
      "purchase:create",
      "purchase.edit_own",
      "receiving:view",
      "receiving:create",
      "receiving.edit_own",
      "stock_count:view",
      "stock_count:create",
      "stock_count:print",
      "stock_count.print",
      "stock_count.edit_own",
      "stock:write",
      "reports:view",
      "procurement_master:view",
    ].includes(permissionCode);
  }

  return false;
}

/**
 * Checks if a user has access to a specific branch.
 */
export function hasBranchAccess(user: User | null, branchId?: string): boolean {
  if (!user || user.status === "inactive") return false;

  // If no specific branch is requested or "all" is specified
  if (!branchId || branchId === "all") {
    return true;
  }

  // Owners, IT, Admins, and Purchase role have access to all branches by default
  if (
    user.role === "owner" ||
    user.role === "it" ||
    user.role === "admin" ||
    user.role === "purchase" ||
    user.isAllBranches
  ) {
    return true;
  }

  // Explicit user_branches access list
  if (user.allowedBranchIds && user.allowedBranchIds.length > 0) {
    return user.allowedBranchIds.includes(branchId);
  }

  // Fallback to primary single branch assignment
  if (user.branchId) {
    return user.branchId === branchId;
  }

  return false;
}

/**
 * Returns the list of branches accessible by the user.
 */
export function getAllowedBranches(user: User | null, allBranches: Branch[]): Branch[] {
  if (!user || user.status === "inactive") return [];

  if (
    user.role === "owner" ||
    user.role === "it" ||
    user.role === "admin" ||
    user.role === "purchase" ||
    user.isAllBranches
  ) {
    return allBranches;
  }

  if (user.allowedBranchIds && user.allowedBranchIds.length > 0) {
    const allowedSet = new Set(user.allowedBranchIds);
    return allBranches.filter((b) => allowedSet.has(b.id));
  }

  if (user.branchId) {
    return allBranches.filter((b) => b.id === user.branchId);
  }

  return allBranches;
}

/**
 * Validates BOTH permission AND branch access in a single reusable check.
 */
export function canAccess(
  user: User | null,
  permissionCode: PermissionCode | string,
  branchId?: string,
): boolean {
  return hasPermission(user, permissionCode) && hasBranchAccess(user, branchId);
}

/**
 * Writes an entry into the permission_audit_logs table.
 */
export async function logPermissionAudit(
  targetUserId: string,
  actorId: string | undefined,
  action: string,
  permissionCode?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from("permission_audit_logs").insert({
      target_user_id: targetUserId,
      actor_id: actorId || null,
      action,
      permission_code: permissionCode || null,
      details: details || {},
    });
  } catch (err) {
    console.error("Failed to write permission audit log:", err);
  }
}
