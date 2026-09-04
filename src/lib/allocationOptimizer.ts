import { PurchaseProduct, PurchaseSupplier } from "../features/purchase/types";

/**
 * รหัสสินค้าที่ล็อกซัพพลายเออร์เริ่มต้นเป็น ชินเซ็น (Shinsen - sup-5)
 * ตามข้อกำหนดเรื่องการควบคุมคุณภาพผักสด 5 รายการ:
 * 1. 2B220159 ใบโอบะ (10 ใบ/แพ็ค)
 * 2. 2B223151 อโวคาโด้นิวซีแลนด์ สุกพร้อมทาน
 * 3. 2B620666 รากบัวจีน
 * 4. 2B620679 กระเทียมจีนปอกเปลือก-คละไซส์
 * 5. 2B620667 ข้าวโพดหวานไม่ปอกเปลือก
 */
export const DEFAULT_LOCKED_SUPPLIER_MASTER_CODES: Record<string, string> = {
  "2B220159": "sup-5", // ใบโอบะ (10 ใบ/แพ็ค)
  "2B223151": "sup-5", // อโวคาโด้นิวซีแลนด์ สุกพร้อมทาน
  "2B620666": "sup-5", // รากบัวจีน
  "2B620679": "sup-5", // กระเทียมจีนปอกเปลือก-คละไซส์
  "2B620667": "sup-5", // ข้าวโพดหวานไม่ปอกเปลือก (ขนาด 300-350g/ฝัก)
};

/** One buyable option for a master (generic) product — a specific supplier's row for it. */
export interface SupplierOption {
  supplierId: string;
  supplierName: string;
  product: PurchaseProduct;
}

/** A generic product grouped across all suppliers that carry it (matched by Product.masterCode). */
export interface MasterProduct {
  masterCode: string;
  name: string;
  category: string;
  unit: string;
  options: SupplierOption[]; // sorted cheapest first (or with locked supplier prioritized)
  lockedSupplierId?: string;
}

/** What the branch typed in: "อยากได้ของนี้ เท่านี้" — no supplier chosen yet. */
export interface RequestedQty {
  masterCode: string;
  quantity: number;
}

export interface AutoAdjustmentLog {
  masterCode: string;
  productName: string;
  fromSupplierId: string;
  fromSupplierName: string;
  toSupplierId: string;
  toSupplierName: string;
  quantity: number;
  unit: string;
  priceBefore: number;
  priceAfter: number;
  costDiff: number; // (priceAfter - priceBefore) * quantity
  targetSupplierName: string;
  moveType?: "item_transfer" | "supplier_consolidation";
}

export interface FailedSupplierDeficit {
  supplierId: string;
  supplierName: string;
  currentAmount: number;
  minOrderAmount: number;
  deficit: number;
}

export interface AllocatedLineItem {
  masterCode: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  /** true if this item ended up with a supplier that could not reach its own minimum */
  isUnavoidableBelowMinimum?: boolean;
  /** true if this specific line item is only sold by this single supplier in the entire catalog */
  isExclusiveItem?: boolean;
  /** true if this item was locked to a specific supplier */
  isLockedSupplierItem?: boolean;
  /** true if item is locked to a supplier who doesn't have a truck arriving on that day */
  isLockedSupplierMismatchWarning?: boolean;
}

export interface SupplierAllocationResult {
  supplierId: string;
  supplierName: string;
  items: AllocatedLineItem[];
  subtotal: number;
  minOrderAmount: number;
  meetsMinimum: boolean;
  deficit?: number;
  /** true if all items in this supplier group cannot be bought elsewhere (exclusive or locked only) */
  isAllItemsUnavoidable?: boolean;
  /** true if supplier contains exclusive items but total subtotal still could not reach minimum threshold */
  isExclusiveBelowMinimumWarning?: boolean;
  /** true if this supplier already had a scheduled truck from a normal order */
  hasTruckScheduled?: boolean;
}

