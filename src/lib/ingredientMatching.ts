import type { Item } from "./types";

/**
 * Known supplier suffixes used across procurement, e.g.:
 * -SS (ชินเซ็น / Shinsen)
 * -WF (WFOOD)
 * -CT / -CP (Central / CP)
 * -SUPA, -SUPB
 */
const KNOWN_SUPPLIER_SUFFIXES = new Set([
  "ss",
  "wf",
  "ct",
  "cp",
  "sup",
  "supa",
  "supb",
  "supc",
  "shinsen",
  "wfood",
  "central",
]);

/**
 * Extracts the base ingredient / master code by stripping supplier suffixes
 * e.g. "2B220159-SS" -> "2B220159"
 * e.g. "2B220159-WF" -> "2B220159"
 * e.g. "4B220169_SS" -> "4B220169"
 * e.g. "VEG-001-A"   -> "VEG-001"
 */
export function extractBaseIngredientCode(code: string): string {
  if (!code) return "";
  const trimmed = code.trim();

  // 1. Check pattern: PREFIX-SUFFIX or PREFIX_SUFFIX or PREFIX.SUFFIX
  // Match standard delimiter followed by 1-7 alphanumeric characters
  const match = trimmed.match(/^(.+?)[-_.]([A-Za-z0-9]{1,7})$/);
  if (match) {
    const prefix = match[1].trim();
    const suffix = match[2].trim().toLowerCase();

    // If suffix matches known supplier suffix OR is a short alphanumeric code (1-4 chars)
    if (KNOWN_SUPPLIER_SUFFIXES.has(suffix) || suffix.length <= 4) {
      return prefix;
    }
  }

  return trimmed;
}

/**
 * Determines whether an Item matches a given recipe ingredient code
 * Supports:
 * 1. Exact item code match
 * 2. Item masterCode match
 * 3. Base code extracted from item code matching recipe code
 * 4. Item code starting with recipe code prefix (e.g. recipe "2B220159" matches item "2B220159-SS")
 * 5. Recipe code having a suffix while master item is base code
 */
export function matchesIngredientCode(
  item: { code: string; masterCode?: string; name?: string },
  recipeIngredientCode: string,
): boolean {
  if (!recipeIngredientCode || !item) return false;

  const target = recipeIngredientCode.toLowerCase().trim();
  const itemCode = (item.code || "").toLowerCase().trim();
  const masterCode = (item.masterCode || "").toLowerCase().trim();

  if (itemCode === target) return true;
  if (masterCode === target) return true;

  const itemBaseCode = extractBaseIngredientCode(item.code).toLowerCase().trim();
  const targetBaseCode = extractBaseIngredientCode(recipeIngredientCode).toLowerCase().trim();

  if (itemBaseCode === target) return true;
  if (itemBaseCode === targetBaseCode) return true;
  if (itemCode === targetBaseCode) return true;

  // Prefix match (item code starts with target + delimiter)
  if (
    itemCode.startsWith(target + "-") ||
    itemCode.startsWith(target + "_") ||
    itemCode.startsWith(target + ".")
  ) {
    return true;
  }

  // If item masterCode starts with or matches
  if (
    masterCode &&
    (masterCode === target ||
      masterCode === targetBaseCode ||
      masterCode.startsWith(target + "-") ||
      masterCode.startsWith(target + "_"))
  ) {
    return true;
  }

  return false;
}

/**
 * Finds all Master Items that match a recipe ingredient code (including all supplier variants)
 */
export function findMatchingMasterItems(ingredientCode: string, items: Item[]): Item[] {
  if (!ingredientCode || !items || items.length === 0) return [];
  return items.filter((item) => matchesIngredientCode(item, ingredientCode));
}

/**
 * Finds the primary/canonical Master Item representing a recipe ingredient code.
 * Preference:
 * 1. Exact code match
 * 2. MasterCode exact match
 * 3. Active item with highest stock
 * 4. First matching variant
 */
export function findPrimaryMatchingMasterItem(
  ingredientCode: string,
  items: Item[],
): Item | undefined {
  const matches = findMatchingMasterItems(ingredientCode, items);
  if (matches.length === 0) return undefined;

  const target = ingredientCode.toLowerCase().trim();

  // 1. Exact code
  const exact = matches.find((i) => i.code.toLowerCase().trim() === target);
  if (exact) return exact;

  // 2. Master code exact
  const masterExact = matches.find((i) => (i.masterCode || "").toLowerCase().trim() === target);
  if (masterExact) return masterExact;

  // 3. Active with stock
  const activeWithStock = matches.find((i) => i.active && (i.currentStock ?? 0) > 0);
  if (activeWithStock) return activeWithStock;

  // 4. Any active
  const anyActive = matches.find((i) => i.active);
  if (anyActive) return anyActive;

  return matches[0];
}

/**
 * Gets a human-readable supplier variant label, e.g. "ชินเซ็น (-SS)" or "WFOOD (-WF)"
 */
export function getSupplierVariantLabel(
  item: Item,
  suppliers: { id: string; name: string; code?: string }[] = [],
): string {
  const supp = suppliers.find((s) => s.id === item.supplierId);
  const codeSuffixMatch = item.code.match(/[-_.]([A-Za-z0-9]+)$/);
  const suffix = codeSuffixMatch ? ` (-${codeSuffixMatch[1]})` : "";

  if (supp) {
    return `${supp.name}${suffix}`;
  }
  return item.code;
}
