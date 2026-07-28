import { supabase } from "@/lib/supabase";
import type { UUID } from "@/lib/types";

export type LotStatus = "active" | "depleted" | "expired" | "cancelled";

export interface InventoryLot {
  id: UUID;
  lotNumber: string;
  branchId: UUID | null;
  itemId: UUID;
  purchaseItemId: UUID | null;
  supplierId: UUID | null;
  receivedDate: string;
  expiryDate: string | null;
  unitCost: number;
  qtyReceived: number;
  qtyRemaining: number;
  status: LotStatus;
}

interface InventoryLotRow {
  id: string;
  lot_number: string;
  branch_id: string | null;
  item_id: string;
  purchase_item_id: string | null;
  supplier_id: string | null;
  received_date: string;
  expiry_date: string | null;
  unit_cost: number;
  qty_received: number;
  qty_remaining: number;
  status: LotStatus;
}

function rowToLot(r: InventoryLotRow): InventoryLot {
  return {
    id: r.id,
    lotNumber: r.lot_number,
    branchId: r.branch_id,
    itemId: r.item_id,
    purchaseItemId: r.purchase_item_id,
    supplierId: r.supplier_id,
    receivedDate: r.received_date,
    expiryDate: r.expiry_date,
    unitCost: Number(r.unit_cost ?? 0),
    qtyReceived: Number(r.qty_received ?? 0),
    qtyRemaining: Number(r.qty_remaining ?? 0),
    status: r.status,
  };
}

/**
 * Every consumable lot for an item, in FEFO allocation order: earliest
 * expiry_date first, then earliest received_date first (lots with no
 * expiry_date sort last -- Postgres/PostgREST put NULLs last in an
 * ascending sort by default, so non-expiring stock is correctly consumed
 * after everything that can expire).
 *
 * Excludes lots with qty_remaining <= 0 or status = 'expired', per the
 * FEFO requirement. Pass `branchId` to further scope to a single branch.
 */
export async function getAvailableLots(itemId: UUID, branchId?: UUID): Promise<InventoryLot[]> {
  if (!itemId) throw new Error("getAvailableLots: itemId is required");

  let query = supabase
    .from("inventory_lots")
    .select("*")
    .eq("item_id", itemId)
    .gt("qty_remaining", 0)
    .neq("status", "expired")
    .order("expiry_date", { ascending: true, nullsFirst: false })
    .order("received_date", { ascending: true });

  if (branchId) query = query.eq("branch_id", branchId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToLot);
}

export interface ConsumeInventoryOptions {
  /** Scope consumption (and the resulting inventory_balance update) to one branch. */
  branchId?: UUID;
  /** e.g. 'transactions', 'stock_count_items' -- what triggered this consumption. */
  referenceTable?: string;
  referenceId?: UUID;
  movementType?: "USAGE" | "ADJUSTMENT" | "TRANSFER_OUT";
  remark?: string;
}

export interface ConsumeInventoryLine {
  lotId: UUID;
  lotNumber: string;
  quantity: number;
  expiryDate: string | null;
}

export interface ConsumeInventoryResult {
  itemId: UUID;
  quantityRequested: number;
  quantityConsumed: number;
  /** One line per lot deducted from, in the order they were consumed (earliest expiry first). */
  lines: ConsumeInventoryLine[];
}

interface ConsumeFefoRpcRow {
  lot_id: string;
  lot_number: string;
  quantity: number;
  expiry_date: string | null;
}

/**
 * Consumes `quantity` of `itemId` using First Expired First Out
 * allocation: the earliest-expiring lot (then earliest-received) is
 * deducted from first, moving on to the next lot whenever one is
 * insufficient on its own, until the full quantity is covered.
 *
 * Every deduction creates a stock_movements row (one per lot touched).
 * The whole operation runs server-side inside a single Postgres function
 * call (public.fn_consume_fefo, see supabase/migrations/013_fefo_consumption.sql),
 * which is transactional: if stock turns out to be insufficient partway
 * through, every update/insert already made in this call is rolled back
 * and nothing is left half-consumed.
 *
 * Throws an Error (surfacing the database's message, e.g. "Insufficient
 * stock for item <id>: requested 50, available 32") if there isn't enough
 * available stock to fully satisfy the request.
 */
export async function consumeInventory(
  itemId: UUID,
  quantity: number,
  options: ConsumeInventoryOptions = {},
): Promise<ConsumeInventoryResult> {
  if (!itemId) throw new Error("consumeInventory: itemId is required");
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("consumeInventory: quantity must be a positive number");
  }

  const { data, error } = await supabase.rpc("fn_consume_fefo", {
    p_item_id: itemId,
    p_qty: quantity,
    p_branch_id: options.branchId ?? null,
    p_reference_table: options.referenceTable ?? null,
    p_reference_id: options.referenceId ?? null,
    p_movement_type: options.movementType ?? "USAGE",
    p_remark: options.remark ?? null,
  });

  if (error) {
    // fn_consume_fefo raises a Postgres exception (and rolls back) when
    // stock is insufficient -- surface that as a plain Error with the
    // database's own message rather than a raw PostgREST error object.
    throw new Error(error.message || "Failed to consume inventory");
  }

  const rows = (data ?? []) as ConsumeFefoRpcRow[];
  const lines: ConsumeInventoryLine[] = rows.map((r) => ({
    lotId: r.lot_id,
    lotNumber: r.lot_number,
    quantity: Number(r.quantity),
    expiryDate: r.expiry_date,
  }));

  return {
    itemId,
    quantityRequested: quantity,
    quantityConsumed: lines.reduce((sum, l) => sum + l.quantity, 0),
    lines,
  };
}
