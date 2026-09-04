import { supabase } from "@/lib/supabase";
import type { Item } from "@/lib/types";
import { findMatchingMasterItems } from "@/lib/ingredientMatching";

export interface InventoryLot {
  id: string;
  lotNumber: string;
  branchId?: string | null;
  itemId: string;
  purchaseItemId?: string | null;
  supplierId?: string | null;
  receivedDate: string;
  expiryDate?: string | null;
  unitCost: number;
  qtyReceived: number;
  qtyRemaining: number;
  status: "active" | "depleted" | "expired" | "cancelled";
  createdAt?: string;
  updatedAt?: string;
}

export interface ConsumeInventoryOptions {
  branchId?: string;
  employee?: string;
  remark?: string;
  allItems?: Item[];
}

export interface ConsumedLotDetail {
  lotId: string;
  lotNumber: string;
  itemId: string;
  itemCode?: string;
  supplierId?: string | null;
  qty: number;
  unitCost?: number;
  receivedDate?: string;
  expiryDate?: string | null;
}

export interface ConsumeInventoryResult {
  success: boolean;
  consumedQty: number;
  lotsUsed: ConsumedLotDetail[];
  message?: string;
}

const rowToLot = (r: Record<string, unknown>): InventoryLot => ({
  id: r.id as string,
  lotNumber: r.lot_number as string,
  branchId: (r.branch_id as string) ?? null,
  itemId: r.item_id as string,
  purchaseItemId: (r.purchase_item_id as string) ?? null,
  supplierId: (r.supplier_id as string) ?? null,
  receivedDate: r.received_date as string,
  expiryDate: (r.expiry_date as string) ?? null,
  unitCost: Number(r.unit_cost ?? 0),
  qtyReceived: Number(r.qty_received ?? 0),
  qtyRemaining: Number(r.qty_remaining ?? 0),
  status: (r.status as InventoryLot["status"]) ?? "active",
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

/**
 * Retrieves available active lots for a single item ID, sorted by FEFO / FIFO:
 * 1. Expiry date ascending (earliest expiring first)
 * 2. Received date ascending (earliest received first)
 */
export async function getAvailableLots(itemId: string, branchId?: string): Promise<InventoryLot[]> {
  try {
    let query = supabase
      .from("inventory_lots")
      .select("*")
      .eq("item_id", itemId)
      .eq("status", "active")
      .gt("qty_remaining", 0)
      .order("expiry_date", { ascending: true, nullsFirst: false })
      .order("received_date", { ascending: true });

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(rowToLot);
  } catch (err) {
    console.warn("getAvailableLots error:", err);
    return [];
  }
}

/**
 * Retrieves available active lots across ALL supplier variants for a given base ingredient code
 * (e.g. recipe code "2B220159" will retrieve lots for "2B220159-SS", "2B220159-WF", etc.)
 * sorted strictly by FIFO / FEFO across all suppliers.
 */
export async function getAvailableLotsForIngredient(
  ingredientCodeOrItemId: string,
  branchId?: string,
  allItems: Item[] = [],
): Promise<InventoryLot[]> {
  try {
    // 1. Identify all matching item IDs (exact code, base code, master code, or variant suffix)
    const matchingItems = findMatchingMasterItems(ingredientCodeOrItemId, allItems);
    const itemIds = new Set<string>();

    // Add direct parameter as an ID in case it's a UUID
    itemIds.add(ingredientCodeOrItemId);

    matchingItems.forEach((item) => {
      itemIds.add(item.id);
    });

    const targetIds = Array.from(itemIds);

    let query = supabase
      .from("inventory_lots")
      .select("*")
      .in("item_id", targetIds)
      .eq("status", "active")
      .gt("qty_remaining", 0);

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const mapped = data.map(rowToLot);

    // 2. Sort across all supplier variants by FIFO / FEFO:
    // - Earliest expiry date first (if present)
    // - Earliest received date first
    // - Earliest created date
    return mapped.sort((a, b) => {
      if (a.expiryDate && b.expiryDate) {
        const expDiff = new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        if (expDiff !== 0) return expDiff;
      } else if (a.expiryDate && !b.expiryDate) {
        return -1;
      } else if (!a.expiryDate && b.expiryDate) {
        return 1;
      }

      const recA = a.receivedDate ? new Date(a.receivedDate).getTime() : 0;
      const recB = b.receivedDate ? new Date(b.receivedDate).getTime() : 0;
      if (recA !== recB) return recA - recB;

      const createA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return createA - createB;
    });
  } catch (err) {
    console.warn("getAvailableLotsForIngredient error:", err);
    return [];
  }
}

/**
 * Consumes inventory in strict FIFO / FEFO order.
 * If the ingredient has multiple supplier variants, it will automatically consume from
 * the earliest received / expiring supplier's lot first until depleted, then proceed to the next supplier.
 */
export async function consumeInventory(
  ingredientCodeOrItemId: string,
  quantity: number,
  options?: ConsumeInventoryOptions,
): Promise<ConsumeInventoryResult> {
  if (quantity <= 0) {
    return { success: true, consumedQty: 0, lotsUsed: [] };
  }

  const allItems = options?.allItems || [];
  const lots = await getAvailableLotsForIngredient(
    ingredientCodeOrItemId,
    options?.branchId,
    allItems,
  );

  let remainingToConsume = quantity;
  const lotsUsed: ConsumedLotDetail[] = [];

  for (const lot of lots) {
    if (remainingToConsume <= 0) break;

    const take = Math.min(lot.qtyRemaining, remainingToConsume);
    const newQtyRemaining = lot.qtyRemaining - take;
    const newStatus = newQtyRemaining === 0 ? "depleted" : "active";

    try {
      await supabase
        .from("inventory_lots")
        .update({
          qty_remaining: newQtyRemaining,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lot.id);
    } catch (e) {
      console.warn("Failed to update lot:", e);
    }

    const matchedItem = allItems.find((i) => i.id === lot.itemId);

    lotsUsed.push({
      lotId: lot.id,
      lotNumber: lot.lotNumber,
      itemId: lot.itemId,
      itemCode: matchedItem?.code,
      supplierId: lot.supplierId,
      qty: take,
      unitCost: lot.unitCost,
      receivedDate: lot.receivedDate,
      expiryDate: lot.expiryDate,
    });

    remainingToConsume -= take;
  }

  const consumedQty = quantity - remainingToConsume;
  return {
    success: remainingToConsume === 0,
    consumedQty,
    lotsUsed,
    message:
      remainingToConsume > 0
        ? `Consuming completed partially. ${remainingToConsume} units remaining without active lot allocation.`
        : "Inventory consumed successfully via FIFO/FEFO across supplier lots.",
  };
}
