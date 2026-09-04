import React, { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { convertUsageToMasterUnit, formatUnitThai } from "@/lib/unitConversion";
import { findMatchingMasterItems, findPrimaryMatchingMasterItem } from "@/lib/ingredientMatching";
import type { Item } from "@/lib/types";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { printReportDocument } from "./printReports";
import {
  Calculator,
  Calendar,
  Filter,
  Download,
  Search,
  Eye,
  Building2,
  Tag,
  ChefHat,
  X,
  PieChart,
  Layers,
  ArrowUpDown,
  FileSpreadsheet,
  Printer,
} from "lucide-react";

interface MenuBreakdownItem {
  menuCode: string;
  menuName: string;
  quantitySold: number;
  recipeQuantity: number;
  recipeUnit: string;
  contributedUsageRaw: number;
  contributedUsageConverted: number;
  percentOfTotal: number;
}

interface IngredientUsageSummary {
  ingredientCode: string;
  ingredientName: string;
  categoryName: string;
  masterUnit: string;
  recipeUnit: string;
  totalUsageRaw: number;
  totalUsageConverted: number;
  isConverted: boolean;
  conversionFactor: number;
  matchingSupplierItems?: Item[];
  breakdown: MenuBreakdownItem[];
}

export interface TheoreticalUsagePageProps {
  hideTitleHeader?: boolean;
}

export function TheoreticalUsagePage({ hideTitleHeader = false }: TheoreticalUsagePageProps) {
  const { recipes, salesRecords, items, categories, branches, settings, currentUser } = useStore();

  // Filters State
  const [startDate, setStartDate] = useState<string>(() => {
    // Default to first day of current month
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("all");
  const [searchIngredient, setSearchIngredient] = useState<string>("");
  const [selectedMenuCode, setSelectedMenuCode] = useState<string>("all");

  // Breakdown Modal State
  const [selectedUsageItem, setSelectedUsageItem] = useState<IngredientUsageSummary | null>(null);

  // Date Quick Presets
  const applyDatePreset = (preset: "today" | "7days" | "thisMonth" | "allTime") => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "7days") {
      const past7 = new Date();
      past7.setDate(today.getDate() - 7);
      setStartDate(past7.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === "thisMonth") {
      const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(startMonth.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === "allTime") {
      setStartDate("");
      setEndDate("");
    }
  };

  // Master Item Map for fast lookup (Category, Unit, Master Item Object)
  const itemMasterMap = useMemo(() => {
    const map = new Map<string, Item>();
    items.forEach((item) => {
      if (item.code) {
        map.set(item.code.toLowerCase().trim(), item);
      }
    });
    return map;
  }, [items]);

  const itemCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => {
      const cat = categories.find((c) => c.id === item.categoryId);
      map.set(item.code.toLowerCase().trim(), cat?.name || "ไม่ระบุหมวดหมู่");
    });
    return map;
  }, [items, categories]);

  // Unique Menus list for filter dropdown
  const availableMenus = useMemo(() => {
    const map = new Map<string, string>();
    recipes.forEach((r) => map.set(r.menuCode, r.menuName));
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [recipes]);

  // CALCULATE THEORETICAL USAGE WITH UNIT CONVERSION
  const usageSummaries = useMemo(() => {
    // 1. Filter Sales Records by date range, branch, and menu code
    const filteredSales = salesRecords.filter((sale) => {
      const matchesBranch = selectedBranchId === "all" || sale.branchId === selectedBranchId;
      const matchesStart = !startDate || sale.date >= startDate;
      const matchesEnd = !endDate || sale.date <= endDate;
      const matchesMenu = selectedMenuCode === "all" || sale.menuCode === selectedMenuCode;

      return matchesBranch && matchesStart && matchesEnd && matchesMenu;
    });

    // 2. Aggregate usage by Ingredient Code
    const map = new Map<
      string,
      {
        ingredientCode: string;
        ingredientName: string;
        categoryName: string;
        masterUnit: string;
        recipeUnit: string;
        masterItem?: Item;
        totalUsageRaw: number;
        menuMap: Map<
          string,
          {
            menuCode: string;
            menuName: string;
            quantitySold: number;
            recipeQuantity: number;
            recipeUnit: string;
            contributedUsageRaw: number;
          }
        >;
      }
    >();

    filteredSales.forEach((sale) => {
      // Find recipe lines for this menuCode
      const matchingRecipes = recipes.filter(
        (r) => r.active && r.menuCode.toLowerCase().trim() === sale.menuCode.toLowerCase().trim(),
      );

      matchingRecipes.forEach((recipeLine) => {
        const ingCode = recipeLine.ingredientCode.trim();
        const matchingItems = findMatchingMasterItems(ingCode, items);
        const primaryItem =
          findPrimaryMatchingMasterItem(ingCode, items) ||
          itemMasterMap.get(ingCode.toLowerCase()) ||
          matchingItems[0];

        const ingKey = (primaryItem?.code || ingCode).toLowerCase();
        const contributedRaw = sale.quantitySold * recipeLine.quantity;

        const cat = primaryItem
          ? categories.find((c) => c.id === primaryItem.categoryId)
          : undefined;
        const categoryName = cat?.name || itemCategoryMap.get(ingKey) || "ไม่ระบุหมวดหมู่";
        const masterUnit = primaryItem?.unit
          ? formatUnitThai(primaryItem.unit)
          : formatUnitThai(recipeLine.unit);

        let entry = map.get(ingKey);
        if (!entry) {
          entry = {
            ingredientCode: primaryItem?.code || recipeLine.ingredientCode,
            ingredientName: primaryItem?.name || recipeLine.ingredientName,
            categoryName,
            masterUnit,
            recipeUnit: formatUnitThai(recipeLine.unit),
            masterItem: primaryItem,
            matchingSupplierItems: matchingItems,
            totalUsageRaw: 0,
            menuMap: new Map(),
          };
          map.set(ingKey, entry);
        }

        entry.totalUsageRaw += contributedRaw;

        // Track menu breakdown
        const menuKey = sale.menuCode.toLowerCase();
        let menuEntry = entry.menuMap.get(menuKey);
        if (!menuEntry) {
          menuEntry = {
            menuCode: sale.menuCode,
            menuName: sale.menuName || recipeLine.menuName,
            quantitySold: 0,
            recipeQuantity: recipeLine.quantity,
            recipeUnit: formatUnitThai(recipeLine.unit),
            contributedUsageRaw: 0,
          };
          entry.menuMap.set(menuKey, menuEntry);
        }

        menuEntry.quantitySold += sale.quantitySold;
        menuEntry.contributedUsageRaw += contributedRaw;
      });
    });

    // Convert map to sorted summary list with unit conversion
    let list: IngredientUsageSummary[] = Array.from(map.values()).map((item) => {
      const conv = convertUsageToMasterUnit(
        item.totalUsageRaw,
        item.recipeUnit,
        item.masterUnit,
        item.masterItem,
      );

      const breakdownList: MenuBreakdownItem[] = Array.from(item.menuMap.values()).map((m) => {
        const contribConv = m.contributedUsageRaw * conv.factor;
        return {
          menuCode: m.menuCode,
          menuName: m.menuName,
          quantitySold: m.quantitySold,
          recipeQuantity: m.recipeQuantity,
          recipeUnit: m.recipeUnit,
          contributedUsageRaw: m.contributedUsageRaw,
          contributedUsageConverted: contribConv,
          percentOfTotal:
            item.totalUsageRaw > 0 ? (m.contributedUsageRaw / item.totalUsageRaw) * 100 : 0,
        };
      });

      // Sort breakdown by converted contributed usage descending
      breakdownList.sort((a, b) => b.contributedUsageConverted - a.contributedUsageConverted);

      return {
        ingredientCode: item.ingredientCode,
        ingredientName: item.ingredientName,
        categoryName: item.categoryName,
        masterUnit: conv.masterUnit,
        recipeUnit: conv.recipeUnit,
        totalUsageRaw: item.totalUsageRaw,
        totalUsageConverted: conv.convertedQty,
        isConverted: conv.isConverted,
        conversionFactor: conv.factor,
        matchingSupplierItems: item.matchingSupplierItems,
        breakdown: breakdownList,
      };
    });

    // Filter by Category
    if (selectedCategoryName !== "all") {
      list = list.filter((item) => item.categoryName === selectedCategoryName);
    }

    // Filter by Search Query
    if (searchIngredient.trim()) {
      const query = searchIngredient.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.ingredientCode.toLowerCase().includes(query) ||
          item.ingredientName.toLowerCase().includes(query),
      );
    }

    // Sort by Total Usage Converted Descending
    list.sort((a, b) => b.totalUsageConverted - a.totalUsageConverted);

    return list;
  }, [
    salesRecords,
    recipes,
    startDate,
    endDate,
    selectedBranchId,
    selectedMenuCode,
    selectedCategoryName,
    searchIngredient,
    itemCategoryMap,
    itemMasterMap,
  ]);

  // Overall statistics
  const grandTotalItemsCount = usageSummaries.length;
  const maxUsageInList = useMemo(() => {
    return usageSummaries.length > 0 ? usageSummaries[0].totalUsageConverted : 1;
  }, [usageSummaries]);

  // EXPORT TO EXCEL WITH CONVERTED MASTER UNITS
  const handleExportExcel = () => {
    if (usageSummaries.length === 0) {
      toast.error("ไม่มีข้อมูลการใช้ตามสูตรสำหรับส่งออก");
      return;
    }

    // Sheet 1: Theoretical Usage Summary
    const summaryRows = usageSummaries.map((item) => ({
      "รหัสวัตถุดิบ (Ingredient Code)": item.ingredientCode,
      "ชื่อวัตถุดิบ (Ingredient Name)": item.ingredientName,
      "หมวดหมู่ (Category)": item.categoryName,
      "ใช้ตามสูตร (Master Unit Usage)": Number(item.totalUsageConverted.toFixed(3)),
      "หน่วยนับหลัก (Master Unit)": item.masterUnit,
      "ปริมาณสูตรเดิม (Recipe Raw Usage)": Number(item.totalUsageRaw.toFixed(2)),
      "หน่วยสูตรเดิม (Recipe Unit)": item.recipeUnit,
      สถานะการแปลงหน่วย: item.isConverted ? "แปลงเป็นหน่วยนับหลักแล้ว" : "หน่วยตรงกัน",
      จำนวนเมนูที่ใช้: (item.breakdown || []).length,
    }));

    // Sheet 2: Detailed Menu Breakdown
    const detailRows: Record<string, unknown>[] = [];
    usageSummaries.forEach((item) => {
      (item.breakdown || []).forEach((b) => {
        detailRows.push({
          รหัสวัตถุดิบ: item.ingredientCode,
          ชื่อวัตถุดิบ: item.ingredientName,
          "หน่วยนับหลัก (Master Unit)": item.masterUnit,
          รหัสเมนู: b.menuCode,
          ชื่อเมนู: b.menuName,
          "จำนวนขาย (Qty Sold)": b.quantitySold,
          ปริมาณสูตรต่อเมนู: `${b.recipeQuantity} ${b.recipeUnit}`,
          "ปริมาณการใช้รวม (หน่วยนับหลัก)": Number(b.contributedUsageConverted.toFixed(3)),
          "ปริมาณการใช้รวม (หน่วยสูตรเดิม)": Number(b.contributedUsageRaw.toFixed(2)),
          "สัดส่วน (%)": `${b.percentOfTotal.toFixed(1)}%`,
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    const wsDetails = XLSX.utils.json_to_sheet(detailRows);

    XLSX.utils.book_append_sheet(wb, wsSummary, "สรุปการใช้ตามสูตร");
    XLSX.utils.book_append_sheet(wb, wsDetails, "รายละเอียดแยกตามเมนู");

    const fileName = `Theoretical_Usage_Report_${startDate || "All"}_to_${endDate || "All"}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("ส่งออกรายงานการใช้ตามสูตรเรียบร้อยแล้ว");
  };

  const handlePrint = () => {
    if (usageSummaries.length === 0) {
      toast.error("ไม่มีข้อมูลการใช้ตามสูตรสำหรับพิมพ์");
      return;
    }

    const branchName =
      selectedBranchId === "all"
        ? "ทุกสาขา"
        : branches.find((b) => b.id === selectedBranchId)?.name || selectedBranchId;

    const periodLabel = `${startDate || "เริ่มต้น"} ถึง ${endDate || "ปัจจุบัน"}`;
    const categoryLabel = selectedCategoryName !== "all" ? selectedCategoryName : undefined;
    const menuLabel =
      selectedMenuCode !== "all"
        ? uniqueSoldMenus.find((m) => m.code === selectedMenuCode)?.name || selectedMenuCode
        : undefined;

    printReportDocument({
      activeTab: "theoretical",
      restaurantName: settings.companyName || "Sushi Hana Thailand",
      branchLabel: branchName,
      periodLabel,
      categoryLabel,
      menuLabel,
      currentUser,
      canViewFinancial: true,
      theoreticalRows: usageSummaries.map((item) => ({
        ingredientCode: item.ingredientCode,
        ingredientName: item.ingredientName,
        categoryName: item.categoryName,
        masterUnit: item.masterUnit,
        totalUsageConverted: item.totalUsageConverted,
        recipeUnit: item.recipeUnit,
        totalUsageRaw: item.totalUsageRaw,
        menuCount: (item.breakdown || []).length,
        isConverted: item.isConverted,
      })),
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      {!hideTitleHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-950/10 dark:bg-amber-950/60 rounded-lg text-amber-950 dark:text-amber-300">
                <Calculator className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  การใช้ตามสูตร (Theoretical Usage)
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  สรุปปริมาณการใช้วัตถุดิบตามสูตรอาหาร จากยอดขายจริงตามช่วงเวลาและสาขา
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-xs flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              พิมพ์รายงาน
            </button>
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 text-sm font-semibold text-amber-50 bg-stone-900 hover:bg-stone-800 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-100 rounded-lg transition-colors shadow-xs flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              ส่งออก Excel
            </button>
          </div>
        </div>
      )}

      {/* Filter Control Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            <Filter className="w-4 h-4 text-amber-950 dark:text-amber-400" />
            ตัวกรองรายงานการใช้วัตถุดิบ
          </div>

          <div className="flex items-center gap-2">
            {hideTitleHeader && (
              <div className="flex items-center gap-2 mr-2">
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  พิมพ์
                </button>
                <button
                  onClick={handleExportExcel}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-50 bg-stone-900 hover:bg-stone-800 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-100 rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel
                </button>
              </div>
            )}

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400 mr-1 hidden sm:inline">เลือกช่วงเวลา:</span>
              <button
                onClick={() => applyDatePreset("today")}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors"
              >
                วันนี้
              </button>
              <button
                onClick={() => applyDatePreset("7days")}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors"
              >
                7 วันที่ผ่านมา
              </button>
              <button
                onClick={() => applyDatePreset("thisMonth")}
                className="px-2.5 py-1 text-xs font-medium bg-amber-950/10 text-amber-950 dark:bg-amber-950/80 dark:text-amber-200 rounded-md transition-colors font-semibold"
              >
                เดือนนี้
              </button>
              <button
                onClick={() => applyDatePreset("allTime")}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors"
              >
                ทั้งหมด
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {/* Start Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              ตั้งแต่วันที่
            </label>
            <ThaiDatePicker
              value={startDate}
              onChange={setStartDate}
              className="w-full text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              ถึงวันที่
            </label>
            <ThaiDatePicker
              value={endDate}
              onChange={setEndDate}
              className="w-full text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>

          {/* Branch Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              เลือกสาขา
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
            >
              <option value="all">ทุกสาขา</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              หมวดหมู่วัตถุดิบ
            </label>
            <select
              value={selectedCategoryName}
              onChange={(e) => setSelectedCategoryName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
            >
              <option value="all">ทุกหมวดหมู่</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Specific Menu Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              กรองตามเมนูอาหาร
            </label>
            <select
              value={selectedMenuCode}
              onChange={(e) => setSelectedMenuCode(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
            >
              <option value="all">ทุกเมนูอาหาร</option>
              {availableMenus.map((m) => (
                <option key={m.code} value={m.code}>
                  [{m.code}] {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหารหัสวัตถุดิบ หรือ ชื่อวัตถุดิบ..."
            value={searchIngredient}
            onChange={(e) => setSearchIngredient(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          />
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">จำนวนวัตถุดิบที่ใช้ตามสูตร</span>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {grandTotalItemsCount} รายการ
          </p>
          <p className="text-xs text-slate-400 mt-1">วัตถุดิบที่ไม่ซ้ำกันในรอบการขายนี้</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">สูตรอาหารที่ใช้งาน</span>
          <p className="text-2xl font-bold text-stone-900 dark:text-amber-200 mt-1">
            {new Set(recipes.map((r) => r.menuCode)).size} เมนู
          </p>
          <p className="text-xs text-slate-400 mt-1">จำนวนเมนูที่มีโครงสร้างสูตรพร้อมคำนวณ</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">ยอดขายนำเข้าในระบบ</span>
          <p className="text-2xl font-bold text-stone-900 dark:text-amber-200 mt-1">
            {salesRecords.reduce((acc, curr) => acc + curr.quantitySold, 0).toLocaleString()}{" "}
            จาน/ชุด
          </p>
          <p className="text-xs text-slate-400 mt-1">ประวัติยอดขายทั้งหมดที่บันทึกแล้ว</p>
        </div>
      </div>

      {/* MAIN THEORETICAL USAGE TABLE */}
      {usageSummaries.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <Calculator className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
            ไม่พบข้อมูลการใช้ตามสูตร
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-md mx-auto">
            กรุณาตรวจสอบการเลือกช่วงเวลา สาขา หรือ นำเข้ารายงานยอดขาย
            เพื่อประมวลผลคำนวณการใช้วัตถุดิบตามสูตร
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-100 dark:bg-slate-800 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">รหัสวัตถุดิบ (Ingredient Code)</th>
                  <th className="px-4 py-3.5">ชื่อวัตถุดิบ (Ingredient Name)</th>
                  <th className="px-4 py-3.5">หมวดหมู่ (Category)</th>
                  <th className="px-4 py-3.5">หน่วยนับ (Unit)</th>
                  <th className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-slate-100">
                    ใช้ตามสูตร (Theoretical Usage)
                  </th>
                  <th className="px-4 py-3.5 w-40">สัดส่วนปริมาณ</th>
                  <th className="px-4 py-3.5 text-center">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {usageSummaries.map((item) => {
                  const relativePercent = Math.min(
                    100,
                    (item.totalUsageConverted / maxUsageInList) * 100,
                  );

                  return (
                    <tr
                      key={item.ingredientCode}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-3.5 font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                        {item.ingredientCode}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {item.ingredientName}
                          </span>
                          {item.matchingSupplierItems && item.matchingSupplierItems.length > 1 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-md">
                              {item.matchingSupplierItems.length} ซัพฯ (FIFO)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md">
                          {item.categoryName}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.masterUnit}
                        </span>
                        {item.isConverted && (
                          <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-950/10 text-amber-950 dark:bg-amber-950/80 dark:text-amber-200 rounded-xs">
                            หน่วยหลัก
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div
                          className="font-extrabold text-stone-900 dark:text-amber-200 text-base"
                          title={
                            item.isConverted
                              ? `ปริมาณหน่วยย่อยตามสูตรเดิม: ${item.totalUsageRaw.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${item.recipeUnit}`
                              : undefined
                          }
                        >
                          {item.totalUsageConverted.toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 3,
                          })}{" "}
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {item.masterUnit}
                          </span>
                        </div>
                        {item.isConverted && (
                          <div className="text-xs font-normal text-slate-400 dark:text-slate-500 mt-0.5">
                            (
                            {item.totalUsageRaw.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}{" "}
                            {item.recipeUnit})
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-stone-900 dark:bg-amber-700 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(5, relativePercent)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => setSelectedUsageItem(item)}
                          className="px-3 py-1.5 text-xs font-medium text-amber-950 bg-amber-950/10 hover:bg-amber-950/20 dark:bg-amber-950/60 dark:text-amber-200 rounded-lg transition-colors inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          ดูรายละเอียด ({(item.breakdown || []).length} เมนู)
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BREAKDOWN MODAL / DRAWER */}
      {selectedUsageItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-stone-900 text-stone-100 dark:bg-amber-950 dark:text-amber-200 rounded-md">
                    {selectedUsageItem.ingredientCode}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {selectedUsageItem.ingredientName}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  หมวดหมู่: {selectedUsageItem.categoryName} | รวมใช้ทั้งสิ้น:{" "}
                  <strong className="text-stone-900 dark:text-amber-300 font-extrabold">
                    {selectedUsageItem.totalUsageConverted.toLocaleString(undefined, {
                      maximumFractionDigits: 3,
                    })}{" "}
                    {selectedUsageItem.masterUnit}
                  </strong>
                  {selectedUsageItem.isConverted && (
                    <span className="text-slate-400 text-xs font-normal ml-1.5">
                      (
                      {selectedUsageItem.totalUsageRaw.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{" "}
                      {selectedUsageItem.recipeUnit})
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setSelectedUsageItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content / Breakdown Table */}
            <div className="p-6 overflow-y-auto space-y-4">
              {selectedUsageItem.matchingSupplierItems &&
                (selectedUsageItem.matchingSupplierItems || []).length > 1 && (
                  <div className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs">
                    <div className="font-bold text-emerald-900 dark:text-emerald-200 mb-1.5 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      สินค้าซัพพลายเออร์ที่เชื่อมโยง (
                      {(selectedUsageItem.matchingSupplierItems || []).length} รายการ —
                      ตัดสต็อคตามลำดับ FIFO อัตโนมัติ):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {(selectedUsageItem.matchingSupplierItems || []).map((sItem) => (
                        <div
                          key={sItem.id}
                          className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 dark:border-emerald-900 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {sItem.code}
                            </span>
                            <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                              {sItem.name}
                            </div>
                          </div>
                          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-900/60 px-2 py-0.5 rounded">
                            สต็อก: {(sItem.currentStock ?? 0).toFixed(1)} {sItem.unit || "ชิ้น"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-amber-950 dark:text-amber-400" />
                รายการเมนูที่สมมติใช้วัตถุดิบนี้ (Contributing Menus)
              </h4>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-3.5 py-2.5">รหัสเมนู</th>
                      <th className="px-3.5 py-2.5">ชื่อเมนูอาหาร</th>
                      <th className="px-3.5 py-2.5 text-right">จำนวนขาย</th>
                      <th className="px-3.5 py-2.5 text-right">ปริมาณสูตร/เมนู</th>
                      <th className="px-3.5 py-2.5 text-right font-bold text-slate-900 dark:text-slate-100">
                        ปริมาณการใช้รวม
                      </th>
                      <th className="px-3.5 py-2.5 text-right">สัดส่วน (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {(selectedUsageItem.breakdown || []).map((b) => (
                      <tr key={b.menuCode} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-3.5 py-2.5 font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                          {b.menuCode}
                        </td>
                        <td className="px-3.5 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                          {b.menuName}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-semibold">
                          {b.quantitySold.toLocaleString()} จาน
                        </td>
                        <td className="px-3.5 py-2.5 text-right text-slate-500">
                          {b.recipeQuantity} {b.recipeUnit}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-stone-900 dark:text-amber-300">
                          <div>
                            {b.contributedUsageConverted.toLocaleString(undefined, {
                              maximumFractionDigits: 3,
                            })}{" "}
                            <span className="text-xs font-normal text-slate-600 dark:text-slate-300">
                              {selectedUsageItem.masterUnit}
                            </span>
                          </div>
                          {selectedUsageItem.isConverted && (
                            <div className="text-[11px] font-normal text-slate-400">
                              (
                              {b.contributedUsageRaw.toLocaleString(undefined, {
                                maximumFractionDigits: 2,
                              })}{" "}
                              {b.recipeUnit})
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
                          {b.percentOfTotal.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
              <button
                onClick={() => setSelectedUsageItem(null)}
                className="px-5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
