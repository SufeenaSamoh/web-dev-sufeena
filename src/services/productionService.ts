import { supabase } from "@/lib/supabase";
import {
  findMatchingMasterItems,
  findPrimaryMatchingMasterItem,
  getSupplierVariantLabel,
} from "@/lib/ingredientMatching";
import { consumeInventory } from "./inventoryLots";
import type {
  ProductionRecipe,
  ProductionRecipeIngredient,
  ProductionBatch,
  ProductionBatchConsumption,
  Item,
  StockTransaction,
} from "@/lib/types";
import { convertRecipeToStockUnit } from "@/lib/unitConversion";

const RECIPES_STORAGE_KEY = "hana-production-recipes-v1";
const BATCHES_STORAGE_KEY = "hana-production-batches-v1";

// Seed default production recipes for common prepared sauces if none exist
const DEFAULT_PRODUCTION_RECIPES: ProductionRecipe[] = [
  {
    id: "prod-rec-sauce-sweet",
    producedItemCode: "SAUCE-SWEET",
    yieldQuantity: 5,
    yieldUnit: "L",
    active: true,
    note: "สูตรซอสหวานสูตรมาตรฐานประจำครัวกลาง (Standard Sweet Sauce)",
    ingredients: [
      {
        id: "ing-1",
        ingredientCode: "SOY-SAUCE",
        ingredientName: "โชยุ (Soy Sauce)",
        quantity: 2.5,
        unit: "L",
      },
      {
        id: "ing-2",
        ingredientCode: "MIRIN",
        ingredientName: "มิริน (Mirin)",
        quantity: 1.5,
        unit: "L",
      },
      {
        id: "ing-3",
        ingredientCode: "SUGAR",
        ingredientName: "น้ำตาลทราย (Sugar)",
        quantity: 1200,
        unit: "g",
      },
    ],
  },
  {
    id: "prod-rec-sauce-spicy",
    producedItemCode: "SAUCE-SPICY",
    yieldQuantity: 3,
    yieldUnit: "L",
    active: true,
    note: "สูตรซอสเผ็ดสูตรฮานะ (Spicy Sauce)",
    ingredients: [
      {
        id: "ing-4",
        ingredientCode: "MAYO",
        ingredientName: "มายองเนสญี่ปุ่น (Japanese Mayo)",
        quantity: 2000,
        unit: "g",
      },
      {
        id: "ing-5",
        ingredientCode: "SRIRACHA",
        ingredientName: "ซอสพริกศรีราชา (Sriracha)",
        quantity: 800,
        unit: "g",
      },
      {
        id: "ing-6",
        ingredientCode: "TOGARASHI",
        ingredientName: "พริกป่นญี่ปุ่น (Togarashi)",
        quantity: 100,
        unit: "g",
      },
    ],
  },
];

/**
 * Load cached production recipes from localStorage
 */
export function loadCachedProductionRecipes(): ProductionRecipe[] {
  if (typeof window === "undefined") return DEFAULT_PRODUCTION_RECIPES;
  try {
    const raw = localStorage.getItem(RECIPES_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return DEFAULT_PRODUCTION_RECIPES;
}

/**
 * Save cached production recipes to localStorage
 */
export function saveCachedProductionRecipes(recipes: ProductionRecipe[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(recipes));
  } catch {
    // ignore
  }
}

/**
 * Load cached production batches from localStorage
 */
export function loadCachedProductionBatches(): ProductionBatch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BATCHES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Save cached production batches to localStorage
 */
export function saveCachedProductionBatches(batches: ProductionBatch[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BATCHES_STORAGE_KEY, JSON.stringify(batches));
  } catch {
    // ignore
  }
}

/**
 * Fetch all production recipes from Supabase with their ingredients
 */
