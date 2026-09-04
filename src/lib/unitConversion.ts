import type { Item } from "@/lib/types";

export const UNIT_THAI_MAP: Record<string, string> = {
  piece: "ชิ้น",
  pieces: "ชิ้น",
  pcs: "ชิ้น",
  pack: "แพ็ค",
  packs: "แพ็ค",
  box: "กล่อง",
  boxes: "กล่อง",
  bag: "ถุง",
  bags: "ถุง",
  bottle: "ขวด",
  bottles: "ขวด",
  can: "กระป๋อง",
  cans: "กระป๋อง",
  jar: "โหล",
  carton: "ลัง",
  cartons: "ลัง",
  set: "ชุด",
  sets: "ชุด",
  dozen: "โหล",
  gram: "กรัม",
  grams: "กรัม",
  g: "กรัม",
  kilogram: "กิโลกรัม",
  kilograms: "กิโลกรัม",
  kg: "กิโลกรัม",
  กก: "กิโลกรัม",
  "กก.": "กิโลกรัม",
  liter: "ลิตร",
  liters: "ลิตร",
  L: "ลิตร",
  l: "ลิตร",
  มล: "มิลลิลิตร",
  "มล.": "มิลลิลิตร",
  ml: "มิลลิลิตร",
  pound: "ปอนด์",
  lb: "ปอนด์",
  lbs: "ปอนด์",
  tray: "แผง",
  trays: "แผง",
  แผง: "แผง",
  ฟอง: "ฟอง",
};

export function formatUnitThai(unit?: string): string {
  if (!unit) return "";
  const key = unit.toLowerCase().trim();
  return UNIT_THAI_MAP[key] || unit;
}

export interface UnitConversionResult {
  convertedQty: number;
  masterUnit: string;
  rawQty: number;
  recipeUnit: string;
  isConverted: boolean;
  factor: number;
}

function getWeightCategory(unit: string): "mg" | "g" | "kg" | null {
  const u = unit.toLowerCase().trim();
  if (["g", "gram", "grams", "กรัม", "ก.", "ก"].includes(u)) return "g";
  if (["kg", "kilogram", "kilograms", "กก.", "กก", "กิโลกรัม", "กิโล", "กิโลฯ"].includes(u))
    return "kg";
  if (["mg", "milligram", "milligrams", "มิลลิกรัม", "มก.", "มก"].includes(u)) return "mg";
  return null;
}

function getVolumeCategory(unit: string): "ml" | "l" | null {
  const u = unit.toLowerCase().trim();
  if (["ml", "มล", "มล.", "milliliter", "milliliters", "มิลลิลิตร", "cc", "ซีซี"].includes(u))
    return "ml";
  if (["l", "liter", "liters", "ลิตร", "ล.", "ล"].includes(u)) return "l";
  return null;
}

function normalizeUnit(unit: string): string {
  const formatted = formatUnitThai(unit);
  return (formatted || unit).toLowerCase().trim();
}

/**
 * Converts a theoretical usage quantity from its recipe unit into the Master Item stock unit
 * using deterministic structured fields: stock_unit, recipe_unit, and conversion_factor.
 */
