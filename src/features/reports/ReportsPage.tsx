import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/PageHeader";
import { useStore, formatCurrency } from "@/lib/store";
import { hasPermission } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SearchableSupplierSelector } from "@/components/SearchableSupplierSelector";
import { Download, Printer, FileText, FileSpreadsheet, Search } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatDateTime } from "@/lib/dateFormat";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { UsageVariancePage } from "./UsageVariancePage";
import { TheoreticalUsagePage } from "./TheoreticalUsagePage";
import { InventoryMovementPage } from "./InventoryMovementPage";
import { PriceAnalysisPage } from "./PriceAnalysisPage";
import { cn } from "@/lib/utils";
import { printReportDocument } from "./printReports";

type ReportTab =
  "variance" | "inventory" | "purchase" | "count" | "movement" | "theoretical" | "price";
type Preset = "week" | "month" | "custom";

function presetRange(preset: Preset): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  if (preset === "week") start.setDate(end.getDate() - 6);
  else if (preset === "month") start.setDate(end.getDate() - 29);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function formatDateDisplay(dateStr: string): string {
  return formatDate(dateStr);
}

function getGeneratedDateTime(): string {
  return formatDateTime(new Date());
}

type QuickFilterType = "all" | "movement" | "no_movement" | "out_of_stock" | "hide_out_of_stock";

function sortRows<T extends Record<string, unknown>>(
  rows: T[],
  key: string,
  dir: "asc" | "desc",
): T[] {
  if (!key) return rows;
  return [...rows].sort((a, b) => {
    const valA = a[key];
    const valB = b[key];
    if (typeof valA === "number" && typeof valB === "number") {
      return dir === "asc" ? valA - valB : valB - valA;
    }
    return dir === "asc"
      ? String(valA ?? "").localeCompare(String(valB ?? ""))
      : String(valB ?? "").localeCompare(String(valA ?? ""));
  });
}