export interface AllocationResult {
  bySupplier: SupplierAllocationResult[];
  totalAmount: number;
  /** sum if every item were simply bought at its cheapest listed price, ignoring minimum-order constraints */
  naiveCheapestTotal: number;
  /** true if every supplier group in the allocation met its own minimum order amount */
  allMinimumsMet: boolean;
  /** true if there is at least one supplier below minimum that is NOT unavoidable (must block submission) */
  hasBlockingBelowMinimum?: boolean;
  /** Active mode used for allocation */
  orderMode: "normal" | "urgent";
  /** true if requested urgent mode but fell back to normal because no normal order was found */
  isFallbackToNormal?: boolean;
  /** Set of supplier IDs with trucks arriving on this delivery date */
  availableTruckSuppliers?: string[];
  /** Detailed log of automatic adjustments made to meet minimums */
  autoAdjustments: AutoAdjustmentLog[];
  /** true if auto-balancing was unable to satisfy minimums for all suppliers */
  autoBalanceFailed: boolean;
  /** List of suppliers that still fail minimum order requirements */
  failedSuppliers: FailedSupplierDeficit[];
}

export interface OptimizeAllocationOptions {
  orderMode?: "normal" | "urgent";
  /** Suppliers with scheduled trucks from existing normal orders on the delivery date */
  availableSupplierIds?: string[] | null;
}

/**
 * Helper to check if a branch matches Porto Chino (branch-5 / pin 0011 / BR-05)
 */
export function isPortoChinoBranch(
  branchOrId?: string | { id?: string; code?: string; pin?: string; name?: string },
): boolean {
  if (!branchOrId) return false;
  if (typeof branchOrId === "string") {
    const s = branchOrId.toLowerCase().trim();
    return (
      s === "branch-5" ||
      s === "br-05" ||
      s === "0011" ||
      s.includes("พอโต") ||
      s.includes("พอร์โต") ||
      s.includes("porto")
    );
  }
  const id = (branchOrId.id || "").toLowerCase();
  const code = (branchOrId.code || "").toLowerCase();
  const pin = (branchOrId.pin || "").toLowerCase();
  const name = (branchOrId.name || "").toLowerCase();
  return (
    id === "branch-5" ||
    code === "br-05" ||
    pin === "0011" ||
    name.includes("พอโต") ||
    name.includes("พอร์โต") ||
    name.includes("porto")
  );
}

/**
 * Check if a supplier is allowed for the given branch.
 * If supplier has availableBranchIds:
 *   - Must match currentBranchId or Porto Chino check if availableBranchIds contains Porto Chino.
 * If supplier has no availableBranchIds (or empty):
 *   - Available to ALL branches.
 */
export function isSupplierAllowedForBranch(
  supplier: PurchaseSupplier | undefined,
  currentBranchIdOrBranch?: string | { id?: string; code?: string; pin?: string; name?: string },
): boolean {
  if (!supplier) return true;
  if (!supplier.availableBranchIds || supplier.availableBranchIds.length === 0) {
    return true; // Available to all branches
  }
  if (!currentBranchIdOrBranch) {
    return false;
  }
  const branchId =
    typeof currentBranchIdOrBranch === "string"
      ? currentBranchIdOrBranch
      : currentBranchIdOrBranch.id;
  const isPorto = isPortoChinoBranch(currentBranchIdOrBranch);

  return supplier.availableBranchIds.some((bId) => {
    if (bId === branchId) return true;
    if (isPorto && (bId === "branch-5" || bId === "0011" || bId === "BR-05")) return true;
    return false;
  });
}

/**
 * Build the cross-supplier catalog: one entry per masterCode, with every supplier's price for it.
 * Filters supplier options according to branch scoping (e.g. Central is only available for Porto Chino).
 */
