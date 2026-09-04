import { supabase } from "@/lib/supabase";
import type {
  UsageVarianceReason,
  StockAdjustment,
  UsageVariancePeriod,
  StandardReasonCode,
  STANDARD_VARIANCE_REASONS,
} from "@/features/reports/types/usageVariance";
import type { User, StockTransaction } from "@/lib/types";

const REASONS_STORAGE_KEY = "hana-usage-variance-reasons-v1";
const ADJUSTMENTS_STORAGE_KEY = "hana-stock-adjustments-v1";
const PERIODS_STORAGE_KEY = "hana-usage-variance-periods-v1";

/**
 * Load all saved variance reasons
 */
export function loadSavedVarianceReasons(): UsageVarianceReason[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REASONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore error
  }
  return [];
}

/**
 * Load all saved stock adjustments
 */
export function loadSavedStockAdjustments(): StockAdjustment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ADJUSTMENTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore error
  }
  return [];
}

/**
 * Load all variance periods
 */
export function loadSavedVariancePeriods(): UsageVariancePeriod[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PERIODS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore error
  }
  return [];
}

/**
 * Save reasons to persistent storage
 */
export function persistVarianceReasons(reasons: UsageVarianceReason[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REASONS_STORAGE_KEY, JSON.stringify(reasons));
  } catch {
    // Ignore error
  }
}

/**
 * Save stock adjustments to persistent storage
 */
export function persistStockAdjustments(adjustments: StockAdjustment[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ADJUSTMENTS_STORAGE_KEY, JSON.stringify(adjustments));
  } catch {
    // Ignore error
  }
}

/**
 * Save periods to persistent storage
 */
export function persistVariancePeriods(periods: UsageVariancePeriod[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PERIODS_STORAGE_KEY, JSON.stringify(periods));
  } catch {
    // Ignore error
  }
}

export interface RecordReasonParams {
  varianceItemId: string;
  periodId?: string;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  branchId: string;
  branchName: string;
  reasonCode: StandardReasonCode;
  reasonLabel: string;
  reasonNote?: string;
  currentUser?: User | null;
  previousReasonCode?: StandardReasonCode;
}

/**
 * Records a variance reason in immutable audit history
 */
export async function recordVarianceReason(
  params: RecordReasonParams,
): Promise<{ success: boolean; reason: UsageVarianceReason }> {
  const currentReasons = loadSavedVarianceReasons();

  const newReason: UsageVarianceReason = {
    id: `rsn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    varianceItemId: params.varianceItemId,
    periodId: params.periodId,
    ingredientId: params.ingredientId,
    ingredientCode: params.ingredientCode,
    ingredientName: params.ingredientName,
    branchId: params.branchId,
    reasonCode: params.reasonCode,
    reasonLabel: params.reasonLabel,
    reasonNote: params.reasonNote?.trim() || "",
    previousReasonCode: params.previousReasonCode,
    recordedBy: params.currentUser?.id || "user-1",
    recordedByName: params.currentUser?.name || params.currentUser?.email || "ผู้ตรวจสอบ",
    recordedByRole: params.currentUser?.role || "staff",
    recordedAt: new Date().toISOString(),
  };

  const updatedReasons = [newReason, ...currentReasons];
  persistVarianceReasons(updatedReasons);

  // Attempt Supabase insert if table exists
  try {
    await supabase.from("usage_variance_reasons").insert([
      {
        id: newReason.id,
        variance_item_id: newReason.varianceItemId,
        period_id: newReason.periodId,
        ingredient_id: newReason.ingredientId,
        reason_code: newReason.reasonCode,
        reason_note: newReason.reasonNote,
        recorded_by: newReason.recordedBy,
        recorded_at: newReason.recordedAt,
      },
    ]);
  } catch {
    // Fallback gracefully to localStorage
  }

  return { success: true, reason: newReason };
}

export interface SaveAndAdjustStockParams {
  varianceItemId: string;
  periodId?: string;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  branchId: string;
  branchName: string;
  unit: string;
  unitPrice: number;
  diffQty: number; // Discrepancy quantity (Actual - Theoretical)
  reasonCode: StandardReasonCode;
  reasonLabel: string;
  reasonNote?: string;
  currentUser?: User | null;
  addTransactionFn: (t: Omit<StockTransaction, "id">) => Promise<void>;
}

/**
 * Records reason AND creates an automatic Stock Adjustment entry + Stock Transaction to synchronize stock.
 */
export async function saveReasonAndAdjustStock(params: SaveAndAdjustStockParams): Promise<{
  success: boolean;
  reason: UsageVarianceReason;
  adjustment: StockAdjustment;
}> {
  // 1. Record the Reason first
  const { reason } = await recordVarianceReason({
    varianceItemId: params.varianceItemId,
    periodId: params.periodId,
    ingredientId: params.ingredientId,
    ingredientCode: params.ingredientCode,
    ingredientName: params.ingredientName,
    branchId: params.branchId,
    branchName: params.branchName,
    reasonCode: params.reasonCode,
    reasonLabel: params.reasonLabel,
    reasonNote: params.reasonNote,
    currentUser: params.currentUser,
  });

  // 2. Create the Stock Adjustment record
  const currentAdjustments = loadSavedStockAdjustments();

  // If Diff is positive (over-usage / loss), the adjustment is -diffQty. If negative (surplus), +diffQty.
  const qtyDelta = -params.diffQty;
  const totalValue = Math.abs(params.diffQty * params.unitPrice);

  const newAdjustment: StockAdjustment = {
    id: `adj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    ingredientId: params.ingredientId,
    ingredientCode: params.ingredientCode,
    ingredientName: params.ingredientName,
    branchId: params.branchId,
    branchName: params.branchName,
    qtyDelta,
    unit: params.unit,
    unitPrice: params.unitPrice,
    totalValue,
    sourceType: "variance_review",
    referenceId: params.varianceItemId,
    reasonCode: params.reasonCode,
    reasonLabel: params.reasonLabel,
    reasonNote: params.reasonNote,
    createdBy: params.currentUser?.id || "user-1",
    createdByName: params.currentUser?.name || params.currentUser?.email || "ผู้ดูแลระบบ",
    createdAt: new Date().toISOString(),
  };

  const updatedAdjustments = [newAdjustment, ...currentAdjustments];
  persistStockAdjustments(updatedAdjustments);

  // 3. Post system stock adjustment transaction
  try {
    await params.addTransactionFn({
      itemId: params.ingredientId,
      type: "adjustment",
      quantity: qtyDelta,
      unitPrice: params.unitPrice,
      date: new Date().toISOString(),
      branchId: params.branchId,
      remark: `Variance Adjustment: ${params.reasonLabel}${
        params.reasonNote ? ` (${params.reasonNote})` : ""
      }`,
    });
  } catch (err) {
    console.warn("Failed to create stock transaction for variance adjustment:", err);
  }

  // Attempt Supabase insert if table exists
  try {
    await supabase.from("stock_adjustments").insert([
      {
        id: newAdjustment.id,
        ingredient_id: newAdjustment.ingredientId,
        branch_id: newAdjustment.branchId,
        qty_delta: newAdjustment.qtyDelta,
        source_type: newAdjustment.sourceType,
        reference_id: newAdjustment.referenceId,
        created_by: newAdjustment.createdBy,
        created_at: newAdjustment.createdAt,
      },
    ]);
  } catch {
    // Fallback gracefully
  }

  return {
    success: true,
    reason,
    adjustment: newAdjustment,
  };
}
