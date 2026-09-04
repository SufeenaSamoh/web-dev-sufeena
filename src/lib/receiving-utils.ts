import type { Item, Purchase, VatMode } from "./types";

export { type VatMode };

/**
 * Thai UI Labels for VAT modes (strictly for display).
 * Internal values remain "INCLUDED", "EXCLUDED", "NONE".
 */
export const VAT_MODE_LABELS: Record<VatMode, string> = {
  INCLUDED: "V (รวม Vat)",
  EXCLUDED: "V (แยก Vat)",
  NONE: "N (ไม่มี Vat)",
};

export const VAT_MODE_OPTIONS: { value: VatMode; label: string; description: string }[] = [
  {
    value: "INCLUDED",
    label: "V (รวม Vat)",
    description: "ราคาต่อหน่วยรวม VAT 7% แล้ว",
  },
  {
    value: "EXCLUDED",
    label: "V (แยก Vat)",
    description: "ราคาต่อหน่วยยังไม่รวม VAT (+VAT 7%)",
  },
  {
    value: "NONE",
    label: "N (ไม่มี Vat)",
    description: "สินค้ายกเว้นภาษี / ไม่คิด VAT",
  },
];

/**
 * Normalizes legacy or current VAT mode into standard VatMode enum.
 */
export function normalizeVatMode(mode?: string | null): VatMode {
  if (!mode) return "INCLUDED";
  if (mode === "EXCLUDED") return "EXCLUDED";
  if (mode === "NONE" || mode === "N") return "NONE";
  return "INCLUDED"; // "INCLUDED" or "V" or default
}

export interface VatCalculationResult {
  unitPrice: number; // The entered price per unit
  quantity: number;
  netUnitPrice: number; // Unit price before VAT
  vatUnitPrice: number; // VAT amount per unit
  grossUnitPrice: number; // Unit price after VAT
  netTotal: number; // มูลค่าก่อน VAT = quantity * netUnitPrice
  vatTotal: number; // VAT = quantity * vatUnitPrice (or grossTotal - netTotal)
  grossTotal: number; // มูลค่ารวม = quantity * grossUnitPrice
}

/**
 * Calculates VAT financial breakdown according to Thai standard:
 *
 * 1) INCLUDED - "V (รวม Vat)":
 *    Entered unit price includes 7% VAT.
 *    Net Price = Unit Price / 1.07
 *    VAT Amount = Gross Total - Net Total
 *    Gross Total = quantity * Unit Price
 *
 * 2) EXCLUDED - "V (แยก Vat)":
 *    Entered unit price excludes VAT.
 *    Net Price = Unit Price
 *    VAT Amount = Net Total * 7%
 *    Gross Total = Net Total + VAT Amount
 *
 * 3) NONE - "N (ไม่มี Vat)":
 *    Entered unit price has no VAT.
 *    Net Total = quantity * Unit Price
 *    VAT Amount = 0
 *    Gross Total = Net Total
 */
export function calculateItemVat(
  enteredPrice: number,
  quantity: number,
  rawVatMode: VatMode | "V" | "N" | string = "INCLUDED",
  vatRate: number = 0.07,
): VatCalculationResult {
  const price = isNaN(enteredPrice) || enteredPrice < 0 ? 0 : enteredPrice;
  const qty = isNaN(quantity) || quantity < 0 ? 0 : quantity;
  const mode = normalizeVatMode(rawVatMode);

  if (mode === "INCLUDED") {
    // Price includes VAT
    const grossTotal = Number((price * qty).toFixed(2));
    const netTotal = Number((grossTotal / (1 + vatRate)).toFixed(2));
    const vatTotal = Number((grossTotal - netTotal).toFixed(2));
    const netUnitPrice = qty > 0 ? Number((netTotal / qty).toFixed(4)) : price / (1 + vatRate);
    const vatUnitPrice = qty > 0 ? Number((vatTotal / qty).toFixed(4)) : price - netUnitPrice;
    return {
      unitPrice: price,
      quantity: qty,
      netUnitPrice,
      vatUnitPrice,
      grossUnitPrice: price,
      netTotal,
      vatTotal,
      grossTotal,
    };
  } else if (mode === "EXCLUDED") {
    // Price excludes VAT (Add 7%)
    const netTotal = Number((price * qty).toFixed(2));
    const vatTotal = Number((netTotal * vatRate).toFixed(2));
    const grossTotal = Number((netTotal + vatTotal).toFixed(2));
    const grossUnitPrice = Number((price * (1 + vatRate)).toFixed(4));
    return {
      unitPrice: price,
      quantity: qty,
      netUnitPrice: price,
      vatUnitPrice: Number((price * vatRate).toFixed(4)),
      grossUnitPrice,
      netTotal,
      vatTotal,
      grossTotal,
    };
  } else {
    // NONE - No VAT
    const netTotal = Number((price * qty).toFixed(2));
    return {
      unitPrice: price,
      quantity: qty,
      netUnitPrice: price,
      vatUnitPrice: 0,
      grossUnitPrice: price,
      netTotal,
      vatTotal: 0,
      grossTotal: netTotal,
    };
  }
}