export async function fetchProductionRecipesFromDB(): Promise<ProductionRecipe[]> {
  try {
    const { data: recipesData, error: recipesError } = await supabase
      .from("production_recipes")
      .select("*")
      .order("created_at", { ascending: false });

    if (recipesError) {
      console.warn("Failed to fetch production_recipes from DB, using cache:", recipesError);
      return loadCachedProductionRecipes();
    }

    if (!recipesData || recipesData.length === 0) {
      // If table is empty, seed defaults
      const cached = loadCachedProductionRecipes();
      return cached;
    }

    // Fetch ingredients
    const { data: ingData, error: ingError } = await supabase
      .from("production_recipe_ingredients")
      .select("*");

    if (ingError) {
      console.warn(
        "Failed to fetch production_recipe_ingredients, continuing with empty ing:",
        ingError,
      );
    }

    const ingredientsByRecipeId = new Map<string, ProductionRecipeIngredient[]>();
    (ingData || []).forEach((row: Record<string, unknown>) => {
      const recId = String(row.production_recipe_id);
      if (!ingredientsByRecipeId.has(recId)) {
        ingredientsByRecipeId.set(recId, []);
      }
      ingredientsByRecipeId.get(recId)!.push({
        id: String(row.id),
        productionRecipeId: String(row.production_recipe_id),
        ingredientCode: String(row.ingredient_code),
        ingredientName: String(row.ingredient_name),
        quantity: Number(row.quantity),
        unit: String(row.unit),
        createdAt: row.created_at ? String(row.created_at) : undefined,
      });
    });

    const result: ProductionRecipe[] = recipesData.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      producedItemCode: String(row.produced_item_code),
      yieldQuantity: Number(row.yield_quantity),
      yieldUnit: String(row.yield_unit),
      active: (row.active as boolean) ?? true,
      note: row.note ? String(row.note) : "",
      ingredients: ingredientsByRecipeId.get(String(row.id)) || [],
      createdAt: row.created_at ? String(row.created_at) : undefined,
      updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    }));

    saveCachedProductionRecipes(result);
    return result;
  } catch (err) {
    console.error("fetchProductionRecipes error:", err);
    return loadCachedProductionRecipes();
  }
}

/**
 * Detects if adding or updating a recipe introduces a circular dependency (Cycle Detection in BOM graph)
 * @param rootCode Produced item code (uppercase)
 * @param directIngredients Array of direct ingredient codes
 * @param recipeGraph Map of produced item code -> array of ingredient codes
 * @param nameMap Optional map of code -> item name for human-readable error messages
 */
export function detectBOMCycle(
  rootCode: string,
  directIngredients: string[],
  recipeGraph: Map<string, string[]>,
  nameMap?: Map<string, string>,
): { hasCycle: boolean; cyclePath: string[]; formattedChain: string } {
  const normRoot = rootCode.trim().toUpperCase();
  if (!normRoot) return { hasCycle: false, cyclePath: [], formattedChain: "" };

  const getName = (c: string) => {
    const norm = c.trim().toUpperCase();
    const name = nameMap?.get(norm);
    return name && name !== norm ? `${name} (${norm})` : norm;
  };

  // 1. Direct self-reference check (A -> A)
  for (const ing of directIngredients) {
    const normIng = ing.trim().toUpperCase();
    if (normIng === normRoot) {
      const cycle = [normRoot, normRoot];
      return {
        hasCycle: true,
        cyclePath: cycle,
        formattedChain: cycle.map(getName).join(" → "),
      };
    }
  }

  // 2. DFS traversal from each direct ingredient
  for (const ing of directIngredients) {
    const normIng = ing.trim().toUpperCase();

    const dfs = (
      current: string,
      currentPath: string[],
      visitedInBranch: Set<string>,
    ): string[] | null => {
      const normCurr = current.trim().toUpperCase();
      if (normCurr === normRoot) {
        return [...currentPath, normCurr];
      }
      if (visitedInBranch.has(normCurr)) {
        return null; // Stop branch to avoid infinite loop on unrelated cycles
      }

      visitedInBranch.add(normCurr);
      const subIngredients = recipeGraph.get(normCurr) || [];

      for (const next of subIngredients) {
        const normNext = next.trim().toUpperCase();
        const found = dfs(normNext, [...currentPath, normCurr], new Set(visitedInBranch));
        if (found) return found;
      }

      return null;
    };

    const cycle = dfs(normIng, [normRoot], new Set());
    if (cycle) {
      return {
        hasCycle: true,
        cyclePath: cycle,
        formattedChain: cycle.map(getName).join(" → "),
      };
    }
  }

  return { hasCycle: false, cyclePath: [], formattedChain: "" };
}

/**
 * Save or update a production recipe
 */
