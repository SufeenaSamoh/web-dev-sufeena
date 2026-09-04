import React, { useState, useMemo, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { formatDateTime } from "@/lib/dateFormat";
import { ProductionRecipe, ProductionRecipeIngredient, Item } from "@/lib/types";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import { detectBOMCycle } from "@/services/productionService";
import { ProductionRecipeSummaryView } from "./ProductionRecipeSummaryView";
import {
  CookingPot,
  Plus,
  Search,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronRight,
  Power,
  Flame,
  Layers,
  Sparkles,
  RefreshCw,
  Upload,
  Download,
  FileSpreadsheet,
  Check,
  AlertCircle,
  LayoutList,
  LayoutGrid,
  Clock,
  ArrowUpDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

export interface ParsedProductionRecipeGroup {
  rawProducedCode: string;
  producedItemName: string;
  yieldQuantity: number;
  yieldUnit: string;
  active: boolean;
  resolvedItemCode: string;
  itemStatus: "existing" | "will_create" | "will_convert" | "conflict" | "error";
  statusMessage: string;
  errors: string[];
  ingredients: {
    rowNum: number;
    ingredientCode: string;
    ingredientName: string;
    quantity: number;
    unit: string;
    isValid: boolean;
    error?: string;
  }[];
}

type RecipeSortOption =
  "date_desc" | "date_asc" | "code_asc" | "code_desc" | "name_asc" | "ings_desc";

export function ProductionRecipesPage() {
  const {
    productionRecipes,
    items,
    addItem,
    updateItem,
    addProductionRecipe,
    updateProductionRecipe,
    deleteProductionRecipe,
    toggleProductionRecipeStatus,
    refreshProductionData,
  } = useStore();

  // Read URL search param if present (e.g. from MasterItemsPage shortcut)
  const initialSearch = useMemo(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("search") || "";
    }
    return "";
  }, []);

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<RecipeSortOption>("date_desc");
  const [expandedRecipes, setExpandedRecipes] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"summary" | "cards">("summary");

  // Sync initialSearch if URL changes
  useEffect(() => {
    if (initialSearch) {
      setSearchQuery(initialSearch);
    }
  }, [initialSearch]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<ProductionRecipe | null>(null);

  // Form State
  const [formItemCode, setFormItemCode] = useState("");
  const [formYieldQty, setFormYieldQty] = useState("1");
  const [formYieldUnit, setFormYieldUnit] = useState("L");
  const [formNote, setFormNote] = useState("");
  const [formActive, setFormActive] = useState(true);

  // Form Ingredients List
  interface FormIngredientRow {
    tempId: string;
    ingredientCode: string;
    ingredientName: string;
    quantity: string;
    unit: string;
  }
  const [formIngredients, setFormIngredients] = useState<FormIngredientRow[]>([]);

  // Excel Bulk Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [rawSheetRows, setRawSheetRows] = useState<Record<string, unknown>[]>([]);
  const [autoCreateMode, setAutoCreateMode] = useState<"auto_code" | "file_code">("auto_code");
  const [expandedImportGroups, setExpandedImportGroups] = useState<Record<number, boolean>>({});
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Item Lookup Map
  const itemMap = useMemo(() => {
    const map = new Map<string, Item>();
    (items || []).forEach((it) => {
      if (it?.code) {
        map.set(it.code.toUpperCase(), it);
      }
    });
    return map;
  }, [items]);

  // Prepared items (for produced item dropdown)
  const preparedItems = useMemo(() => {
    return (items || []).filter(
      (it) =>
        it &&
        (it.itemType === "prepared" ||
          it.code?.startsWith("SAUCE") ||
          it.category?.toLowerCase().includes("ซอส")),
    );
  }, [items]);

  // Filtered & Sorted recipes
  const filteredRecipes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = (productionRecipes || []).filter((rec) => {
      if (!rec) return false;
      const pCode = rec.producedItemCode || "";
      const pItem = itemMap.get(pCode.toUpperCase());
      const pName = pItem ? pItem.name.toLowerCase() : "";
      const ings = rec.ingredients || [];
      const matchesSearch =
        !q ||
        pCode.toLowerCase().includes(q) ||
        pName.includes(q) ||
        (rec.note && rec.note.toLowerCase().includes(q)) ||
        ings.some(
          (ing) =>
            (ing?.ingredientCode && ing.ingredientCode.toLowerCase().includes(q)) ||
            (ing?.ingredientName && ing.ingredientName.toLowerCase().includes(q)),
        );

      const matchesStatus =
        activeFilter === "all" ||
        (activeFilter === "active" && rec.active) ||
        (activeFilter === "inactive" && !rec.active);

      return matchesSearch && matchesStatus;
    });

    // Apply sorting
    return list.sort((a, b) => {
      if (sortBy === "date_desc") {
        const timeA = a.updatedAt || a.createdAt || "";
        const timeB = b.updatedAt || b.createdAt || "";
        return timeB.localeCompare(timeA);
      }
      if (sortBy === "date_asc") {
        const timeA = a.updatedAt || a.createdAt || "";
        const timeB = b.updatedAt || b.createdAt || "";
        return timeA.localeCompare(timeB);
      }
      if (sortBy === "code_asc") {
        return (a.producedItemCode || "").localeCompare(b.producedItemCode || "");
      }
      if (sortBy === "code_desc") {
        return (b.producedItemCode || "").localeCompare(a.producedItemCode || "");
      }
      if (sortBy === "name_asc") {
        const nameA =
          itemMap.get((a.producedItemCode || "").toUpperCase())?.name || a.producedItemCode || "";
        const nameB =
          itemMap.get((b.producedItemCode || "").toUpperCase())?.name || b.producedItemCode || "";
        return nameA.localeCompare(nameB, "th");
      }
      if (sortBy === "ings_desc") {
        return (b.ingredients || []).length - (a.ingredients || []).length;
      }
      return 0;
    });
  }, [productionRecipes, searchQuery, activeFilter, itemMap, sortBy]);

  // Parse Excel Rows into Production Recipe Groups (with forward-fill and dependency graph cycle detection)
  const parsedImportGroups = useMemo<ParsedProductionRecipeGroup[]>(() => {
    if (!rawSheetRows || rawSheetRows.length === 0) return [];

    const existingCodes = new Set<string>(items.map((i) => i.code.toUpperCase()));
    let nextAutoCodeIndex = 1;

    const generateNextCode = (prefix = "PRP") => {
      while (true) {
        const candidate = `${prefix}-${String(nextAutoCodeIndex).padStart(4, "0")}`;
        nextAutoCodeIndex++;
        if (!existingCodes.has(candidate.toUpperCase())) {
          existingCodes.add(candidate.toUpperCase());
          return candidate;
        }
      }
    };

    const groups: ParsedProductionRecipeGroup[] = [];
    let currentGroup: ParsedProductionRecipeGroup | null = null;

    let lastProducedCode = "";
    let lastProducedName = "";
    let lastYieldQty = 1;
    let lastYieldUnit = "L";
    let lastActive = true;

    rawSheetRows.forEach((row, idx) => {
      const rowNum = idx + 2;

      // Extract raw column values with flexible headers
      const rawProdCode = String(
        row["Produced Item Code"] ||
          row["Produced Code"] ||
          row["รหัสสินค้าที่ผลิต"] ||
          row["รหัสซอส"] ||
          row["Item Code"] ||
          "",
      ).trim();

      const rawProdName = String(
        row["Produced Item Name"] ||
          row["Produced Name"] ||
          row["ชื่อสินค้าที่ผลิต"] ||
          row["ชื่อซอส"] ||
          row["Item Name"] ||
          "",
      ).trim();

      const rawYieldQtyVal =
        row["Yield Quantity"] ?? row["Yield Qty"] ?? row["ปริมาณผลผลิต"] ?? row["Yield"];
      const rawYieldUnitVal = String(
        row["Yield Unit"] ?? row["หน่วยผลผลิต"] ?? row["หน่วย Yield"] ?? "",
      ).trim();

      const rawIngCode = String(
        row["Ingredient Code"] || row["Ingr Code"] || row["รหัสวัตถุดิบ"] || row["Raw Code"] || "",
      ).trim();

      const rawIngName = String(
        row["Ingredient Name"] || row["Ingr Name"] || row["ชื่อวัตถุดิบ"] || row["Raw Name"] || "",
      ).trim();

      const rawQtyVal = row["Quantity"] ?? row["Qty"] ?? row["ปริมาณ"] ?? row["จำนวน"];
      const rawUnitVal = String(row["Unit"] || row["หน่วย"] || "").trim();

      const rawActiveVal = String(row["Active"] || row["สถานะ"] || "Y")
        .trim()
        .toUpperCase();
      const rowActive =
        rawActiveVal === "Y" ||
        rawActiveVal === "TRUE" ||
        rawActiveVal === "1" ||
        rawActiveVal === "ACTIVE";

      // Detect if this row starts a new Produced Item Group
      const isNewGroup =
        (rawProdCode && rawProdCode !== lastProducedCode) ||
        (rawProdName && rawProdName !== lastProducedName && !rawProdCode && !lastProducedCode) ||
        groups.length === 0;

      if (isNewGroup && (rawProdCode || rawProdName)) {
        lastProducedCode = rawProdCode;
        lastProducedName = rawProdName || rawProdCode;
        lastYieldQty = parseFloat(String(rawYieldQtyVal)) || 1;
        lastYieldUnit = rawYieldUnitVal || "L";
        lastActive = rowActive;

        // Resolve item status and code
        let resolvedCode = rawProdCode;
        let itemStatus: "existing" | "will_create" | "will_convert" | "conflict" | "error" =
          "existing";
        let statusMessage = "มีอยู่แล้ว (จับคู่ปกติ)";
        const groupErrors: string[] = [];

        if (!lastProducedName) {
          groupErrors.push("กรุณาระบุชื่อสินค้าที่ผลิต (Produced Item Name)");
        }
        if (lastYieldQty <= 0) {
          groupErrors.push("ปริมาณผลผลิต (Yield Quantity) ต้องมากกว่า 0");
        }
        if (!lastYieldUnit) {
          groupErrors.push("กรุณาระบุหน่วยผลผลิต (Yield Unit)");
        }

        const matchInMaster = rawProdCode ? itemMap.get(rawProdCode.toUpperCase()) : undefined;

        if (matchInMaster) {
          if (matchInMaster.itemType === "prepared") {
            itemStatus = "existing";
            statusMessage = "มีอยู่แล้วใน Master Items (ประเภท Prepared)";
            resolvedCode = matchInMaster.code;
          } else {
            // Can convert from raw (or other types) to 'prepared'
            itemStatus = "will_convert";
            statusMessage =
              "รหัสนี้มีอยู่แล้วใน Master Items เป็นวัตถุดิบดิบ (Raw) — ระบบจะแปลงเป็นประเภท 'วัตถุดิบเตรียม (Prepared)' ให้อัตโนมัติ สต็อกคงเหลือปัจจุบันจะไม่เปลี่ยนแปลง";
            resolvedCode = matchInMaster.code;
          }
        } else {
          // Not found in Master Items
          if (autoCreateMode === "auto_code") {
            const autoCode = generateNextCode("PRP");
            resolvedCode = autoCode;
            itemStatus = "will_create";
            statusMessage = `จะสร้างรหัสใหม่อัตโนมัติใน Master Items: ${autoCode} (Prepared)`;
          } else {
            // file_code mode
            if (rawProdCode) {
              resolvedCode = rawProdCode;
              itemStatus = "will_create";
              statusMessage = `จะสร้างรายการใหม่ใน Master Items ด้วยรหัส: ${rawProdCode} (Prepared)`;
            } else {
              itemStatus = "error";
              statusMessage = "ไม่มีรหัสสินค้า และไม่ได้เปิดโหมดสร้างรหัสอัตโนมัติ";
              groupErrors.push(statusMessage);
            }
          }
        }

        currentGroup = {
          rawProducedCode: rawProdCode,
          producedItemName: lastProducedName,
          yieldQuantity: lastYieldQty,
          yieldUnit: lastYieldUnit,
          active: lastActive,
          resolvedItemCode: resolvedCode,
          itemStatus,
          statusMessage,
          errors: groupErrors,
          ingredients: [],
        };
        groups.push(currentGroup);
      }

      // Add ingredient to current group
      if (currentGroup && (rawIngCode || rawIngName)) {
        const qty = parseFloat(String(rawQtyVal));
        const ingMatch = rawIngCode ? itemMap.get(rawIngCode.toUpperCase()) : undefined;

        let isValid = true;
        let errorMsg: string | undefined;

        if (!rawIngCode) {
          isValid = false;
          errorMsg = "ไม่ระบุรหัสวัตถุดิบ (Ingredient Code)";
        } else if (!ingMatch) {
          isValid = false;
          errorMsg = `ไม่พบรหัสวัตถุดิบ "${rawIngCode}" ใน Master Items (ไม่อนุญาตให้ auto-create วัตถุดิบดิบ)`;
        } else if (isNaN(qty) || qty <= 0) {
          isValid = false;
          errorMsg = "ปริมาณวัตถุดิบต้องมากกว่า 0";
        } else if (!rawUnitVal) {
          isValid = false;
          errorMsg = "ไม่ระบุหน่วยของวัตถุดิบ";
        }

        currentGroup.ingredients.push({
          rowNum,
          ingredientCode: rawIngCode,
          ingredientName: rawIngName || (ingMatch ? ingMatch.name : rawIngCode),
          quantity: isNaN(qty) ? 0 : qty,
          unit: rawUnitVal || (ingMatch ? ingMatch.recipeUnit || ingMatch.unit : "g"),
          isValid,
          error: errorMsg,
        });
      }
    });

    // Multi-level BOM Cycle Detection: Build dependency graph from existing recipes + import sheet groups
    const recipeGraph = new Map<string, string[]>();

    // 1. Existing recipes in database
    (productionRecipes || []).forEach((rec) => {
      if (rec?.producedItemCode) {
        recipeGraph.set(
          rec.producedItemCode.toUpperCase(),
          (rec.ingredients || []).map((ing) => (ing?.ingredientCode || "").toUpperCase()),
        );
      }
    });

    // 2. Override/add groups from current import sheet
    groups.forEach((grp) => {
      if (grp.resolvedItemCode) {
        recipeGraph.set(
          grp.resolvedItemCode.toUpperCase(),
          (grp.ingredients || []).map((ing) => (ing?.ingredientCode || "").toUpperCase()),
        );
      }
    });

    // 3. Name lookup for informative cycle chain display
    const nameMap = new Map<string, string>();
    (items || []).forEach((it) => {
      if (it?.code) {
        nameMap.set(it.code.toUpperCase(), it.name || it.code);
      }
    });
    groups.forEach((grp) => {
      if (grp.resolvedItemCode && grp.producedItemName) {
        nameMap.set(grp.resolvedItemCode.toUpperCase(), grp.producedItemName);
      }
    });

    // 4. Check for cycles for every group
    groups.forEach((grp) => {
      if (!grp.resolvedItemCode) return;
      const directIngs = (grp.ingredients || []).map((ing) => ing?.ingredientCode || "");
      const cycleCheck = detectBOMCycle(grp.resolvedItemCode, directIngs, recipeGraph, nameMap);

      if (cycleCheck.hasCycle) {
        grp.itemStatus = "conflict";
        const cycleErrMsg = `ไม่สามารถบันทึกได้: พบการวนลูป ${cycleCheck.formattedChain}`;
        grp.statusMessage = cycleErrMsg;
        grp.errors.push(cycleErrMsg);
      }
    });

    return groups;
  }, [rawSheetRows, items, itemMap, autoCreateMode, productionRecipes]);

  // Import Validation Statistics
  const importStats = useMemo(() => {
    const totalGroups = parsedImportGroups.length;
    let totalIngredients = 0;
    let validGroups = 0;
    let invalidGroups = 0;
    let willCreateItemsCount = 0;
    let willConvertItemsCount = 0;
    let existingItemsCount = 0;

    parsedImportGroups.forEach((grp) => {
      totalIngredients += grp.ingredients.length;
      const hasIngredientErrors =
        grp.ingredients.length === 0 || grp.ingredients.some((ing) => !ing.isValid);
      const isGroupValid =
        grp.errors.length === 0 &&
        (grp.itemStatus === "existing" ||
          grp.itemStatus === "will_create" ||
          grp.itemStatus === "will_convert") &&
        !hasIngredientErrors;

      if (isGroupValid) {
        validGroups++;
      } else {
        invalidGroups++;
      }

      if (grp.itemStatus === "will_create") {
        willCreateItemsCount++;
      } else if (grp.itemStatus === "will_convert") {
        willConvertItemsCount++;
      } else if (grp.itemStatus === "existing") {
        existingItemsCount++;
      }
    });

    return {
      totalGroups,
      totalIngredients,
      validGroups,
      invalidGroups,
      willCreateItemsCount,
      willConvertItemsCount,
      existingItemsCount,
    };
  }, [parsedImportGroups]);

  // Download Excel Template
  const downloadTemplate = () => {
    const sampleIng1 = items[0]?.code || "SOY-SAUCE";
    const sampleIngName1 = items[0]?.name || "ซีอิ๊วญี่ปุ่น (ตัวอย่าง)";
    const sampleIng2 = items[1]?.code || "SUGAR-01";
    const sampleIngName2 = items[1]?.name || "น้ำตาลทราย (ตัวอย่าง)";
    const sampleIng3 = items[2]?.code || "MIRIN-01";
    const sampleIngName3 = items[2]?.name || "มิริน (ตัวอย่าง)";

    const sampleData = [
      {
        "Produced Item Code": "SAUCE-SWEET",
        "Produced Item Name": "ซอสหวานฮานะ (ตัวอย่าง)",
        "Yield Quantity": 5,
        "Yield Unit": "L",
        "Ingredient Code": sampleIng1,
        "Ingredient Name": sampleIngName1,
        Quantity: 3,
        Unit: "L",
        Active: "Y",
      },
      {
        "Produced Item Code": "", // Blank for next ingredient of same product (Forward-fill)
        "Produced Item Name": "",
        "Yield Quantity": "",
        "Yield Unit": "",
        "Ingredient Code": sampleIng2,
        "Ingredient Name": sampleIngName2,
        Quantity: 1.5,
        Unit: "kg",
        Active: "Y",
      },
      {
        "Produced Item Code": "",
        "Produced Item Name": "",
        "Yield Quantity": "",
        "Yield Unit": "",
        "Ingredient Code": sampleIng3,
        "Ingredient Name": sampleIngName3,
        Quantity: 0.5,
        Unit: "L",
        Active: "Y",
      },
      {
        "Produced Item Code": "",
        "Produced Item Name": "ซอสสไปซี่มาโยฮานะ (ตัวอย่างสินค้าใหม่)",
        "Yield Quantity": 2,
        "Yield Unit": "kg",
        "Ingredient Code": sampleIng2,
        "Ingredient Name": sampleIngName2,
        Quantity: 0.2,
        Unit: "kg",
        Active: "Y",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    worksheet["!cols"] = [
      { wch: 22 }, // Produced Item Code
      { wch: 36 }, // Produced Item Name
      { wch: 15 }, // Yield Quantity
      { wch: 12 }, // Yield Unit
      { wch: 20 }, // Ingredient Code
      { wch: 32 }, // Ingredient Name
      { wch: 12 }, // Quantity
      { wch: 12 }, // Unit
      { wch: 10 }, // Active
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Production_Recipes");
    XLSX.writeFile(workbook, "Production_Recipe_Template.xlsx");
    toast.success("ดาวน์โหลดไฟล์แม่แบบสูตรผลิตเรียบร้อยแล้ว");
  };

  // Handle Excel File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: "",
        });

        if (!rawJson || rawJson.length === 0) {
          toast.error("ไม่พบข้อมูลในไฟล์ Excel ที่เลือก");
          return;
        }

        setRawSheetRows(rawJson);
        setIsImportModalOpen(true);
        toast.info(`อ่านข้อมูลสำเร็จ ${rawJson.length} บรรทัด กำลังเตรียมการตรวจสอบข้อมูล...`);
      } catch (err: unknown) {
        console.error("Excel parse error:", err);
        toast.error("เกิดข้อผิดพลาดในการอ่านไฟล์ Excel กรุณาตรวจสอบรูปแบบไฟล์");
      }
    };

    reader.readAsBinaryString(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Confirm Import
  const handleConfirmImport = async () => {
    if (parsedImportGroups.length === 0) {
      toast.error("ไม่มีข้อมูลที่จะนำเข้า");
      return;
    }

    const validGroups = parsedImportGroups.filter((grp) => {
      const hasIngredientErrors =
        grp.ingredients.length === 0 || grp.ingredients.some((ing) => !ing.isValid);
      return (
        grp.errors.length === 0 &&
        (grp.itemStatus === "existing" ||
          grp.itemStatus === "will_create" ||
          grp.itemStatus === "will_convert") &&
        !hasIngredientErrors
      );
    });

    if (validGroups.length === 0) {
      toast.error("ไม่พบรายการสูตรผลิตที่ผ่านการตรวจสอบ กรุณาตรวจสอบข้อผิดพลาด");
      return;
    }

    setIsImporting(true);
    let createdItemsCount = 0;
    let convertedItemsCount = 0;
    let savedRecipesCount = 0;
    let failedCount = 0;

    try {
      for (const group of validGroups) {
        let targetCode = group.resolvedItemCode;

        // Step 1: Auto-convert existing item to prepared if needed
        if (group.itemStatus === "will_convert") {
          const existingItem = items.find((i) => i.code.toUpperCase() === targetCode.toUpperCase());
          if (existingItem) {
            const updateRes = await updateItem(existingItem.id, { itemType: "prepared" });
            if (updateRes.success) {
              convertedItemsCount++;
            } else {
              console.error(`Failed to convert item ${targetCode} to prepared:`, updateRes.error);
              failedCount++;
              continue; // Skip recipe if item update failed
            }
          }
        } else if (group.itemStatus === "will_create") {
          // Auto-create Master Item
          const itemRes = await addItem({
            code: targetCode,
            name: group.producedItemName,
            categoryId: "",
            supplierId: "",
            unit: group.yieldUnit || "unit",
            stockUnit: group.yieldUnit || "unit",
            recipeUnit: group.yieldUnit || "unit",
            conversionFactor: 1,
            itemType: "prepared",
            minStock: 0,
            purchasePrice: 0,
            active: true,
            description: `สินค้ากึ่งสำเร็จรูปสร้างอัตโนมัติจากการนำเข้าสูตรผลิต (${formatDateTime(new Date())})`,
          });

          if (itemRes.success) {
            createdItemsCount++;
            if (itemRes.item) {
              targetCode = itemRes.item.code;
            }
          } else {
            console.error(`Failed to auto-create item ${targetCode}:`, itemRes.error);
            failedCount++;
            continue; // Skip recipe if item creation failed
          }
        }

        // Step 2: Create or update production recipe
        const payload = {
          producedItemCode: targetCode.toUpperCase(),
          yieldQuantity: group.yieldQuantity,
          yieldUnit: group.yieldUnit,
          active: group.active,
          note: "นำเข้าจากไฟล์ Excel",
          ingredients: group.ingredients.map((ing) => ({
            ingredientCode: ing.ingredientCode.toUpperCase(),
            ingredientName: ing.ingredientName,
            quantity: ing.quantity,
            unit: ing.unit,
          })),
        };

        // Check if recipe already exists for this produced item
        const existingRecipe = productionRecipes.find(
          (r) => r.producedItemCode.toUpperCase() === targetCode.toUpperCase(),
        );

        if (existingRecipe) {
          const updateRes = await updateProductionRecipe(existingRecipe.id, payload);
          if (updateRes.success) {
            savedRecipesCount++;
          } else {
            failedCount++;
          }
        } else {
          const addRes = await addProductionRecipe(payload);
          if (addRes.success) {
            savedRecipesCount++;
          } else {
            failedCount++;
          }
        }
      }

      toast.success(
        `นำเข้าสูตรผลิตสำเร็จ ${savedRecipesCount} สูตร (แปลงเป็น Prepared ${convertedItemsCount} รายการ, สร้างใหม่ ${createdItemsCount} รายการ)${
          failedCount > 0 ? ` [พบข้อผิดพลาด ${failedCount} รายการ]` : ""
        }`,
      );

      setIsImportModalOpen(false);
      setRawSheetRows([]);
      setImportFileName("");
      refreshProductionData();
    } catch (err: unknown) {
      console.error("Confirm import error:", err);
      toast.error("เกิดข้อผิดพลาดในการนำเข้าข้อมูล");
    } finally {
      setIsImporting(false);
    }
  };

  // Export Failed Production BOMs to Excel
  const handleExportFailedBOMs = () => {
    const failedGroups = parsedImportGroups.filter((grp) => {
      const hasIngredientErrors =
        grp.ingredients.length === 0 || grp.ingredients.some((ing) => !ing.isValid);
      return (
        grp.errors.length > 0 ||
        (grp.itemStatus !== "existing" &&
          grp.itemStatus !== "will_create" &&
          grp.itemStatus !== "will_convert") ||
        hasIngredientErrors
      );
    });

    if (failedGroups.length === 0) {
      toast.info("ไม่พบสูตรผลิตที่มีข้อผิดพลาด ทุกสูตรผลิตผ่านการตรวจสอบสมบูรณ์");
      return;
    }

    const exportRows = failedGroups.flatMap((grp) =>
      (grp.ingredients || []).map((ing) => ({
        "Produced Item Code": grp.resolvedItemCode,
        "Produced Item Name": grp.producedItemName,
        "Yield Quantity": grp.yieldQuantity,
        "Yield Unit": grp.yieldUnit,
        "Ingredient Code": ing.ingredientCode,
        "Ingredient Name": ing.ingredientName,
        Quantity: ing.quantity,
        Unit: ing.unit,
        Active: grp.active ? "Y" : "N",
        สถานะสูตร: "ไม่ผ่านการตรวจสอบ (ไม่ถูกนำเข้า)",
        ข้อผิดพลาดในรายการนี้: ing.error ? ing.error : "— (แถวนี้ถูกต้อง)",
        สรุปสาเหตุที่สูตรผลิตนี้ไม่ผ่าน: (grp.errors || [])
          .concat(
            (grp.ingredients || [])
              .filter((i) => !i.isValid && i.error)
              .map((i) => `[${i.ingredientCode}] ${i.error}`),
          )
          .join(" | "),
      })),
    );

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet["!cols"] = [
      { wch: 22 }, // Produced Item Code
      { wch: 32 }, // Produced Item Name
      { wch: 14 }, // Yield Quantity
      { wch: 12 }, // Yield Unit
      { wch: 20 }, // Ingredient Code
      { wch: 28 }, // Ingredient Name
      { wch: 12 }, // Quantity
      { wch: 10 }, // Unit
      { wch: 8 }, // Active
      { wch: 35 }, // สถานะสูตร
      { wch: 40 }, // ข้อผิดพลาดในรายการนี้
      { wch: 55 }, // สรุปสาเหตุที่สูตรผลิตนี้ไม่ผ่าน
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Failed_BOM_Recipes");
    const fileName = `Failed_Production_BOMs_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast.success(
      `Export สูตรผลิตที่ไม่ผ่านจำนวน ${failedGroups.length} สูตร (${exportRows.length} รายการ) เรียบร้อยแล้ว`,
    );
  };

  // Toggle Recipe Accordion
  const toggleExpand = (id: string) => {
    setExpandedRecipes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleExpandImportGroup = (idx: number) => {
    setExpandedImportGroups((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingRecipe(null);
    setFormItemCode(preparedItems[0]?.code || "");
    setFormYieldQty("1");
    setFormYieldUnit(preparedItems[0]?.unit || preparedItems[0]?.stockUnit || "L");
    setFormNote("");
    setFormActive(true);
    setFormIngredients([
      {
        tempId: `tmp-${Date.now()}-1`,
        ingredientCode: "",
        ingredientName: "",
        quantity: "1",
        unit: "g",
      },
    ]);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (rec: ProductionRecipe) => {
    setEditingRecipe(rec);
    setFormItemCode(rec.producedItemCode);
    setFormYieldQty(String(rec.yieldQuantity));
    setFormYieldUnit(rec.yieldUnit);
    setFormNote(rec.note || "");
    setFormActive(rec.active);
    setFormIngredients(
      (rec.ingredients || []).map((ing, idx) => ({
        tempId: `tmp-${Date.now()}-${idx}`,
        ingredientCode: ing.ingredientCode,
        ingredientName: ing.ingredientName,
        quantity: String(ing.quantity),
        unit: ing.unit,
      })),
    );
    setIsModalOpen(true);
  };

  // Add ingredient row in form
  const handleAddIngredientRow = () => {
    setFormIngredients((prev) => [
      ...prev,
      {
        tempId: `tmp-${Date.now()}-${prev.length}`,
        ingredientCode: "",
        ingredientName: "",
        quantity: "1",
        unit: "g",
      },
    ]);
  };

  // Update ingredient row
  const handleUpdateIngredientRow = (
    tempId: string,
    field: keyof FormIngredientRow,
    val: string,
  ) => {
    setFormIngredients((prev) =>
      prev.map((row) => {
        if (row.tempId !== tempId) return row;
        const updated = { ...row, [field]: val };
        // Auto-fill ingredientName and default unit when ingredientCode changes
        if (field === "ingredientCode") {
          const selected = (items || []).find(
            (i) => i && i.code?.toUpperCase() === val.toUpperCase(),
          );
          if (selected) {
            updated.ingredientName = selected.name;
            updated.unit = selected.recipeUnit || selected.unit || selected.stockUnit || "g";
          }
        }
        return updated;
      }),
    );
  };

  // Remove ingredient row
  const handleRemoveIngredientRow = (tempId: string) => {
    if (formIngredients.length <= 1) {
      toast.warning("สูตรผลิตต้องมีวัตถุดิบอย่างน้อย 1 รายการ");
      return;
    }
    setFormIngredients((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  // Save recipe
  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formItemCode) {
      toast.error("กรุณาเลือกรหัสสินค้ากึ่งสำเร็จรูป");
      return;
    }

    const yQty = Number(formYieldQty);
    if (!yQty || yQty <= 0) {
      toast.error("ปริมาณผลผลิต (Yield) ต้องมากกว่า 0");
      return;
    }

    // Validate ingredients
    const validIngredients: Omit<ProductionRecipeIngredient, "id">[] = [];
    for (let i = 0; i < formIngredients.length; i++) {
      const row = formIngredients[i];
      if (!row.ingredientCode) {
        toast.error(`กรุณาระบุวัตถุดิบลำดับที่ ${i + 1}`);
        return;
      }
      const qty = Number(row.quantity);
      if (!qty || qty <= 0) {
        toast.error(`ปริมาณวัตถุดิบ ${row.ingredientName || row.ingredientCode} ต้องมากกว่า 0`);
        return;
      }
      validIngredients.push({
        ingredientCode: row.ingredientCode.trim().toUpperCase(),
        ingredientName: row.ingredientName || row.ingredientCode,
        quantity: qty,
        unit: row.unit.trim() || "unit",
      });
    }

    // Circular Dependency Validation (Cycle Detection)
    const formProducedCode = formItemCode.trim().toUpperCase();
    const recipeGraph = new Map<string, string[]>();

    (productionRecipes || []).forEach((r) => {
      if (
        r?.producedItemCode &&
        (!editingRecipe || r.id !== editingRecipe.id) &&
        r.producedItemCode.toUpperCase() !== formProducedCode
      ) {
        recipeGraph.set(
          r.producedItemCode.toUpperCase(),
          (r.ingredients || []).map((i) => (i?.ingredientCode || "").toUpperCase()),
        );
      }
    });

    recipeGraph.set(
      formProducedCode,
      validIngredients.map((i) => (i?.ingredientCode || "").toUpperCase()),
    );

    const nameMap = new Map<string, string>();
    (items || []).forEach((it) => {
      if (it?.code) {
        nameMap.set(it.code.toUpperCase(), it.name || it.code);
      }
    });

    const cycleCheck = detectBOMCycle(
      formProducedCode,
      validIngredients.map((i) => i.ingredientCode),
      recipeGraph,
      nameMap,
    );

    if (cycleCheck.hasCycle) {
      toast.error(`ไม่สามารถบันทึกได้: พบการวนลูป ${cycleCheck.formattedChain}`);
      return;
    }

    const payload = {
      producedItemCode: formProducedCode,
      yieldQuantity: yQty,
      yieldUnit: formYieldUnit.trim() || "unit",
      active: formActive,
      note: formNote.trim(),
      ingredients: validIngredients,
    };

    if (editingRecipe) {
      const res = await updateProductionRecipe(editingRecipe.id, payload);
      if (res.success) {
        toast.success("บันทึกการแก้ไขสูตรผลิตเรียบร้อยแล้ว");
        setIsModalOpen(false);
      } else {
        toast.error(res.error || "เกิดข้อผิดพลาดในการบันทึก");
      }
    } else {
      const res = await addProductionRecipe(payload);
      if (res.success) {
        toast.success("เพิ่มสูตรผลิตใหม่เรียบร้อยแล้ว");
        setIsModalOpen(false);
      } else {
        toast.error(res.error || "เกิดข้อผิดพลาดในการสร้างสูตรผลิต");
      }
    }
  };

  // Delete Confirmation State
  const [deleteConfirmRecipe, setDeleteConfirmRecipe] = useState<ProductionRecipe | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete recipe
  const handleDelete = (rec: ProductionRecipe) => {
    setDeleteConfirmRecipe(rec);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmRecipe) return;
    setIsDeleting(true);
    try {
      const res = await deleteProductionRecipe(deleteConfirmRecipe.id);
      if (res.success) {
        toast.success("ลบสูตรผลิตเรียบร้อยแล้ว");
        setDeleteConfirmRecipe(null);
        if (editingRecipe?.id === deleteConfirmRecipe.id) {
          setIsModalOpen(false);
        }
      } else {
        toast.error(res.error || "ไม่สามารถลบสูตรผลิตได้");
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลบสูตร";
      toast.error(errMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Hidden File Input for Excel Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx,.xls,.csv"
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              สูตรผลิตสินค้ากึ่งสำเร็จรูป (Production Recipes / BOM)
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            จัดการสูตรและส่วนผสมสำหรับสินค้าที่ผลิตเองในครัว เช่น ซอสหวาน, ซอสสไปซี่, น้ำยำ (Item
            Type: Prepared) เพื่อใช้ตัดสต็อกวัตถุดิบอัตโนมัติ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            className="flex items-center gap-1.5"
            title="ดาวน์โหลดไฟล์ Excel แม่แบบสำหรับกรอกสูตรผลิต"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            แม่แบบ (Template)
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/30"
            title="นำเข้าสูตรผลิตหลายรายการจากไฟล์ Excel"
          >
            <Upload className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            นำเข้า Excel
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshProductionData()}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            รีเฟรช
          </Button>

          <Link to="/production-batch">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400 border-amber-500/30"
            >
              <Flame className="h-4 w-4 text-amber-500" />
              ไปหน้าบันทึกการผลิต
            </Button>
          </Link>

          <Button
            onClick={handleOpenCreate}
            size="sm"
            className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            สร้างสูตรผลิตใหม่
          </Button>
        </div>
      </div>

      {/* View Mode Toggle Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
        <button
          onClick={() => setViewMode("summary")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            viewMode === "summary"
              ? "bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30 shadow-xs"
              : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
          }`}
        >
          <LayoutList className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span>หน้าสรุปภาพรวม & บัญชีสูตร (Summary Index)</span>
          <Badge className="bg-amber-600 text-white dark:bg-amber-500 dark:text-stone-900 text-[11px] h-5 px-1.5 font-bold">
            {productionRecipes.length}
          </Badge>
        </button>

        <button
          onClick={() => setViewMode("cards")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            viewMode === "cards"
              ? "bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30 shadow-xs"
              : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
          }`}
        >
          <LayoutGrid className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span>การ์ดจัดการสูตร & ส่วนผสมละเอียด (Detailed Cards)</span>
        </button>
      </div>

      {viewMode === "summary" ? (
        <ProductionRecipeSummaryView
          recipes={productionRecipes}
          items={items}
          onOpenCreate={handleOpenCreate}
          onOpenEdit={handleOpenEdit}
          onToggleStatus={toggleProductionRecipeStatus}
        />
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">สูตรผลิตทั้งหมด</span>
                <CookingPot className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-bold">{productionRecipes.length}</p>
              <span className="text-xs text-muted-foreground">สูตรที่กำหนดไว้ในระบบ</span>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  สูตรที่เปิดใช้งาน (Active)
                </span>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-600">
                {productionRecipes.filter((r) => r.active).length}
              </p>
              <span className="text-xs text-muted-foreground">พร้อมใช้งานในการตัดสต็อก</span>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  สินค้ากึ่งสำเร็จรูป (Prepared Items)
                </span>
                <Layers className="h-5 w-5 text-amber-500" />
              </div>
              <p className="mt-2 text-2xl font-bold">{preparedItems.length}</p>
              <span className="text-xs text-muted-foreground">รายการใน Master Items</span>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between rounded-xl border bg-card p-4 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อสูตร, รหัสสินค้า, หรือวัตถุดิบ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap justify-between lg:justify-end">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1 font-medium">
                  <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                  เรียงตาม:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as RecipeSortOption)}
                  className="text-xs bg-muted/60 border border-input rounded-lg px-2.5 py-1.5 font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                >
                  <option value="date_desc">📅 วันที่นำเข้า/บันทึก (ใหม่สุด → เก่าสุด)</option>
                  <option value="date_asc">📅 วันที่นำเข้า/บันทึก (เก่าสุด → ใหม่สุด)</option>
                  <option value="code_asc">🔤 รหัสสินค้า (A → Z)</option>
                  <option value="code_desc">🔤 รหัสสินค้า (Z → A)</option>
                  <option value="name_asc">📝 ชื่อสินค้า (ก → ฮ)</option>
                  <option value="ings_desc">📊 จำนวนส่วนผสม (มาก → น้อย)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">สถานะ:</span>
                <div className="flex rounded-lg border bg-muted p-0.5">
                  <button
                    onClick={() => setActiveFilter("all")}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      activeFilter === "all"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    ทั้งหมด ({productionRecipes.length})
                  </button>
                  <button
                    onClick={() => setActiveFilter("active")}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      activeFilter === "active"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    ใช้งานอยู่ ({productionRecipes.filter((r) => r.active).length})
                  </button>
                  <button
                    onClick={() => setActiveFilter("inactive")}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      activeFilter === "inactive"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    ปิดใช้งาน ({productionRecipes.filter((r) => !r.active).length})
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Recipe List */}
          {filteredRecipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card p-12 text-center">
              <CookingPot className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <h3 className="text-lg font-semibold text-foreground">ไม่พบสูตรผลิตสินค้า</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                {searchQuery
                  ? "ไม่พบข้อมูลที่ตรงกับคำค้นหา ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ"
                  : "ยังไม่มีการสร้างสูตรผลิตสินค้ากึ่งสำเร็จรูป คลิกปุ่มด้านล่างเพื่อสร้างสูตรแรก หรือนำเข้าผ่าน Excel"}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                >
                  <Upload className="mr-1.5 h-4 w-4 text-emerald-600" />
                  นำเข้าไฟล์ Excel
                </Button>
                <Button onClick={handleOpenCreate} size="sm">
                  <Plus className="mr-1.5 h-4 w-4" />
                  สร้างสูตรผลิตใหม่
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRecipes.map((rec) => {
                const pItem = itemMap.get(rec.producedItemCode.toUpperCase());
                const isExpanded = expandedRecipes[rec.id] !== false; // default expanded

                return (
                  <div
                    key={rec.id}
                    className="overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:border-primary/40"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b bg-muted/20">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleExpand(rec.id)}
                          className="rounded-md p-1 hover:bg-muted text-muted-foreground"
                          title={isExpanded ? "ย่อส่วนผสม" : "ขยายส่วนผสม"}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                        </button>

                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          <CookingPot className="h-5 w-5" />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground text-base">
                              {pItem ? pItem.name : rec.producedItemCode}
                            </span>
                            <Badge variant="outline" className="font-mono text-xs font-semibold">
                              {rec.producedItemCode}
                            </Badge>
                            {pItem?.itemType === "prepared" && (
                              <Badge
                                variant="outline"
                                className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-[10px]"
                              >
                                Prepared Item
                              </Badge>
                            )}
                            {rec.active ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300 text-[10px]">
                                เปิดใช้งาน
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                ปิดใช้งาน
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                            <span className="inline-flex items-center gap-1 font-medium text-foreground">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                              วันที่บันทึก/นำเข้า:{" "}
                              <span className="font-semibold text-foreground">
                                {formatDateTime(rec.createdAt || rec.updatedAt)}
                              </span>
                            </span>
                            <span className="hidden sm:inline">•</span>
                            <span>
                              ผลผลิตมาตรฐาน:{" "}
                              <strong className="text-foreground">
                                {rec.yieldQuantity || 0} {rec.yieldUnit || ""}
                              </strong>{" "}
                              ต่อรอบผลิต
                            </span>
                            <span className="hidden sm:inline">•</span>
                            <span>มีส่วนผสม {(rec.ingredients || []).length} รายการ</span>
                            {rec.note && <span className="hidden md:inline">• {rec.note}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Link
                          to="/production-batch"
                          search={{ recipeId: rec.id } as Record<string, unknown>}
                        >
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-xs border-amber-500/30 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                            title="บันทึกการผลิตจริงโดยใช้สูตรนี้"
                          >
                            <Flame className="h-3.5 w-3.5" />
                            บันทึกการผลิต
                          </Button>
                        </Link>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleProductionRecipeStatus(rec.id)}
                          className="h-8 w-8 p-0"
                          title={rec.active ? "ปิดใช้งานสูตร" : "เปิดใช้งานสูตร"}
                        >
                          <Power
                            className={`h-4 w-4 ${rec.active ? "text-emerald-600" : "text-muted-foreground"}`}
                          />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEdit(rec)}
                          className="h-8 w-8 p-0"
                          title="แก้ไขสูตร"
                        >
                          <Edit2 className="h-4 w-4 text-primary" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(rec)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          title="ลบสูตร"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Ingredients Table */}
                    {isExpanded && (
                      <div className="p-4 bg-card">
                        <div className="rounded-lg border overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                              <tr>
                                <th className="py-2.5 px-3 w-10 text-center">#</th>
                                <th className="py-2.5 px-3">รหัสวัตถุดิบ (Ingredient Code)</th>
                                <th className="py-2.5 px-3">ชื่อวัตถุดิบ</th>
                                <th className="py-2.5 px-3 text-right">
                                  ปริมาณต่อสูตร (Batch Qty)
                                </th>
                                <th className="py-2.5 px-3 text-right">
                                  สัดส่วนต่อ 1 {rec.yieldUnit || ""}
                                </th>
                                <th className="py-2.5 px-3">หน่วย</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {(rec.ingredients || []).map((ing, idx) => {
                                const ingCode = ing?.ingredientCode || "";
                                const ingItem = itemMap.get(ingCode.toUpperCase());
                                const yieldQty = rec.yieldQuantity || 0;
                                const ingQty = ing?.quantity || 0;
                                const perUnitQty = yieldQty > 0 ? ingQty / yieldQty : 0;

                                return (
                                  <tr key={ing?.id || idx} className="hover:bg-muted/20">
                                    <td className="py-2 px-3 text-center text-muted-foreground font-mono">
                                      {idx + 1}
                                    </td>
                                    <td className="py-2 px-3 font-mono font-medium">{ingCode}</td>
                                    <td className="py-2 px-3">
                                      <div className="flex items-center gap-1.5">
                                        <span>
                                          {ing?.ingredientName || ingItem?.name || ingCode}
                                        </span>
                                        {ingItem && (
                                          <span className="text-[10px] text-muted-foreground">
                                            (คงเหลือ: {ingItem.currentStock || 0}{" "}
                                            {ingItem.stockUnit || ingItem.unit})
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2 px-3 text-right font-semibold tabular-nums">
                                      {ingQty.toLocaleString(undefined, {
                                        maximumFractionDigits: 4,
                                      })}
                                    </td>
                                    <td className="py-2 px-3 text-right text-muted-foreground tabular-nums">
                                      {perUnitQty.toLocaleString(undefined, {
                                        maximumFractionDigits: 4,
                                      })}
                                    </td>
                                    <td className="py-2 px-3 font-medium text-muted-foreground">
                                      {ing?.unit || ""}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Excel Bulk Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border bg-card shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    นำเข้าสูตรผลิตจาก Excel (Bulk Import BOM)
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    ไฟล์: <strong>{importFileName}</strong> ({rawSheetRows.length} บรรทัด)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Mode Selection Box */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    การจัดการรหัสสินค้ากึ่งสำเร็จรูป (Prepared Items)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    เลือกวิธีจัดการเมื่อรหัสสินค้ายังไม่มีใน Master Items
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                      autoCreateMode === "auto_code"
                        ? "border-primary bg-background shadow-xs ring-1 ring-primary"
                        : "border-border hover:bg-background/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="autoCreateMode"
                      checked={autoCreateMode === "auto_code"}
                      onChange={() => setAutoCreateMode("auto_code")}
                      className="mt-0.5 text-primary"
                    />
                    <div>
                      <div className="text-xs font-semibold text-foreground">
                        1. สร้างรหัสใหม่อัตโนมัติ (Auto-generate PRP-xxxx)
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        หากรหัสว่างหรือไม่พบใน Master Items ระบบจะสร้างรหัสใหม่แบบเรียงลำดับให้ทันที
                        (แนะนำ)
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                      autoCreateMode === "file_code"
                        ? "border-primary bg-background shadow-xs ring-1 ring-primary"
                        : "border-border hover:bg-background/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="autoCreateMode"
                      checked={autoCreateMode === "file_code"}
                      onChange={() => setAutoCreateMode("file_code")}
                      className="mt-0.5 text-primary"
                    />
                    <div>
                      <div className="text-xs font-semibold text-foreground">
                        2. ใช้รหัสที่ระบุในไฟล์ Excel ตรงๆ
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        สร้างรายการใหม่โดยใช้รหัสตามคอลัมน์ Produced Item Code
                        (จะแจ้งเตือนหากซ้ำกับวัตถุดิบดิบ)
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="text-[11px] text-muted-foreground">สูตรผลิตที่พบ</div>
                  <div className="text-lg font-bold text-foreground mt-0.5">
                    {importStats.totalGroups} สูตร
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="text-[11px] text-muted-foreground">รายการวัตถุดิบ</div>
                  <div className="text-lg font-bold text-foreground mt-0.5">
                    {importStats.totalIngredients} บรรทัด
                  </div>
                </div>

                <div className="rounded-lg border bg-emerald-500/10 border-emerald-500/20 p-3">
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    พร้อมนำเข้า
                  </div>
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {importStats.validGroups} สูตร
                  </div>
                </div>

                <div className="rounded-lg border bg-amber-500/10 border-amber-500/20 p-3">
                  <div className="text-[11px] text-amber-700 dark:text-amber-400">
                    จะแปลงเป็น Prepared
                  </div>
                  <div className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                    {importStats.willConvertItemsCount} รายการ
                  </div>
                </div>

                <div
                  className={`rounded-lg border p-3 col-span-2 sm:col-span-1 ${
                    importStats.invalidGroups > 0
                      ? "bg-rose-500/10 border-rose-500/20"
                      : "bg-muted/20"
                  }`}
                >
                  <div
                    className={`text-[11px] ${
                      importStats.invalidGroups > 0
                        ? "text-rose-700 dark:text-rose-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    มีข้อผิดพลาด
                  </div>
                  <div
                    className={`text-lg font-bold mt-0.5 ${
                      importStats.invalidGroups > 0
                        ? "text-rose-700 dark:text-rose-300"
                        : "text-foreground"
                    }`}
                  >
                    {importStats.invalidGroups} สูตร
                  </div>
                </div>
              </div>

              {/* Groups Preview List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    รายการสูตรผลิตที่กำลังนำเข้า ({parsedImportGroups.length} รายการ)
                  </span>
                  <span className="text-xs text-muted-foreground">
                    คลิกแถวเพื่อดูรายการส่วนผสมและสถานะตรวจสอบ
                  </span>
                </div>

                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {parsedImportGroups.map((grp, gIdx) => {
                    const isExpanded = expandedImportGroups[gIdx] !== false;
                    const hasIngErrors = grp.ingredients.some((ing) => !ing.isValid);
                    const isGroupValid =
                      grp.errors.length === 0 &&
                      (grp.itemStatus === "existing" ||
                        grp.itemStatus === "will_create" ||
                        grp.itemStatus === "will_convert") &&
                      !hasIngErrors;

                    return (
                      <div
                        key={gIdx}
                        className={`rounded-xl border transition-all ${
                          !isGroupValid
                            ? "border-rose-400 bg-rose-50/40 dark:bg-rose-950/20"
                            : grp.itemStatus === "will_convert"
                              ? "border-amber-300 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-700"
                              : grp.itemStatus === "will_create"
                                ? "border-blue-300 bg-blue-50/30 dark:bg-blue-950/20"
                                : "border-border bg-card"
                        }`}
                      >
                        {/* Group Header */}
                        <div
                          onClick={() => toggleExpandImportGroup(gIdx)}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 cursor-pointer gap-2 select-none"
                        >
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-xs font-mono text-muted-foreground">
                              #{gIdx + 1}
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                              {grp.producedItemName}
                            </span>
                            <Badge variant="outline" className="font-mono text-xs">
                              {grp.resolvedItemCode}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Yield: {grp.yieldQuantity} {grp.yieldUnit}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            {grp.itemStatus === "existing" && (
                              <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300 text-xs">
                                <Check className="w-3 h-3 mr-1" />
                                มีอยู่แล้ว (จับคู่ปกติ)
                              </Badge>
                            )}

                            {grp.itemStatus === "will_convert" && (
                              <Badge className="bg-amber-500/15 text-amber-800 hover:bg-amber-500/20 dark:text-amber-300 text-xs border border-amber-400/40">
                                <Sparkles className="w-3 h-3 mr-1 text-amber-600 dark:text-amber-400" />
                                จะแปลงเป็น Prepared
                              </Badge>
                            )}

                            {grp.itemStatus === "will_create" && (
                              <Badge className="bg-blue-500/15 text-blue-700 hover:bg-blue-500/20 dark:text-blue-300 text-xs">
                                <Plus className="w-3 h-3 mr-1" />
                                จะสร้างใหม่อัตโนมัติ ({grp.resolvedItemCode})
                              </Badge>
                            )}

                            {grp.itemStatus === "conflict" && (
                              <Badge className="bg-rose-500/15 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300 text-xs">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                พบการวนลูป (Circular BOM)
                              </Badge>
                            )}

                            {grp.itemStatus === "error" && (
                              <Badge variant="destructive" className="text-xs">
                                ข้อผิดพลาด
                              </Badge>
                            )}

                            <span className="text-xs text-muted-foreground">
                              ({grp.ingredients.length} วัตถุดิบ)
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {/* Convert to Prepared explanation banner */}
                        {grp.itemStatus === "will_convert" && grp.errors.length === 0 && (
                          <div className="px-3.5 pb-2 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                            <span>
                              รหัสนี้มีอยู่แล้วใน Master Items เป็นวัตถุดิบดิบ (Raw) —
                              ระบบจะแปลงเป็นประเภท &quot;วัตถุดิบเตรียม (Prepared)&quot;
                              ให้อัตโนมัติ สต็อกคงเหลือปัจจุบันจะไม่เปลี่ยนแปลง
                            </span>
                          </div>
                        )}

                        {/* Error Message banner */}
                        {grp.errors.length > 0 && (
                          <div className="px-3.5 pb-2 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{grp.errors.join(", ")}</span>
                          </div>
                        )}

                        {/* Ingredients Table */}
                        {isExpanded && (
                          <div className="border-t px-3.5 py-2.5 bg-background/50">
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="text-muted-foreground border-b text-[11px]">
                                  <th className="pb-1.5 pl-1 w-8">#</th>
                                  <th className="pb-1.5">รหัสวัตถุดิบ</th>
                                  <th className="pb-1.5">ชื่อวัตถุดิบ</th>
                                  <th className="pb-1.5 text-right">ปริมาณ</th>
                                  <th className="pb-1.5 pl-2">หน่วย</th>
                                  <th className="pb-1.5 text-right">สถานะ</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/40">
                                {grp.ingredients.map((ing, ingIdx) => (
                                  <tr
                                    key={ingIdx}
                                    className={`py-1 ${!ing.isValid ? "text-rose-600 dark:text-rose-400" : ""}`}
                                  >
                                    <td className="py-1 pl-1 text-muted-foreground font-mono text-[11px]">
                                      {ingIdx + 1}
                                    </td>
                                    <td className="py-1 font-mono font-medium">
                                      {ing.ingredientCode}
                                    </td>
                                    <td className="py-1">{ing.ingredientName}</td>
                                    <td className="py-1 text-right font-semibold tabular-nums">
                                      {ing.quantity}
                                    </td>
                                    <td className="py-1 pl-2 text-muted-foreground">{ing.unit}</td>
                                    <td className="py-1 text-right">
                                      {ing.isValid ? (
                                        <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 text-[11px]">
                                          <Check className="w-3 h-3 mr-0.5" /> ผ่าน
                                        </span>
                                      ) : (
                                        <span
                                          className="inline-flex items-center text-rose-600 dark:text-rose-400 text-[11px]"
                                          title={ing.error}
                                        >
                                          <AlertCircle className="w-3 h-3 mr-0.5" /> {ing.error}
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t px-6 py-4 bg-muted/20">
              <div className="text-xs text-muted-foreground">
                พร้อมนำเข้า <strong>{importStats.validGroups}</strong> จากทั้งหมด{" "}
                <strong>{importStats.totalGroups}</strong> สูตร
                {importStats.willConvertItemsCount > 0 && (
                  <>
                    {" "}
                    (จะแปลงเป็น Prepared <strong>{importStats.willConvertItemsCount}</strong>{" "}
                    รายการ)
                  </>
                )}
                {importStats.willCreateItemsCount > 0 && (
                  <>
                    {" "}
                    (จะสร้างสินค้าใหม่ <strong>{importStats.willCreateItemsCount}</strong> รายการ)
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {importStats.invalidGroups > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExportFailedBOMs}
                    className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Export สูตรที่ไม่ผ่าน ({importStats.invalidGroups})
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsImportModalOpen(false)}
                  disabled={isImporting}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirmImport}
                  disabled={isImporting || importStats.validGroups === 0}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      กำลังนำเข้าข้อมูล...
                    </>
                  ) : (
                    <>
                      <Check className="mr-1.5 h-4 w-4" />
                      ยืนยันนำเข้าข้อมูล ({importStats.validGroups} รายการ)
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single Recipe Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CookingPot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {editingRecipe ? "แก้ไขสูตรผลิตสินค้า" : "สร้างสูตรผลิตสินค้าใหม่ (BOM)"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    กำหนดวัตถุดิบและสัดส่วนที่ต้องใช้ในการผลิตสินค้ากึ่งสำเร็จรูป
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecipe} className="mt-4 space-y-4">
              {/* Produced Item Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  สินค้ากึ่งสำเร็จรูปที่จะผลิต (Produced Item){" "}
                  <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formItemCode}
                  onChange={(e) => {
                    setFormItemCode(e.target.value);
                    const selected = items.find((i) => i.code === e.target.value);
                    if (selected) {
                      setFormYieldUnit(
                        selected.recipeUnit || selected.unit || selected.stockUnit || "L",
                      );
                    }
                  }}
                  disabled={!!editingRecipe}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
                  required
                >
                  <option value="">-- เลือกสินค้ากึ่งสำเร็จรูป (Prepared Items) --</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.code}>
                      {it.code} - {it.name} ({it.itemType || "raw"})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  เฉพาะสินค้าที่มีรหัสใน Master Items (แนะนำประเภท: Prepared เช่น ซอส, น้ำสต็อก)
                </p>
              </div>

              {/* Yield & Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    ปริมาณผลผลิตต่อรอบ (Yield Quantity) <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min="0.0001"
                    value={formYieldQty}
                    onChange={(e) => setFormYieldQty(e.target.value)}
                    placeholder="เช่น 1, 5, 10"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    หน่วยของผลผลิต (Yield Unit) <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={formYieldUnit}
                    onChange={(e) => setFormYieldUnit(e.target.value)}
                    placeholder="เช่น L, kg, pack, ถุง"
                    required
                  />
                </div>
              </div>

              {/* Note & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">หมายเหตุสูตร</label>
                  <Input
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    placeholder="เช่น สูตรมาตรฐานครัวกลาง, สำหรับสาขาเอกมัย"
                  />
                </div>

                <div className="space-y-1.5 flex flex-col justify-center">
                  <label className="text-xs font-semibold text-foreground mb-1">สถานะสูตร</label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>เปิดใช้งาน (Active)</span>
                  </label>
                </div>
              </div>

              {/* Ingredients List */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                    รายการวัตถุดิบในสูตร (Recipe Ingredients){" "}
                    <span className="text-rose-500">*</span>
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddIngredientRow}
                    className="h-7 text-xs"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    เพิ่มวัตถุดิบ
                  </Button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {formIngredients.map((row, idx) => (
                    <div
                      key={row.tempId}
                      className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5"
                    >
                      <span className="w-5 text-center text-xs font-medium text-muted-foreground">
                        {idx + 1}
                      </span>

                      {/* Ingredient selector */}
                      <div className="flex-1 min-w-[180px]">
                        <select
                          value={row.ingredientCode}
                          onChange={(e) =>
                            handleUpdateIngredientRow(row.tempId, "ingredientCode", e.target.value)
                          }
                          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          required
                        >
                          <option value="">-- เลือกวัตถุดิบ --</option>
                          {items.map((it) => (
                            <option key={it.id} value={it.code}>
                              {it.code} - {it.name} ({it.unit || it.stockUnit})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="w-24">
                        <Input
                          type="number"
                          step="any"
                          min="0.0001"
                          value={row.quantity}
                          onChange={(e) =>
                            handleUpdateIngredientRow(row.tempId, "quantity", e.target.value)
                          }
                          placeholder="ปริมาณ"
                          className="h-8 text-xs text-right"
                          required
                        />
                      </div>

                      {/* Unit */}
                      <div className="w-20">
                        <Input
                          value={row.unit}
                          onChange={(e) =>
                            handleUpdateIngredientRow(row.tempId, "unit", e.target.value)
                          }
                          placeholder="หน่วย"
                          className="h-8 text-xs"
                          required
                        />
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveIngredientRow(row.tempId)}
                        className="rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        title="ลบแถวนี้"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 border-t pt-4">
                {editingRecipe ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(editingRecipe)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    ลบสูตรผลิตนี้
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    size="sm"
                  >
                    ยกเลิก
                  </Button>
                  <Button type="submit" size="sm" className="bg-primary text-primary-foreground">
                    {editingRecipe ? "บันทึกการแก้ไข" : "สร้างสูตรผลิต"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteConfirmRecipe)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteConfirmRecipe(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              ยืนยันการลบสูตรผลิต (BOM)
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-muted-foreground">
              คุณแน่ใจหรือไม่ว่าต้องการลบสูตรผลิตสำหรับสินค้า:
            </DialogDescription>
          </DialogHeader>

          {deleteConfirmRecipe && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">รหัสสินค้า:</span>
                <span className="font-mono font-bold text-foreground">
                  {deleteConfirmRecipe.producedItemCode}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ชื่อสินค้า:</span>
                <span className="font-medium text-foreground">
                  {itemMap.get(deleteConfirmRecipe.producedItemCode.toUpperCase())?.name ||
                    deleteConfirmRecipe.producedItemCode}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ผลผลิตต่อรอบ:</span>
                <span className="font-medium text-foreground">
                  {deleteConfirmRecipe.yieldQuantity} {deleteConfirmRecipe.yieldUnit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">จำนวนวัตถุดิบในสูตร:</span>
                <span className="font-medium text-foreground">
                  {(deleteConfirmRecipe.ingredients || []).length} รายการ
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmRecipe(null)}
              disabled={isDeleting}
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="gap-1.5"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  กำลังลบ...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  ยืนยันการลบสูตร
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
