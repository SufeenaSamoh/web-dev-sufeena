import React, { useState, useMemo, useRef } from "react";
import { useStore } from "@/lib/store";
import { formatDateTime } from "@/lib/dateFormat";
import { RecipeItem } from "@/lib/types";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  findMatchingMasterItems,
  findPrimaryMatchingMasterItem,
  extractBaseIngredientCode,
} from "@/lib/ingredientMatching";
import {
  ChefHat,
  Plus,
  Search,
  Upload,
  Download,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  X,
  ChevronDown,
  ChevronRight,
  Lock,
  Power,
  RotateCcw,
  Clock,
  Archive,
  Info,
  RefreshCw,
  ShieldAlert,
  FileWarning,
  Filter,
  Check,
  Layers,
  List,
  AlertOctagon,
  ArrowUpDown,
  Table2,
} from "lucide-react";
import { RecipeMasterSummaryView } from "./RecipeMasterSummaryView";

export interface ParsedImportRow {
  rowNum: number;
  menuCode: string;
  menuName: string;
  ingredientCode: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  subRecipeCode: string;
  active: boolean;
  errors: string[];
  isRowValid: boolean;
  isMenuValid: boolean;
  menuErrors: string[];
}

export interface ParsedImportMenuGroup {
  menuCode: string;
  menuName: string;
  rows: ParsedImportRow[];
  totalRows: number;
  isMenuValid: boolean;
  hasErrors: boolean;
  rowErrorsCount: number;
  errors: string[];
  errorSummary: string;
}