export async function saveProductionRecipeToDB(
  recipe: Partial<ProductionRecipe> & {
    producedItemCode: string;
    yieldQuantity: number;
    yieldUnit: string;
    ingredients: Omit<ProductionRecipeIngredient, "id">[];
  },
): Promise<{ success: boolean; data?: ProductionRecipe; error?: string }> {
  try {
    const normProducedCode = recipe.producedItemCode.trim().toUpperCase();

    // Circular Dependency Validation (Cycle Detection)
    const existingRecipes = await fetchProductionRecipesFromDB();
    const recipeGraph = new Map<string, string[]>();

    (existingRecipes || []).forEach((r) => {
      if (
        r?.producedItemCode &&
        (!recipe.id || r.id !== recipe.id) &&
        r.producedItemCode.toUpperCase() !== normProducedCode
      ) {
        recipeGraph.set(
          r.producedItemCode.toUpperCase(),
          (r.ingredients || []).map((i) => (i?.ingredientCode || "").toUpperCase()),
        );
      }
    });

    const safeRecipeIngs = recipe.ingredients || [];
    recipeGraph.set(
      normProducedCode,
      safeRecipeIngs.map((i) => (i?.ingredientCode || "").trim().toUpperCase()),
    );

    const cycleCheck = detectBOMCycle(
      normProducedCode,
      safeRecipeIngs.map((i) => i?.ingredientCode || ""),
      recipeGraph,
    );

    if (cycleCheck.hasCycle) {
      return {
        success: false,
        error: `ไม่สามารถบันทึกได้: พบการวนลูป ${cycleCheck.formattedChain}`,
      };
    }

    const isEdit = Boolean(recipe.id);
    const now = new Date().toISOString();
    const isUUID =
      typeof recipe.id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recipe.id);

    let recipeId = recipe.id || `local-rec-${Date.now()}`;

    // Try persisting to Supabase if table exists
    try {
      if (isEdit && isUUID) {
        const { error: updateErr } = await supabase
          .from("production_recipes")
          .update({
            produced_item_code: normProducedCode,
            yield_quantity: Number(recipe.yieldQuantity),
            yield_unit: recipe.yieldUnit.trim(),
            active: recipe.active ?? true,
            note: recipe.note ?? "",
            updated_at: now,
          })
          .eq("id", recipeId);

        if (!updateErr) {
          // Delete existing ingredients
          await supabase
            .from("production_recipe_ingredients")
            .delete()
            .eq("production_recipe_id", recipeId);

          if (recipe.ingredients && recipe.ingredients.length > 0) {
            const ingPayloads = recipe.ingredients.map((ing) => ({
              production_recipe_id: recipeId,
              ingredient_code: ing.ingredientCode.trim().toUpperCase(),
              ingredient_name: ing.ingredientName.trim(),
              quantity: Number(ing.quantity),
              unit: ing.unit.trim(),
            }));

            await supabase.from("production_recipe_ingredients").insert(ingPayloads);
          }
        } else {
          console.warn("DB update production_recipe warning (fallback to cache):", updateErr);
        }
      } else {
        const recipePayload = {
          ...(isUUID ? { id: recipe.id } : {}),
          produced_item_code: normProducedCode,
          yield_quantity: Number(recipe.yieldQuantity),
          yield_unit: recipe.yieldUnit.trim(),
          active: recipe.active ?? true,
          note: recipe.note ?? "",
          updated_at: now,
          created_at: now,
        };

        const { data: insertData, error: insertErr } = await supabase
          .from("production_recipes")
          .insert(recipePayload)
          .select("id")
          .single();

        if (!insertErr && insertData?.id) {
          recipeId = insertData.id;

          if (recipe.ingredients && recipe.ingredients.length > 0) {
            const ingPayloads = recipe.ingredients.map((ing) => ({
              production_recipe_id: recipeId,
              ingredient_code: ing.ingredientCode.trim().toUpperCase(),
              ingredient_name: ing.ingredientName.trim(),
              quantity: Number(ing.quantity),
              unit: ing.unit.trim(),
            }));

            await supabase.from("production_recipe_ingredients").insert(ingPayloads);
          }
        } else {
          console.warn("DB insert production_recipe warning (fallback to cache):", insertErr);
        }
      }
    } catch (dbErr) {
      console.warn(
        "Supabase production_recipes table unavailable, fallback to localStorage:",
        dbErr,
      );
    }

    const newIngredients: ProductionRecipeIngredient[] = (recipe.ingredients || []).map(
      (ing, idx) => ({
        ...ing,
        id: (ing as ProductionRecipeIngredient).id || `ing-${Date.now()}-${idx}`,
        productionRecipeId: recipeId,
      }),
    );

    const savedRecipe: ProductionRecipe = {
      id: recipeId,
      producedItemCode: normProducedCode,
      yieldQuantity: Number(recipe.yieldQuantity),
      yieldUnit: recipe.yieldUnit.trim(),
      active: recipe.active ?? true,
      note: recipe.note ?? "",
      ingredients: newIngredients,
      updatedAt: now,
      createdAt: recipe.createdAt || now,
    };

    // Update local cache
    const cached = loadCachedProductionRecipes();
    const nextList = cached.some((r) => r.id === recipeId)
      ? cached.map((r) => (r.id === recipeId ? savedRecipe : r))
      : [savedRecipe, ...cached];

    saveCachedProductionRecipes(nextList);

    return {
      success: true,
      data: savedRecipe,
    };
  } catch (err: unknown) {
    console.warn("saveProductionRecipe error:", err);
    // Fallback: save to localStorage
    const cached = loadCachedProductionRecipes();
    const id = recipe.id || `local-rec-${Date.now()}`;
    const newIngredients: ProductionRecipeIngredient[] = (recipe.ingredients || []).map(
      (ing, idx) => ({
        ...ing,
        id: (ing as ProductionRecipeIngredient).id || `ing-${Date.now()}-${idx}`,
        productionRecipeId: id,
      }),
    );
    const newRecipe: ProductionRecipe = {
      id,
      producedItemCode: recipe.producedItemCode,
      yieldQuantity: recipe.yieldQuantity,
      yieldUnit: recipe.yieldUnit,
      active: recipe.active ?? true,
      note: recipe.note ?? "",
      ingredients: newIngredients,
      updatedAt: new Date().toISOString(),
      createdAt: recipe.createdAt || new Date().toISOString(),
    };

    const nextList = cached.some((r) => r.id === id)
      ? cached.map((r) => (r.id === id ? newRecipe : r))
      : [newRecipe, ...cached];

    saveCachedProductionRecipes(nextList);
    return { success: true, data: newRecipe };
  }
}