export function buildMasterCatalog(
  products: PurchaseProduct[],
  currentBranchIdOrBranch?: string | { id?: string; code?: string; pin?: string; name?: string },
  suppliers?: PurchaseSupplier[],
): MasterProduct[] {
  const supplierMap = suppliers ? new Map(suppliers.map((s) => [s.id, s])) : null;
  const isPorto = isPortoChinoBranch(currentBranchIdOrBranch);

  const groups = new Map<string, PurchaseProduct[]>();
  for (const p of products) {
    if (!p.masterCode) continue;
    if (p.isActive === false) continue;

    // Branch scoping filter:
    const sup = supplierMap?.get(p.supplierId);
    if (sup && sup.availableBranchIds && sup.availableBranchIds.length > 0) {
      if (!isSupplierAllowedForBranch(sup, currentBranchIdOrBranch)) {
        continue;
      }
    } else if (
      p.supplierId === "sup-7" ||
      p.supplierName?.includes("เซ็นทรัล") ||
      p.supplierName?.toLowerCase().includes("central")
    ) {
      // Fallback for Central (sup-7) in case suppliers list was not passed
      if (!isPorto) {
        continue;
      }
    }

    const list = groups.get(p.masterCode) || [];
    list.push(p);
    groups.set(p.masterCode, list);
  }

  const result: MasterProduct[] = [];
  for (const [masterCode, list] of groups.entries()) {
    // Check if any product has explicit lockedSupplierId or matches default map
    let lockedSupplierId: string | undefined = undefined;
    const explicitLock = list.find((p) => p.lockedSupplierId !== undefined)?.lockedSupplierId;
    if (explicitLock) {
      lockedSupplierId = explicitLock;
    } else if (explicitLock === "") {
      lockedSupplierId = undefined; // explicitly unlocked
    } else if (DEFAULT_LOCKED_SUPPLIER_MASTER_CODES[masterCode]) {
      lockedSupplierId = DEFAULT_LOCKED_SUPPLIER_MASTER_CODES[masterCode];
    }

    const options: SupplierOption[] = list
      .filter((p) => p.price > 0)
      .map((p) => ({ supplierId: p.supplierId, supplierName: p.supplierName, product: p }))
      .sort((a, b) => a.product.price - b.product.price);

    if (options.length === 0) continue;
    const first = options[0].product;
    result.push({
      masterCode,
      name: first.name,
      category: first.category,
      unit: first.unit,
      options,
      lockedSupplierId,
    });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, "th"));
}

/**
 * Smart Allocation Engine with Dual Modes:
 *
 * 1) NORMAL MODE (โหมดสั่งปกติ):
 *    - Respects lockedSupplierId for locked quality items.
 *    - Multi-pass optimization to ensure all suppliers meet minimum order thresholds (Shinsen ฿800, WFOOD ฿1,000).
 *    - Balances collapsing vs. filling with lowest cost penalty.
 *
 * 2) URGENT MODE (โหมดสั่งด่วน / ผักด่วน):
 *    - Restricted to available suppliers with trucks arriving on the delivery date.
 *    - If 1 supplier has a truck: forces all items to that 1 supplier.
 *    - If 2 suppliers have trucks: selects the cheapest option between the 2 suppliers for each item.
 *    - No minimum order requirement and no filling/collapsing (piggybacks on normal order truck).
 *    - If no normal order found for the date: fallbacks to normal mode (with minimums) to protect from no-truck deliveries.
 */
