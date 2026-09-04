import React, { useState, useMemo } from "react";
import { ProductionRecipe, Item } from "@/lib/types";
import { Link } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { printHtmlDocument, getThaiPrintTimestamp } from "@/lib/printUtils";
import { formatDateTime } from "@/lib/dateFormat";
import {
  CookingPot,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  Edit2,
  Flame,
  Printer,
  Download,
  Layers,
  Sparkles,
  Boxes,
  Power,
  ChevronRight,
  Filter,
  FileSpreadsheet,
  X,
  Info,
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

type RecipeSortOption =
  "date_desc" | "date_asc" | "code_asc" | "code_desc" | "name_asc" | "ings_desc";

interface ProductionRecipeSummaryViewProps {
  recipes: ProductionRecipe[];
  items: Item[];
  onOpenCreate: () => void;
  onOpenEdit: (recipe: ProductionRecipe) => void;
  onToggleStatus: (recipeId: string) => void;
}

export function ProductionRecipeSummaryView({
  recipes = [],
  items = [],
  onOpenCreate,
  onOpenEdit,
  onToggleStatus,
}: ProductionRecipeSummaryViewProps) {
  const safeRecipes = useMemo(() => recipes || [], [recipes]);
  const safeItems = useMemo(() => items || [], [items]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<RecipeSortOption>("date_desc");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedRecipeForView, setSelectedRecipeForView] = useState<ProductionRecipe | null>(null);

  // Map for fast item lookups
  const itemMap = useMemo(() => {
    const map = new Map<string, Item>();
    safeItems.forEach((it) => {
      if (it?.code) {
        map.set(it.code.toUpperCase(), it);
      }
    });
    return map;
  }, [safeItems]);

  // Prepared items count
  const preparedItems = useMemo(() => {
    return safeItems.filter(
      (it) =>
        it &&
        (it.itemType === "prepared" ||
          it.code?.startsWith("SAUCE") ||
          it.category?.toLowerCase().includes("ซอส")),
    );
  }, [safeItems]);

  // Unique ingredients used across all recipes
  const uniqueIngredients = useMemo(() => {
    const ingSet = new Set<string>();
    safeRecipes.forEach((r) => {
      (r?.ingredients || []).forEach((ing) => {
        if (ing?.ingredientCode) ingSet.add(ing.ingredientCode.toUpperCase());
      });
    });
    return ingSet;
  }, [safeRecipes]);

  // Available yield units
  const availableUnits = useMemo(() => {
    const units = new Set<string>();
    safeRecipes.forEach((r) => {
      if (r?.yieldUnit) units.add(r.yieldUnit.trim());
    });
    return Array.from(units);
  }, [safeRecipes]);

  // Filtered & Sorted recipes
  const filteredRecipes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = safeRecipes.filter((rec) => {
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
        statusFilter === "all" ||
        (statusFilter === "active" && rec.active) ||
        (statusFilter === "inactive" && !rec.active);

      const matchesUnit =
        unitFilter === "all" || (rec.yieldUnit && rec.yieldUnit.trim() === unitFilter);

      return matchesSearch && matchesStatus && matchesUnit;
    });

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
  }, [safeRecipes, searchQuery, statusFilter, unitFilter, itemMap, sortBy]);

  // Copy code helper
  const handleCopyCode = (code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`คัดลอกรหัส ${code} เรียบร้อยแล้ว`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Export summary to Excel
  const handleExportExcel = () => {
    if (safeRecipes.length === 0) {
      toast.error("ไม่มีข้อมูลสูตรผลิตสำหรับส่งออก");
      return;
    }

    try {
      // 1. Summary Sheet Rows
      const summaryRows = filteredRecipes.map((rec, index) => {
        const pCode = rec.producedItemCode || "";
        const pItem = itemMap.get(pCode.toUpperCase());
        const ings = rec.ingredients || [];
        const ingredientSummary = ings
          .map(
            (ing) =>
              `${ing?.ingredientName || ing?.ingredientCode} (${ing?.quantity || 0} ${ing?.unit || ""})`,
          )
          .join(", ");

        return {
          "ลำดับ (No.)": index + 1,
          "รหัสสินค้าที่ผลิต / รหัสสูตร (Produced Code)": pCode,
          "ชื่อสินค้ากึ่งสำเร็จรูป (Produced Item Name)": pItem ? pItem.name : pCode,
          "ผลผลิตมาตรฐานต่อรอบ (Yield Qty)": rec.yieldQuantity || 0,
          "หน่วยผลผลิต (Yield Unit)": rec.yieldUnit || "",
          "จำนวนส่วนผสม (Ingredients Count)": ings.length,
          "รายการส่วนผสมทั้งหมด (Ingredients List)": ingredientSummary,
          "สถานะ (Status)": rec.active ? "เปิดใช้งาน (Active)" : "ปิดใช้งาน (Inactive)",
          "สต็อกคงเหลือใน Master Items": pItem ? (pItem.currentStock ?? 0) : "-",
          "หมายเหตุ (Note)": rec.note || "-",
        };
      });

      // 2. Detailed Ingredients Sheet Rows
      const detailRows: Record<string, unknown>[] = [];
      filteredRecipes.forEach((rec) => {
        const pCode = rec.producedItemCode || "";
        const pItem = itemMap.get(pCode.toUpperCase());
        const ings = rec.ingredients || [];
        ings.forEach((ing, ingIdx) => {
          const perUnit =
            (rec.yieldQuantity || 0) > 0 ? (ing?.quantity || 0) / rec.yieldQuantity : 0;
          detailRows.push({
            "รหัสสูตร (Produced Code)": pCode,
            ชื่อสินค้ากึ่งสำเร็จรูป: pItem ? pItem.name : pCode,
            ผลผลิตต่อรอบ: `${rec.yieldQuantity || 0} ${rec.yieldUnit || ""}`,
            ลำดับส่วนผสม: ingIdx + 1,
            "รหัสวัตถุดิบ (Ingredient Code)": ing?.ingredientCode || "",
            "ชื่อวัตถุดิบ (Ingredient Name)": ing?.ingredientName || "",
            "ปริมาณต่อรอบ (Batch Qty)": ing?.quantity || 0,
            "สัดส่วนต่อ 1 หน่วย": Number(perUnit.toFixed(4)),
            หน่วยวัตถุดิบ: ing?.unit || "",
            สถานะสูตร: rec.active ? "Active" : "Inactive",
          });
        });
      });

      const wb = XLSX.utils.book_new();

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, "สรุปภาพรวมสูตรผลิต");

      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, wsDetail, "รายละเอียดส่วนผสมทุกสูตร");

      const dateStr = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `Hana_Production_Recipes_Summary_${dateStr}.xlsx`);
      toast.success("ส่งออกไฟล์ Excel สรุปสูตรผลิตเรียบร้อยแล้ว");
    } catch (err) {
      console.error("Export Excel error:", err);
      toast.error("เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel");
    }
  };

  // Print Summary Sheet
  const handlePrintSummary = () => {
    if (filteredRecipes.length === 0) {
      toast.error("ไม่มีข้อมูลสูตรผลิตสำหรับพิมพ์");
      return;
    }

    const printDate = getThaiPrintTimestamp();
    const rowsHtml = filteredRecipes
      .map((rec, index) => {
        const pCode = rec.producedItemCode || "";
        const pItem = itemMap.get(pCode.toUpperCase());
        const ings = rec.ingredients || [];
        const ingPreview = ings
          .map(
            (ing) =>
              `<span style="display:inline-block; background:#f1f5f9; padding:2px 6px; border-radius:4px; margin:2px; font-size:11px;">
                ${ing?.ingredientName || ing?.ingredientCode}: <strong>${ing?.quantity || 0} ${ing?.unit || ""}</strong>
              </span>`,
          )
          .join("");

        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
            <td style="padding: 8px; text-align: center; font-weight: bold; color: #64748b;">${index + 1}</td>
            <td style="padding: 8px; font-family: monospace; font-weight: bold; color: #0f172a;">${pCode}</td>
            <td style="padding: 8px; font-weight: bold; color: #1e293b;">
              ${pItem ? pItem.name : pCode}
              ${pItem?.itemType === "prepared" ? '<span style="font-size:10px; color:#b45309; background:#fef3c7; padding:1px 4px; border-radius:3px; margin-left:4px;">Prepared</span>' : ""}
            </td>
            <td style="padding: 8px; text-align: right; font-weight: 600;">${rec.yieldQuantity || 0} ${rec.yieldUnit || ""}</td>
            <td style="padding: 8px; text-align: center; font-weight: 600;">${ings.length} รายการ</td>
            <td style="padding: 8px;">${ingPreview}</td>
            <td style="padding: 8px; text-align: center;">
              ${
                rec.active
                  ? '<span style="color:#15803d; font-weight:bold;">เปิดใช้งาน</span>'
                  : '<span style="color:#64748b;">ปิดใช้งาน</span>'
              }
            </td>
          </tr>
        `;
      })
      .join("");

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>สรุปสูตรผลิตสินค้ากึ่งสำเร็จรูป (Production Recipes Summary)</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { font-family: 'Sarabun', 'Segoe UI', Tahoma, sans-serif; color: #0f172a; margin: 0; padding: 0; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 20px; font-weight: bold; }
            .subtitle { font-size: 12px; color: #475569; margin-top: 4px; }
            .meta { font-size: 11px; text-align: right; color: #64748b; }
            .stats { display: flex; gap: 15px; margin-bottom: 15px; }
            .stat-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #f8fafc; font-size: 12px; }
            .stat-num { font-size: 16px; font-weight: bold; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; text-align: left; }
            th { background-color: #f1f5f9; padding: 8px; font-size: 12px; font-weight: bold; border-bottom: 2px solid #cbd5e1; }
            td { vertical-align: top; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">รายงานสรุปสูตรผลิตสินค้ากึ่งสำเร็จรูป (Semi-Finished Goods BOM)</div>
              <div class="subtitle">ระบบจัดการสต็อกและสูตรการผลิต — Hana ERP System</div>
            </div>
            <div class="meta">
              <div>วันที่พิมพ์: <strong>${printDate}</strong></div>
              <div>จำนวนสูตรในรายงาน: <strong>${filteredRecipes.length}</strong> สูตร</div>
            </div>
          </div>

          <div class="stats">
            <div class="stat-box">
              <div>สูตรผลิตทั้งหมด</div>
              <div class="stat-num">${recipes.length} สูตร</div>
            </div>
            <div class="stat-box">
              <div>สูตรที่เปิดใช้งาน (Active)</div>
              <div class="stat-num" style="color:#15803d;">${recipes.filter((r) => r.active).length} สูตร</div>
            </div>
            <div class="stat-box">
              <div>สินค้ากึ่งสำเร็จรูป (Prepared Items)</div>
              <div class="stat-num" style="color:#b45309;">${preparedItems.length} รายการ</div>
            </div>
            <div class="stat-box">
              <div>วัตถุดิบดิบที่นำมาใช้รวม</div>
              <div class="stat-num">${uniqueIngredients.size} รายการ</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th style="width: 120px;">รหัสสินค้า / สูตร</th>
                <th style="width: 180px;">ชื่อสินค้ากึ่งสำเร็จรูป</th>
                <th style="width: 110px; text-align: right;">ผลผลิตต่อรอบ</th>
                <th style="width: 100px; text-align: center;">จำนวนส่วนผสม</th>
                <th>รายการส่วนผสมทั้งหมด (วัตถุดิบ & สัดส่วน)</th>
                <th style="width: 90px; text-align: center;">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div style="margin-top: 20px; font-size: 10px; color: #94a3b8; text-align: right;">
            เอกสารสรุปสูตรผลิตจากระบบ Hana — พิมพ์เมื่อ ${printDate}
          </div>
        </body>
      </html>
    `;

    printHtmlDocument(printHtml, "สรุปสูตรผลิตสินค้ากึ่งสำเร็จรูป");
  };

  return (
    <div className="space-y-6">
      {/* 1. Hero Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
        {/* Card 1: Total Recipes */}
        <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-linear-to-br from-white to-amber-50/40 dark:from-stone-900 dark:to-amber-950/20 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              สูตรผลิตทั้งหมด
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <CookingPot className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100">
              {recipes.length}
            </span>
            <span className="text-xs text-stone-500">สูตร</span>
          </div>
          <p className="mt-1 text-[11px] text-stone-500 truncate">สูตรมาตรฐานที่บันทึกในระบบ</p>
        </div>

        {/* Card 2: Active Recipes */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200/70 dark:border-emerald-800/60 bg-linear-to-br from-white to-emerald-50/40 dark:from-stone-900 dark:to-emerald-950/20 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              สูตรพร้อมใช้งาน (Active)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
              {recipes.filter((r) => r.active).length}
            </span>
            <span className="text-xs text-emerald-600/80">สูตร</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-600/80 truncate">พร้อมใช้ตัดสต็อกเมื่อผลิต</p>
        </div>

        {/* Card 3: Inactive Recipes */}
        <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              ปิดใช้งานชั่วคราว
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-500">
              <Power className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-600 dark:text-stone-400">
              {recipes.filter((r) => !r.active).length}
            </span>
            <span className="text-xs text-stone-500">สูตร</span>
          </div>
          <p className="mt-1 text-[11px] text-stone-500 truncate">พักการใช้งาน/ปรับปรุง</p>
        </div>

        {/* Card 4: Prepared Master Items */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-200/70 dark:border-amber-800/60 bg-linear-to-br from-white to-amber-50/30 dark:from-stone-900 dark:to-amber-950/20 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              สินค้ากึ่งสำเร็จรูป (Master)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-700 dark:text-amber-400">
              {preparedItems.length}
            </span>
            <span className="text-xs text-amber-600">รายการ</span>
          </div>
          <p className="mt-1 text-[11px] text-amber-600/80 truncate">ประเภท Prepared ในคลัง</p>
        </div>

        {/* Card 5: Unique Ingredients */}
        <div className="col-span-2 sm:col-span-2 md:col-span-4 lg:col-span-1 relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              วัตถุดิบดิบที่ใช้รวม
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100">
              {uniqueIngredients.size}
            </span>
            <span className="text-xs text-stone-500">ชนิด</span>
          </div>
          <p className="mt-1 text-[11px] text-stone-500 truncate">วัตถุดิบที่ใช้ในทุกสูตร</p>
        </div>
      </div>

      {/* 2. Search & Toolbar Controls */}
      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 dark:border-stone-800 bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input
            placeholder="ค้นหาด้วยรหัสสูตร, ชื่อสินค้า, หรือชื่อส่วนผสม..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-stone-50/50 dark:bg-stone-900/50 border-stone-200 dark:border-stone-800 rounded-xl text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filters & Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-stone-500 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
              เรียง:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as RecipeSortOption)}
              className="h-8 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-2.5 text-xs text-stone-700 dark:text-stone-300 font-medium"
            >
              <option value="date_desc">📅 วันที่นำเข้า/บันทึก (ใหม่สุด → เก่าสุด)</option>
              <option value="date_asc">📅 วันที่นำเข้า/บันทึก (เก่าสุด → ใหม่สุด)</option>
              <option value="code_asc">🔤 รหัสสินค้า (A → Z)</option>
              <option value="code_desc">🔤 รหัสสินค้า (Z → A)</option>
              <option value="name_asc">📝 ชื่อสินค้า (ก → ฮ)</option>
              <option value="ings_desc">📊 จำนวนส่วนผสม (มาก → น้อย)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-900 p-1">
            <button
              onClick={() => setStatusFilter("all")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                statusFilter === "all"
                  ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs"
                  : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
              }`}
            >
              ทั้งหมด ({recipes.length})
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                statusFilter === "active"
                  ? "bg-white dark:bg-stone-800 text-emerald-700 dark:text-emerald-400 shadow-xs"
                  : "text-stone-600 dark:text-stone-400 hover:text-emerald-600"
              }`}
            >
              เปิดใช้งาน ({recipes.filter((r) => r.active).length})
            </button>
            <button
              onClick={() => setStatusFilter("inactive")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                statusFilter === "inactive"
                  ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs"
                  : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
              }`}
            >
              ปิด ({recipes.filter((r) => !r.active).length})
            </button>
          </div>

          {/* Unit Filter (if more than 1 unit) */}
          {availableUnits.length > 1 && (
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="h-8 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-2.5 text-xs text-stone-700 dark:text-stone-300 font-medium"
            >
              <option value="all">หน่วยผลผลิตทั้งหมด</option>
              {availableUnits.map((u) => (
                <option key={u} value={u}>
                  หน่วย: {u}
                </option>
              ))}
            </select>
          )}

          {/* Print Summary Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintSummary}
            className="rounded-xl border-stone-200 dark:border-stone-800 gap-1.5 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
            title="พิมพ์ตารางสรุปสูตรผลิตสินค้ากึ่งสำเร็จรูป"
          >
            <Printer className="h-3.5 w-3.5 text-stone-600 dark:text-stone-400" />
            พิมพ์สรุป
          </Button>

          {/* Export Excel Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="rounded-xl border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/60 gap-1.5 text-xs font-semibold"
            title="ดาวน์โหลดไฟล์ Excel สรุปสูตรผลิตทั้งหมด"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            ส่งออก Excel
          </Button>
        </div>
      </div>

      {/* 3. Summary Recipes Table */}
      {filteredRecipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 dark:border-stone-800 bg-card p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 mb-3">
            <CookingPot className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
            ไม่พบสูตรผลิตสินค้ากึ่งสำเร็จรูป
          </h3>
          <p className="mt-1 text-xs text-stone-500 max-w-md">
            {searchQuery || statusFilter !== "all" || unitFilter !== "all"
              ? "ไม่พบข้อมูลที่ตรงกับคำค้นหาหรือตัวกรอง ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง"
              : "ยังไม่มีสูตรผลิตสินค้ากึ่งสำเร็จรูปในระบบ คลิกปุ่มด้านล่างเพื่อเริ่มสร้างสูตร"}
          </p>
          <div className="mt-4 flex gap-2">
            {(searchQuery || statusFilter !== "all" || unitFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setUnitFilter("all");
                }}
                className="text-xs"
              >
                ล้างตัวกรอง
              </Button>
            )}
            <Button size="sm" onClick={onOpenCreate} className="text-xs">
              สร้างสูตรผลิตใหม่
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800 bg-card shadow-xs">
          {/* Table Header Summary Banner */}
          <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-900/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-stone-800 dark:text-stone-200">
                บัญชีรายชื่อสูตรผลิตสินค้ากึ่งสำเร็จรูป (Semi-Finished Production Recipes Index)
              </span>
              <Badge variant="secondary" className="text-[11px] font-semibold">
                {filteredRecipes.length} สูตร
              </Badge>
            </div>
            <span className="text-[11px] text-stone-500 hidden sm:inline-block">
              คลิกที่รหัสสูตรเพื่อคัดลอก หรือกดปุ่ม "ดูสูตร" เพื่อดูอัตราส่วนส่วนผสม
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-100/60 dark:bg-stone-900/80 text-stone-600 dark:text-stone-400 font-semibold">
                  <th className="py-3 px-3 text-center w-12">#</th>
                  <th className="py-3 px-3 min-w-[140px]">รหัสสูตร / สินค้า</th>
                  <th className="py-3 px-3 min-w-[180px]">ชื่อสินค้ากึ่งสำเร็จรูป</th>
                  <th className="py-3 px-3 text-right min-w-[110px]">ผลผลิตต่อรอบ</th>
                  <th className="py-3 px-3 text-center min-w-[90px]">ส่วนผสม</th>
                  <th className="py-3 px-3 min-w-[280px]">รายการวัตถุดิบที่ใช้ (ส่วนผสม)</th>
                  <th className="py-3 px-3 text-right min-w-[100px]">สต็อกในคลัง</th>
                  <th className="py-3 px-3 text-center min-w-[90px]">สถานะ</th>
                  <th className="py-3 px-3 text-right min-w-[130px]">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200/80 dark:divide-stone-800">
                {filteredRecipes.map((rec, index) => {
                  const pItem = itemMap.get(rec.producedItemCode.toUpperCase());
                  const isCopied = copiedCode === rec.producedItemCode;

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-stone-50/80 dark:hover:bg-stone-900/40 transition-colors group"
                    >
                      {/* 1. Index */}
                      <td className="py-3 px-3 text-center text-stone-400 dark:text-stone-500 font-mono font-medium">
                        {index + 1}
                      </td>

                      {/* 2. Recipe / Item Code */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-stone-900 dark:text-stone-100 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700">
                            {rec.producedItemCode}
                          </span>
                          <button
                            onClick={() => handleCopyCode(rec.producedItemCode)}
                            className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-0.5 rounded transition-colors"
                            title="คัดลอกรหัสสูตร"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 3. Produced Item Name */}
                      <td className="py-3 px-3">
                        <div>
                          <span className="font-semibold text-stone-900 dark:text-stone-100 text-[13px]">
                            {pItem ? pItem.name : rec.producedItemCode}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] font-medium text-stone-600 dark:text-stone-300 flex items-center gap-1 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded">
                              <Clock className="w-2.5 h-2.5 text-stone-400" />
                              {formatDateTime(rec.createdAt || rec.updatedAt)}
                            </span>
                            {pItem?.itemType === "prepared" ? (
                              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/60 px-1.5 py-0.2 rounded">
                                Prepared
                              </span>
                            ) : pItem ? (
                              <span className="text-[10px] text-stone-500">
                                {pItem.category || "ทั่วไป"}
                              </span>
                            ) : (
                              <span className="text-[10px] text-rose-500 flex items-center gap-0.5">
                                <AlertCircle className="w-2.5 h-2.5" /> ยังไม่ผูกใน Master
                              </span>
                            )}
                            {rec.note && (
                              <span
                                className="text-[10px] text-stone-400 truncate max-w-[140px]"
                                title={rec.note}
                              >
                                • {rec.note}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 4. Standard Yield */}
                      <td className="py-3 px-3 text-right tabular-nums">
                        <span className="font-bold text-stone-900 dark:text-stone-100 text-xs">
                          {(rec.yieldQuantity || 0).toLocaleString()}
                        </span>{" "}
                        <span className="font-medium text-stone-500">{rec.yieldUnit || ""}</span>
                      </td>

                      {/* 5. Ingredients Count */}
                      <td className="py-3 px-3 text-center">
                        <Badge
                          variant="outline"
                          className="font-mono text-xs border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                        >
                          {(rec.ingredients || []).length} ชนิด
                        </Badge>
                      </td>

                      {/* 6. Key Ingredients Summary Tags */}
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1 items-center max-w-[340px]">
                          {(rec.ingredients || []).slice(0, 3).map((ing, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200/60 dark:border-stone-700/60 truncate max-w-[160px]"
                              title={`${ing?.ingredientName || ing?.ingredientCode}: ${ing?.quantity || 0} ${ing?.unit || ""}`}
                            >
                              <span className="truncate">
                                {ing?.ingredientName || ing?.ingredientCode}
                              </span>
                              <span className="font-mono text-[10px] text-stone-400 font-semibold">
                                {ing?.quantity || 0} {ing?.unit || ""}
                              </span>
                            </span>
                          ))}
                          {(rec.ingredients || []).length > 3 && (
                            <button
                              onClick={() => setSelectedRecipeForView(rec)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-amber-700 dark:text-amber-400 hover:underline bg-amber-50 dark:bg-amber-950/40"
                            >
                              +{(rec.ingredients || []).length - 3} รายการ...
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 7. Current Kitchen Stock */}
                      <td className="py-3 px-3 text-right">
                        {pItem ? (
                          <div>
                            <span className="font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                              {(pItem.currentStock ?? 0).toLocaleString()}
                            </span>{" "}
                            <span className="text-[11px] text-stone-500">
                              {pItem.stockUnit || pItem.unit}
                            </span>
                          </div>
                        ) : (
                          <span className="text-stone-400">-</span>
                        )}
                      </td>

                      {/* 8. Status */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => onToggleStatus(rec.id)}
                          className="inline-flex"
                          title={rec.active ? "คลิกเพื่อปิดใช้งานสูตร" : "คลิกเพื่อเปิดใช้งานสูตร"}
                        >
                          {rec.active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              เปิดใช้งาน
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
                              ปิดใช้งาน
                            </span>
                          )}
                        </button>
                      </td>

                      {/* 9. Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Quick View Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedRecipeForView(rec)}
                            className="h-7 w-7 p-0 text-stone-600 hover:text-stone-900 dark:text-stone-300"
                            title="ดูรายละเอียดส่วนผสมและอัตราส่วน"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          {/* Produce Batch Shortcut */}
                          <Link
                            to="/production-batch"
                            search={{ recipeId: rec.id } as Record<string, unknown>}
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 gap-1 text-[11px] font-medium border-amber-500/30 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                              title="บันทึกการผลิตจริงโดยใช้สูตรนี้"
                            >
                              <Flame className="h-3 w-3 text-amber-500" />
                              ผลิต
                            </Button>
                          </Link>

                          {/* Edit Recipe */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onOpenEdit(rec)}
                            className="h-7 w-7 p-0 text-stone-600 hover:text-stone-900 dark:text-stone-300"
                            title="แก้ไขสูตร"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-stone-500 hover:text-stone-900" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer Summary */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/30 px-4 py-3 text-xs text-stone-500">
            <div>
              แสดง <strong>{filteredRecipes.length}</strong> จากทั้งหมด{" "}
              <strong>{recipes.length}</strong> สูตรผลิต
            </div>
            <div className="flex items-center gap-3 mt-2 sm:mt-0">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                เปิดใช้งาน: {recipes.filter((r) => r.active).length} สูตร
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-stone-400"></span>
                ปิดใช้งาน: {recipes.filter((r) => !r.active).length} สูตร
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Quick View Recipe Details Modal */}
      {selectedRecipeForView && (
        <Dialog
          open={!!selectedRecipeForView}
          onOpenChange={(open) => !open && setSelectedRecipeForView(null)}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <CookingPot className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
                    <span>
                      {itemMap.get(selectedRecipeForView.producedItemCode.toUpperCase())?.name ||
                        selectedRecipeForView.producedItemCode}
                    </span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {selectedRecipeForView.producedItemCode}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    สูตรผลิตสินค้ากึ่งสำเร็จรูป (Standard BOM)
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 text-xs">
              <div>
                <span className="text-stone-500">ผลผลิตมาตรฐานต่อรอบ:</span>
                <div className="font-bold text-stone-900 dark:text-stone-100 text-sm mt-0.5">
                  {selectedRecipeForView.yieldQuantity || 0} {selectedRecipeForView.yieldUnit || ""}
                </div>
              </div>
              <div>
                <span className="text-stone-500">จำนวนส่วนผสม:</span>
                <div className="font-bold text-stone-900 dark:text-stone-100 text-sm mt-0.5">
                  {(selectedRecipeForView.ingredients || []).length} รายการ
                </div>
              </div>
              <div>
                <span className="text-stone-500">สถานะ:</span>
                <div className="font-bold mt-0.5">
                  {selectedRecipeForView.active ? (
                    <span className="text-emerald-600">เปิดใช้งาน (Active)</span>
                  ) : (
                    <span className="text-stone-500">ปิดใช้งาน (Inactive)</span>
                  )}
                </div>
              </div>
              {selectedRecipeForView.note && (
                <div className="col-span-2 sm:col-span-3 pt-1 border-t border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400">
                  <span className="font-semibold">หมายเหตุ:</span> {selectedRecipeForView.note}
                </div>
              )}
            </div>

            {/* Ingredients Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-amber-600" />
                  รายการส่วนผสมและอัตราส่วน (Ingredients Breakdown)
                </h4>
              </div>

              <div className="overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-400 font-semibold border-b">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">รหัสวัตถุดิบ</th>
                      <th className="py-2.5 px-3">ชื่อวัตถุดิบ</th>
                      <th className="py-2.5 px-3 text-right">ปริมาณต่อรอบ</th>
                      <th className="py-2.5 px-3 text-right">
                        ต่อ 1 {selectedRecipeForView.yieldUnit || ""}
                      </th>
                      <th className="py-2.5 px-3">หน่วย</th>
                      <th className="py-2.5 px-3 text-right">สต็อกในครัว</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                    {(selectedRecipeForView.ingredients || []).map((ing, idx) => {
                      const ingItem = itemMap.get((ing?.ingredientCode || "").toUpperCase());
                      const yieldQty = selectedRecipeForView.yieldQuantity || 0;
                      const ingQty = ing?.quantity || 0;
                      const perUnit = yieldQty > 0 ? ingQty / yieldQty : 0;

                      return (
                        <tr key={idx} className="hover:bg-stone-50/60 dark:hover:bg-stone-900/40">
                          <td className="py-2.5 px-3 text-center text-stone-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold">
                            {ing?.ingredientCode || ""}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-stone-900 dark:text-stone-100">
                            {ing?.ingredientName || ingItem?.name || ing?.ingredientCode || ""}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                            {ingQty.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </td>
                          <td className="py-2.5 px-3 text-right text-stone-500 tabular-nums">
                            {perUnit.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-stone-600 dark:text-stone-400">
                            {ing?.unit || ""}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold">
                            {ingItem ? (
                              <span
                                className={
                                  (ingItem.currentStock ?? 0) <= 0
                                    ? "text-rose-600"
                                    : "text-emerald-700 dark:text-emerald-400"
                                }
                              >
                                {(ingItem.currentStock ?? 0).toLocaleString()}{" "}
                                {ingItem.stockUnit || ingItem.unit}
                              </span>
                            ) : (
                              <span className="text-stone-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRecipeForView(null)}
                className="text-xs"
              >
                ปิดหน้าต่าง
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const rec = selectedRecipeForView;
                    setSelectedRecipeForView(null);
                    onOpenEdit(rec);
                  }}
                  className="text-xs gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  แก้ไขสูตร
                </Button>

                <Link
                  to="/production-batch"
                  search={{ recipeId: selectedRecipeForView.id } as Record<string, unknown>}
                  onClick={() => setSelectedRecipeForView(null)}
                >
                  <Button
                    size="sm"
                    className="text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    ไปหน้าบันทึกการผลิตสูตรนี้
                  </Button>
                </Link>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