/**
 * Delete a production recipe
 */
export async function deleteProductionRecipeFromDB(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const isUUID =
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  try {
    if (isUUID) {
      // 1. Delete associated ingredients first to prevent FK constraint issues
      await supabase.from("production_recipe_ingredients").delete().eq("production_recipe_id", id);

      // 2. Delete recipe
      const { error } = await supabase.from("production_recipes").delete().eq("id", id);
      if (error) {
        console.warn("DB delete error, continuing with cache:", error);
      }
    }
  } catch (err) {
    console.warn("deleteProductionRecipe error:", err);
  }

  const cached = loadCachedProductionRecipes();
  const nextList = cached.filter((r) => r.id !== id);
  saveCachedProductionRecipes(nextList);
  return { success: true };
}

/**
 * Toggle a production recipe active status
 */
export async function toggleProductionRecipeStatusInDB(
  id: string,
  active: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("production_recipes")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.warn("DB update status error, continuing with cache:", error);
    }
  } catch (err) {
    console.warn("toggleProductionRecipeStatus error:", err);
  }

  const cached = loadCachedProductionRecipes();
  const nextList = cached.map((r) => (r.id === id ? { ...r, active } : r));
  saveCachedProductionRecipes(nextList);
  return { success: true };
}

/**
 * Fetch all production batches and their consumptions
 */
