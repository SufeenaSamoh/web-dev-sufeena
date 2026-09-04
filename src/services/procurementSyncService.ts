import type { Item, Category, Supplier } from "@/lib/types";
import type { PurchaseProduct } from "@/features/purchase/types";
import { REAL_VEGETABLE_PRODUCTS } from "@/data/vegetables";
import { ALL_PORTO_CENTRAL_AND_SPECIAL_PRODUCTS } from "@/data/portoCentralProducts";
import { INITIAL_PRODUCTS_A } from "./purchaseDbA";

export interface SyncCandidateItem {
  code: string;
  name: string;
  categoryName: string;
  categoryId?: string;
  supplierName: string;
  supplierId?: string;
  stockUnit: string;
  recipeUnit: string;
  conversionFactor: number;
  purchasePrice: number;
  itemType: "raw";
  minStock: number;
  description: string;
  status: "new" | "exists";
  existingItem?: Item;
  sourceSuppliers: {
    supplierName: string;
    price: number;
    unit: string;
  }[];
}

/**
 * Normalizes standard inventory & recipe units from procurement unit text
 */
export function deriveUnitsAndFactor(rawUnit: string): {
  stockUnit: string;
  recipeUnit: string;
  conversionFactor: number;
} {
  const u = (rawUnit || "").trim().toLowerCase();

  // Weight (Kilograms -> Grams)
  if (
    u === "กก." ||
    u === "กก" ||
    u === "กิโลกรัม" ||
    u === "kg" ||
    u === "kilogram" ||
    u.includes("กิโล")
  ) {
    return { stockUnit: "kg", recipeUnit: "g", conversionFactor: 1000 };
  }

  // Volume (Liters -> Milliliters)
  if (u === "ลิตร" || u === "liter" || u === "l" || u === "แกลลอน" || u === "gallon") {
    return { stockUnit: "liter", recipeUnit: "ml", conversionFactor: 1000 };
  }

  // Piece-based (ใบ, ลูก, ฟอง, ชิ้น, ต้น, หัว, แง่ง)
  if (
    u === "ใบ" ||
    u === "ลูก" ||
    u === "ฟอง" ||
    u === "ชิ้น" ||
    u === "ต้น" ||
    u === "หัว" ||
    u === "แง่ง" ||
    u === "piece" ||
    u === "pcs"
  ) {
    return { stockUnit: rawUnit || "piece", recipeUnit: rawUnit || "piece", conversionFactor: 1 };
  }

  // Packs / Bundles / Trays / Boxes (แพ็ค, กล่อง, ถุง, กำ, มัด, แผง, ขวด, กระป๋อง)
  return { stockUnit: rawUnit || "pack", recipeUnit: rawUnit || "piece", conversionFactor: 1 };
}

/**
 * Extracts and prepares all unique procurement products (from all catalogs & live db)
 * and compares them against existing items in Master Items.
 */
export function getProcurementSyncCandidates(
  liveProducts: PurchaseProduct[] = [],
  existingItems: Item[] = [],
  categories: Category[] = [],
  suppliers: Supplier[] = [],
): SyncCandidateItem[] {
  // Combine all sources: live Firestore products + Real Vegetables catalog + Porto/Special + Initial fallback
  const allProds: PurchaseProduct[] = [
    ...liveProducts,
    ...REAL_VEGETABLE_PRODUCTS,
    ...ALL_PORTO_CENTRAL_AND_SPECIAL_PRODUCTS,
    ...INITIAL_PRODUCTS_A,
  ];

  // Group by canonical Master Code (or normalized Product Code)
  const groupedByCode = new Map<string, PurchaseProduct[]>();

  for (const p of allProds) {
    if (!p) continue;
    // Standardize masterCode e.g. "2B220159", "4B220169", "PORK-001"
    const rawCode = (p.masterCode || p.code || "").trim();
    if (!rawCode) continue;

    // Clean code (remove trailing supplier suffixes if masterCode wasn't explicitly set)
    let cleanCode = rawCode.toUpperCase();
    if (
      !p.masterCode &&
      (cleanCode.endsWith("-SS") || cleanCode.endsWith("-WF") || cleanCode.endsWith("-CT"))
    ) {
      cleanCode = cleanCode.slice(0, -3);
    }

    const list = groupedByCode.get(cleanCode) || [];
    list.push(p);
    groupedByCode.set(cleanCode, list);
  }

  // Build lookup maps for existing items
  const existingCodeMap = new Map<string, Item>();
  for (const it of existingItems) {
    if (it.code) {
      existingCodeMap.set(it.code.trim().toUpperCase(), it);
    }
  }

  const categoryNameMap = new Map<string, string>();
  for (const c of categories) {
    if (c.name) categoryNameMap.set(c.name.trim().toLowerCase(), c.id);
  }

  const supplierNameMap = new Map<string, string>();
  for (const s of suppliers) {
    if (s.name) {
      supplierNameMap.set(s.name.trim().toLowerCase(), s.id);
      supplierNameMap.set(s.code.trim().toLowerCase(), s.id);
    }
  }

  const candidates: SyncCandidateItem[] = [];

  for (const [code, prodList] of groupedByCode.entries()) {
    // Find representative product (prefer active or with price > 0)
    const primaryProd = prodList.find((p) => p.price > 0 && p.isActive !== false) || prodList[0];
    const name = primaryProd.name.trim();
    const categoryName = primaryProd.category?.trim() || "ผัก";

    // Find best/lowest price across suppliers
    const validPrices = prodList.filter((p) => p.price > 0).map((p) => p.price);
    const bestPrice = validPrices.length > 0 ? Math.min(...validPrices) : primaryProd.price || 0;

    // Derive units
    const { stockUnit, recipeUnit, conversionFactor } = deriveUnitsAndFactor(primaryProd.unit);

    // Map Category ID
    let categoryId = categoryNameMap.get(categoryName.toLowerCase());
    if (!categoryId) {
      // Fallback matching: e.g. "ผัก" or "วัตถุดิบสด" or "เนื้อสัตว์"
      for (const [catName, catId] of categoryNameMap.entries()) {
        if (
          catName.includes(categoryName.toLowerCase()) ||
          categoryName.toLowerCase().includes(catName)
        ) {
          categoryId = catId;
          break;
        }
      }
    }

    // Map Supplier ID
    let supplierId = supplierNameMap.get(primaryProd.supplierName?.toLowerCase() || "");
    if (!supplierId && prodList.length > 0) {
      for (const p of prodList) {
        const found = supplierNameMap.get(p.supplierName?.toLowerCase() || "");
        if (found) {
          supplierId = found;
          break;
        }
      }
    }

    const existing = existingCodeMap.get(code);

    candidates.push({
      code,
      name,
      categoryName,
      categoryId,
      supplierName: primaryProd.supplierName || "ระบบจัดซื้อ",
      supplierId,
      stockUnit,
      recipeUnit,
      conversionFactor,
      purchasePrice: bestPrice,
      itemType: "raw",
      minStock: 0,
      description: `นำเข้าอัตโนมัติจากระบบจัดซื้อ (ผักและวัตถุดิบสด)`,
      status: existing ? "exists" : "new",
      existingItem: existing,
      sourceSuppliers: prodList.map((p) => ({
        supplierName: p.supplierName,
        price: p.price,
        unit: p.unit,
      })),
    });
  }

  // Sort candidates: New items first, then alphabetical by name
  return candidates.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "new" ? -1 : 1;
    }
    return a.name.localeCompare(b.name, "th");
  });
}