export function optimizeAllocation(
  requested: RequestedQty[],
  masterCatalog: MasterProduct[],
  suppliers: PurchaseSupplier[],
  options?: OptimizeAllocationOptions,
): AllocationResult {
  const orderMode = options?.orderMode || "normal";
  const availableSupplierIds = options?.availableSupplierIds;

  const catalogMap = new Map(masterCatalog.map((m) => [m.masterCode, m]));
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));

  type Assignment = {
    option: SupplierOption;
    quantity: number;
    isLocked?: boolean;
    isLockedMismatch?: boolean;
  };

  // Filter requested items with valid positive qty
  const validRequested = requested.filter((r) => r.quantity > 0 && catalogMap.has(r.masterCode));

  if (validRequested.length === 0) {
    return {
      bySupplier: [],
      totalAmount: 0,
      naiveCheapestTotal: 0,
      allMinimumsMet: true,
      hasBlockingBelowMinimum: false,
      orderMode,
      availableTruckSuppliers: availableSupplierIds || [],
      autoAdjustments: [],
      autoBalanceFailed: false,
      failedSuppliers: [],
    };
  }

  // Calculate naive cheapest total regardless of constraints
  let naiveCheapestTotal = 0;
  for (const req of validRequested) {
    const master = catalogMap.get(req.masterCode)!;
    const cheapest = master.options[0];
    naiveCheapestTotal += cheapest.product.price * req.quantity;
  }

  // Identify exclusive items across the whole cart
  const isItemExclusiveToSupplier = (masterCode: string, supplierId: string): boolean => {
    const master = catalogMap.get(masterCode);
    if (!master || master.options.length === 0) return false;
    const activeOptions = master.options.filter((o) => o.product.price > 0);
    return activeOptions.length === 1 && activeOptions[0].supplierId === supplierId;
  };

  // =========================================================================
  // CASE 1: URGENT MODE with available trucks on delivery date
  // =========================================================================
  if (orderMode === "urgent" && availableSupplierIds && availableSupplierIds.length > 0) {
    const assignment = new Map<string, Assignment>();
    const truckSet = new Set(availableSupplierIds);

    for (const req of validRequested) {
      const master = catalogMap.get(req.masterCode)!;
      const lockedSid = master.lockedSupplierId;

      // 1. If item has locked supplier
      if (lockedSid) {
        const lockedOpt = master.options.find(
          (o) => o.supplierId === lockedSid && o.product.price > 0,
        );
        if (lockedOpt) {
          const isMismatch = !truckSet.has(lockedSid);
          assignment.set(req.masterCode, {
            option: lockedOpt,
            quantity: req.quantity,
            isLocked: true,
            isLockedMismatch: isMismatch,
          });
          continue;
        }
      }

      // 2. Filter options to only suppliers who have a truck arriving
      const truckOptions = master.options
        .filter((o) => truckSet.has(o.supplierId) && o.product.price > 0)
        .sort((a, b) => a.product.price - b.product.price);

      if (truckOptions.length > 0) {
        // Pick cheapest among suppliers with trucks
        assignment.set(req.masterCode, {
          option: truckOptions[0],
          quantity: req.quantity,
        });
      } else {
        // If no truck supplier sells this item, fallback to overall cheapest (exclusive item)
        const cheapestOpt = master.options[0];
        assignment.set(req.masterCode, {
          option: cheapestOpt,
          quantity: req.quantity,
        });
      }
    }

    // Build urgent result without minimum enforcement
    const bySupplierMap = new Map<string, SupplierAllocationResult>();
    for (const [masterCode, a] of assignment.entries()) {
      const sid = a.option.supplierId;
      const sup = supplierMap.get(sid);
      const minOrderAmount = sup?.minOrderAmount || 0;

      if (!bySupplierMap.has(sid)) {
        bySupplierMap.set(sid, {
          supplierId: sid,
          supplierName: a.option.supplierName,
          items: [],
          subtotal: 0,
          minOrderAmount,
          meetsMinimum: true, // In urgent mode, truck is already arriving so minimum is met
          hasTruckScheduled: truckSet.has(sid),
        });
      }

      const group = bySupplierMap.get(sid)!;
      const lineTotal = a.option.product.price * a.quantity;
      const isExclusive = isItemExclusiveToSupplier(masterCode, sid);

      group.items.push({
        masterCode,
        supplierId: sid,
        supplierName: a.option.supplierName,
        productId: a.option.product.id,
        productCode: a.option.product.code,
        productName: a.option.product.name,
        unit: a.option.product.unit,
        quantity: a.quantity,
        unitPrice: a.option.product.price,
        totalPrice: lineTotal,
        isExclusiveItem: isExclusive,
        isLockedSupplierItem: a.isLocked,
        isLockedSupplierMismatchWarning: a.isLockedMismatch,
      });
      group.subtotal += lineTotal;
    }

    const bySupplier = Array.from(bySupplierMap.values()).map((g) => ({
      ...g,
      items: g.items.sort((a, b) => a.productName.localeCompare(b.productName, "th")),
    }));

    const totalAmount = bySupplier.reduce((sum, g) => sum + g.subtotal, 0);

    return {
      bySupplier: bySupplier.sort((a, b) => a.supplierName.localeCompare(b.supplierName, "th")),
      totalAmount,
      naiveCheapestTotal,
      allMinimumsMet: true,
      hasBlockingBelowMinimum: false,
      orderMode: "urgent",
      isFallbackToNormal: false,
      availableTruckSuppliers: availableSupplierIds,
      autoAdjustments: [],
      autoBalanceFailed: false,
      failedSuppliers: [],
    };
  }

  // =========================================================================
  // CASE 2: NORMAL MODE (or Urgent fallback when no normal order exists)
  // =========================================================================
  const isFallbackToNormal =
    orderMode === "urgent" && (!availableSupplierIds || availableSupplierIds.length === 0);

  const assignment = new Map<string, Assignment>();

  // STEP 1 — Initial allocation:
  // 1. Items with lockedSupplierId are assigned to that locked supplier (isLocked: true) - Hard constraint
  // 2. All other items are assigned independently to the cheapest supplier that offers the item
  for (const req of validRequested) {
    const master = catalogMap.get(req.masterCode)!;
    const lockedSid = master.lockedSupplierId;
    let chosen = master.options[0];

    if (lockedSid) {
      const lockedOpt = master.options.find(
        (o) => o.supplierId === lockedSid && o.product.price > 0,
      );
      if (lockedOpt) {
        chosen = lockedOpt;
        assignment.set(req.masterCode, { option: chosen, quantity: req.quantity, isLocked: true });
        continue;
      }
    }

    assignment.set(req.masterCode, { option: chosen, quantity: req.quantity });
  }

  // Keep an immutable snapshot of initial assignment for reporting auto-adjustments
  const initialAssignmentSnapshot = new Map<string, Assignment>();
  for (const [m, a] of assignment.entries()) {
    initialAssignmentSnapshot.set(m, { ...a });
  }

  const computeSubtotals = (currAssignment: Map<string, Assignment>) => {
    const subtotals = new Map<string, number>();
    for (const a of currAssignment.values()) {
      const sid = a.option.supplierId;
      subtotals.set(sid, (subtotals.get(sid) || 0) + a.option.product.price * a.quantity);
    }
    return subtotals;
  };

  // Helper to identify troubled suppliers (active and below minimum)
  const getTroubledSuppliers = (currAssignment: Map<string, Assignment>) => {
    const subtotals = computeSubtotals(currAssignment);
    const troubled: {
      supplierId: string;
      supplierName: string;
      subtotal: number;
      minAmt: number;
      deficit: number;
      hasLocked: boolean;
    }[] = [];

    for (const [sid, subtotal] of subtotals.entries()) {
      if (subtotal <= 0) continue;
      const sup = supplierMap.get(sid);
      const minAmt = sup?.minOrderAmount || 0;
      if (subtotal < minAmt) {
        const hasLocked = Array.from(currAssignment.values()).some(
          (a) => a.option.supplierId === sid && a.isLocked,
        );
        troubled.push({
          supplierId: sid,
          supplierName: sup?.name || sid,
          subtotal,
          minAmt,
          deficit: minAmt - subtotal,
          hasLocked,
        });
      }
    }
    return troubled;
  };

  // STEP 2 — Auto-Balancing Loop
  // Check if any active supplier is below minimum
  let troubledList = getTroubledSuppliers(assignment);

  if (troubledList.length > 0) {
    let iterations = 0;
    const maxIterations = 25;
    const visitedSignatures = new Set<string>();

    while (iterations++ < maxIterations) {
      const sig = Array.from(assignment.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([m, a]) => `${m}:${a.option.supplierId}`)
        .join("|");

      if (visitedSignatures.has(sig)) break;
      visitedSignatures.add(sig);

      troubledList = getTroubledSuppliers(assignment);
      if (troubledList.length === 0) break;

      // 2.a Priority: If cart contains Locked Supplier items for a supplier,
      // that supplier MUST be fixed to meet its minimum first before other suppliers!
      troubledList.sort((a, b) => {
        if (a.hasLocked && !b.hasLocked) return -1;
        if (!a.hasLocked && b.hasLocked) return 1;
        return a.deficit - b.deficit; // Smallest deficit first
      });

      let madeProgress = false;

      for (const target of troubledList) {
        const targetSid = target.supplierId;
        const currentSubtotals = computeSubtotals(assignment);
        const targetCurrentSubtotal = currentSubtotals.get(targetSid) || 0;
        if (targetCurrentSubtotal >= target.minAmt) continue;

        // 2.b & 2.c: Find candidate items in cart not locked and available at target supplier
        interface TransferCandidate {
          masterCode: string;
          sourceSid: string;
          targetOption: SupplierOption;
          currentOption: SupplierOption;
          quantity: number;
          costDiff: number;
          gainAtTarget: number;
          lossAtSource: number;
        }

        const candidates: TransferCandidate[] = [];

        for (const [masterCode, a] of assignment.entries()) {
          if (a.option.supplierId === targetSid) continue;
          if (a.isLocked) continue; // Hard constraint: NEVER move locked items

          const master = catalogMap.get(masterCode);
          if (!master) continue;

          const targetOpt = master.options.find(
            (o) => o.supplierId === targetSid && o.product.price > 0,
          );
          if (!targetOpt) continue;

          const priceAtTarget = targetOpt.product.price;
          const priceAtSource = a.option.product.price;
          const costDiff = (priceAtTarget - priceAtSource) * a.quantity;
          const gainAtTarget = priceAtTarget * a.quantity;
          const lossAtSource = priceAtSource * a.quantity;

          // 2.d Simulation Check:
          // Check if moving this item out causes source supplier S to drop below its minimum.
          const sourceSid = a.option.supplierId;
          const sourceSubtotal = currentSubtotals.get(sourceSid) || 0;
          const newSourceSubtotal = sourceSubtotal - lossAtSource;
          const sourceMinAmt = supplierMap.get(sourceSid)?.minOrderAmount || 0;

          // If new source subtotal is > 0 and < sourceMinAmt, it breaks the source! Reject.
          if (newSourceSubtotal > 0 && newSourceSubtotal < sourceMinAmt) {
            continue; // Disqualified: causes source supplier to fall below minimum
          }

          candidates.push({
            masterCode,
            sourceSid,
            targetOption: targetOpt,
            currentOption: a.option,
            quantity: a.quantity,
            costDiff,
            gainAtTarget,
            lossAtSource,
          });
        }

        // 2.e: Sort candidates by lowest cost difference first (making overall order cheapest)
        candidates.sort((a, b) => a.costDiff - b.costDiff);

        if (candidates.length > 0) {
          let runningTargetSubtotal = targetCurrentSubtotal;
          for (const cand of candidates) {
            assignment.set(cand.masterCode, {
              option: cand.targetOption,
              quantity: cand.quantity,
            });
            runningTargetSubtotal += cand.gainAtTarget;
            madeProgress = true;
            if (runningTargetSubtotal >= target.minAmt) {
              break; // Target fulfilled!
            }
          }

          if (madeProgress) break; // Re-evaluate in next iteration
        }

        // 2.f: Escalate to "รวมซัพฯ" (Consolidation) if item-by-item was not enough
        const afterStepSubtotals = computeSubtotals(assignment);
        const afterTargetSubtotal = afterStepSubtotals.get(targetSid) || 0;

        if (afterTargetSubtotal < target.minAmt) {
          // Move all non-locked items available at target to target regardless of cost
          const allConsolidateCandidates: {
            masterCode: string;
            targetOpt: SupplierOption;
            qty: number;
          }[] = [];

          for (const [masterCode, a] of assignment.entries()) {
            if (a.option.supplierId === targetSid) continue;
            if (a.isLocked) continue; // Hard constraint: NEVER move locked items

            const master = catalogMap.get(masterCode);
            if (!master) continue;

            const targetOpt = master.options.find(
              (o) => o.supplierId === targetSid && o.product.price > 0,
            );
            if (targetOpt) {
              allConsolidateCandidates.push({
                masterCode,
                targetOpt,
                qty: a.quantity,
              });
            }
          }

          if (allConsolidateCandidates.length > 0) {
            for (const item of allConsolidateCandidates) {
              assignment.set(item.masterCode, {
                option: item.targetOpt,
                quantity: item.qty,
              });
            }
            madeProgress = true;
            break;
          }
        }
      }

      if (madeProgress) continue;

      // Handle troubled suppliers that have NO locked items and cannot meet minimum:
      // Check if all their items can be moved to another active supplier
      const purelyFlexibleTroubled = troubledList.filter((t) => !t.hasLocked);
      for (const target of purelyFlexibleTroubled) {
        const targetSid = target.supplierId;
        const otherActiveSuppliers = Array.from(supplierMap.keys()).filter((s) => s !== targetSid);

        let collapsed = false;
        for (const otherSid of otherActiveSuppliers) {
          const itemsAtTarget = Array.from(assignment.entries()).filter(
            ([, a]) => a.option.supplierId === targetSid,
          );
          if (itemsAtTarget.length === 0) continue;

          let canAllMove = true;
          const moves: { masterCode: string; opt: SupplierOption; qty: number }[] = [];

          for (const [masterCode, a] of itemsAtTarget) {
            const master = catalogMap.get(masterCode);
            const otherOpt = master?.options.find(
              (o) => o.supplierId === otherSid && o.product.price > 0,
            );
            if (!otherOpt) {
              canAllMove = false;
              break;
            }
            moves.push({ masterCode, opt: otherOpt, qty: a.quantity });
          }

          if (canAllMove && moves.length > 0) {
            for (const m of moves) {
              assignment.set(m.masterCode, {
                option: m.opt,
                quantity: m.qty,
              });
            }
            madeProgress = true;
            collapsed = true;
            break;
          }
        }
        if (collapsed) break;
      }

      if (!madeProgress) break;
    }
  }

  // STEP 3 — Build Detailed Auto-Adjustment Logs (Requirement 3)
  const autoAdjustments: AutoAdjustmentLog[] = [];
  for (const [masterCode, finalAssn] of assignment.entries()) {
    const initAssn = initialAssignmentSnapshot.get(masterCode);
    if (!initAssn) continue;

    if (finalAssn.option.supplierId !== initAssn.option.supplierId) {
      const priceBefore = initAssn.option.product.price;
      const priceAfter = finalAssn.option.product.price;
      const costDiff = (priceAfter - priceBefore) * finalAssn.quantity;
      const master = catalogMap.get(masterCode);

      autoAdjustments.push({
        masterCode,
        productName: master?.name || finalAssn.option.product.name,
        fromSupplierId: initAssn.option.supplierId,
        fromSupplierName: initAssn.option.supplierName,
        toSupplierId: finalAssn.option.supplierId,
        toSupplierName: finalAssn.option.supplierName,
        quantity: finalAssn.quantity,
        unit: finalAssn.option.product.unit,
        priceBefore,
        priceAfter,
        costDiff,
        targetSupplierName: finalAssn.option.supplierName,
        moveType: "item_transfer",
      });
    }
  }

  // STEP 4 — Build Final Supplier Allocations and Validate Minimums
  const bySupplierMap = new Map<string, SupplierAllocationResult>();
  for (const [masterCode, a] of assignment.entries()) {
    const sid = a.option.supplierId;
    const sup = supplierMap.get(sid);
    const minOrderAmount = sup?.minOrderAmount || 0;
    if (!bySupplierMap.has(sid)) {
      bySupplierMap.set(sid, {
        supplierId: sid,
        supplierName: a.option.supplierName,
        items: [],
        subtotal: 0,
        minOrderAmount,
        meetsMinimum: true,
      });
    }
    const group = bySupplierMap.get(sid)!;
    const lineTotal = a.option.product.price * a.quantity;
    const isExclusive = isItemExclusiveToSupplier(masterCode, sid);

    group.items.push({
      masterCode,
      supplierId: sid,
      supplierName: a.option.supplierName,
      productId: a.option.product.id,
      productCode: a.option.product.code,
      productName: a.option.product.name,
      unit: a.option.product.unit,
      quantity: a.quantity,
      unitPrice: a.option.product.price,
      totalPrice: lineTotal,
      isExclusiveItem: isExclusive,
      isLockedSupplierItem: a.isLocked,
    });
    group.subtotal += lineTotal;
  }

  const bySupplier = Array.from(bySupplierMap.values()).map((g) => {
    const meetsMinimum = g.subtotal >= g.minOrderAmount;
    const deficit = Math.max(0, g.minOrderAmount - g.subtotal);

    // Tag line items
    g.items = g.items.map((it) => ({
      ...it,
      isUnavoidableBelowMinimum:
        !meetsMinimum && (it.isLockedSupplierItem === true || it.isExclusiveItem === true),
    }));

    const isAllItemsUnavoidable =
      !meetsMinimum &&
      g.items.length > 0 &&
      g.items.every((it) => it.isLockedSupplierItem || it.isExclusiveItem);

    const hasExclusiveItem = g.items.some((it) => it.isExclusiveItem || it.isLockedSupplierItem);
    const isExclusiveBelowMinimumWarning = !meetsMinimum && hasExclusiveItem;

    return {
      ...g,
      meetsMinimum,
      deficit,
      isAllItemsUnavoidable,
      isExclusiveBelowMinimumWarning,
      items: g.items.sort((a, b) => a.productName.localeCompare(b.productName, "th")),
    };
  });

  const totalAmount = bySupplier.reduce((sum, g) => sum + g.subtotal, 0);
  const allMinimumsMet = bySupplier.every((g) => g.meetsMinimum);

  // Requirement 4: Final verification and blocking
  // In normal mode, if any supplier is below minimum, submission is BLOCKED.
  const hasBlockingBelowMinimum = orderMode === "normal" && !allMinimumsMet;
  const autoBalanceFailed = orderMode === "normal" && !allMinimumsMet;

  const failedSuppliers: FailedSupplierDeficit[] = bySupplier
    .filter((g) => !g.meetsMinimum)
    .map((g) => ({
      supplierId: g.supplierId,
      supplierName: g.supplierName,
      currentAmount: g.subtotal,
      minOrderAmount: g.minOrderAmount,
      deficit: g.deficit || Math.max(0, g.minOrderAmount - g.subtotal),
    }));

  return {
    bySupplier: bySupplier.sort((a, b) => a.supplierName.localeCompare(b.supplierName, "th")),
    totalAmount,
    naiveCheapestTotal,
    allMinimumsMet,
    hasBlockingBelowMinimum,
    orderMode: isFallbackToNormal ? "urgent" : "normal",
    isFallbackToNormal,
    availableTruckSuppliers: availableSupplierIds || [],
    autoAdjustments,
    autoBalanceFailed,
    failedSuppliers,
  };
}