export async function fetchProductionBatchesFromDB(): Promise<ProductionBatch[]> {
  try {
    const { data: batchData, error: batchError } = await supabase
      .from("production_batches")
      .select("*")
      .order("produced_at", { ascending: false });

    if (batchError) {
      console.warn("Failed to fetch production_batches from DB, using cache:", batchError);
      return loadCachedProductionBatches();
    }

    if (!batchData || batchData.length === 0) {
      return loadCachedProductionBatches();
    }

    const { data: consData, error: consError } = await supabase
      .from("production_batch_consumptions")
      .select("*");

    if (consError) {
      console.warn("Failed to fetch consumptions:", consError);
    }

    const consumptionsByBatchId = new Map<string, ProductionBatchConsumption[]>();
    (consData || []).forEach((row: Record<string, unknown>) => {
      const bId = String(row.production_batch_id);
      if (!consumptionsByBatchId.has(bId)) {
        consumptionsByBatchId.set(bId, []);
      }
      consumptionsByBatchId.get(bId)!.push({
        id: String(row.id),
        productionBatchId: String(row.production_batch_id),
        ingredientCode: String(row.ingredient_code),
        ingredientName: String(row.ingredient_name),
        quantityConsumed: Number(row.quantity_consumed),
        unit: String(row.unit),
        createdAt: row.created_at ? String(row.created_at) : undefined,
      });
    });

    const result: ProductionBatch[] = batchData.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      producedItemCode: String(row.produced_item_code),
      producedItemName: row.produced_item_name ? String(row.produced_item_name) : "",
      batchQuantity: Number(row.batch_quantity),
      yieldUnit: String(row.yield_unit),
      producedAt: String(row.produced_at),
      branchId: row.branch_id ? String(row.branch_id) : undefined,
      branchName: row.branch_name ? String(row.branch_name) : undefined,
      note: row.note ? String(row.note) : undefined,
      createdBy: String(row.created_by),
      createdAt: row.created_at ? String(row.created_at) : undefined,
      consumptions: consumptionsByBatchId.get(String(row.id)) || [],
    }));

    saveCachedProductionBatches(result);
    return result;
  } catch (err) {
    console.warn("fetchProductionBatches warning:", err);
    return loadCachedProductionBatches();
  }
}

export interface RecordProductionBatchParams {
  producedItemCode: string;
  batchQuantity: number;
  producedAt?: string;
  branchId?: string;
  branchName?: string;
  note?: string;
  createdBy?: string;
  items: Item[];
  productionRecipes: ProductionRecipe[];
  addTransactionFn: (t: Omit<StockTransaction, "id">) => Promise<void>;
  currentStockFn: (itemId: string, branchId?: string) => number;
}

/**
 * Execute business logic to record a production batch:
 * 1. Find production recipe
 * 2. Calculate proportional ingredient usage (batchQuantity / yieldQuantity)
 * 3. Check ingredient stock & collect warnings (allow record even if insufficient)
 * 4. Deduct ingredient stock (type: 'usage', quantity: -consumedQty)
 * 5. Add finished prepared item stock (type: 'adjustment', quantity: +batchQuantity)
 * 6. Save production_batches & production_batch_consumptions records
 */