/**
 * Calculates final gross cost per unit for legacy compatibility.
 */
export function calculateFinalCost(
  enteredCost: number,
  vatType: VatMode | "V" | "N" | string = "INCLUDED",
): number {
  if (isNaN(enteredCost) || enteredCost < 0) return 0;
  const mode = normalizeVatMode(vatType);
  if (mode === "EXCLUDED") {
    return Number((enteredCost * 1.07).toFixed(2));
  }
  return Number(enteredCost.toFixed(2));
}

/**
 * Helper to check if a category or item name represents Packaging or Consumables.
 */
export function isPackagingOrConsumable(text?: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return (
    t.includes("บรรจุภัณฑ์") ||
    t.includes("packaging") ||
    t.includes("วัสดุสิ้นเปลือง") ||
    t.includes("consumable") ||
    t.includes("ภาชนะ") ||
    t.includes("ถุง") ||
    t.includes("กล่อง") ||
    t.includes("แก้ว") ||
    t.includes("ฝา") ||
    t.includes("หลอด") ||
    t.includes("vacuum") ||
    t.includes("cup") ||
    t.includes("box") ||
    t.includes("bag")
  );
}

/**
 * Calculates the auto expiry date based on Receiving Date + Shelf Life & Unit.
 * Example: Receiving '2026-08-01', Shelf Life 1, Unit 'Year' => '2027-08-01'.
 */
export function calculateExpiryDate(
  receivingDateStr: string,
  shelfLife: number,
  unit: "Day" | "Month" | "Year" = "Day",
): string {
  if (!receivingDateStr || !shelfLife || shelfLife <= 0) return "";
  const date = new Date(receivingDateStr);
  if (isNaN(date.getTime())) return "";

  if (unit === "Year") {
    date.setFullYear(date.getFullYear() + shelfLife);
  } else if (unit === "Month") {
    date.setMonth(date.getMonth() + shelfLife);
  } else {
    // Day
    date.setDate(date.getDate() + shelfLife);
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Gets default unit purchase cost using priority:
 * 1. Latest Purchase Price (from previous purchases)
 * 2. Default Cost from Master Item
 * 3. 0.00
 */
export function getDefaultPurchaseCost(
  itemId: string,
  purchases: Purchase[],
  itemMasterCost?: number,
): number {
  if (!itemId) return 0;

  // Search purchases newest first for this item
  const sortedPurchases = [...purchases].sort(
    (a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime(),
  );

  for (const p of sortedPurchases) {
    const match = p.items.find((it) => it.itemId === itemId && it.unitPrice != null);
    if (match && match.unitPrice > 0) {
      return match.unitPrice;
    }
  }

  if (itemMasterCost && itemMasterCost > 0) {
    return itemMasterCost;
  }

  return 0;
}

/**
 * Auto-generates Lot Code for receiving item.
 */
export function generateLotCode(itemCode: string, receivingDateStr: string): string {
  const datePart = receivingDateStr.replace(/-/g, "").slice(2); // YYMMDD
  const codePart = (itemCode || "ITEM")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6);
  return `LOT-${codePart}-${datePart}`;
}
