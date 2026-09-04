import type { UUID } from "@/lib/types";

export type VarianceStatus =
  | "normal" // ปกติ (ภายใน Threshold)
  | "abnormal_unreviewed" // ผิดปกติ - รอตรวจสอบ
  | "abnormal_reviewed" // ผิดปกติ - บันทึกเหตุผลแล้ว
  | "adjusted"; // ปรับปรุงสต็อกแล้ว

export type StandardReasonCode =
  | "spoilage" // ของเสีย / หมดอายุ
  | "promo_free" // แจกฟรี / ทดลองเมนู / โปรโมชั่น / ส่วนลดพนักงาน
  | "production_loss" // ทำเสีย / ทำหล่น ระหว่างกระบวนการผลิต
  | "human_error" // นับผิด / รับเข้าผิด (Human error)
  | "recipe_outdated" // สูตรไม่ตรงกับของจริง (Recipe outdated)
  | "unrecorded_transfer" // โอนย้ายสาขา / คลัง ที่ไม่ได้บันทึกในระบบ
  | "unknown_loss" // สูญหาย / ไม่ทราบสาเหตุ
  | "other"; // อื่นๆ (ระบุเอง)

export interface VarianceReasonOption {
  code: StandardReasonCode;
  label: string;
  category: "waste" | "operational" | "recipe" | "system" | "other";
  description: string;
}

export const STANDARD_VARIANCE_REASONS: readonly VarianceReasonOption[] = [
  {
    code: "spoilage",
    label: "ของเสีย / หมดอายุ (Spoilage)",
    category: "waste",
    description: "วัตถุดิบเน่าเสีย เสื่อมสภาพ หรือหมดอายุก่อนใช้งาน",
  },
  {
    code: "promo_free",
    label: "แจกฟรี / ทดลองเมนู / โปรโมชั่น / ส่วนลดพนักงาน",
    category: "operational",
    description: "นำไปใช้ในการตลาด ทดลองอาหาร หรือสวัสดิการพนักงานที่ไม่มีการคีย์ขาย",
  },
  {
    code: "production_loss",
    label: "ทำเสีย / ทำหล่น ระหว่างกระบวนการผลิต (Production Loss)",
    category: "waste",
    description: "เกิดความเสียหาย หก หล่น หรือไหม้ ระหว่างการเตรียมหรือปรุงอาหาร",
  },
  {
    code: "human_error",
    label: "นับผิด / รับเข้าผิด (Human error)",
    category: "system",
    description: "ความผิดพลาดจากการนับสต็อกหน้างาน หรือคีย์ใบรับเข้าผิดพลาด",
  },
  {
    code: "recipe_outdated",
    label: "สูตรไม่ตรงกับของจริง (Recipe outdated / Over-portioning)",
    category: "recipe",
    description: "ตวงวัตถุดิบเกินสูตร หรือสูตรอาหารในระบบยังไม่อัปเดตตามการใช้งานจริง",
  },
  {
    code: "unrecorded_transfer",
    label: "โอนย้ายสาขา / คลัง ที่ไม่ได้บันทึกในระบบ",
    category: "system",
    description: "มีการยืมหรือโอนวัตถุดิบไปสาขาอื่นโดยยังไม่ได้ออกเอกสารในระบบ",
  },
  {
    code: "unknown_loss",
    label: "สูญหาย / ไม่ทราบสาเหตุ",
    category: "other",
    description: "สต็อกขาดหายไปโดยไม่สามารถระบุสาเหตุที่ชัดเจนได้",
  },
  {
    code: "other",
    label: "อื่นๆ (ระบุเอง)",
    category: "other",
    description: "เหตุผลอื่นๆ นอกเหนือจากตัวเลือกมาตรฐาน (ต้องกรอกรายละเอียดเพิ่มเติม)",
  },
];

/**
 * usage_variance_periods - งวดการเปรียบเทียบ
 */
export interface UsageVariancePeriod {
  id: UUID;
  branchId: UUID;
  branchName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: "open" | "closed" | "in_review";
  totalTheoreticalCost: number;
  totalActualCost: number;
  totalVarianceValue: number;
  abnormalItemsCount: number;
  adjustedItemsCount: number;
  createdAt: string;
  createdBy: string;
  closedAt?: string;
  closedBy?: string;
  updatedAt?: string;
}

/**
 * Contributing menu item for theoretical usage breakdown
 */
export interface ContributingMenuSale {
  menuCode: string;
  menuName: string;
  quantitySold: number;
  recipePortion: number;
  recipeUnit: string;
  contributedUsageRaw: number;
  contributedUsageConverted: number;
  masterUnit: string;
  recipeVersion?: string;
}

/**
 * usage_variance_items - รายละเอียดต่อวัตถุดิบต่องวด
 */