export function ReportsPage() {
  const {
    items,
    categories,
    transactions,
    suppliers,
    branches,
    inventoryBalance,
    settings,
    currentUser,
    selectedBranchId,
  } = useStore();
  const canViewFinancial = hasPermission(currentUser, "reports:financial");

  // Tab state: default to 'variance' as requested
  const [activeTab, setActiveTab] = useState<ReportTab>("variance");

  const [preset, setPreset] = useState<Preset>("month");
  const initial = presetRange("month");
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);

  const [branchId, setBranchId] = useState(selectedBranchId || "all");
  const [categoryId, setCategoryId] = useState("all");
  const [supplierId, setSupplierId] = useState("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>("all");
  const [q, setQ] = useState("");

  // Sort state per tab
  const [sortKey, setSortKey] = useState<string>("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const r = presetRange(p);
      setStart(r.start);
      setEnd(r.end);
    }
  };

  const startTs = useMemo(() => new Date(start + "T00:00:00").getTime(), [start]);
  const endTs = useMemo(() => new Date(end + "T23:59:59").getTime(), [end]);

  const filteredItems = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryId !== "all" && i.categoryId !== categoryId) return false;
      if (supplierId !== "all" && i.supplierId !== supplierId) return false;
      if (!query) return true;
      const supplierName = suppliers.find((s) => s.id === i.supplierId)?.name ?? "";
      return (
        i.code.toLowerCase().includes(query) ||
        i.name.toLowerCase().includes(query) ||
        supplierName.toLowerCase().includes(query)
      );
    });
  }, [items, categoryId, supplierId, q, suppliers]);
  const filteredItemIds = useMemo(() => new Set(filteredItems.map((i) => i.id)), [filteredItems]);

  const stockByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of inventoryBalance) {
      if (branchId !== "all" && b.branchId !== branchId) continue;
      map.set(b.itemId, (map.get(b.itemId) ?? 0) + b.quantity);
    }
    return map;
  }, [inventoryBalance, branchId]);

  // Inventory rows
  const inventoryRows = useMemo(
    () =>
      filteredItems.map((i) => {
        const stock = stockByItem.get(i.id) ?? 0;
        return {
          code: i.code,
          name: i.name,
          unit: i.unit,
          category: categories.find((c) => c.id === i.categoryId)?.name ?? "ทั่วไป",
          stock,
          min: i.minStock,
          status: stock <= i.minStock ? "ต่ำกว่าเกณฑ์" : "ปกติ",
          purchasePrice: i.purchasePrice ?? 0,
        };
      }),
    [filteredItems, categories, stockByItem],
  );

  const displayedInventoryRows = useMemo(() => {
    const rows = inventoryRows.filter((r) => {
      if (quickFilter === "movement") return r.stock > 0;
      if (quickFilter === "no_movement") return r.stock === 0;
      if (quickFilter === "out_of_stock") return r.stock === 0;
      if (quickFilter === "hide_out_of_stock") return r.stock > 0;
      return true;
    });

    return sortRows(rows, sortKey, sortDir);
  }, [inventoryRows, quickFilter, sortKey, sortDir]);

  // Purchase rows
  const purchaseRows = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "purchase")
        .filter((t) => filteredItemIds.has(t.itemId))
        .filter((t) => branchId === "all" || t.branchId === branchId)
        .filter((t) => {
          const ts = new Date(t.date).getTime();
          return ts >= startTs && ts <= endTs;
        })
        .map((t) => {
          const item = items.find((i) => i.id === t.itemId);
          return {
            date: formatDate(t.date),
            rawDate: t.date,
            code: item?.code ?? "-",
            item: item?.name ?? "-",
            unit: item?.unit ?? "",
            supplier: suppliers.find((s) => s.id === t.supplierId)?.name ?? "-",
            qty: t.quantity,
            price: t.unitPrice ?? 0,
            total: (t.unitPrice ?? 0) * t.quantity,
          };
        }),
    [transactions, items, suppliers, filteredItemIds, branchId, startTs, endTs],
  );

  const displayedPurchaseRows = useMemo(() => {
    const rows = purchaseRows.filter(() => {
      if (quickFilter === "no_movement") return false;
      return true;
    });

    return sortRows(rows, sortKey, sortDir);
  }, [purchaseRows, quickFilter, sortKey, sortDir]);

  // Stock count adjustment rows
  const stockCountRows = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "adjustment")
        .filter((t) => filteredItemIds.has(t.itemId))
        .filter((t) => branchId === "all" || t.branchId === branchId)
        .filter((t) => {
          const ts = new Date(t.date).getTime();
          return ts >= startTs && ts <= endTs;
        })
        .map((t) => {
          const item = items.find((i) => i.id === t.itemId);
          return {
            date: formatDate(t.date),
            rawDate: t.date,
            code: item?.code ?? "-",
            item: item?.name ?? "-",
            unit: item?.unit ?? "",
            diff: t.quantity,
            remark: t.remark ?? "ตรวจนับสต็อก",
          };
        }),
    [transactions, items, filteredItemIds, branchId, startTs, endTs],
  );

  const displayedStockCountRows = useMemo(() => {
    const rows = stockCountRows.filter(() => {
      if (quickFilter === "no_movement") return false;
      return true;
    });

    return sortRows(rows, sortKey, sortDir);
  }, [stockCountRows, quickFilter, sortKey, sortDir]);

  // Filter context labels
  const restaurantName = settings.companyName || "Sushi Hana";
  const branchLabel =
    branchId === "all"
      ? "ทุกสาขา (All Branches)"
      : (branches.find((b) => b.id === branchId)?.name ?? branchId);
  const periodLabel = `${formatDateDisplay(start)} - ${formatDateDisplay(end)}`;

  const getExportFilename = (ext: string) => {
    const tabName =
      activeTab === "inventory"
        ? "Inventory_Report"
        : activeTab === "purchase"
          ? "Purchase_Report"
          : "Stock_Count_Report";
    const cleanBranch =
      branchLabel.replace(/[^a-zA-Z0-9ก-๙]+/g, "_").replace(/^_+|_+$/g, "") || "All_Branches";
    return `${tabName}_${cleanBranch}_${start}_to_${end}.${ext}`;
  };

  const getActiveTabData = () => {
    switch (activeTab) {
      case "inventory":
        return {
          headers: [
            "รหัส",
            "ชื่อวัตถุดิบ",
            "หน่วย",
            "หมวดหมู่",
            "สต็อกคงเหลือ",
            "สต็อกขั้นต่ำ",
            "สถานะ",
          ],
          rows: displayedInventoryRows.map((r) => [
            r.code,
            r.name,
            r.unit,
            r.category,
            r.stock,
            r.min,
            r.status,
          ]),
        };
      case "purchase":
        return {
          headers: canViewFinancial
            ? [
                "วันที่",
                "รหัส",
                "ชื่อวัตถุดิบ",
                "หน่วย",
                "ซัพพลายเออร์",
                "จำนวนรับเข้า",
                "ราคาต่อหน่วย",
                "มูลค่ารวม (บาท)",
              ]
            : ["วันที่", "รหัส", "ชื่อวัตถุดิบ", "หน่วย", "ซัพพลายเออร์", "จำนวนรับเข้า"],
          rows: displayedPurchaseRows.map((r) =>
            canViewFinancial
              ? [r.date, r.code, r.item, r.unit, r.supplier, r.qty, r.price, r.total]
              : [r.date, r.code, r.item, r.unit, r.supplier, r.qty],
          ),
        };
      case "count":
        return {
          headers: ["วันที่", "รหัส", "ชื่อวัตถุดิบ", "หน่วย", "ผลต่างที่ปรับปรุง", "หมายเหตุ"],
          rows: displayedStockCountRows.map((r) => [
            r.date,
            r.code,
            r.item,
            r.unit,
            r.diff,
            r.remark,
          ]),
        };
      default:
        return { headers: [], rows: [] };
    }
  };

  const handleExportCsv = () => {
    const { headers, rows } = getActiveTabData();
    if (rows.length === 0) return toast.error("ไม่มีข้อมูลสำหรับส่งออก");

    const generated = getGeneratedDateTime();
    const filename = getExportFilename("csv");

    const csvLines = [
      `"ร้านอาหาร:","${restaurantName.replace(/"/g, '""')}"`,
      `"สาขา:","${branchLabel.replace(/"/g, '""')}"`,
      `"ช่วงเวลา:","${periodLabel.replace(/"/g, '""')}"`,
      `"วันที่ออกรายงาน:","${generated.replace(/"/g, '""')}"`,
      "",
      headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","),
      ...rows.map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")),
    ];

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    toast.success(`ส่งออกไฟล์ ${filename} เรียบร้อยแล้ว`);
  };

  const handleExportExcel = () => {
    const { headers, rows } = getActiveTabData();
    if (rows.length === 0) return toast.error("ไม่มีข้อมูลสำหรับส่งออก");

    const generated = getGeneratedDateTime();
    const filename = getExportFilename("xlsx");

    const sheetData = [
      ["ร้านอาหาร:", restaurantName],
      ["สาขา:", branchLabel],
      ["ช่วงเวลา:", periodLabel],
      ["วันที่ออกรายงาน:", generated],
      [],
      headers,
      ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, filename);
    toast.success(`ส่งออกไฟล์ ${filename} เรียบร้อยแล้ว`);
  };

  const handlePrint = () => {
    const { rows } = getActiveTabData();
    if (rows.length === 0) {
      toast.error("ไม่มีข้อมูลสำหรับพิมพ์");
      return;
    }

    printReportDocument({
      activeTab: activeTab as "inventory" | "purchase" | "count",
      restaurantName,
      branchLabel,
      periodLabel,
      supplierLabel:
        supplierId !== "all"
          ? suppliers.find((s) => s.id === supplierId)?.name || supplierId
          : undefined,
      categoryLabel:
        categoryId !== "all"
          ? categories.find((c) => c.id === categoryId)?.name || categoryId
          : undefined,
      generatedDateTime: getGeneratedDateTime(),
      currentUser,
      canViewFinancial,
      inventoryRows: displayedInventoryRows,
      purchaseRows: displayedPurchaseRows,
      stockCountRows: displayedStockCountRows,
    });
  };

  const handleExportPdf = () => {
    handlePrint();
  };

  const renderSortIndicator = (key: string) => {
    if (sortKey !== key) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1 text-primary font-bold">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header & Title (No redundant description) */}
      <PageHeader title="รายงานระบบ (Reports)" />

      {/* 2. Top-Level Sub-Tab Navigation Bar (Minimal Threads/Instagram-style Underline Tabs) */}
      <div className="w-full border-b border-slate-200 dark:border-slate-800 flex items-center overflow-x-auto print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab("variance")}
          className={cn(
            "px-4 py-3 text-center text-xs sm:text-sm whitespace-nowrap transition-colors border-b-2 -mb-px select-none",
            activeTab === "variance"
              ? "border-slate-900 text-slate-900 font-medium dark:border-slate-100 dark:text-slate-100"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 font-normal",
          )}
        >
          รายงานผลต่าง
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("inventory")}
          className={cn(
            "px-4 py-3 text-center text-xs sm:text-sm whitespace-nowrap transition-colors border-b-2 -mb-px select-none",
            activeTab === "inventory"
              ? "border-slate-900 text-slate-900 font-medium dark:border-slate-100 dark:text-slate-100"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 font-normal",
          )}
        >
          คลังคงเหลือ
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("purchase")}
          className={cn(
            "px-4 py-3 text-center text-xs sm:text-sm whitespace-nowrap transition-colors border-b-2 -mb-px select-none",
            activeTab === "purchase"
              ? "border-slate-900 text-slate-900 font-medium dark:border-slate-100 dark:text-slate-100"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 font-normal",
          )}
        >
          การจัดซื้อ
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("count")}
          className={cn(
            "px-4 py-3 text-center text-xs sm:text-sm whitespace-nowrap transition-colors border-b-2 -mb-px select-none",
            activeTab === "count"
              ? "border-slate-900 text-slate-900 font-medium dark:border-slate-100 dark:text-slate-100"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 font-normal",
          )}
        >
          ผลนับสต็อก
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("movement")}
          className={cn(
            "px-4 py-3 text-center text-xs sm:text-sm whitespace-nowrap transition-colors border-b-2 -mb-px select-none",
            activeTab === "movement"
              ? "border-slate-900 text-slate-900 font-medium dark:border-slate-100 dark:text-slate-100"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 font-normal",
          )}
        >
          เคลื่อนไหวสินค้า
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("theoretical")}
          className={cn(
            "px-4 py-3 text-center text-xs sm:text-sm whitespace-nowrap transition-colors border-b-2 -mb-px select-none",
            activeTab === "theoretical"
              ? "border-slate-900 text-slate-900 font-medium dark:border-slate-100 dark:text-slate-100"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 font-normal",
          )}
        >
          การใช้ตามสูตร
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("price")}
          className={cn(
            "px-4 py-3 text-center text-xs sm:text-sm whitespace-nowrap transition-colors border-b-2 -mb-px select-none",
            activeTab === "price"
              ? "border-slate-900 text-slate-900 font-medium dark:border-slate-100 dark:text-slate-100"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 font-normal",
          )}
        >
          วิเคราะห์ราคา
        </button>
      </div>

      {/* 3. Tab Contents */}
      {activeTab === "variance" ? (
        <UsageVariancePage hideTitleHeader={true} />
      ) : activeTab === "theoretical" ? (
        <TheoreticalUsagePage hideTitleHeader={true} />
      ) : activeTab === "movement" ? (
        <InventoryMovementPage hideTitleHeader={true} />
      ) : activeTab === "price" ? (
        <PriceAnalysisPage hideTitleHeader={true} />
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground pb-1 print:hidden">
            {activeTab === "inventory" &&
              "ตรวจสอบยอดสต็อกคงเหลือปัจจุบัน ปริมาณสต็อกขั้นต่ำ และสถานะเตือนสินค้าใกล้หมด"}
            {activeTab === "purchase" &&
              "ประวัติการสั่งซื้อและรับเข้าวัตถุดิบแยกตามช่วงเวลา ซัพพลายเออร์ และมูลค่าจัดซื้อ"}
            {activeTab === "count" &&
              "ประวัติผลต่างการตรวจนับสต็อกจริงและการปรับปรุงสต็อก (Stock Count Adjustments)"}
          </div>

          {/* Shared Filter Bar for Inventory, Purchase, Stock Count */}
          <Card className="rounded-2xl border-border/70 bg-card p-3 shadow-xs print:hidden">
            <div className="flex flex-wrap items-end gap-2.5">
              {/* Branch */}
              <div className="min-w-[130px] flex-1 sm:flex-none">
                <Label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                  สาขา (Branch)
                </Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกสาขา (All Branches)</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category */}
              {(activeTab === "inventory" || activeTab === "purchase" || activeTab === "count") && (
                <div className="min-w-[140px] flex-1 sm:flex-none">
                  <Label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                    หมวดหมู่ (Category)
                  </Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                      <SelectValue placeholder="ทุกหมวดหมู่" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกหมวดหมู่ (All)</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Supplier (Shown for inventory and purchase) */}
              {(activeTab === "inventory" || activeTab === "purchase") && (
                <div className="min-w-[160px] flex-1 sm:flex-none">
                  <Label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                    ซัพพลายเออร์ (Supplier)
                  </Label>
                  <SearchableSupplierSelector
                    value={supplierId}
                    onChange={setSupplierId}
                    suppliers={suppliers}
                    allowAll
                    allValue="all"
                    allLabel="ทุกซัพพลายเออร์ (All)"
                    size="sm"
                    className="h-9 rounded-xl text-xs bg-background"
                    placeholder="เลือกซัพพลายเออร์..."
                  />
                </div>
              )}

              {/* Date Period (Shown for purchase and count) */}
              {(activeTab === "purchase" || activeTab === "count") && (
                <div className="flex items-center gap-1 min-w-[260px]">
                  <div className="flex-1">
                    <Label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                      วันที่เริ่มต้น
                    </Label>
                    <ThaiDatePicker
                      value={start}
                      onChange={(val) => {
                        setStart(val);
                        setPreset("custom");
                      }}
                      className="h-9 rounded-xl text-xs bg-background"
                    />
                  </div>
                  <span className="self-end pb-2 text-xs text-muted-foreground">-</span>
                  <div className="flex-1">
                    <Label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                      วันที่สิ้นสุด
                    </Label>
                    <ThaiDatePicker
                      value={end}
                      onChange={(val) => {
                        setEnd(val);
                        setPreset("custom");
                      }}
                      className="h-9 rounded-xl text-xs bg-background"
                    />
                  </div>
                </div>
              )}

              {/* Quick Filter */}
              {activeTab === "inventory" && (
                <div className="min-w-[160px] flex-1 sm:flex-none">
                  <Label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                    ตัวกรองด่วน (Quick Filter)
                  </Label>
                  <Select
                    value={quickFilter}
                    onValueChange={(v) => setQuickFilter(v as QuickFilterType)}
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs bg-background font-medium">
                      <SelectValue placeholder="ทั้งหมด" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด (All)</SelectItem>
                      <SelectItem value="movement">เฉพาะที่มีสต็อก (&gt; 0)</SelectItem>
                      <SelectItem value="no_movement">สต็อกเป็นศูนย์ (= 0)</SelectItem>
                      <SelectItem value="out_of_stock">สินค้าหมดสต็อก</SelectItem>
                      <SelectItem value="hide_out_of_stock">ซ่อนสินค้าหมดสต็อก</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Search */}
              <div className="min-w-[160px] flex-1">
                <Label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                  ค้นหา (Search)
                </Label>
                <div className="flex h-9 items-center gap-1.5 rounded-xl border border-input bg-background px-2.5">
                  <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="พิมพ์รหัส, ชื่อวัตถุดิบ หรือผู้จำหน่าย..."
                    className="h-7 border-0 bg-transparent text-xs shadow-none focus-visible:ring-0 p-0"
                  />
                </div>
              </div>

              {/* Export Action Buttons */}
              <div className="flex items-center gap-1.5 ml-auto pt-2 sm:pt-0">
                <Button
                  variant="outline"
                  onClick={handleExportCsv}
                  title="ส่งออก CSV"
                  className="rounded-xl text-xs h-9 px-2.5"
                >
                  <Download className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">CSV</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportExcel}
                  title="ส่งออก Excel"
                  className="rounded-xl text-xs h-9 px-2.5"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 sm:mr-1 text-emerald-600" />
                  <span className="hidden sm:inline">Excel</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportPdf}
                  title="ส่งออก PDF"
                  className="rounded-xl text-xs h-9 px-2.5"
                >
                  <FileText className="h-3.5 w-3.5 sm:mr-1 text-rose-500" />
                  <span className="hidden sm:inline">PDF</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePrint}
                  title="พิมพ์รายงาน"
                  className="rounded-xl text-xs h-9 px-2.5"
                >
                  <Printer className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">พิมพ์</span>
                </Button>
              </div>
            </div>
          </Card>

          {/* Printable Header Banner */}
          <div className="hidden print:block rounded-xl border border-slate-300 bg-white p-4 shadow-none mb-4">
            <div className="flex items-center justify-between border-b border-slate-300 pb-3 mb-3">
              <div>
                <h1 className="text-base font-bold text-slate-900">{restaurantName}</h1>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">
                  {activeTab === "inventory" && "รายงานยอดสต็อกคงเหลือ (Inventory Balance Report)"}
                  {activeTab === "purchase" &&
                    "รายงานประวัติการจัดซื้อและรับเข้า (Purchase & Receiving Report)"}
                  {activeTab === "count" &&
                    "รายงานผลต่างการตรวจนับสต็อก (Stock Count Variance Report)"}
                </p>
              </div>
              <div className="text-right text-[10px] text-slate-500">
                <div>วันที่พิมพ์: {getGeneratedDateTime()}</div>
                <div>สาขา: {branchLabel}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-700">
              <div>
                <span className="font-semibold text-slate-500">สาขา:</span> {branchLabel}
              </div>
              <div>
                <span className="font-semibold text-slate-500">ช่วงเวลา:</span> {periodLabel}
              </div>
              {(activeTab === "inventory" || activeTab === "purchase") && (
                <div>
                  <span className="font-semibold text-slate-500">ซัพพลายเออร์:</span>{" "}
                  {supplierId === "all"
                    ? "ทุกซัพพลายเออร์"
                    : suppliers.find((s) => s.id === supplierId)?.name || supplierId}
                </div>
              )}
              <div>
                <span className="font-semibold text-slate-500">จำนวนรายการ:</span>{" "}
                {activeTab === "inventory"
                  ? `${displayedInventoryRows.length} รายการ`
                  : activeTab === "purchase"
                    ? `${displayedPurchaseRows.length} รายการ`
                    : `${displayedStockCountRows.length} รายการ`}
              </div>
            </div>
          </div>

          {/* Table Container */}
          <Card className="rounded-2xl border-border/70 p-4 shadow-xs">
            {activeTab === "inventory" && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer select-none hover:bg-accent/30"
                        onClick={() => handleSort("code")}
                      >
                        รหัส {renderSortIndicator("code")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none hover:bg-accent/30"
                        onClick={() => handleSort("name")}
                      >
                        ชื่อวัตถุดิบ {renderSortIndicator("name")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none hover:bg-accent/30"
                        onClick={() => handleSort("category")}
                      >
                        หมวดหมู่ {renderSortIndicator("category")}
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer select-none hover:bg-accent/30"
                        onClick={() => handleSort("stock")}
                      >
                        สต็อกคงเหลือ {renderSortIndicator("stock")}
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer select-none hover:bg-accent/30"
                        onClick={() => handleSort("min")}
                      >
                        สต็อกขั้นต่ำ {renderSortIndicator("min")}
                      </TableHead>
                      <TableHead className="text-center">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedInventoryRows.map((r) => (
                      <TableRow key={r.code}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {r.code}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {r.name}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({r.unit})
                          </span>
                        </TableCell>
                        <TableCell>{r.category}</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">
                          {r.stock} {r.unit}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {r.min} {r.unit}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.status === "ต่ำกว่าเกณฑ์" ? (
                            <Badge variant="destructive" className="text-[10px]">
                              ต่ำกว่าเกณฑ์
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px]">
                              ปกติ
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {displayedInventoryRows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-xs text-muted-foreground"
                        >
                          ไม่พบรายการสินค้าตามเงื่อนไขการค้นหา
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {activeTab === "purchase" && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer select-none hover:bg-accent/30"
                        onClick={() => handleSort("rawDate")}
                      >
                        วันที่ {renderSortIndicator("rawDate")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none hover:bg-accent/30"
                        onClick={() => handleSort("code")}
                      >
                        รหัส {renderSortIndicator("code")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none hover:bg-accent/30"
                        onClick={() => handleSort("item")}
                      >
                        ชื่อวัตถุดิบ {renderSortIndicator("item")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none hover:bg-accent/30"
                        onClick={() => handleSort("supplier")}
                      >
                        ซัพพลายเออร์ {renderSortIndicator("supplier")}
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer select-none hover:bg-accent/30"
                        onClick={() => handleSort("qty")}
                      >
                        จำนวนรับเข้า {renderSortIndicator("qty")}
                      </TableHead>
                      {canViewFinancial && (
                        <>
                          <TableHead
                            className="text-right cursor-pointer select-none hover:bg-accent/30"
                            onClick={() => handleSort("price")}
                          >
                            ราคา/หน่วย {renderSortIndicator("price")}
                          </TableHead>
                          <TableHead
                            className="text-right cursor-pointer select-none hover:bg-accent/30"
                            onClick={() => handleSort("total")}
                          >
                            มูลค่ารวม (บาท) {renderSortIndicator("total")}
                          </TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedPurchaseRows.map((r, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs text-muted-foreground">{r.date}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {r.code}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {r.item}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({r.unit})
                          </span>
                        </TableCell>
                        <TableCell>{r.supplier}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {r.qty} {r.unit}
                        </TableCell>
                        {canViewFinancial && (
                          <>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(r.price)}
                            </TableCell>
                            <TableCell className="text-right font-bold tabular-nums text-slate-900 dark:text-slate-100">
                              {formatCurrency(r.total)}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                    {displayedPurchaseRows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={canViewFinancial ? 7 : 5}
                          className="text-center py-8 text-xs text-muted-foreground"
                        >
                          ไม่พบประวัติการจัดซื้อในช่วงเวลาที่เลือก
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {activeTab === "count" && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer select-none hover:bg-accent/30"
                        onClick={() => handleSort("rawDate")}
                      >
                        วันที่ {renderSortIndicator("rawDate")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none hover:bg-accent/30"
                        onClick={() => handleSort("code")}
                      >
                        รหัส {renderSortIndicator("code")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none hover:bg-accent/30"
                        onClick={() => handleSort("item")}
                      >
                        ชื่อวัตถุดิบ {renderSortIndicator("item")}
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer select-none hover:bg-accent/30"
                        onClick={() => handleSort("diff")}
                      >
                        ผลต่างที่ปรับปรุง {renderSortIndicator("diff")}
                      </TableHead>
                      <TableHead>หมายเหตุ / สาเหตุ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedStockCountRows.map((r, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs text-muted-foreground">{r.date}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {r.code}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {r.item}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({r.unit})
                          </span>
                        </TableCell>
                        <TableCell
                          className={`text-right font-bold tabular-nums ${
                            r.diff > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : r.diff < 0
                                ? "text-destructive"
                                : ""
                          }`}
                        >
                          {r.diff > 0 ? `+${r.diff}` : r.diff} {r.unit}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{r.remark}</TableCell>
                      </TableRow>
                    ))}
                    {displayedStockCountRows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-xs text-muted-foreground"
                        >
                          ไม่พบรายการตรวจนับหรือปรับปรุงสต็อกในช่วงเวลาที่เลือก
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