export function convertUsageToMasterUnit(
  rawQty: number,
  recipeUnit: string,
  masterUnitRaw?: string,
  item?: Item,
): UnitConversionResult {
  const stockUnit = (item?.stockUnit || masterUnitRaw || item?.unit || recipeUnit || "").trim();
  const itemRecipeUnit = (item?.recipeUnit || recipeUnit || item?.unit || "").trim();
  const cf = item?.conversionFactor && item.conversionFactor > 0 ? item.conversionFactor : 1;

  const stockUnitFormatted = formatUnitThai(stockUnit) || stockUnit;
  const recipeUnitFormatted = formatUnitThai(recipeUnit) || recipeUnit;

  const normInputRecipe = normalizeUnit(recipeUnit);
  const normItemRecipe = normalizeUnit(itemRecipeUnit);
  const normStockUnit = normalizeUnit(stockUnit);

  // 1. Explicit Item Structured Conversion Factor (from database)
  if (item && item.conversionFactor && item.conversionFactor > 0) {
    // If input recipe unit matches the item's recipe unit (e.g. g vs g, piece vs piece)
    if (normInputRecipe === normItemRecipe) {
      const convertedQty = rawQty / cf;
      const factor = 1 / cf;
      const isConverted = cf !== 1 || normInputRecipe !== normStockUnit;
      return {
        convertedQty,
        masterUnit: stockUnitFormatted,
        rawQty,
        recipeUnit: recipeUnitFormatted,
        isConverted,
        factor,
      };
    }

    // If input recipe unit differs from item's recipe unit, check metric category alignment (e.g. kg -> g -> stock_unit)
    const weightInput = getWeightCategory(normInputRecipe);
    const weightItem = getWeightCategory(normItemRecipe);
    if (weightInput && weightItem) {
      const toGrams: Record<string, number> = { mg: 0.001, g: 1, kg: 1000 };
      const metricMultiplier = toGrams[weightInput] / toGrams[weightItem];
      const qtyInItemRecipeUnit = rawQty * metricMultiplier;
      const convertedQty = qtyInItemRecipeUnit / cf;
      const factor = metricMultiplier / cf;
      return {
        convertedQty,
        masterUnit: stockUnitFormatted,
        rawQty,
        recipeUnit: recipeUnitFormatted,
        isConverted: true,
        factor,
      };
    }

    const volumeInput = getVolumeCategory(normInputRecipe);
    const volumeItem = getVolumeCategory(normItemRecipe);
    if (volumeInput && volumeItem) {
      const toMl: Record<string, number> = { ml: 1, l: 1000 };
      const metricMultiplier = toMl[volumeInput] / toMl[volumeItem];
      const qtyInItemRecipeUnit = rawQty * metricMultiplier;
      const convertedQty = qtyInItemRecipeUnit / cf;
      const factor = metricMultiplier / cf;
      return {
        convertedQty,
        masterUnit: stockUnitFormatted,
        rawQty,
        recipeUnit: recipeUnitFormatted,
        isConverted: true,
        factor,
      };
    }

    // 1d. Custom or unmatched units when item has conversionFactor > 0 (1 Stock Unit = cf Recipe Units)
    const convertedQty = rawQty / cf;
    const factor = 1 / cf;
    const isConverted = cf !== 1 || normInputRecipe !== normStockUnit;
    return {
      convertedQty,
      masterUnit: stockUnitFormatted,
      rawQty,
      recipeUnit: recipeUnitFormatted,
      isConverted,
      factor,
    };
  }

  // 2. Standard Metric Fallback (g <-> kg, ml <-> L)
  if (normInputRecipe !== normStockUnit) {
    const weightRecipe = getWeightCategory(normInputRecipe);
    const weightMaster = getWeightCategory(normStockUnit);
    if (weightRecipe && weightMaster) {
      const toGrams: Record<string, number> = { mg: 0.001, g: 1, kg: 1000 };
      const grams = rawQty * toGrams[weightRecipe];
      const convertedQty = grams / toGrams[weightMaster];
      const factor = toGrams[weightRecipe] / toGrams[weightMaster];
      return {
        convertedQty,
        masterUnit: stockUnitFormatted,
        rawQty,
        recipeUnit: recipeUnitFormatted,
        isConverted: factor !== 1,
        factor,
      };
    }

    const volumeRecipe = getVolumeCategory(normInputRecipe);
    const volumeMaster = getVolumeCategory(normStockUnit);
    if (volumeRecipe && volumeMaster) {
      const toMl: Record<string, number> = { ml: 1, l: 1000 };
      const ml = rawQty * toMl[volumeRecipe];
      const convertedQty = ml / toMl[volumeMaster];
      const factor = toMl[volumeRecipe] / toMl[volumeMaster];
      return {
        convertedQty,
        masterUnit: stockUnitFormatted,
        rawQty,
        recipeUnit: recipeUnitFormatted,
        isConverted: factor !== 1,
        factor,
      };
    }
  }

  // 3. Identical units or default fallback (1:1)
  return {
    convertedQty: rawQty,
    masterUnit: stockUnitFormatted || recipeUnitFormatted,
    rawQty,
    recipeUnit: recipeUnitFormatted,
    isConverted: false,
    factor: 1,
  };
}

/**
 * Converts a quantity in Stock Units to Recipe Units
 * Formula: stockQty * conversionFactor (1 Stock Unit = conversionFactor Recipe Units)
 */
export function convertStockToRecipeUnit(stockQty: number, item?: Item): number {
  const cf = item?.conversionFactor && item.conversionFactor > 0 ? item.conversionFactor : 1;
  return stockQty * cf;
}

/**
 * Converts a quantity in Recipe Units to Stock Units
 * Formula: recipeQty / conversionFactor (1 Stock Unit = conversionFactor Recipe Units)
 */
export function convertRecipeToStockUnit(recipeQty: number, item?: Item): number {
  const cf = item?.conversionFactor && item.conversionFactor > 0 ? item.conversionFactor : 1;
  return recipeQty / cf;
}