export interface UsageVarianceItem {
  id: UUID;
  periodId?: UUID;
  branchId: UUID;
  branchName: string;
  ingredientId: UUID;
  ingredientCode: string;
  ingredientName: string;
  categoryId: UUID;
  categoryName: string;
  unit: string;
  stockUnit?: string;
  recipeUnit?: string;
  purchasePrice: number;

  // Core Formula Quantities
  beginningQty: number; // ยอดต้นงวด (จาก Ending count งวดก่อนหน้า)
  beginningCountDate?: string; // วันที่ตรวจนับต้นงวด
  purchaseQty: number; // รับเข้าในงวด
  endingActualQty: number; // ยอดปลายงวดที่นับจริง
  endingCountDate?: string; // วันที่ตรวจนับปลายงวด

  actualUsageQty: number; // ใช้จริง = Beginning + Purchases - Ending Actual
  theoreticalUsageQty: number; // ใช้ตามสูตร = Sum(Sales * Recipe BOM)

  diffQty: number; // Diff = Actual Usage - Theoretical Usage
  diffPct: number; // Diff % = (Diff Qty / Theoretical Usage) * 100
  diffValue: number; // Diff Value = Diff Qty * Purchase Price (THB)

  isAbnormal: boolean; // เข้าเงื่อนไข Diff % > Threshold OR |Diff Value| > Threshold
  thresholdPctApplied: number;
  thresholdValueApplied: number;

  status: VarianceStatus;

  // Current reason snapshot
  currentReasonCode?: StandardReasonCode;
  currentReasonLabel?: string;
  currentReasonNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;

  // Adjustment status
  isAdjusted?: boolean;
  adjustedQty?: number;
  adjustedAt?: string;
  adjustedBy?: string;
  adjustmentRefId?: string;

  // Breakdown items for drilldown modal
  menuBreakdown?: ContributingMenuSale[];
}

/**
 * usage_variance_reasons - เหตุผลที่บันทึก
 */
export interface UsageVarianceReason {
  id: UUID;
  varianceItemId: UUID;
  periodId?: UUID;
  ingredientId: UUID;
  ingredientCode: string;
  ingredientName: string;
  branchId: UUID;
  reasonCode: StandardReasonCode;
  reasonLabel: string;
  reasonNote?: string;
  previousReasonCode?: StandardReasonCode;
  recordedBy: string;
  recordedByName: string;
  recordedByRole?: string;
  recordedAt: string;
}

/**
 * stock_adjustments - รายการปรับปรุงสต็อกที่เกิดจากการอนุมัติ variance
 */
export interface StockAdjustment {
  id: UUID;
  ingredientId: UUID;
  ingredientCode: string;
  ingredientName: string;
  branchId: UUID;
  branchName: string;
  qtyDelta: number; // จำนวนที่ปรับปรุง (+ หรือ -)
  unit: string;
  unitPrice: number;
  totalValue: number;
  sourceType: "variance_review" | "manual" | "stock_count";
  referenceId: string; // periodId or varianceItemId or docId
  reasonCode: StandardReasonCode | string;
  reasonLabel: string;
  reasonNote?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

/**
 * Recipe / BOM Versioning
 */
export interface RecipeVersionIngredient {
  ingredientCode: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  subRecipeCode?: string;
}

export interface RecipeVersion {
  id: UUID;
  menuCode: string;
  menuName: string;
  versionNumber: number; // e.g. 1, 2, 3
  versionTag?: string; // e.g. "v1.0", "v2.0"
  effectiveDate: string; // YYYY-MM-DD (Active starting from this date)
  endDate?: string; // YYYY-MM-DD (Optional end date if replaced)
  ingredients: RecipeVersionIngredient[];
  changeSummary?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

/**
 * Summary stats for executive dashboard
 */
export interface VarianceExecutiveSummary {
  totalTheoreticalCost: number;
  totalActualCost: number;
  netVarianceCost: number;
  netVariancePct: number;
  totalItemsCount: number;
  abnormalItemsCount: number;
  reviewedItemsCount: number;
  adjustedItemsCount: number;
  lossValueByReason: {
    reasonCode: StandardReasonCode;
    reasonLabel: string;
    lossValue: number;
    count: number;
  }[];
  monthlyTrend: {
    periodKey: string;
    periodLabel: string;
    theoreticalCost: number;
    actualCost: number;
    varianceValue: number;
    variancePct: number;
    abnormalCount: number;
  }[];
  topAbnormalIngredients: {
    ingredientId: string;
    code: string;
    name: string;
    category: string;
    unit: string;
    diffQty: number;
    diffValue: number;
    diffPct: number;
    anomalyCount: number;
  }[];
}
