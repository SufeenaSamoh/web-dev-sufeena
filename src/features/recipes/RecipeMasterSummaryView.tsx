import React, { useState, useMemo, useCallback } from "react";
import { RecipeItem, Item } from "@/lib/types";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { printHtmlDocument, getThaiPrintTimestamp } from "@/lib/printUtils";
import { formatDateTime } from "@/lib/dateFormat";
import {
  ChefHat,
  Search,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  Edit2,
  Printer,
  Download,
  Layers,
  Boxes,
  Power,
  Archive,
  RefreshCw,
  X,
  Clock,
  ArrowUpDown,
  Plus,
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

const SORT_OPTIONS = [
  "date_desc",
  "date_asc",
  "code_asc",
  "code_desc",
  "name_asc",
  "count_desc",
  "cost_desc",
] as const;
type RecipeMenuSortOption = (typeof SORT_OPTIONS)[number];

export interface GroupedRecipeMenu {
  menuCode: string;
  menuName: string;
  active: boolean;
  isDeleted: boolean;
  reason?: string;
  actionTimestamp?: string;
  createdAt?: string;
  updatedAt?: string;
  lines: RecipeItem[];
  estimatedCost: number;
  hasPreparedIngs: boolean;
}

interface RecipeMasterSummaryViewProps {
  recipes: RecipeItem[];
  items: Item[];
  onOpenCreate: (presetMenuCode?: string, presetMenuName?: string) => void;
  onOpenEdit: (item: RecipeItem) => void;
  onSetActive: (menuCode: string, menuName: string) => void;
  onSetInactive: (menuCode: string, menuName: string) => void;
  onRestore: (menuCode: string, menuName: string) => void;
  onSoftDelete: (menuCode: string, menuName: string) => void;
  onSwitchToCards?: (targetMenuCode?: string) => void;
}

export function RecipeMasterSummaryView({
  recipes = [],
  items = [],
  onOpenCreate,
  onOpenEdit,
  onSetActive,
  onSetInactive,
  onRestore,
  onSoftDelete,
  onSwitchToCards,
}: RecipeMasterSummaryViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "deleted">(
    "all",
  );
  const [preparedFilter, setPreparedFilter] = useState<"all" | "prepared_only" | "raw_only">("all");
  const [sortBy, setSortBy] = useState<RecipeMenuSortOption>("date_desc");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedMenuForView, setSelectedMenuForView] = useState<GroupedRecipeMenu | null>(null);

  // Map for fast item lookups (by uppercase code)
  const itemMap = useMemo(() => {
    const map = new Map<string, Item>();
    (items || []).forEach((it) => {
      if (it?.code) {
        map.set(it.code.toUpperCase().trim(), it);
      }
    });
    return map;
  }, [items]);

  // Helper to calculate estimated cost of an ingredient line
  const calculateIngCost = useCallback(
    (ingCode: string, qty: number, unit: string) => {
      const found = itemMap.get(ingCode.toUpperCase().trim());
      if (!found || !found.standardCost || found.standardCost <= 0) return 0;

      // Direct cost calculation
      const baseCost = found.standardCost;
      const baseUnit = (found.recipeUnit || found.stockUnit || found.unit || "").toLowerCase();
      const reqUnit = unit.toLowerCase();

      // Simple unit conversions
      if (baseUnit === "kg" && reqUnit === "g") {
        return (baseCost / 1000) * qty;
      }
      if (baseUnit === "l" && reqUnit === "ml") {
        return (baseCost / 1000) * qty;
      }
      if (baseUnit === "g" && reqUnit === "kg") {
        return baseCost * 1000 * qty;
      }
      if (baseUnit === "ml" && reqUnit === "l") {
        return baseCost * 1000 * qty;
      }
      return baseCost * qty;
    },
    [itemMap],
  );

  // Group all recipe items by menuCode into structured menu models
  const groupedMenus = useMemo<GroupedRecipeMenu[]>(() => {
    const menuMap = new Map<string, GroupedRecipeMenu>();

    (recipes || []).forEach((r) => {
      if (!r) return;
      const code = (r.menuCode || "").trim().toUpperCase();
      if (!code) return;

      if (!menuMap.has(code)) {
        menuMap.set(code, {
          menuCode: r.menuCode,
          menuName: r.menuName,
          active: r.active ?? true,
          isDeleted: r.isDeleted || r.status === "deleted",
          reason: r.reason,
          actionTimestamp: r.actionTimestamp || r.updatedAt || r.createdAt,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          lines: [],
          estimatedCost: 0,
          hasPreparedIngs: false,
        });
      }

      const grp = menuMap.get(code)!;
      grp.lines.push(r);

      // Keep latest timestamp / info if available
      if (r.actionTimestamp && (!grp.actionTimestamp || r.actionTimestamp > grp.actionTimestamp)) {
        grp.actionTimestamp = r.actionTimestamp;
      }
      if (r.updatedAt && (!grp.updatedAt || r.updatedAt > grp.updatedAt)) {
        grp.updatedAt = r.updatedAt;
      }
      if (r.createdAt && (!grp.createdAt || r.createdAt < grp.createdAt)) {
        grp.createdAt = r.createdAt;
      }
      if (r.reason) {
        grp.reason = r.reason;
      }
      if (r.active !== undefined) {
        grp.active = r.active;
      }
      if (r.isDeleted || r.status === "deleted") {
        grp.isDeleted = true;
      }
    });

    // Compute costs and prepared items check for each menu
    const result: GroupedRecipeMenu[] = [];
    menuMap.forEach((grp) => {
      let totalCost = 0;
      let hasPrepared = false;

      grp.lines.forEach((line) => {
        const item = itemMap.get(line.ingredientCode.toUpperCase().trim());
        if (
          item?.itemType === "prepared" ||
          line.ingredientCode.toUpperCase().startsWith("SAUCE") ||
          item?.category?.toLowerCase().includes("ซอส") ||
          line.subRecipeCode
        ) {
          hasPrepared = true;
        }
        totalCost += calculateIngCost(line.ingredientCode, line.quantity, line.unit);
      });

      grp.estimatedCost = totalCost;
      grp.hasPreparedIngs = hasPrepared;
      result.push(grp);
    });

    return result;
  }, [recipes, itemMap, calculateIngCost]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalMenus = groupedMenus.length;
    const activeMenus = groupedMenus.filter((m) => m.active && !m.isDeleted).length;
    const inactiveMenus = groupedMenus.filter((m) => !m.active && !m.isDeleted).length;
    const deletedMenus = groupedMenus.filter((m) => m.isDeleted).length;
    const preparedCount = groupedMenus.filter((m) => m.hasPreparedIngs && !m.isDeleted).length;

    const uniqueIngs = new Set<string>();
    recipes.forEach((r) => {
      if (r?.ingredientCode) uniqueIngs.add(r.ingredientCode.toUpperCase().trim());
    });

    return {
      totalMenus,
      activeMenus,
      inactiveMenus,
      deletedMenus,
      preparedCount,
      uniqueIngredientsCount: uniqueIngs.size,
    };
  }, [groupedMenus, recipes]);

  // Filter & Sort Menus
  const filteredMenus = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = groupedMenus.filter((menu) => {
      // 1. Search Query
      const matchesSearch =
        !q ||
        menu.menuCode.toLowerCase().includes(q) ||
        menu.menuName.toLowerCase().includes(q) ||
        (menu.reason && menu.reason.toLowerCase().includes(q)) ||
        menu.lines.some(
          (l) =>
            l.ingredientCode.toLowerCase().includes(q) ||
            l.ingredientName.toLowerCase().includes(q) ||
            (l.subRecipeCode && l.subRecipeCode.toLowerCase().includes(q)),
        );

      // 2. Status Filter
      let matchesStatus = true;
      if (statusFilter === "active") {
        matchesStatus = menu.active && !menu.isDeleted;
      } else if (statusFilter === "inactive") {
        matchesStatus = !menu.active && !menu.isDeleted;
      } else if (statusFilter === "deleted") {
        matchesStatus = menu.isDeleted;
      }

      // 3. Prepared Filter
      let matchesPrepared = true;
      if (preparedFilter === "prepared_only") {
        matchesPrepared = menu.hasPreparedIngs;
      } else if (preparedFilter === "raw_only") {
        matchesPrepared = !menu.hasPreparedIngs;
      }

      return matchesSearch && matchesStatus && matchesPrepared;
    });

    // Apply Sorting
    return list.sort((a, b) => {
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
      if (sortBy === "cost_desc") {
        return b.estimatedCost - a.estimatedCost;
      }
      return 0;
    });
  }, [groupedMenus, searchQuery, statusFilter, preparedFilter, sortBy]);

  // Copy code helper
  const handleCopyCode = (code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`คัดลอกรหัสเมนู ${code} เรียบร้อยแล้ว`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Export summary to Excel
  const handleExportExcel = () => {
    if (groupedMenus.length === 0) {
      toast.error("ไม่มีข้อมูลสูตรอาหารสำหรับส่งออก");
      return;
    }

    try {
      // 1. Summary Sheet Rows
      const summaryRows = filteredMenus.map((menu, index) => {
        const ingredientSummary = menu.lines
          .map((l) => `${l.ingredientName || l.ingredientCode} (${l.quantity} ${l.unit})`)
          .join(", ");

        let statusText = "เปิดใช้งาน (Active)";
        if (menu.isDeleted) statusText = "อยู่ในถังขยะ (Deleted)";
        else if (!menu.active) statusText = "ปิดใช้งาน (Inactive)";

        return {
          "ลำดับ (No.)": index + 1,
          "รหัสเมนูอาหาร (Menu Code)": menu.menuCode,
          "ชื่อเมนูอาหาร (Menu Name)": menu.menuName,
          "จำนวนวัตถุดิบ (Ingredients Count)": menu.lines.length,
          "ต้นทุนวัตถุดิบประมาณการ (Est. Cost)": Number(menu.estimatedCost.toFixed(2)),
          มีส่วนผสมกึ่งสำเร็จรูป: menu.hasPreparedIngs ? "มี (Prepared/Sauce)" : "ไม่มี",
          "สถานะ (Status)": statusText,
          "วันที่บันทึก/นำเข้า": formatDateTime(
            menu.actionTimestamp || menu.updatedAt || menu.createdAt,
          ),
          "รายการวัตถุดิบทั้งหมด (Ingredients List)": ingredientSummary,
          "เหตุผล/หมายเหตุ": menu.reason || "-",
        };
      });

      // 2. Detailed Ingredients Sheet Rows
      const detailRows: Record<string, unknown>[] = [];
      filteredMenus.forEach((menu) => {
        menu.lines.forEach((line, ingIdx) => {
          const ingItem = itemMap.get(line.ingredientCode.toUpperCase().trim());
          const cost = calculateIngCost(line.ingredientCode, line.quantity, line.unit);

          detailRows.push({
            "รหัสเมนู (Menu Code)": menu.menuCode,
            "ชื่อเมนู (Menu Name)": menu.menuName,
            ลำดับวัตถุดิบ: ingIdx + 1,
            "รหัสวัตถุดิบ (Ingredient Code)": line.ingredientCode,
            "ชื่อวัตถุดิบ (Ingredient Name)": line.ingredientName,
            "ปริมาณที่ใช้ (Quantity)": line.quantity,
            "หน่วยนับ (Unit)": line.unit,
            "ต้นทุนประมาณการ (Est. Cost)": Number(cost.toFixed(2)),
            หมวดหมู่วัตถุดิบ: ingItem?.category || "ทั่วไป",
            "วัตถุดิบทดแทน/สูตรย่อย": line.subRecipeCode || "-",
            สถานะเมนู: menu.isDeleted ? "Deleted" : menu.active ? "Active" : "Inactive",
          });
        });
      });

      const wb = XLSX.utils.book_new();

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, "สรุปภาพรวมสูตรอาหาร");

      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, wsDetail, "รายละเอียดส่วนผสมทุกเมนู");

      const dateStr = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `Hana_Recipe_Master_Summary_${dateStr}.xlsx`);
      toast.success("ส่งออกไฟล์ Excel สรุปสูตรอาหารเรียบร้อยแล้ว");
    } catch (err) {
      console.error("Export Excel error:", err);
      toast.error("เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel");
    }
  };

  // Print Summary Sheet
  const handlePrintSummary = () => {
    if (filteredMenus.length === 0) {
      toast.error("ไม่มีข้อมูลสูตรอาหารสำหรับพิมพ์");
      return;
    }

    const printDate = getThaiPrintTimestamp();
    const rowsHtml = filteredMenus
      .map((menu, index) => {
        const ingPreview = menu.lines
          .map(
            (l) =>
              `<span style="display:inline-block; background:#f1f5f9; padding:2px 6px; border-radius:4px; margin:2px; font-size:11px;">
                ${l.ingredientName || l.ingredientCode}: <strong>${l.quantity} ${l.unit}</strong>
              </span>`,
          )
          .join("");

        let statusBadge = '<span style="color:#15803d; font-weight:bold;">เปิดใช้งาน</span>';
        if (menu.isDeleted) {
          statusBadge = '<span style="color:#dc2626; font-weight:bold;">ลบแล้ว</span>';
        } else if (!menu.active) {
          statusBadge = '<span style="color:#b45309; font-weight:bold;">ปิดใช้งาน</span>';
        }

        const dateFormatted = formatDateTime(
          menu.actionTimestamp || menu.updatedAt || menu.createdAt,
        );

        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
            <td style="padding: 8px; text-align: center; font-weight: bold; color: #64748b;">${index + 1}</td>
            <td style="padding: 8px; font-family: monospace; font-weight: bold; color: #0f172a;">${menu.menuCode}</td>
            <td style="padding: 8px; font-weight: bold; color: #1e293b;">
              ${menu.menuName}
              ${menu.hasPreparedIngs ? '<span style="font-size:10px; color:#b45309; background:#fef3c7; padding:1px 4px; border-radius:3px; margin-left:4px;">มี Prepared/ซอส</span>' : ""}
            </td>
            <td style="padding: 8px; text-align: center; font-size: 11px; color: #475569;">${dateFormatted}</td>
            <td style="padding: 8px; text-align: center; font-weight: 600;">${menu.lines.length} รายการ</td>
            <td style="padding: 8px;">${ingPreview}</td>
            <td style="padding: 8px; text-align: right; font-weight: 600;">
              ${menu.estimatedCost > 0 ? `฿${menu.estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
            </td>
            <td style="padding: 8px; text-align: center;">${statusBadge}</td>
          </tr>
        `;
      })
      .join("");

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>สรุปบัญชีสูตรอาหาร (Recipe Master Summary)</title>
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
              <div class="title">รายงานสรุปบัญชีสูตรอาหาร (Food Recipe Master Index)</div>
              <div class="subtitle">ระบบจัดการสูตรและคำนวณการใช้วัตถุดิบ — Hana ERP System</div>
            </div>
            <div class="meta">
              <div>วันที่พิมพ์: <strong>${printDate}</strong></div>
              <div>จำนวนเมนูในรายงาน: <strong>${filteredMenus.length}</strong> เมนู</div>
            </div>
          </div>

          <div class="stats">
            <div class="stat-box">
              <div>เมนูทั้งหมด</div>
              <div class="stat-num">${stats.totalMenus} เมนู</div>
            </div>
            <div class="stat-box">
              <div>เปิดใช้งาน (Active)</div>
              <div class="stat-num" style="color:#15803d;">${stats.activeMenus} เมนู</div>
            </div>
            <div class="stat-box">
              <div>ปิดใช้งาน (Inactive)</div>
              <div class="stat-num" style="color:#b45309;">${stats.inactiveMenus} เมนู</div>
            </div>
            <div class="stat-box">
              <div>วัตถุดิบดิบที่นำมาใช้รวม</div>
              <div class="stat-num" style="color:#0284c7;">${stats.uniqueIngredientsCount} รายการ</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">#</th>
                <th style="width: 110px;">รหัสเมนู</th>
                <th style="width: 170px;">ชื่อเมนูอาหาร</th>
                <th style="width: 130px; text-align: center;">วันที่บันทึก/นำเข้า</th>
                <th style="width: 85px; text-align: center;">วัตถุดิบ</th>
                <th>รายการวัตถุดิบที่ใช้ (สัดส่วน)</th>
                <th style="width: 95px; text-align: right;">ต้นทุนประมาณการ</th>
                <th style="width: 85px; text-align: center;">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div style="margin-top: 20px; font-size: 10px; color: #94a3b8; text-align: right;">
            เอกสารสรุปสูตรอาหารจากระบบ Hana — พิมพ์เมื่อ ${printDate}
          </div>
        </body>
      </html>
    `;

    printHtmlDocument(printHtml, "สรุปบัญชีสูตรอาหาร");
  };

  // Print Single Menu Recipe Sheet
  const handlePrintSingleMenu = (menu: GroupedRecipeMenu) => {
    const printDate = getThaiPrintTimestamp();
    const rows = menu.lines
      .map((l, idx) => {
        const item = itemMap.get(l.ingredientCode.toUpperCase().trim());
        const cost = calculateIngCost(l.ingredientCode, l.quantity, l.unit);
        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
            <td style="padding: 10px 8px; text-align: center; color: #64748b;">${idx + 1}</td>
            <td style="padding: 10px 8px; font-family: monospace; font-weight: bold; color: #0f172a;">${l.ingredientCode}</td>
            <td style="padding: 10px 8px; font-weight: 600; color: #1e293b;">
              ${l.ingredientName || l.ingredientCode}
              ${item?.itemType === "prepared" ? '<span style="font-size:10px; color:#b45309; background:#fef3c7; padding:1px 4px; border-radius:3px; margin-left:4px;">Prepared</span>' : ""}
            </td>
            <td style="padding: 10px 8px; text-align: right; font-weight: bold; font-size: 14px;">${l.quantity.toLocaleString()}</td>
            <td style="padding: 10px 8px; font-weight: 500; color: #475569;">${l.unit}</td>
            <td style="padding: 10px 8px; text-align: right; color: #475569;">
              ${item?.standardCost ? `฿${item.standardCost.toLocaleString()}/${item.stockUnit || item.unit || "หน่วย"}` : "-"}
            </td>
            <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: #0f172a;">
              ${cost > 0 ? `฿${cost.toFixed(2)}` : "-"}
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
          <title>สูตรอาหาร: ${menu.menuName} (${menu.menuCode})</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: 'Sarabun', 'Segoe UI', Tahoma, sans-serif; color: #0f172a; margin: 0; padding: 0; }
            .card { border: 2px solid #0f172a; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
            .title { font-size: 22px; font-weight: bold; color: #0f172a; }
            .code { font-family: monospace; font-size: 16px; color: #475569; margin-top: 4px; }
            .stats { display: flex; gap: 12px; margin-bottom: 16px; }
            .stat-box { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #f8fafc; }
            .stat-label { font-size: 11px; color: #64748b; }
            .stat-val { font-size: 16px; font-weight: bold; color: #0f172a; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; text-align: left; }
            th { background-color: #f1f5f9; padding: 10px 8px; font-size: 12px; font-weight: bold; border-bottom: 2px solid #cbd5e1; }
            .footer { margin-top: 24px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div>
                <div class="title">${menu.menuName}</div>
                <div class="code">รหัสเมนู: <strong>${menu.menuCode}</strong></div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 13px; font-weight: bold; color: ${menu.active ? "#15803d" : "#b45309"};">
                  ${menu.active ? "● เปิดใช้งาน (Active)" : "○ ปิดใช้งาน (Inactive)"}
                </div>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
                  บันทึกเมื่อ: ${formatDateTime(menu.actionTimestamp || menu.updatedAt || menu.createdAt)}
                </div>
              </div>
            </div>

            <div class="stats">
              <div class="stat-box">
                <div class="stat-label">จำนวนวัตถุดิบทั้งหมด</div>
                <div class="stat-val">${menu.lines.length} รายการ</div>
              </div>
              <div class="stat-box">
                <div class="stat-label">ต้นทุนวัตถุดิบต่อจาน (ประมาณการ)</div>
                <div class="stat-val" style="color: #047857;">
                  ${menu.estimatedCost > 0 ? `฿${menu.estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                </div>
              </div>
              <div class="stat-box">
                <div class="stat-label">ประเภทวัตถุดิบ</div>
                <div class="stat-val" style="font-size: 13px; margin-top: 4px;">
                  ${menu.hasPreparedIngs ? "มีวัตถุดิบกึ่งสำเร็จรูป / ซอส" : "วัตถุดิบดิบมาตรฐาน"}
                </div>
              </div>
            </div>

            ${menu.reason ? `<div style="background:#fef3c7; border:1px solid #fde68a; padding:8px 12px; border-radius:6px; font-size:12px; color:#92400e; margin-bottom:16px;"><strong>บันทึกเหตุผล:</strong> ${menu.reason}</div>` : ""}

            <table>
              <thead>
                <tr>
                  <th style="width: 40px; text-align: center;">#</th>
                  <th style="width: 130px;">รหัสวัตถุดิบ</th>
                  <th>ชื่อวัตถุดิบ</th>
                  <th style="width: 100px; text-align: right;">ปริมาณที่ใช้</th>
                  <th style="width: 70px;">หน่วย</th>
                  <th style="width: 110px; text-align: right;">ราคาต่อหน่วย</th>
                  <th style="width: 110px; text-align: right;">ต้นทุนประมาณการ</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>

            <div class="footer">
              <div>สูตรอาหารมาตรฐาน — Hana Restaurant Management System</div>
              <div>พิมพ์เมื่อ: ${printDate}</div>
            </div>
          </div>
        </body>
      </html>
    `;

    printHtmlDocument(printHtml, `สูตรอาหาร_${menu.menuCode}`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Hero Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
        {/* Card 1: Total Menus */}
        <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-linear-to-br from-white to-amber-50/40 dark:from-stone-900 dark:to-amber-950/20 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              เมนูอาหารทั้งหมด
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ChefHat className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100">
              {stats.totalMenus}
            </span>
            <span className="text-xs text-stone-500">เมนู</span>
          </div>
          <p className="mt-1 text-[11px] text-stone-500 truncate">สูตรเมนูที่บันทึกในระบบ</p>
        </div>

        {/* Card 2: Active Menus */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200/70 dark:border-emerald-800/60 bg-linear-to-br from-white to-emerald-50/40 dark:from-stone-900 dark:to-emerald-950/20 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              เมนูเปิดใช้งาน (Active)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
              {stats.activeMenus}
            </span>
            <span className="text-xs text-emerald-600/80">เมนู</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-600/80 truncate">
            พร้อมคำนวณตัดสต็อกตามยอดขาย
          </p>
        </div>

        {/* Card 3: Inactive Menus */}
        <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              ปิดใช้งานชั่วคราว
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Power className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-700 dark:text-amber-400">
              {stats.inactiveMenus}
            </span>
            <span className="text-xs text-stone-500">เมนู</span>
          </div>
          <p className="mt-1 text-[11px] text-stone-500 truncate">หยุดขาย/ปรับปรุงสูตร</p>
        </div>

        {/* Card 4: Prepared Components */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-200/70 dark:border-amber-800/60 bg-linear-to-br from-white to-amber-50/30 dark:from-stone-900 dark:to-amber-950/20 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              มีส่วนผสมกึ่งสำเร็จรูป
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-700 dark:text-amber-400">
              {stats.preparedCount}
            </span>
            <span className="text-xs text-amber-600">เมนู</span>
          </div>
          <p className="mt-1 text-[11px] text-amber-600/80 truncate">ใช้ซอส/ของกึ่งสำเร็จรูป</p>
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
              {stats.uniqueIngredientsCount}
            </span>
            <span className="text-xs text-stone-500">ชนิด</span>
          </div>
          <p className="mt-1 text-[11px] text-stone-500 truncate">วัตถุดิบใน Master Items</p>
        </div>
      </div>

      {/* 2. Search & Toolbar Controls */}
      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 dark:border-stone-800 bg-card p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input
            placeholder="ค้นหาด้วยรหัสเมนู, ชื่อเมนูอาหาร, หรือชื่อวัตถุดิบ..."
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
              onChange={(e) => setSortBy(e.target.value as RecipeMenuSortOption)}
              className="h-8 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-2.5 text-xs text-stone-700 dark:text-stone-300 font-medium"
            >
              <option value="date_desc">📅 วันที่นำเข้า/บันทึก (ใหม่สุด → เก่าสุด)</option>
              <option value="date_asc">📅 วันที่นำเข้า/บันทึก (เก่าสุด → ใหม่สุด)</option>
              <option value="code_asc">🔤 รหัสเมนู (A → Z)</option>
              <option value="code_desc">🔤 รหัสเมนู (Z → A)</option>
              <option value="name_asc">📝 ชื่อเมนู (ก → ฮ)</option>
              <option value="count_desc">📊 จำนวนวัตถุดิบ (มาก → น้อย)</option>
              <option value="cost_desc">💰 ต้นทุนประมาณการ (มาก → น้อย)</option>
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
              ทั้งหมด ({stats.totalMenus})
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                statusFilter === "active"
                  ? "bg-white dark:bg-stone-800 text-emerald-700 dark:text-emerald-400 shadow-xs"
                  : "text-stone-600 dark:text-stone-400 hover:text-emerald-600"
              }`}
            >
              ใช้งาน ({stats.activeMenus})
            </button>
            <button
              onClick={() => setStatusFilter("inactive")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                statusFilter === "inactive"
                  ? "bg-white dark:bg-stone-800 text-amber-700 dark:text-amber-400 shadow-xs"
                  : "text-stone-600 dark:text-stone-400 hover:text-amber-600"
              }`}
            >
              ปิดใช้งาน ({stats.inactiveMenus})
            </button>
            {stats.deletedMenus > 0 && (
              <button
                onClick={() => setStatusFilter("deleted")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                  statusFilter === "deleted"
                    ? "bg-white dark:bg-stone-800 text-rose-700 dark:text-rose-400 shadow-xs"
                    : "text-stone-600 dark:text-stone-400 hover:text-rose-600"
                }`}
              >
                ถังขยะ ({stats.deletedMenus})
              </button>
            )}
          </div>

          {/* Prepared / Sauce Filter */}
          <select
            value={preparedFilter}
            onChange={(e) =>
              setPreparedFilter(e.target.value as "all" | "prepared_only" | "raw_only")
            }
            className="h-8 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-2.5 text-xs text-stone-700 dark:text-stone-300 font-medium"
          >
            <option value="all">วัตถุดิบทุกรูปแบบ</option>
            <option value="prepared_only">🍲 มีวัตถุดิบกึ่งสำเร็จรูป / ซอส</option>
            <option value="raw_only">🥬 วัตถุดิบดิบล้วน</option>
          </select>

          {/* Print Summary Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintSummary}
            className="rounded-xl border-stone-200 dark:border-stone-800 gap-1.5 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
            title="พิมพ์ตารางสรุปบัญชีสูตรอาหาร"
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
            title="ดาวน์โหลดไฟล์ Excel สรุปสูตรอาหารทั้งหมด"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            ส่งออก Excel
          </Button>
        </div>
      </div>

      {/* 3. Summary Recipes Table */}
      {filteredMenus.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 dark:border-stone-800 bg-card p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 mb-3">
            <ChefHat className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
            ไม่พบรายการสูตรอาหาร
          </h3>
          <p className="mt-1 text-xs text-stone-500 max-w-md">
            {searchQuery || statusFilter !== "all" || preparedFilter !== "all"
              ? "ไม่พบข้อมูลที่ตรงกับคำค้นหาหรือตัวกรอง ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง"
              : "ยังไม่มีสูตรอาหารในระบบ คลิกปุ่มด้านล่างเพื่อเริ่มสร้างสูตร"}
          </p>
          <div className="mt-4 flex gap-2">
            {(searchQuery || statusFilter !== "all" || preparedFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setPreparedFilter("all");
                }}
                className="text-xs"
              >
                ล้างตัวกรอง
              </Button>
            )}
            <Button size="sm" onClick={() => onOpenCreate()} className="text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" />
              เพิ่มสูตรอาหารใหม่
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800 bg-card shadow-xs">
          {/* Table Header Summary Banner */}
          <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-900/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-stone-800 dark:text-stone-200">
                บัญชีรายชื่อสูตรอาหาร (Food Recipe Master Index)
              </span>
              <Badge variant="secondary" className="text-[11px] font-semibold">
                {filteredMenus.length} เมนู
              </Badge>
            </div>
            <span className="text-[11px] text-stone-500 hidden sm:inline-block">
              คลิกที่รหัสเมนูเพื่อคัดลอก หรือกดปุ่ม "ดูสูตร" เพื่อดูอัตราส่วนส่วนผสมอย่างละเอียด
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-100/60 dark:bg-stone-900/80 text-stone-600 dark:text-stone-400 font-semibold">
                  <th className="py-3 px-3 text-center w-12">#</th>
                  <th className="py-3 px-3 min-w-[130px]">รหัสเมนูอาหาร</th>
                  <th className="py-3 px-3 min-w-[180px]">ชื่อเมนูอาหาร</th>
                  <th className="py-3 px-3 text-center min-w-[80px]">วัตถุดิบ</th>
                  <th className="py-3 px-3 min-w-[280px]">รายการวัตถุดิบหลักที่ใช้</th>
                  <th className="py-3 px-3 text-right min-w-[120px]">ต้นทุนประมาณการ</th>
                  <th className="py-3 px-3 text-center min-w-[90px]">สถานะ</th>
                  <th className="py-3 px-3 text-right min-w-[130px]">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200/80 dark:divide-stone-800">
                {filteredMenus.map((menu, index) => {
                  const isCopied = copiedCode === menu.menuCode;

                  return (
                    <tr
                      key={menu.menuCode}
                      className="hover:bg-stone-50/80 dark:hover:bg-stone-900/40 transition-colors group"
                    >
                      {/* 1. Index */}
                      <td className="py-3 px-3 text-center text-stone-400 dark:text-stone-500 font-mono font-medium">
                        {index + 1}
                      </td>

                      {/* 2. Menu Code */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-stone-900 dark:text-stone-100 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700">
                            {menu.menuCode}
                          </span>
                          <button
                            onClick={() => handleCopyCode(menu.menuCode)}
                            className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-0.5 rounded transition-colors"
                            title="คัดลอกรหัสเมนู"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 3. Menu Name & Info */}
                      <td className="py-3 px-3">
                        <div>
                          <span className="font-semibold text-stone-900 dark:text-stone-100 text-[13px]">
                            {menu.menuName}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] font-medium text-stone-600 dark:text-stone-300 flex items-center gap-1 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded">
                              <Clock className="w-2.5 h-2.5 text-stone-400" />
                              {formatDateTime(
                                menu.actionTimestamp || menu.updatedAt || menu.createdAt,
                              )}
                            </span>
                            {menu.hasPreparedIngs && (
                              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/60 px-1.5 py-0.2 rounded">
                                มี Prepared/ซอส
                              </span>
                            )}
                            {menu.reason && (
                              <span
                                className="text-[10px] text-stone-400 truncate max-w-[160px]"
                                title={menu.reason}
                              >
                                • {menu.reason}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 4. Ingredients Count */}
                      <td className="py-3 px-3 text-center">
                        <Badge
                          variant="outline"
                          className="font-mono text-xs border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                        >
                          {menu.lines.length} รายการ
                        </Badge>
                      </td>

                      {/* 5. Key Ingredients Summary Tags */}
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1 items-center max-w-[340px]">
                          {menu.lines.slice(0, 3).map((l, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200/60 dark:border-stone-700/60 truncate max-w-[160px]"
                              title={`${l.ingredientName || l.ingredientCode}: ${l.quantity} ${l.unit}`}
                            >
                              <span className="truncate">
                                {l.ingredientName || l.ingredientCode}
                              </span>
                              <span className="font-mono text-[10px] text-stone-400 font-semibold">
                                {l.quantity} {l.unit}
                              </span>
                            </span>
                          ))}
                          {menu.lines.length > 3 && (
                            <button
                              onClick={() => setSelectedMenuForView(menu)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-amber-700 dark:text-amber-400 hover:underline bg-amber-50 dark:bg-amber-950/40"
                            >
                              +{menu.lines.length - 3} รายการ...
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 6. Estimated Cost */}
                      <td className="py-3 px-3 text-right">
                        {menu.estimatedCost > 0 ? (
                          <div>
                            <span className="font-semibold text-stone-900 dark:text-stone-100 tabular-nums text-[13px]">
                              ฿
                              {menu.estimatedCost.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                            <span className="text-[10px] text-stone-400 block">/ จาน</span>
                          </div>
                        ) : (
                          <span className="text-stone-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* 7. Status */}
                      <td className="py-3 px-3 text-center">
                        {menu.isDeleted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            ถังขยะ (ลบแล้ว)
                          </span>
                        ) : menu.active ? (
                          <button
                            onClick={() => onSetInactive(menu.menuCode, menu.menuName)}
                            className="inline-flex"
                            title="คลิกเพื่อปิดใช้งานเมนูนี้"
                          >
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 hover:bg-emerald-200/80 transition-colors">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              เปิดใช้งาน
                            </span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onSetActive(menu.menuCode, menu.menuName)}
                            className="inline-flex"
                            title="คลิกเพื่อเปิดใช้งานเมนูนี้"
                          >
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-amber-200/80 transition-colors">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              ปิดใช้งาน
                            </span>
                          </button>
                        )}
                      </td>

                      {/* 8. Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Quick View Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedMenuForView(menu)}
                            className="h-7 w-7 p-0 text-stone-600 hover:text-stone-900 dark:text-stone-300"
                            title="ดูรายละเอียดส่วนผสมและอัตราส่วน"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          {/* Print Single Menu */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePrintSingleMenu(menu)}
                            className="h-7 w-7 p-0 text-stone-600 hover:text-stone-900 dark:text-stone-300"
                            title="พิมพ์ใบสูตรอาหารเดี่ยว (Recipe Sheet)"
                          >
                            <Printer className="h-3.5 w-3.5 text-stone-500 hover:text-stone-900" />
                          </Button>

                          {/* Add/Edit Ingredient into this menu */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (onSwitchToCards) {
                                onSwitchToCards(menu.menuCode);
                              } else {
                                onOpenCreate(menu.menuCode, menu.menuName);
                              }
                            }}
                            className="h-7 w-7 p-0 text-stone-600 hover:text-stone-900 dark:text-stone-300"
                            title="จัดการ/แก้ไขส่วนผสมในสูตรนี้"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-stone-500 hover:text-stone-900" />
                          </Button>

                          {/* Restore or Soft Delete Action */}
                          {menu.isDeleted ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onRestore(menu.menuCode, menu.menuName)}
                              className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700"
                              title="คืนค่าเมนูนี้กลับสู่การใช้งาน"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onSoftDelete(menu.menuCode, menu.menuName)}
                              className="h-7 w-7 p-0 text-stone-400 hover:text-rose-600"
                              title="ย้ายเมนูนี้ไปยังประวัติการลบ / ถังขยะ"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          )}
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
              แสดง <strong>{filteredMenus.length}</strong> จากทั้งหมด{" "}
              <strong>{stats.totalMenus}</strong> เมนูอาหาร
            </div>
            <div className="flex items-center gap-3 mt-2 sm:mt-0 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                เปิดใช้งาน: {stats.activeMenus} เมนู
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                ปิดใช้งาน: {stats.inactiveMenus} เมนู
              </span>
              {stats.deletedMenus > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                  ในถังขยะ: {stats.deletedMenus} เมนู
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Quick View Recipe Details Modal */}
      {selectedMenuForView && (
        <Dialog
          open={!!selectedMenuForView}
          onOpenChange={(open) => !open && setSelectedMenuForView(null)}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <ChefHat className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
                    <span>{selectedMenuForView.menuName}</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {selectedMenuForView.menuCode}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    สูตรอาหารมาตรฐาน (Standard Food Recipe BOM)
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 text-xs">
              <div>
                <span className="text-stone-500">จำนวนส่วนผสม:</span>
                <div className="font-bold text-stone-900 dark:text-stone-100 text-sm mt-0.5">
                  {selectedMenuForView.lines.length} รายการ
                </div>
              </div>
              <div>
                <span className="text-stone-500">ต้นทุนวัตถุดิบประมาณการ:</span>
                <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">
                  {selectedMenuForView.estimatedCost > 0
                    ? `฿${selectedMenuForView.estimatedCost.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} / จาน`
                    : "-"}
                </div>
              </div>
              <div>
                <span className="text-stone-500">สถานะ:</span>
                <div className="font-bold mt-0.5">
                  {selectedMenuForView.isDeleted ? (
                    <span className="text-rose-600">ถังขยะ (ลบแล้ว)</span>
                  ) : selectedMenuForView.active ? (
                    <span className="text-emerald-600">เปิดใช้งาน (Active)</span>
                  ) : (
                    <span className="text-amber-600">ปิดใช้งาน (Inactive)</span>
                  )}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-3 pt-1 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-stone-500">
                <span>
                  วันที่บันทึก/นำเข้า:{" "}
                  <strong className="text-stone-700 dark:text-stone-300">
                    {formatDateTime(
                      selectedMenuForView.actionTimestamp ||
                        selectedMenuForView.updatedAt ||
                        selectedMenuForView.createdAt,
                    )}
                  </strong>
                </span>
                {selectedMenuForView.hasPreparedIngs && (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                    ★ มีส่วนผสมที่เป็นสินค้ากึ่งสำเร็จรูป / ซอส
                  </span>
                )}
              </div>
              {selectedMenuForView.reason && (
                <div className="col-span-2 sm:col-span-3 text-stone-600 dark:text-stone-400">
                  <span className="font-semibold">บันทึกเหตุผล:</span> {selectedMenuForView.reason}
                </div>
              )}
            </div>

            {/* Ingredients Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-700 dark:text-stone-300">
                <span>รายการวัตถุดิบและสัดส่วนที่ใช้ต่อ 1 ที่เสิร์ฟ</span>
                <span>{selectedMenuForView.lines.length} วัตถุดิบ</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100 dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 font-semibold">
                    <tr>
                      <th className="p-2.5 text-center w-8">#</th>
                      <th className="p-2.5">รหัสวัตถุดิบ</th>
                      <th className="p-2.5">ชื่อวัตถุดิบ</th>
                      <th className="p-2.5 text-right">ปริมาณที่ใช้</th>
                      <th className="p-2.5">หน่วย</th>
                      <th className="p-2.5 text-right">ต้นทุนประมาณการ</th>
                      <th className="p-2.5 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200/80 dark:divide-stone-800">
                    {selectedMenuForView.lines.map((l, idx) => {
                      const cost = calculateIngCost(l.ingredientCode, l.quantity, l.unit);
                      const item = itemMap.get(l.ingredientCode.toUpperCase().trim());

                      return (
                        <tr
                          key={l.id || idx}
                          className="hover:bg-stone-50/60 dark:hover:bg-stone-900/40"
                        >
                          <td className="p-2.5 text-center text-stone-400 font-mono">{idx + 1}</td>
                          <td className="p-2.5 font-mono font-bold text-stone-900 dark:text-stone-100">
                            {l.ingredientCode}
                          </td>
                          <td className="p-2.5">
                            <span className="font-semibold text-stone-800 dark:text-stone-200">
                              {l.ingredientName || l.ingredientCode}
                            </span>
                            {item?.itemType === "prepared" && (
                              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/60 px-1 py-0.2 rounded ml-1">
                                Prepared
                              </span>
                            )}
                            {l.subRecipeCode && (
                              <span className="text-[10px] text-stone-400 block">
                                ทดแทน: {l.subRecipeCode}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                            {l.quantity.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-stone-600 dark:text-stone-400 font-medium">
                            {l.unit}
                          </td>
                          <td className="p-2.5 text-right tabular-nums text-stone-700 dark:text-stone-300">
                            {cost > 0 ? `฿${cost.toFixed(2)}` : "-"}
                          </td>
                          <td className="p-2.5 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedMenuForView(null);
                                onOpenEdit(l);
                              }}
                              className="h-6 w-6 p-0 text-stone-500 hover:text-stone-900"
                              title="แก้ไขรายการวัตถุดิบนี้"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 mt-4 pt-3 border-t border-stone-200 dark:border-stone-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePrintSingleMenu(selectedMenuForView)}
                className="gap-1.5 text-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                พิมพ์สูตรนี้ (A4)
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const m = selectedMenuForView;
                    setSelectedMenuForView(null);
                    if (onSwitchToCards) {
                      onSwitchToCards(m.menuCode);
                    } else {
                      onOpenCreate(m.menuCode, m.menuName);
                    }
                  }}
                  className="text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  เพิ่มวัตถุดิบเข้าสูตรนี้
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