export async function executeProductionBatch(
  params: RecordProductionBatchParams,
): Promise<{ success: boolean; batch?: ProductionBatch; warnings: string[]; error?: string }> {
  const {
    producedItemCode,
    batchQuantity,
    producedAt = new Date().toISOString(),
    branchId,
    branchName = "ครัวกลาง / สาขา",
    note = "",
    createdBy = "Staff",
    items,
    productionRecipes,
    addTransactionFn,
    currentStockFn,
  } = params;

  const warnings: string[] = [];

  // 1. Verify produced item
  const normCode = producedItemCode.trim().toUpperCase();
  const producedItem = items.find((i) => i.code.toUpperCase() === normCode);
  if (!producedItem) {
    return {
      success: false,
      warnings: [],
      error: `ไม่พบสินค้ากึ่งสำเร็จรูปรหัส ${normCode} ใน Master Items`,
    };
  }

  // 2. Verify recipe
  const recipe = productionRecipes.find(
    (r) => r.producedItemCode.toUpperCase() === normCode && r.active,
  );
  if (!recipe) {
    return {
      success: false,
      warnings: [],
      error: `ไม่พบสูตรผลิตที่เปิดใช้งานอยู่สำหรับรหัส ${normCode} (กรุณาสร้างสูตรผลิตก่อนทำการผลิต)`,
    };
  }

  if (recipe.yieldQuantity <= 0) {
    return {
      success: false,
      warnings: [],
      error: "สูตรผลิตระบุปริมาณผลผลิต (Yield Quantity) ไม่ถูกต้อง",
    };
  }

  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    return {
      success: false,
      warnings: [],
      error: "สูตรผลิตนี้ยังไม่มีรายการวัตถุดิบที่ต้องใช้",
    };
  }

  // 3. Calculate consumption scale
  const scaleRatio = batchQuantity / recipe.yieldQuantity;

  interface ConsumedLine {
    ingredientCode: string;
    ingredientName: string;
    item?: Item;
    matchingItems: Item[];
    rawQty: number;
    stockQtyToDeduct: number;
    unit: string;
    currentStock: number;
    isSufficient: boolean;
  }

  const plannedConsumptions: ConsumedLine[] = [];

  for (const ing of recipe.ingredients) {
    const ingCode = ing.ingredientCode.trim();
    const matchingItems = findMatchingMasterItems(ingCode, items);
    const ingItem = findPrimaryMatchingMasterItem(ingCode, items) || matchingItems[0];
    const neededRawQty = ing.quantity * scaleRatio;

    let stockQtyToDeduct = neededRawQty;
    // Check unit conversion if recipe unit differs from stock unit
    if (ingItem && ingItem.recipeUnit && ingItem.stockUnit && ingItem.conversionFactor) {
      if (ing.unit.toLowerCase() === ingItem.recipeUnit.toLowerCase()) {
        stockQtyToDeduct = convertRecipeToStockUnit(neededRawQty, ingItem);
      }
    }

    // Calculate aggregated stock across all supplier variants (e.g. 2B220159-SS + 2B220159-WF)
    const availableStock =
      matchingItems.length > 0
        ? matchingItems.reduce((acc, mItem) => acc + currentStockFn(mItem.id, branchId), 0)
        : ingItem
          ? currentStockFn(ingItem.id, branchId)
          : 0;

    const isSufficient = availableStock >= stockQtyToDeduct;

    if (!isSufficient) {
      const stockUnitDisplay = ingItem?.stockUnit || ingItem?.unit || ing.unit;
      const supplierNote =
        matchingItems.length > 1 ? ` (มี ${matchingItems.length} ซัพพลายเออร์รวมกัน)` : "";
      warnings.push(
        `วัตถุดิบ ${ing.ingredientName} (${ingCode}) ในสต็อกมี ${availableStock.toFixed(2)} ${stockUnitDisplay}${supplierNote} แต่ต้องใช้ ${stockQtyToDeduct.toFixed(2)} ${stockUnitDisplay} (สต็อกไม่พอ แต่บันทึกสำเร็จแล้ว)`,
      );
    }

    plannedConsumptions.push({
      ingredientCode: ingCode,
      ingredientName: ing.ingredientName,
      item: ingItem,
      matchingItems,
      rawQty: neededRawQty,
      stockQtyToDeduct,
      unit: ing.unit,
      currentStock: availableStock,
      isSufficient,
    });
  }

  // 4. Perform stock deductions for all ingredients using FIFO across suppliers
  for (const line of plannedConsumptions) {
    if (line.matchingItems.length > 0 || line.item) {
      const targetItem = line.item || line.matchingItems[0];

      // A. Consume from Supabase inventory_lots via FIFO/FEFO
      const lotConsumeRes = await consumeInventory(line.ingredientCode, line.stockQtyToDeduct, {
        branchId,
        allItems: items,
        remark: `ผลิต ${producedItem.name} [Batch: ${normCode}]`,
      });

      if (lotConsumeRes.lotsUsed.length > 0) {
        // Record specific transactions for each supplier lot consumed
        for (const lotUsage of lotConsumeRes.lotsUsed) {
          const itemForLot = items.find((i) => i.id === lotUsage.itemId) || targetItem;
          await addTransactionFn({
            itemId: lotUsage.itemId,
            type: "usage",
            quantity: -Math.abs(lotUsage.qty),
            date: producedAt,
            branchId,
            remark: `ตัดใช้วัตถุดิบ (FIFO Lot: ${lotUsage.lotNumber}${itemForLot ? ` [${itemForLot.code}]` : ""}) เพื่อผลิต ${producedItem.name} (${batchQuantity} ${recipe.yieldUnit}) [Batch: ${normCode}]`,
          });
        }
      }

      // If there was remaining quantity not covered by explicit inventory_lots, deduct from items in FIFO order
      const remainingUncoveredQty = line.stockQtyToDeduct - lotConsumeRes.consumedQty;
      if (remainingUncoveredQty > 0) {
        // Sort supplier variants with available stock
        let qtyToDeductRemaining = remainingUncoveredQty;
        const candidateItems = line.matchingItems.length > 0 ? line.matchingItems : [targetItem];

        for (const cItem of candidateItems) {
          if (qtyToDeductRemaining <= 0) break;
          const curStk = currentStockFn(cItem.id, branchId);
          const deductFromThis = curStk > 0 ? Math.min(curStk, qtyToDeductRemaining) : 0;

          if (deductFromThis > 0) {
            await addTransactionFn({
              itemId: cItem.id,
              type: "usage",
              quantity: -Math.abs(deductFromThis),
              date: producedAt,
              branchId,
              remark: `ตัดใช้วัตถุดิบ (FIFO ${cItem.code}) เพื่อผลิต ${producedItem.name} (${batchQuantity} ${recipe.yieldUnit}) [Batch: ${normCode}]`,
            });
            qtyToDeductRemaining -= deductFromThis;
          }
        }

        // If still remaining, deduct from primary item
        if (qtyToDeductRemaining > 0 && targetItem) {
          await addTransactionFn({
            itemId: targetItem.id,
            type: "usage",
            quantity: -Math.abs(qtyToDeductRemaining),
            date: producedAt,
            branchId,
            remark: `ตัดใช้วัตถุดิบเพื่อผลิต ${producedItem.name} (${batchQuantity} ${recipe.yieldUnit}) [Batch: ${normCode}]`,
          });
        }
      }
    }
  }

  // 5. Add finished product stock
  await addTransactionFn({
    itemId: producedItem.id,
    type: "adjustment",
    quantity: Math.abs(batchQuantity),
    date: producedAt,
    branchId,
    remark: `รับเข้าจากการผลิต ${producedItem.name} (+${batchQuantity} ${recipe.yieldUnit}) [Batch: ${normCode}]`,
  });

  // 6. Save batch record & consumptions to DB and local cache
  const batchId = `pb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const batchPayload = {
    produced_item_code: normCode,
    produced_item_name: producedItem.name,
    batch_quantity: batchQuantity,
    yield_unit: recipe.yieldUnit,
    produced_at: producedAt,
    branch_id: branchId || null,
    branch_name: branchName,
    note: note.trim(),
    created_by: createdBy,
  };

  let savedBatchId = batchId;

  try {
    const { data: bData, error: bErr } = await supabase
      .from("production_batches")
      .insert(batchPayload)
      .select("id")
      .single();

    if (!bErr && bData) {
      savedBatchId = bData.id;
    }

    if (savedBatchId) {
      const consumptionsPayload = plannedConsumptions.map((c) => ({
        production_batch_id: savedBatchId,
        ingredient_code: c.ingredientCode,
        ingredient_name: c.ingredientName,
        quantity_consumed: c.rawQty,
        unit: c.unit,
      }));

      await supabase.from("production_batch_consumptions").insert(consumptionsPayload);
    }
  } catch (dbErr) {
    console.warn("DB insert production_batch error, cached locally:", dbErr);
  }

  const newBatch: ProductionBatch = {
    id: savedBatchId,
    producedItemCode: normCode,
    producedItemName: producedItem.name,
    batchQuantity,
    yieldUnit: recipe.yieldUnit,
    producedAt,
    branchId,
    branchName,
    note,
    createdBy,
    createdAt: now,
    consumptions: plannedConsumptions.map((c, idx) => ({
      id: `cons-${Date.now()}-${idx}`,
      productionBatchId: savedBatchId,
      ingredientCode: c.ingredientCode,
      ingredientName: c.ingredientName,
      quantityConsumed: c.rawQty,
      unit: c.unit,
    })),
  };

  const cachedBatches = loadCachedProductionBatches();
  saveCachedProductionBatches([newBatch, ...cachedBatches]);

  return {
    success: true,
    batch: newBatch,
    warnings,
  };
}
