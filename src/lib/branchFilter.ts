import type { Item } from "@/lib/types";

/**
 * Branch Filter Helper
 * Ensures "All Branches" aggregates data across ALL branches without dropping records,
 * and specific branch selection filters strictly by branch ID.
 */

export function isAllBranches(selectedBranchId?: string | null): boolean {
  if (!selectedBranchId) return true;
  const normalized = selectedBranchId.trim().toLowerCase();
  return normalized === "" || normalized === "all" || normalized === "all branches";
}

export function filterByBranch<T extends { branchId?: string; branch_id?: string }>(
  records: T[],
  selectedBranchId?: string | null,
): T[] {
  if (isAllBranches(selectedBranchId)) {
    return records;
  }
  return records.filter((r) => {
    const bId = r.branchId ?? r.branch_id;
    return bId === selectedBranchId;
  });
}

export function getItemStockForBranch(
  itemId: string,
  inventoryBalance: { branchId: string; itemId: string; quantity: number }[],
  items: (Item & { currentStock?: number })[],
  selectedBranchId?: string | null,
): number {
  if (isAllBranches(selectedBranchId)) {
    // If inventoryBalance records exist, aggregate across all branches
    const balances = inventoryBalance.filter((b) => b.itemId === itemId);
    if (balances.length > 0) {
      return balances.reduce((sum, b) => sum + b.quantity, 0);
    }
    const item = items.find((i) => i.id === itemId);
    return item?.currentStock ?? 0;
  } else {
    // Filter specifically by branchId
    const balances = inventoryBalance.filter(
      (b) => b.itemId === itemId && b.branchId === selectedBranchId,
    );
    if (balances.length > 0) {
      return balances.reduce((sum, b) => sum + b.quantity, 0);
    }
    return 0;
  }
}

/** Helper to check if a date string falls on local "today" */
export function isTodayLocal(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