export function RecipeMasterPage() {
  const {
    recipes,
    items,
    addRecipeItem,
    updateRecipeItem,
    deleteRecipeItem,
    deleteRecipeByMenuCode,
    setRecipeMenuStatus,
    softDeleteRecipeByMenuCode,
    restoreRecipeMenu,
    hardDeleteRecipeByMenuCode,
    bulkImportRecipes,
  } = useStore();

  const [mainTab, setMainTab] = useState<"summary" | "active" | "inactive" | "deleted" | "import">(
    "summary",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "date_desc" | "date_asc" | "code_asc" | "code_desc" | "name_asc" | "count_desc"
  >("date_desc");
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});

  // Add/Edit Ingredient Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RecipeItem | null>(null);

  // Form State
  const [formMenuCode, setFormMenuCode] = useState("");
  const [formMenuName, setFormMenuName] = useState("");
  const [formIngCode, setFormIngCode] = useState("");
  const [formIngName, setFormIngName] = useState("");
  const [formQty, setFormQty] = useState<string>("100");
  const [formUnit, setFormUnit] = useState("g");
  const [formSubCode, setFormSubCode] = useState("");
  const [formActive, setFormActive] = useState(true);

  // Reason Modal State
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [reasonActionType, setReasonActionType] = useState<"inactive" | "delete">("inactive");
  const [targetMenuCode, setTargetMenuCode] = useState("");
  const [targetMenuName, setTargetMenuName] = useState("");
  const [reasonText, setReasonText] = useState("");

  // Permanent Hard Delete Modal State
  const [isHardDeleteModalOpen, setIsHardDeleteModalOpen] = useState(false);
  const [hardDeleteMenuCode, setHardDeleteMenuCode] = useState("");
  const [hardDeleteMenuName, setHardDeleteMenuName] = useState("");

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedImportRows, setParsedImportRows] = useState<ParsedImportRow[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importFilterTab, setImportFilterTab] = useState<"all" | "valid" | "invalid">("all");
  const [importViewMode, setImportViewMode] = useState<"grouped" | "flat">("grouped");
  const [expandedImportMenus, setExpandedImportMenus] = useState<Record<string, boolean>>({});

  // Helper function to group recipes by Menu Code
  const groupRecipes = (recipeList: RecipeItem[], search: string) => {
    const map = new Map<
      string,
      {
        menuCode: string;
        menuName: string;
        status: string;
        active: boolean;
        isDeleted: boolean;
        reason?: string;
        actionTimestamp?: string;
        createdAt?: string;
        updatedAt?: string;
        lines: RecipeItem[];
      }
    >();

    recipeList.forEach((rec) => {
      const matchesSearch =
        !search.trim() ||
        rec.menuCode.toLowerCase().includes(search.toLowerCase()) ||
        rec.menuName.toLowerCase().includes(search.toLowerCase()) ||
        rec.ingredientCode.toLowerCase().includes(search.toLowerCase()) ||
        rec.ingredientName.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return;

      const key = rec.menuCode.toUpperCase().trim();
      const recTime = rec.actionTimestamp || rec.updatedAt || rec.createdAt;
      const existing = map.get(key) || {
        menuCode: rec.menuCode,
        menuName: rec.menuName,
        status: rec.status || (rec.isDeleted ? "deleted" : rec.active ? "active" : "inactive"),
        active: rec.active,
        isDeleted: rec.isDeleted || false,
        reason: rec.reason || "",
        actionTimestamp: recTime,
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
        lines: [],
      };
      existing.lines.push(rec);
      if (!existing.menuName && rec.menuName) existing.menuName = rec.menuName;
      if (rec.reason && !existing.reason) existing.reason = rec.reason;

      // Keep the most recent timestamp across lines
      if (recTime && (!existing.actionTimestamp || recTime > existing.actionTimestamp)) {
        existing.actionTimestamp = recTime;
      }
      if (rec.createdAt && (!existing.createdAt || rec.createdAt < existing.createdAt)) {
        existing.createdAt = rec.createdAt;
      }
      if (rec.updatedAt && (!existing.updatedAt || rec.updatedAt > existing.updatedAt)) {
        existing.updatedAt = rec.updatedAt;
      }

      map.set(key, existing);
    });

    const groups = Array.from(map.values());

    // Sort groups based on sortBy
    return groups.sort((a, b) => {
      if (sortBy === "date_desc") {
        const timeA = a.actionTimestamp || a.updatedAt || a.createdAt || "";
        const timeB = b.actionTimestamp || b.updatedAt || b.createdAt || "";
        return timeB.localeCompare(timeA);
      }
      if (sortBy === "date_asc") {
        const timeA = a.actionTimestamp || a.updatedAt || a.createdAt || "";
        const timeB = b.actionTimestamp || b.updatedAt || b.createdAt || "";
        return timeA.localeCompare(timeB);
      }
      if (sortBy === "code_asc") {
        return a.menuCode.localeCompare(b.menuCode);
      }
      if (sortBy === "code_desc") {
        return b.menuCode.localeCompare(a.menuCode);
      }
      if (sortBy === "name_asc") {
        return a.menuName.localeCompare(b.menuName, "th");
      }
      if (sortBy === "count_desc") {
        return b.lines.length - a.lines.length;
      }
      return 0;
    });
  };

  // Grouped datasets per tab
  const activeRecipesGrouped = useMemo(() => {
    const list = recipes.filter((r) => r.active && !r.isDeleted && r.status !== "deleted");
    return groupRecipes(list, searchQuery);
  }, [recipes, searchQuery, sortBy]);

  const inactiveRecipesGrouped = useMemo(() => {
    const list = recipes.filter((r) => !r.active && !r.isDeleted && r.status !== "deleted");
    return groupRecipes(list, searchQuery);
  }, [recipes, searchQuery, sortBy]);

  const deletedRecipesGrouped = useMemo(() => {
    const list = recipes.filter((r) => r.isDeleted || r.status === "deleted");
    return groupRecipes(list, searchQuery);
  }, [recipes, searchQuery, sortBy]);

  // Total counts for tab headers
  const totalMenuCount = useMemo(() => {
    return new Set(recipes.map((r) => r.menuCode.toUpperCase().trim())).size;
  }, [recipes]);

  const activeCount = useMemo(() => {
    const list = recipes.filter((r) => r.active && !r.isDeleted && r.status !== "deleted");
    return new Set(list.map((r) => r.menuCode.toUpperCase().trim())).size;
  }, [recipes]);

  const inactiveCount = useMemo(() => {
    const list = recipes.filter((r) => !r.active && !r.isDeleted && r.status !== "deleted");
    return new Set(list.map((r) => r.menuCode.toUpperCase().trim())).size;
  }, [recipes]);

  const deletedCount = useMemo(() => {
    const list = recipes.filter((r) => r.isDeleted || r.status === "deleted");
    return new Set(list.map((r) => r.menuCode.toUpperCase().trim())).size;
  }, [recipes]);

  // Lookup ingredient when typing/selecting Ingredient Code
  const matchedMasterItem = useMemo(() => {
    if (!formIngCode.trim()) return null;
    return findPrimaryMatchingMasterItem(formIngCode, items) || null;
  }, [items, formIngCode]);

  const matchingSupplierVariants = useMemo(() => {
    if (!formIngCode.trim()) return [];
    return findMatchingMasterItems(formIngCode, items);
  }, [items, formIngCode]);

  // Auto-fill Menu Name when Menu Code changes
  const handleMenuCodeChange = (code: string) => {
    setFormMenuCode(code);
    const existingRecipe = recipes.find(
      (r) => r.menuCode.toLowerCase().trim() === code.toLowerCase().trim(),
    );
    if (existingRecipe) {
      setFormMenuName(existingRecipe.menuName);
    }
  };

  // Auto-fill & lock Ingredient Name when Ingredient Code matches Master Items
  const handleIngCodeChange = (code: string) => {
    setFormIngCode(code);
    const found = findPrimaryMatchingMasterItem(code, items);
    if (found) {
      setFormIngName(found.name);
      const u = found.recipeUnit || found.stockUnit || found.unit;
      if (u) setFormUnit(u);
    }
  };

  const openAddModal = (presetMenuCode?: string, presetMenuName?: string) => {
    setEditingItem(null);
    setFormMenuCode(presetMenuCode || "");
    setFormMenuName(presetMenuName || "");
    setFormIngCode("");
    setFormIngName("");
    setFormQty("100");
    setFormUnit("g");
    setFormSubCode("");
    setFormActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (rec: RecipeItem) => {
    setEditingItem(rec);
    setFormMenuCode(rec.menuCode);
    setFormMenuName(rec.menuName);
    setFormIngCode(rec.ingredientCode);
    setFormIngName(rec.ingredientName);
    setFormQty(rec.quantity.toString());
    setFormUnit(rec.unit);
    setFormSubCode(rec.subRecipeCode || "");
    setFormActive(rec.active);
    setIsModalOpen(true);
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMenuCode.trim()) {
      toast.error("กรุณาระบุรหัสเมนู (Menu Code)");
      return;
    }
    if (!formMenuName.trim()) {
      toast.error("กรุณาระบุชื่อเมนู (Menu Name)");
      return;
    }
    if (!formIngCode.trim()) {
      toast.error("กรุณาระบุรหัสวัตถุดิบ (Ingredient Code)");
      return;
    }

    if (!matchedMasterItem) {
      toast.error(
        `รหัสวัตถุดิบ "${formIngCode}" ไม่พบใน Master Items กรุณาใช้รหัสวัตถุดิบที่มีอยู่ในระบบ`,
      );
      return;
    }

    const parsedQty = parseFloat(formQty);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      toast.error("ปริมาณต้องเป็นตัวเลขมากกว่า 0");
      return;
    }

    if (!formUnit.trim()) {
      toast.error("กรุณาระบุหน่วยนับ");
      return;
    }

    const ingNameToUse = matchedMasterItem ? matchedMasterItem.name : formIngName.trim();

    if (editingItem) {
      await updateRecipeItem(editingItem.id, {
        menuCode: formMenuCode.trim(),
        menuName: formMenuName.trim(),
        ingredientCode: formIngCode.trim(),
        ingredientName: ingNameToUse,
        quantity: parsedQty,
        unit: formUnit.trim(),
        subRecipeCode: formSubCode.trim() || undefined,
        active: formActive,
      });
      toast.success("อัปเดตสูตรอาหารเรียบร้อยแล้ว");
    } else {
      await addRecipeItem({
        menuCode: formMenuCode.trim(),
        menuName: formMenuName.trim(),
        ingredientCode: formIngCode.trim(),
        ingredientName: ingNameToUse,
        quantity: parsedQty,
        unit: formUnit.trim(),
        subRecipeCode: formSubCode.trim() || undefined,
        active: formActive,
      });
      toast.success("เพิ่มวัตถุดิบเข้าสูตรอาหารเรียบร้อยแล้ว");
    }

    setIsModalOpen(false);
  };

  const toggleAccordion = (menuCode: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuCode]: !prev[menuCode],
    }));
  };

  // --- REASON MODAL HANDLERS ---
  const triggerSetInactive = (menuCode: string, menuName: string) => {
    setReasonActionType("inactive");
    setTargetMenuCode(menuCode);
    setTargetMenuName(menuName);
    setReasonText("");
    setIsReasonModalOpen(true);
  };

  const triggerSoftDelete = (menuCode: string, menuName: string) => {
    setReasonActionType("delete");
    setTargetMenuCode(menuCode);
    setTargetMenuName(menuName);
    setReasonText("");
    setIsReasonModalOpen(true);
  };

  const handleConfirmReason = async () => {
    if (!reasonText.trim()) {
      toast.error("กรุณาระบุเหตุผลในการดำเนินการ");
      return;
    }

    if (reasonActionType === "inactive") {
      await setRecipeMenuStatus(targetMenuCode, false, reasonText.trim());
      toast.success(`ปิดใช้งานเมนู "${targetMenuName}" (${targetMenuCode}) เรียบร้อยแล้ว`);
    } else if (reasonActionType === "delete") {
      await softDeleteRecipeByMenuCode(targetMenuCode, reasonText.trim());
      toast.success(
        `ย้ายเมนู "${targetMenuName}" (${targetMenuCode}) ไปยังประวัติการลบเรียบร้อยแล้ว`,
      );
    }

    setIsReasonModalOpen(false);
  };

  const handleSetActive = async (menuCode: string, menuName: string) => {
    await setRecipeMenuStatus(menuCode, true, "เปิดใช้งานเมนูอีกครั้ง");
    toast.success(`เปิดใช้งานเมนู "${menuName}" (${menuCode}) เรียบร้อยแล้ว`);
  };

  const handleRestoreMenu = async (menuCode: string, menuName: string) => {
    await restoreRecipeMenu(menuCode);
    toast.success(`คืนค่าเมนู "${menuName}" (${menuCode}) กลับสู่เมนูที่ใช้งานอยู่เรียบร้อยแล้ว`);
  };

  const triggerHardDelete = (menuCode: string, menuName: string) => {
    setHardDeleteMenuCode(menuCode);
    setHardDeleteMenuName(menuName);
    setIsHardDeleteModalOpen(true);
  };

  const handleConfirmHardDelete = async () => {
    if (!hardDeleteMenuCode) return;
    await hardDeleteRecipeByMenuCode(hardDeleteMenuCode);
    toast.success(
      `ลบสูตรอาหารเมนู "${hardDeleteMenuName}" (${hardDeleteMenuCode}) ออกจากฐานข้อมูลถาวรเรียบร้อยแล้ว`,
    );
    setIsHardDeleteModalOpen(false);
  };

  const handleDeleteLine = async (id: string, ingName: string) => {
    if (window.confirm(`คุณต้องการลบวัตถุดิบ "${ingName}" ออกจากสูตรอาหารใช่หรือไม่?`)) {
      const res = await deleteRecipeItem(id);
      if (res.success) {
        toast.success(`ลบวัตถุดิบ "${ingName}" ออกจากสูตรเรียบร้อยแล้ว`);
      } else {
        toast.error(res.error || "ไม่สามารถลบวัตถุดิบได้");
      }
    }
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return "—";
    return formatDateTime(ts);
  };

  // --- EXCEL IMPORT ENGINE ---
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Menu Code": "M001",
        "Menu Name": "Salmon Don (ข้าวหน้าปลาแซลมอน)",
        "Ingredient Code": items[0]?.code || "ITEM-001",
        "Ingredient Name": items[0]?.name || "Fresh Salmon",
        Quantity: 80,
        Unit: items[0]?.unit || "g",
        "Sub Recipe Code": "",
        Active: "Y",
      },
      {
        "Menu Code": "M001",
        "Menu Name": "Salmon Don (ข้าวหน้าปลาแซลมอน)",
        "Ingredient Code": items[1]?.code || "ITEM-002",
        "Ingredient Name": items[1]?.name || "Japanese Rice",
        Quantity: 200,
        Unit: items[1]?.unit || "g",
        "Sub Recipe Code": "",
        Active: "Y",
      },
      {
        "Menu Code": "M002",
        "Menu Name": "Sashimi Set (ชุดซาชิมิ)",
        "Ingredient Code": items[0]?.code || "ITEM-001",
        "Ingredient Name": items[0]?.name || "Fresh Salmon",
        Quantity: 150,
        Unit: items[0]?.unit || "g",
        "Sub Recipe Code": "",
        Active: "Y",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Recipe_Master");
    XLSX.writeFile(workbook, "Hana_Recipe_Master_Template.xlsx");
    toast.success("ดาวน์โหลดไฟล์แม่แบบเรียบร้อยแล้ว");
  };

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
        const rawJson: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
        });

        if (!rawJson || rawJson.length === 0) {
          toast.error("ไม่พบข้อมูลในไฟล์ที่เลือก");
          return;
        }

        // Pass 1: Parse rows & identify row-level issues
        const rawParsed: ParsedImportRow[] = rawJson.map((row, idx) => {
          const rowNum = idx + 2;
          const menuCode = String(row["Menu Code"] || row["Code"] || row["รหัสเมนู"] || "").trim();
          const menuName = String(row["Menu Name"] || row["Name"] || row["ชื่อเมนู"] || "").trim();
          const ingredientCode = String(
            row["Ingredient Code"] || row["Ingr Code"] || row["รหัสวัตถุดิบ"] || "",
          ).trim();
          const rawIngName = String(
            row["Ingredient Name"] || row["Ingr Name"] || row["ชื่อวัตถุดิบ"] || "",
          ).trim();
          const rawQty = row["Quantity"] ?? row["Qty"] ?? row["ปริมาณ"];
          const unit = String(row["Unit"] || row["หน่วย"] || "").trim();
          const subRecipeCode = String(row["Sub Recipe Code"] || row["Sub Code"] || "").trim();
          const rawActive = String(row["Active"] || row["สถานะ"] || "Y")
            .trim()
            .toUpperCase();

          const quantity = typeof rawQty === "number" ? rawQty : parseFloat(String(rawQty));
          const active =
            rawActive === "Y" ||
            rawActive === "TRUE" ||
            rawActive === "1" ||
            rawActive === "ACTIVE";

          const errors: string[] = [];

          if (!menuCode) errors.push("กรอกข้อมูลรหัสเมนู (Menu Code) ไม่ครบ");
          if (!menuName) errors.push("กรอกข้อมูลชื่อเมนู (Menu Name) ไม่ครบ");

          let resolvedIngCode = ingredientCode;
          let resolvedIngName = rawIngName || ingredientCode;

          if (!ingredientCode) {
            errors.push("กรอกข้อมูลรหัสวัตถุดิบ (Ingredient Code) ไม่ครบ");
          } else {
            const masterMatch = findPrimaryMatchingMasterItem(ingredientCode, items);
            if (!masterMatch) {
              errors.push(`รหัสวัตถุดิบ "${ingredientCode}" ไม่พบใน Master Items`);
            } else {
              // Keep the ingredientCode entered (or base code), and use the resolved master item name
              resolvedIngCode = ingredientCode;
              resolvedIngName = masterMatch.name || rawIngName || masterMatch.code;
            }
          }

          if (isNaN(quantity) || quantity <= 0) {
            errors.push("ปริมาณ (Quantity) ต้องเป็นตัวเลขมากกว่า 0");
          }

          if (!unit) errors.push("กรอกข้อมูลหน่วยนับ (Unit) ไม่ครบ");

          return {
            rowNum,
            menuCode,
            menuName,
            ingredientCode: resolvedIngCode,
            ingredientName: resolvedIngName,
            quantity: isNaN(quantity) ? 0 : quantity,
            unit,
            subRecipeCode,
            active,
            errors,
            isRowValid: errors.length === 0,
            isMenuValid: true, // will be resolved in whole-menu validation pass
            menuErrors: [],
          };
        });

        // Pass 2: Check for duplicate ingredient in the same menu
        const seenInMenu = new Map<string, number>();
        rawParsed.forEach((row) => {
          if (row.menuCode && row.ingredientCode) {
            const key = `${row.menuCode.toUpperCase()}__${row.ingredientCode.toUpperCase()}`;
            if (seenInMenu.has(key)) {
              row.errors.push(`พบรหัสวัตถุดิบ "${row.ingredientCode}" ซ้ำซ้อนกันในเมนูนี้`);
              row.isRowValid = false;
            } else {
              seenInMenu.set(key, row.rowNum);
            }
          }
        });

        // Pass 3: Menu Grouping & Atomic Menu Validation (All-or-Nothing Rule)
        const menuRowsMap = new Map<string, ParsedImportRow[]>();
        rawParsed.forEach((row) => {
          const menuKey = row.menuCode
            ? row.menuCode.toUpperCase().trim()
            : `__NO_CODE_ROW_${row.rowNum}`;
          if (!menuRowsMap.has(menuKey)) {
            menuRowsMap.set(menuKey, []);
          }
          menuRowsMap.get(menuKey)!.push(row);
        });

        menuRowsMap.forEach((rows) => {
          const menuErrorsList: string[] = [];
          rows.forEach((r) => {
            if (r.errors.length > 0) {
              r.errors.forEach((err) => {
                menuErrorsList.push(
                  `แถว ${r.rowNum} (${r.ingredientCode || "ไม่ระบุรหัส"}): ${err}`,
                );
              });
            }
          });

          const isMenuValid = menuErrorsList.length === 0 && rows.length > 0;

          rows.forEach((r) => {
            r.isMenuValid = isMenuValid;
            r.menuErrors = menuErrorsList;
          });
        });

        setParsedImportRows(rawParsed);
        setImportFilterTab("all");
      } catch (err) {
        console.error("Excel parse error:", err);
        toast.error("ไม่สามารถอ่านไฟล์ Excel ได้ กรุณาตรวจสอบรูปแบบไฟล์");
      }
    };

    reader.readAsBinaryString(file);
  };

  // Grouped Menu Summary calculation
  const importMenuGroups = useMemo<ParsedImportMenuGroup[]>(() => {
    if (parsedImportRows.length === 0) return [];
    const map = new Map<string, ParsedImportMenuGroup>();

    parsedImportRows.forEach((row) => {
      const key = row.menuCode ? row.menuCode.toUpperCase().trim() : `__NO_CODE_ROW_${row.rowNum}`;
      if (!map.has(key)) {
        map.set(key, {
          menuCode: row.menuCode || "—",
          menuName: row.menuName || "ไม่ระบุชื่อเมนู",
          rows: [],
          totalRows: 0,
          isMenuValid: true,
          hasErrors: false,
          rowErrorsCount: 0,
          errors: [],
          errorSummary: "",
        });
      }
      const grp = map.get(key)!;
      grp.rows.push(row);
      grp.totalRows++;
      if (!row.isRowValid) {
        grp.rowErrorsCount++;
        row.errors.forEach((err) => {
          const formattedErr = `แถว ${row.rowNum} (${row.ingredientCode || "ไม่ระบุรหัส"}): ${err}`;
          if (!grp.errors.includes(formattedErr)) {
            grp.errors.push(formattedErr);
          }
        });
      }
    });

    map.forEach((grp) => {
      grp.isMenuValid = grp.errors.length === 0 && grp.rows.length > 0;
      grp.hasErrors = !grp.isMenuValid;
      grp.errorSummary = grp.errors.join(" | ");
    });

    return Array.from(map.values());
  }, [parsedImportRows]);

  // Overall Import Statistics
  const importStats = useMemo(() => {
    const totalMenus = importMenuGroups.length;
    const totalRows = parsedImportRows.length;
    const validMenus = importMenuGroups.filter((m) => m.isMenuValid);
    const invalidMenus = importMenuGroups.filter((m) => !m.isMenuValid);
    const validRowsCount = validMenus.reduce((s, m) => s + m.rows.length, 0);
    const invalidRowsCount = invalidMenus.reduce((s, m) => s + m.rows.length, 0);

    return {
      totalMenus,
      totalRows,
      validMenusCount: validMenus.length,
      validRowsCount,
      invalidMenusCount: invalidMenus.length,
      invalidRowsCount,
      validMenus,
      invalidMenus,
    };
  }, [importMenuGroups, parsedImportRows]);

  // Filtered rows & groups based on active filter tab
  const displayedImportMenus = useMemo(() => {
    if (importFilterTab === "valid") return importStats.validMenus;
    if (importFilterTab === "invalid") return importStats.invalidMenus;
    return importMenuGroups;
  }, [importFilterTab, importStats, importMenuGroups]);

  const displayedImportRows = useMemo(() => {
    if (importFilterTab === "valid") return parsedImportRows.filter((r) => r.isMenuValid);
    if (importFilterTab === "invalid") return parsedImportRows.filter((r) => !r.isMenuValid);
    return parsedImportRows;
  }, [importFilterTab, parsedImportRows]);

  // Toggle group expansion
  const toggleExpandImportMenu = (menuCode: string) => {
    setExpandedImportMenus((prev) => ({
      ...prev,
      [menuCode]: !prev[menuCode],
    }));
  };

  // Export Failed Menus to Excel for user to fix
  const handleExportFailedMenus = () => {
    const failedMenus = importStats.invalidMenus;
    if (failedMenus.length === 0) {
      toast.info("ไม่พบเมนูที่มีข้อผิดพลาด ทุกเมนูผ่านการตรวจสอบสมบูรณ์");
      return;
    }

    const exportData = failedMenus.flatMap((menu) =>
      menu.rows.map((r) => ({
        "Menu Code": r.menuCode,
        "Menu Name": r.menuName,
        "Ingredient Code": r.ingredientCode,
        "Ingredient Name": r.ingredientName,
        Quantity: r.quantity,
        Unit: r.unit,
        "Sub Recipe Code": r.subRecipeCode || "",
        Active: r.active ? "Y" : "N",
        สถานะเมนู: "ไม่ผ่าน (เมนูไม่สมบูรณ์และไม่ถูกนำเข้า)",
        ข้อผิดพลาดเฉพาะแถวนี้:
          r.errors.length > 0 ? r.errors.join(" | ") : "— (แถวนี้ข้อมูลถูกต้อง)",
        สรุปสาเหตุที่เมนูนี้ไม่ถูกนำเข้า: menu.errors.join(" | "),
      })),
    );

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet["!cols"] = [
      { wch: 14 }, // Menu Code
      { wch: 28 }, // Menu Name
      { wch: 18 }, // Ingredient Code
      { wch: 26 }, // Ingredient Name
      { wch: 12 }, // Quantity
      { wch: 10 }, // Unit
      { wch: 16 }, // Sub Recipe Code
      { wch: 8 }, // Active
      { wch: 38 }, // สถานะเมนู
      { wch: 40 }, // ข้อผิดพลาดเฉพาะแถวนี้
      { wch: 55 }, // สรุปสาเหตุที่เมนูนี้ไม่ถูกนำเข้า
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Failed_Menus_To_Fix");
    const fileName = `Failed_Recipes_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast.success(
      `Export เมนูที่ไม่ผ่านจำนวน ${failedMenus.length} เมนู (${exportData.length} แถว) เรียบร้อยแล้ว สามารถแก้ไขและนำเข้าใหม่อีกครั้ง`,
    );
  };

  const handleExecuteImport = async () => {
    const validMenus = importStats.validMenus;
    if (validMenus.length === 0) {
      toast.error("ไม่มีเมนูที่ผ่านการตรวจสอบ 100% สำหรับนำเข้า กรุณาแก้ไขข้อผิดพลาดก่อน");
      return;
    }

    const validItems = validMenus.flatMap((m) => m.rows);
    const payload: Omit<RecipeItem, "id">[] = validItems.map((r) => ({
      menuCode: r.menuCode,
      menuName: r.menuName,
      ingredientCode: r.ingredientCode,
      ingredientName: r.ingredientName,
      quantity: r.quantity,
      unit: r.unit,
      subRecipeCode: r.subRecipeCode || undefined,
      active: r.active,
    }));

    const result = await bulkImportRecipes(payload);
    if (result.success) {
      if (importStats.invalidMenusCount === 0) {
        toast.success(
          `นำเข้าสูตรอาหารสำเร็จครบถ้วนทั้ง ${validMenus.length} เมนู (${validItems.length} รายการ)`,
        );
        setParsedImportRows([]);
        setImportFileName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setMainTab("active");
      } else {
        toast.success(
          `นำเข้าสูตรอาหารสำเร็จ ${validMenus.length} เมนู (${validItems.length} รายการ) และข้าม ${importStats.invalidMenusCount} เมนูที่มีข้อผิดพลาด`,
        );
        // Retain only failed menus on screen so the user can easily review and click export
        const remainingInvalidRows = importStats.invalidMenus.flatMap((m) => m.rows);
        setParsedImportRows(remainingInvalidRows);
        setImportFilterTab("invalid");
      }
    } else {
      toast.error(result.error || "เกิดข้อผิดพลาดในการนำเข้าข้อมูล");
    }
  };

  // Helper to render recipe cards list
  const renderRecipeCards = (
    groups: ReturnType<typeof groupRecipes>,
    type: "active" | "inactive" | "deleted",
  ) => {
    if (groups.length === 0) {
      return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <ChefHat className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
            {type === "active"
              ? "ไม่พบสูตรอาหารที่ใช้งานอยู่"
              : type === "inactive"
                ? "ไม่มีสูตรอาหารที่ถูกปิดใช้งาน"
                : "ไม่มีประวัติสูตรอาหารที่ถูกลบ"}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {type === "active"
              ? "ยังไม่มีสูตรอาหารตรงตามเงื่อนไข สามารถเพิ่มสูตรใหม่หรือ Import จาก Excel"
              : "ไม่พบเมนูในหมวดหมู่นี้"}
          </p>
          {type === "active" && (
            <div className="flex justify-center gap-3">
              <button
                onClick={() => openAddModal()}
                className="px-4 py-2 text-sm font-medium text-white bg-stone-900 hover:bg-stone-800 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-100 rounded-lg transition-colors"
              >
                เพิ่มสูตรอาหารใหม่
              </button>
              <button
                onClick={() => setMainTab("import")}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Import จาก Excel
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {groups.map((group) => {
          const isExpanded = expandedMenus[group.menuCode] !== false;
          return (
            <div
              key={group.menuCode}
              className={`bg-white dark:bg-slate-900 rounded-xl border overflow-hidden shadow-xs transition-all ${
                type === "inactive"
                  ? "border-amber-200 dark:border-amber-900/50"
                  : type === "deleted"
                    ? "border-rose-200 dark:border-rose-900/50"
                    : "border-slate-200 dark:border-slate-800"
              }`}
            >
              {/* Menu Header Bar */}
              <div
                className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  type === "inactive"
                    ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40"
                    : type === "deleted"
                      ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
                      : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800"
                }`}
              >
                <button
                  onClick={() => toggleAccordion(group.menuCode)}
                  className="flex items-center gap-3 text-left hover:text-stone-900 dark:hover:text-amber-300 transition-colors focus:outline-hidden"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 text-xs font-mono font-bold rounded-md ${
                          type === "inactive"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                            : type === "deleted"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300"
                              : "bg-stone-900 text-stone-100 dark:bg-amber-950 dark:text-amber-200"
                        }`}
                      >
                        {group.menuCode}
                      </span>
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {group.menuName}
                      </h2>
                      {type === "inactive" && (
                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 rounded-full flex items-center gap-1">
                          <Power className="w-3 h-3" /> ปิดใช้งาน
                        </span>
                      )}
                      {type === "deleted" && (
                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 rounded-full flex items-center gap-1">
                          <Trash2 className="w-3 h-3" /> ถูกลบ / จัดเก็บ
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        วันที่บันทึก/นำเข้า:{" "}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {formatDateTime(
                            group.actionTimestamp || group.updatedAt || group.createdAt,
                          )}
                        </span>
                      </span>
                      <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">•</span>
                      <span>วัตถุดิบประกอบ: {group.lines.length} รายการ</span>
                    </div>
                  </div>
                </button>

                {/* Audit Details Banner for Inactive & Deleted */}
                {(type === "inactive" || type === "deleted") && (
                  <div className="text-xs p-2.5 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 max-w-md">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>วันเวลาที่ดำเนินการ: {formatTimestamp(group.actionTimestamp)}</span>
                    </div>
                    {group.reason && (
                      <div className="mt-1 text-slate-700 dark:text-slate-300">
                        <span className="font-semibold text-rose-600 dark:text-rose-400">
                          เหตุผล:{" "}
                        </span>
                        {group.reason}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Controls per Tab */}
                <div className="flex items-center gap-2 shrink-0">
                  {type === "active" && (
                    <>
                      <button
                        onClick={() => openAddModal(group.menuCode, group.menuName)}
                        className="px-3 py-1.5 text-xs font-medium text-amber-950 bg-amber-950/10 hover:bg-amber-950/20 dark:text-amber-200 dark:bg-amber-950/60 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        เพิ่มวัตถุดิบ
                      </button>
                      <button
                        onClick={() => triggerSetInactive(group.menuCode, group.menuName)}
                        className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-950/50 rounded-lg transition-colors flex items-center gap-1"
                        title="ปิดใช้งานเมนูนี้"
                      >
                        <Power className="w-3.5 h-3.5" />
                        ปิดใช้งาน
                      </button>
                      <button
                        onClick={() => triggerSoftDelete(group.menuCode, group.menuName)}
                        className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 dark:text-rose-300 dark:bg-rose-950/50 rounded-lg transition-colors flex items-center gap-1"
                        title="ลบเมนูนี้ไปยังประวัติการลบ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        ลบเมนู
                      </button>
                    </>
                  )}

                  {type === "inactive" && (
                    <>
                      <button
                        onClick={() => handleSetActive(group.menuCode, group.menuName)}
                        className="px-3.5 py-1.5 text-xs font-medium text-amber-950 bg-amber-950/10 hover:bg-amber-950/20 dark:text-amber-200 dark:bg-amber-950/60 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        เปิดใช้งานเมนู
                      </button>
                      <button
                        onClick={() => triggerSoftDelete(group.menuCode, group.menuName)}
                        className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 dark:text-rose-300 dark:bg-rose-950/50 rounded-lg transition-colors flex items-center gap-1"
                        title="ย้ายไปประวัติการลบ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        ลบเมนู
                      </button>
                    </>
                  )}

                  {type === "deleted" && (
                    <>
                      <button
                        onClick={() => handleRestoreMenu(group.menuCode, group.menuName)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-amber-950 bg-amber-950/10 hover:bg-amber-950/20 dark:text-amber-200 dark:bg-amber-950/60 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        คืนค่าเมนู
                      </button>
                      <button
                        onClick={() => triggerHardDelete(group.menuCode, group.menuName)}
                        className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 dark:text-rose-300 dark:bg-rose-950/50 rounded-lg transition-colors flex items-center gap-1.5"
                        title="ลบออกจากฐานข้อมูลถาวร"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        ลบถาวร
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Menu Ingredient Lines Table */}
              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-100/50 dark:bg-slate-800/30 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3">รหัสวัตถุดิบ (Ingredient Code)</th>
                        <th className="px-4 py-3">ชื่อวัตถุดิบ (Ingredient Name)</th>
                        <th className="px-4 py-3 text-right">ปริมาณต่อเมนู (Qty)</th>
                        <th className="px-4 py-3">หน่วยนับ (Unit)</th>
                        <th className="px-4 py-3">รหัสสูตรย่อย</th>
                        <th className="px-4 py-3 text-center">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {group.lines.map((line) => {
                        const isLinkedToMaster = items.some(
                          (i) =>
                            i.code.toLowerCase().trim() ===
                            line.ingredientCode.toLowerCase().trim(),
                        );

                        return (
                          <tr
                            key={line.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                          >
                            <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                              <div className="flex items-center gap-1.5">
                                {line.ingredientCode}
                                {isLinkedToMaster && (
                                  <span title="ตรงกับ Master Items">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-800 dark:text-amber-400" />
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                              {line.ingredientName}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-stone-900 dark:text-amber-300">
                              {line.quantity.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 3,
                              })}
                            </td>
                            <td className="px-4 py-3 text-slate-500">{line.unit}</td>
                            <td className="px-4 py-3 text-slate-400 text-xs">
                              {line.subRecipeCode || "—"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {type === "active" && (
                                  <button
                                    onClick={() => openEditModal(line)}
                                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                    title="แก้ไขวัตถุดิบ"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteLine(line.id, line.ingredientName)}
                                  className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                  title="ลบวัตถุดิบรายการนี้"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-stone-900 text-stone-100 dark:bg-amber-950 dark:text-amber-200 rounded-lg">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                สูตรอาหาร (Recipe Master)
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                จัดการโครงสร้างสูตรอาหาร เชื่อมโยงวัตถุดิบกับ Master Items
                และติดตามประวัติการแก้ไข/ปิดใช้งาน
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadTemplate}
            className="px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            ดาวน์โหลดแม่แบบ Excel
          </button>
          <button
            onClick={() => openAddModal()}
            className="px-4 py-2 text-sm font-medium text-white bg-stone-900 hover:bg-stone-800 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-100 rounded-lg transition-colors shadow-xs flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            เพิ่มสูตรอาหาร
          </button>
        </div>
      </div>

      {/* Main Tabs (Summary / Active / Inactive / Deleted / Import) */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <button
          onClick={() => setMainTab("summary")}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            mainTab === "summary"
              ? "border-stone-900 text-stone-900 dark:text-amber-300 dark:border-amber-400 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
          }`}
        >
          <Table2 className="w-4 h-4" />
          หน้าสรุปภาพรวม ({totalMenuCount})
        </button>
        <button
          onClick={() => setMainTab("active")}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            mainTab === "active"
              ? "border-stone-900 text-stone-900 dark:text-amber-300 dark:border-amber-400 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
          }`}
        >
          <ChefHat className="w-4 h-4" />
          การ์ดสูตรอาหาร ({activeCount})
        </button>
        <button
          onClick={() => setMainTab("inactive")}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            mainTab === "inactive"
              ? "border-amber-600 text-amber-600 dark:text-amber-400 dark:border-amber-500"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
          }`}
        >
          <Power className="w-4 h-4" />
          เมนูที่ถูกปิดใช้งาน ({inactiveCount})
        </button>
        <button
          onClick={() => setMainTab("deleted")}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            mainTab === "deleted"
              ? "border-rose-600 text-rose-600 dark:text-rose-400 dark:border-rose-500"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
          }`}
        >
          <Archive className="w-4 h-4" />
          ประวัติการลบ / ถังขยะ ({deletedCount})
        </button>
        <button
          onClick={() => setMainTab("import")}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            mainTab === "import"
              ? "border-stone-900 text-stone-900 dark:text-amber-300 dark:border-amber-400 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Import Excel / CSV
        </button>
      </div>

      {/* Search & Sort Bar for Card Recipe Tabs */}
      {mainTab !== "import" && mainTab !== "summary" && (
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหารหัสเมนู, ชื่อเมนู, รหัสวัตถุดิบ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-stone-800"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-between md:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap flex items-center gap-1 font-medium">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                เรียงตาม:
              </span>
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as
                      | "date_desc"
                      | "date_asc"
                      | "code_asc"
                      | "code_desc"
                      | "name_asc"
                      | "count_desc",
                  )
                }
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-stone-800"
              >
                <option value="date_desc">📅 วันที่นำเข้า/บันทึก (ใหม่สุด → เก่าสุด)</option>
                <option value="date_asc">📅 วันที่นำเข้า/บันทึก (เก่าสุด → ใหม่สุด)</option>
                <option value="code_asc">🔤 รหัสเมนู (A → Z)</option>
                <option value="code_desc">🔤 รหัสเมนู (Z → A)</option>
                <option value="name_asc">📝 ชื่อเมนู (ก → ฮ)</option>
                <option value="count_desc">📊 จำนวนวัตถุดิบ (มาก → น้อย)</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              แสดงผล:{" "}
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {mainTab === "active"
                  ? `เมนูที่ใช้งานอยู่ (${activeRecipesGrouped.length})`
                  : mainTab === "inactive"
                    ? `เมนูที่ปิดใช้งาน (${inactiveRecipesGrouped.length})`
                    : `ประวัติเมนูที่ถูกลบ (${deletedRecipesGrouped.length})`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 0: SUMMARY VIEW */}
      {mainTab === "summary" && (
        <RecipeMasterSummaryView
          recipes={recipes}
          items={items}
          onOpenCreate={(presetMenuCode, presetMenuName) => {
            openAddModal(presetMenuCode, presetMenuName);
          }}
          onOpenEdit={(item) => {
            openEditModal(item);
          }}
          onSetActive={(menuCode, menuName) => {
            handleSetActive(menuCode, menuName);
          }}
          onSetInactive={(menuCode, menuName) => {
            triggerSetInactive(menuCode, menuName);
          }}
          onRestore={(menuCode, menuName) => {
            handleRestoreMenu(menuCode, menuName);
          }}
          onSoftDelete={(menuCode, menuName) => {
            triggerSoftDelete(menuCode, menuName);
          }}
          onSwitchToCards={(targetMenuCode) => {
            setMainTab("active");
            if (targetMenuCode) {
              setSearchQuery(targetMenuCode);
              setExpandedMenus((prev) => ({ ...prev, [targetMenuCode]: true }));
            }
          }}
        />
      )}

      {/* TAB 1: ACTIVE RECIPES */}
      {mainTab === "active" && renderRecipeCards(activeRecipesGrouped, "active")}

      {/* TAB 2: INACTIVE RECIPES */}
      {mainTab === "inactive" && renderRecipeCards(inactiveRecipesGrouped, "inactive")}

      {/* TAB 3: DELETED / ARCHIVED RECIPES */}
      {mainTab === "deleted" && renderRecipeCards(deletedRecipesGrouped, "deleted")}

      {/* TAB 4: EXCEL IMPORT VIEW */}
      {mainTab === "import" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  นำเข้าสูตรอาหารด้วยไฟล์ Excel (.xlsx, .csv)
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  ตรวจสอบรหัสวัตถุดิบกับ Master Items โดยอัตโนมัติก่อนนำเข้า
                </p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="px-4 py-2 text-sm font-medium text-amber-950 bg-amber-950/10 hover:bg-amber-950/20 dark:text-amber-200 dark:bg-amber-950/60 rounded-lg transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                ดาวน์โหลดแม่แบบ Excel (Recipe Master Template)
              </button>
            </div>

            {/* Dropzone */}
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="w-10 h-10 mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                ลากและวางไฟล์ Excel/CSV ที่นี่ หรือคลิกเพื่อเลือกไฟล์
              </p>
              <p className="text-xs text-slate-400 mt-1">รองรับรูปแบบ .xlsx, .xls, .csv</p>
              {importFileName && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-stone-900 text-stone-100 dark:bg-amber-950 dark:text-amber-200 rounded-md text-xs font-medium">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  ไฟล์ที่เลือก: {importFileName}
                </div>
              )}
            </div>
          </div>

          {/* Import Preview Results */}
          {parsedImportRows.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-medium text-slate-500">ข้อมูลทั้งหมดในไฟล์</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
                      {importStats.totalMenus}{" "}
                      <span className="text-sm font-normal text-slate-500">เมนู</span>
                    </p>
                    <span className="text-xs text-slate-500 font-mono">
                      ({importStats.totalRows} แถว)
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                      พร้อมนำเข้า (ผ่าน 100%)
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                      {importStats.validMenusCount}{" "}
                      <span className="text-sm font-normal text-emerald-600 dark:text-emerald-400">
                        เมนู
                      </span>
                    </p>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                      ({importStats.validRowsCount} แถว)
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-rose-50/80 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-rose-800 dark:text-rose-400">
                      นำเข้าไม่ได้ (มีข้อผิดพลาด)
                    </span>
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <p className="text-2xl font-black text-rose-700 dark:text-rose-300">
                      {importStats.invalidMenusCount}{" "}
                      <span className="text-sm font-normal text-rose-600 dark:text-rose-400">
                        เมนู
                      </span>
                    </p>
                    <span className="text-xs text-rose-600 dark:text-rose-400 font-mono">
                      ({importStats.invalidRowsCount} แถว)
                    </span>
                  </div>
                </div>
              </div>

              {/* Atomic Recipe Rule Notice Banner */}
              <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-xl flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200">
                <ShieldAlert className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-sm">
                    กฎความถูกต้องระดับเมนู (Atomic Recipe Validation):
                  </span>
                  <p className="text-blue-800 dark:text-blue-300 leading-relaxed">
                    ระบบจะนำเข้าเฉพาะเมนูที่ผ่านการตรวจสอบวัตถุดิบครบ 100% ทุกรายการเท่านั้น
                    หากเมนูใดมีข้อผิดพลาดแม้แต่วัตถุดิบเดียว ระบบจะ{" "}
                    <strong>"ยกเว้นการนำเข้าทั้งเมนูนั้น"</strong>{" "}
                    เพื่อป้องกันไม่ให้สูตรอาหารขาดวัตถุดิบและป้องกันสต็อก/ต้นทุนผิดพลาด
                  </p>
                </div>
              </div>

              {/* Failed Menus Summary & Export Alert Card */}
              {importStats.invalidMenusCount > 0 && (
                <div className="p-4 bg-rose-50/90 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <AlertOctagon className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                          พบเมนูที่ไม่สามารถนำเข้าได้ {importStats.invalidMenusCount} เมนู (
                          {importStats.invalidRowsCount} รายการ)
                        </h4>
                        <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                          เมนูเหล่านี้จะไม่ถูกบันทึกเข้าสู่ระบบ
                          ท่านสามารถดาวน์โหลดไฟล์สรุปข้อผิดพลาด เพื่อนำไปแก้ไขและนำเข้าใหม่อีกครั้ง
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleExportFailedMenus}
                      className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600 rounded-lg shadow-sm flex items-center gap-2 shrink-0 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Export เมนูที่ไม่ผ่านไปแก้ไข ({importStats.invalidMenusCount} เมนู)
                    </button>
                  </div>

                  {/* Summary breakdown of failed menus */}
                  <div className="pt-2 border-t border-rose-200 dark:border-rose-800/80">
                    <p className="text-xs font-semibold text-rose-800 dark:text-rose-300 mb-1.5">
                      รายชื่อเมนูที่ไม่ผ่านและสาเหตุ:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                      {importStats.invalidMenus.map((grp) => (
                        <div
                          key={grp.menuCode}
                          className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-900 text-xs space-y-1 shadow-xs"
                        >
                          <div className="flex items-center justify-between gap-2 font-bold text-rose-900 dark:text-rose-200">
                            <span className="truncate">
                              [{grp.menuCode}] {grp.menuName}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-mono shrink-0">
                              {grp.rows.length} รายการ
                            </span>
                          </div>
                          <div className="text-[11px] text-rose-600 dark:text-rose-400 space-y-0.5">
                            {grp.errors.map((e, ei) => (
                              <p key={ei} className="line-clamp-2">
                                • {e}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* View Mode & Filter Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 pb-1">
                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button
                    onClick={() => setImportFilterTab("all")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      importFilterTab === "all"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    ทั้งหมด ({importStats.totalMenus} เมนู)
                  </button>
                  <button
                    onClick={() => setImportFilterTab("valid")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      importFilterTab === "valid"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-emerald-700 dark:text-emerald-400 hover:text-emerald-800"
                    }`}
                  >
                    ผ่าน 100% ({importStats.validMenusCount} เมนู)
                  </button>
                  <button
                    onClick={() => setImportFilterTab("invalid")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      importFilterTab === "invalid"
                        ? "bg-rose-600 text-white shadow-xs"
                        : "text-rose-700 dark:text-rose-400 hover:text-rose-800"
                    }`}
                  >
                    ไม่ผ่าน ({importStats.invalidMenusCount} เมนู)
                  </button>
                </div>

                {/* View Mode Toggle & Actions */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-slate-50 dark:bg-slate-800">
                    <button
                      onClick={() => setImportViewMode("grouped")}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                        importViewMode === "grouped"
                          ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-bold"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      สูตรตามเมนู
                    </button>
                    <button
                      onClick={() => setImportViewMode("flat")}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                        importViewMode === "flat"
                          ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-bold"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      ตารางทุกแถว
                    </button>
                  </div>

                  <button
                    onClick={handleExecuteImport}
                    disabled={importStats.validMenusCount === 0}
                    className="px-4 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-100 disabled:bg-slate-300 dark:disabled:bg-slate-800 rounded-lg transition-colors shadow-xs flex items-center gap-2"
                  >
                    <Check className="w-3.5 h-3.5" />
                    นำเข้าเฉพาะเมนูที่ผ่าน ({importStats.validMenusCount} เมนู /{" "}
                    {importStats.validRowsCount} แถว)
                  </button>
                </div>
              </div>

              {/* Grouped View */}
              {importViewMode === "grouped" && (
                <div className="space-y-3">
                  {displayedImportMenus.length === 0 ? (
                    <div className="p-8 text-center border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <p className="text-sm text-slate-500">ไม่พบเมนูในหมวดหมู่นี้</p>
                    </div>
                  ) : (
                    displayedImportMenus.map((grp) => {
                      const isExpanded = expandedImportMenus[grp.menuCode] ?? !grp.isMenuValid;
                      return (
                        <div
                          key={grp.menuCode}
                          className={`rounded-xl border transition-colors overflow-hidden ${
                            grp.isMenuValid
                              ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                              : "bg-rose-50/20 dark:bg-rose-950/10 border-rose-300 dark:border-rose-800"
                          }`}
                        >
                          {/* Menu Group Header */}
                          <div
                            onClick={() => toggleExpandImportMenu(grp.menuCode)}
                            className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 select-none"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
                                {grp.menuCode}
                              </span>
                              <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                                {grp.menuName}
                              </span>
                              <span className="text-xs text-slate-400">
                                ({grp.rows.length} วัตถุดิบ)
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              {grp.isMenuValid ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> ผ่าน 100% (พร้อมนำเข้า)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 rounded-lg border border-rose-300 dark:border-rose-800">
                                  <AlertOctagon className="w-3.5 h-3.5" /> พบข้อผิดพลาด
                                  (ไม่ถูกนำเข้า)
                                </span>
                              )}
                              <ChevronDown
                                className={`w-4 h-4 text-slate-400 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </div>
                          </div>

                          {/* Expanded Table & Errors */}
                          {isExpanded && (
                            <div className="border-t border-slate-200 dark:border-slate-800 p-3 space-y-3 bg-slate-50/40 dark:bg-slate-800/20">
                              {/* Error callout if invalid */}
                              {!grp.isMenuValid && (
                                <div className="p-3 bg-rose-100/70 dark:bg-rose-950/60 rounded-lg border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 space-y-1">
                                  <span className="font-bold flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5" />{" "}
                                    สาเหตุที่เมนูนี้ไม่ถูกนำเข้า:
                                  </span>
                                  <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-1">
                                    {grp.errors.map((err, ei) => (
                                      <li key={ei}>{err}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Ingredient Lines */}
                              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                      <th className="px-3 py-2">แถวที่</th>
                                      <th className="px-3 py-2">รหัสวัตถุดิบ</th>
                                      <th className="px-3 py-2">ชื่อวัตถุดิบ</th>
                                      <th className="px-3 py-2 text-right">ปริมาณ</th>
                                      <th className="px-3 py-2">หน่วย</th>
                                      <th className="px-3 py-2">สถานะแถว</th>
                                      <th className="px-3 py-2">ข้อผิดพลาด / หมายเหตุ</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {grp.rows.map((row) => (
                                      <tr
                                        key={row.rowNum}
                                        className={
                                          row.isRowValid
                                            ? "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                            : "bg-rose-50/60 dark:bg-rose-950/30"
                                        }
                                      >
                                        <td className="px-3 py-2 font-mono text-slate-500">
                                          {row.rowNum}
                                        </td>
                                        <td className="px-3 py-2 font-mono font-bold">
                                          {row.ingredientCode || "—"}
                                        </td>
                                        <td className="px-3 py-2">{row.ingredientName || "—"}</td>
                                        <td className="px-3 py-2 text-right font-semibold">
                                          {row.quantity}
                                        </td>
                                        <td className="px-3 py-2 text-slate-500">{row.unit}</td>
                                        <td className="px-3 py-2">
                                          {row.isRowValid ? (
                                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                              <CheckCircle2 className="w-3 h-3" /> ถูกต้อง
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 dark:text-rose-400 font-bold">
                                              <AlertTriangle className="w-3 h-3" /> ข้อผิดพลาด
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 text-[11px]">
                                          {row.errors.length > 0 ? (
                                            <span className="text-rose-600 dark:text-rose-400 font-medium">
                                              {row.errors.join(", ")}
                                            </span>
                                          ) : !grp.isMenuValid ? (
                                            <span className="text-amber-600 dark:text-amber-400 italic">
                                              (ระงับเนื่องจากวัตถุดิบอื่นในเมนูนี้มีข้อผิดพลาด)
                                            </span>
                                          ) : (
                                            <span className="text-slate-400">—</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Flat Table View */}
              {importViewMode === "flat" && (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-3 py-2.5">แถว</th>
                        <th className="px-3 py-2.5">สถานะเมนู</th>
                        <th className="px-3 py-2.5">รหัสเมนู</th>
                        <th className="px-3 py-2.5">ชื่อเมนู</th>
                        <th className="px-3 py-2.5">รหัสวัตถุดิบ</th>
                        <th className="px-3 py-2.5">ชื่อวัตถุดิบ</th>
                        <th className="px-3 py-2.5 text-right">ปริมาณ</th>
                        <th className="px-3 py-2.5">หน่วยนับ</th>
                        <th className="px-3 py-2.5">ข้อผิดพลาด / หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {displayedImportRows.map((row) => (
                        <tr
                          key={row.rowNum}
                          className={
                            row.isMenuValid
                              ? "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                              : "bg-rose-50/50 dark:bg-rose-950/20"
                          }
                        >
                          <td className="px-3 py-2 font-mono text-xs text-slate-500">
                            {row.rowNum}
                          </td>
                          <td className="px-3 py-2">
                            {row.isMenuValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-md">
                                <CheckCircle2 className="w-3 h-3" /> ผ่าน
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 rounded-md">
                                <AlertTriangle className="w-3 h-3" /> ไม่ผ่าน
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs font-bold">
                            {row.menuCode || "—"}
                          </td>
                          <td className="px-3 py-2 font-medium">{row.menuName || "—"}</td>
                          <td className="px-3 py-2 font-mono text-xs font-bold">
                            {row.ingredientCode || "—"}
                          </td>
                          <td className="px-3 py-2">{row.ingredientName || "—"}</td>
                          <td className="px-3 py-2 text-right font-semibold">{row.quantity}</td>
                          <td className="px-3 py-2 text-slate-500">{row.unit}</td>
                          <td className="px-3 py-2 text-xs">
                            {row.errors.length > 0 ? (
                              <div className="space-y-0.5">
                                {row.errors.map((err, i) => (
                                  <p
                                    key={i}
                                    className="text-rose-600 dark:text-rose-400 font-medium"
                                  >
                                    • {err}
                                  </p>
                                ))}
                              </div>
                            ) : !row.isMenuValid ? (
                              <span className="text-amber-600 dark:text-amber-400 italic">
                                ระงับเนื่องจากเมนูไม่สมบูรณ์ ({row.menuErrors.length} ข้อผิดพลาด)
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* REASON TRACKING MODAL */}
      {isReasonModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2.5">
                {reasonActionType === "inactive" ? (
                  <Power className="w-5 h-5 text-amber-500" />
                ) : (
                  <Trash2 className="w-5 h-5 text-rose-500" />
                )}
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {reasonActionType === "inactive"
                    ? "ระบุเหตุผลในการปิดใช้งานเมนู"
                    : "ระบุเหตุผลในการลบเมนู"}
                </h3>
              </div>
              <button
                onClick={() => setIsReasonModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-lg text-xs space-y-1">
                <p className="text-slate-500 dark:text-slate-400">เมนูที่เลือกทำรายการ:</p>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  [{targetMenuCode}] {targetMenuName}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  เหตุผลในการดำเนินการ <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="เช่น ยกเลิกการขายเนื่องจากวัตถุดิบขาดตลาด, กรอกข้อมูลผิด ฯลฯ"
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-stone-800"
                />

                {/* Quick reason tag selectors */}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {[
                    "เมนูยกเลิกการขาย",
                    "วัตถุดิบหมด / ยกเลิกใช้",
                    "ปรับเปลี่ยนสูตรใหม่",
                    "กรอกข้อมูลผิดพลาด",
                    "ปิดชั่วคราว",
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setReasonText(tag)}
                      className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReasonModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReason}
                  className={`px-5 py-2 text-sm font-semibold text-white rounded-lg shadow-xs transition-colors ${
                    reasonActionType === "inactive"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  ยืนยันบันทึกเหตุผล
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HARD DELETE PERMANENT CONFIRMATION MODAL */}
      {isHardDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-rose-50 dark:bg-rose-950/30">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold">ยืนยันการลบสูตรอาหารถาวร</h3>
              </div>
              <button
                onClick={() => setIsHardDeleteModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                คุณกำลังจะลบสูตรอาหารของเมนู{" "}
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  [{hardDeleteMenuCode}] {hardDeleteMenuName}
                </span>{" "}
                ออกจากฐานข้อมูล Supabase อย่างถาวร
              </p>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-lg text-xs text-rose-700 dark:text-rose-300 font-medium">
                ⚠️ การลบถาวรนี้ไม่สามารถย้อนคืนได้ ข้อมูลสูตรอาหารของเมนูนี้ในระบบจะถูกลบออกทั้งหมด
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsHardDeleteModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmHardDelete}
                  className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
                >
                  ยืนยันลบถาวร
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT RECIPE INGREDIENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ChefHat className="w-5 h-5 text-amber-950 dark:text-amber-400" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {editingItem ? "แก้ไขวัตถุดิบในสูตรอาหาร" : "เพิ่มวัตถุดิบในสูตรอาหาร"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecipe} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Menu Code */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    รหัสเมนู (Menu Code) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น M001"
                    value={formMenuCode}
                    onChange={(e) => handleMenuCodeChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-stone-800 font-mono"
                  />
                </div>

                {/* Menu Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ชื่อเมนู (Menu Name) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ข้าวหน้าปลาแซลมอน"
                    value={formMenuName}
                    onChange={(e) => setFormMenuName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-stone-800"
                  />
                </div>
              </div>

              {/* Ingredient Code Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  รหัสวัตถุดิบ (Ingredient Code) <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    required
                    list="master-items-list"
                    placeholder="เลือกรหัส หรือพิมพ์ค้นหาจาก Master Items"
                    value={formIngCode}
                    onChange={(e) => handleIngCodeChange(e.target.value)}
                    className={`w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border rounded-lg focus:outline-hidden focus:ring-2 font-mono ${
                      formIngCode && !matchedMasterItem
                        ? "border-rose-400 focus:ring-rose-500"
                        : "border-slate-200 dark:border-slate-700 focus:ring-stone-800"
                    }`}
                  />
                  <datalist id="master-items-list">
                    {items.map((it) => (
                      <option key={it.id} value={it.code}>
                        {it.name} ({it.unit})
                      </option>
                    ))}
                  </datalist>

                  {/* Validation Banner */}
                  {formIngCode.trim() && (
                    <div className="space-y-1.5">
                      {matchedMasterItem ? (
                        <>
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/10 dark:bg-amber-950/50 text-stone-900 dark:text-amber-300 text-xs rounded-md">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              พบวัตถุดิบใน Master Items: <strong>{matchedMasterItem.name}</strong>
                            </span>
                          </div>
                          {matchingSupplierVariants.length > 1 && (
                            <div className="flex items-start gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 text-xs rounded-md">
                              <Layers className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                              <div>
                                <span className="font-bold">
                                  ตรวจพบ {matchingSupplierVariants.length} รายการซัพพลายเออร์:
                                </span>
                                <div className="font-mono text-[11px] text-emerald-800 dark:text-emerald-400 mt-0.5">
                                  {matchingSupplierVariants.map((v) => v.code).join(", ")}
                                </div>
                                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                                  💡 ระบบจะตัดสต็อคผัก/วัตถุดิบแบบ FIFO (เข้าก่อน-ออกก่อน)
                                  อัตโนมัติเมื่อผลิต
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs rounded-md">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            ไม่พบรหัสวัตถุดิบนี้ใน Master Items (กรุณาใช้รหัสวัตถุดิบที่มีอยู่จริง)
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Ingredient Name (Locked if matched) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    ชื่อวัตถุดิบ (Ingredient Name)
                  </label>
                  {matchedMasterItem && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-900 dark:text-amber-400 font-medium">
                      <Lock className="w-3 h-3" /> ล็อคชื่อตาม Master Items
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  readOnly={!!matchedMasterItem}
                  value={matchedMasterItem ? matchedMasterItem.name : formIngName}
                  onChange={(e) => setFormIngName(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${
                    matchedMasterItem
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Quantity */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ปริมาณต่อเมนู (Quantity) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    required
                    value={formQty}
                    onChange={(e) => setFormQty(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-stone-800"
                  />
                </div>

                {/* Unit */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    หน่วยนับ (Unit) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="recipe-units-list"
                    placeholder="เช่น g, kg, ml, pcs"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-stone-800"
                  />
                  <datalist id="recipe-units-list">
                    {Array.from(
                      new Set(
                        items
                          .flatMap((i) => [i.recipeUnit, i.stockUnit, i.unit])
                          .filter((u): u is string => Boolean(u?.trim())),
                      ),
                    ).map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Sub recipe code & Active */}
              <div className="grid grid-cols-2 gap-4 items-center pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    รหัสสูตรย่อย (Sub Recipe Code - ถ้ามี)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น SUB01"
                    value={formSubCode}
                    onChange={(e) => setFormSubCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div className="pt-5">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                      className="w-4 h-4 text-stone-900 rounded-xs border-slate-300 focus:ring-stone-800"
                    />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      เปิดใช้งาน (Active)
                    </span>
                  </label>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={!matchedMasterItem}
                  className="px-5 py-2 text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-100 disabled:bg-slate-300 dark:disabled:bg-slate-800 rounded-lg shadow-xs"
                >
                  {editingItem ? "บันทึกการแก้ไข" : "บันทึกสูตรอาหาร"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
