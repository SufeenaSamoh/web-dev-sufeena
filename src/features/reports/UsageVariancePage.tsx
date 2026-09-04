import React, { useState, useMemo, useEffect } from "react";
import { useStore, formatCurrency } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  calculateUsageVariance,
  type CalculateVarianceParams,
} from "@/lib/usageVarianceCalculator";
import {
  loadSavedVarianceReasons,
  loadSavedStockAdjustments,
  recordVarianceReason,
  saveReasonAndAdjustStock,
} from "@/services/usageVarianceService";
import { loadRecipeVersions, saveRecipeVersions } from "@/lib/recipeVersioning";
import type {
  UsageVarianceItem,
  UsageVarianceReason,
  StockAdjustment,
  StandardReasonCode,
  RecipeVersion,
} from "@/features/reports/types/usageVariance";
import { UsageVarianceDashboard } from "./components/UsageVarianceDashboard";
import { VarianceReasonModal } from "./components/VarianceReasonModal";
import { RecipeVersionModal } from "./components/RecipeVersionModal";
import { printUsageVarianceDocument } from "./printReports";
import {
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  GitBranch,
  Settings as SettingsIcon,
  SlidersHorizontal,
  FileSpreadsheet,
  Info,
  Layers,
  ArrowUpDown,
  Utensils,
  ShoppingCart,
  Building2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type DatePreset = "today" | "last7" | "thisMonth" | "all" | "custom";
type StatusFilter = "all" | "abnormal" | "unreviewed" | "reviewed" | "adjusted" | "normal";

export interface UsageVariancePageProps {
  hideTitleHeader?: boolean;
}

export const UsageVariancePage: React.FC<UsageVariancePageProps> = ({
  hideTitleHeader = false,
}) => {
  const {
    items,
    categories,
    branches,
    transactions,
    stockCounts,
    recipes,
    salesRecords,
    settings,
    currentUser,
    addTransaction,
    selectedBranchId,
    setSelectedBranchId,
  } = useStore();

  // 1. Date Filter State (Default to Current Month)
  const [datePreset, setDatePreset] = useState<DatePreset>("thisMonth");
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);

  // 2. Filter Controls
  const [branchFilter, setBranchFilter] = useState<string>(selectedBranchId || "all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Thresholds from Settings or local override
  const [thresholdPct, setThresholdPct] = useState<number>(settings.variancePercentThreshold ?? 5);
  const [thresholdValue, setThresholdValue] = useState<number>(
    settings.varianceValueThreshold ?? 100,
  );
  const [showThresholdConfig, setShowThresholdConfig] = useState(false);

  // UI state
  const [showDashboard, setShowDashboard] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Modal states
  const [selectedItemForReason, setSelectedItemForReason] = useState<UsageVarianceItem | null>(
    null,
  );
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [isRecipeVersionModalOpen, setIsRecipeVersionModalOpen] = useState(false);

  // Persistent storage state
  const [savedReasons, setSavedReasons] = useState<UsageVarianceReason[]>([]);
  const [savedAdjustments, setSavedAdjustments] = useState<StockAdjustment[]>([]);
  const [recipeVersions, setRecipeVersions] = useState<RecipeVersion[]>([]);

  // Load saved state on mount
  useEffect(() => {
    setSavedReasons(loadSavedVarianceReasons());
    setSavedAdjustments(loadSavedStockAdjustments());
    setRecipeVersions(loadRecipeVersions(recipes));
  }, [recipes]);

  // Sync settings when changed
  useEffect(() => {
    if (settings.variancePercentThreshold) {
      setThresholdPct(settings.variancePercentThreshold);
    }
    if (settings.varianceValueThreshold) {
      setThresholdValue(settings.varianceValueThreshold);
    }
  }, [settings.variancePercentThreshold, settings.varianceValueThreshold]);

  // Handle Preset changes
  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "last7") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === "thisMonth") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      setStartDate(start);
      setEndDate(todayStr);
    } else if (preset === "all") {
      setStartDate("");
      setEndDate("");
    }
  };

  // 3. Calculate Variance
  const { items: calculatedItems, summary } = useMemo(() => {
    return calculateUsageVariance({
      startDate,
      endDate,
      branchId: branchFilter,
      categoryId: categoryFilter,
      searchQuery,
      items,
      categories,
      branches,
      transactions,
      stockCounts,
      recipes,
      recipeVersions,
      salesRecords,
      savedReasons,
      savedAdjustments,
      thresholdPct,
      thresholdValue,
    });
  }, [
    startDate,
    endDate,
    branchFilter,
    categoryFilter,
    searchQuery,
    items,
    categories,
    branches,
    transactions,
    stockCounts,
    recipes,
    recipeVersions,
    salesRecords,
    savedReasons,
    savedAdjustments,
    thresholdPct,
    thresholdValue,
  ]);

  // 4. Apply Status & Search Filtering to table
  const displayedItems = useMemo(() => {
    let list = calculatedItems;
    if (statusFilter !== "all") {
      list = list.filter((item) => {
        if (statusFilter === "abnormal") return item.isAbnormal;
        if (statusFilter === "unreviewed") return item.status === "abnormal_unreviewed";
        if (statusFilter === "reviewed") return item.status === "abnormal_reviewed";
        if (statusFilter === "adjusted") return item.status === "adjusted";
        if (statusFilter === "normal") return item.status === "normal";
        return true;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (it) =>
          it.ingredientName.toLowerCase().includes(q) ||
          it.ingredientCode.toLowerCase().includes(q) ||
          it.categoryName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [calculatedItems, statusFilter, searchQuery]);

  // Toggle Row Expansion
  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Handle Save Reason
  const handleSaveReasonOnly = async (params: {
    item: UsageVarianceItem;
    reasonCode: StandardReasonCode;
    reasonLabel: string;
    reasonNote: string;
  }) => {
    const res = await recordVarianceReason({
      varianceItemId: params.item.id,
      ingredientId: params.item.ingredientId,
      ingredientCode: params.item.ingredientCode,
      ingredientName: params.item.ingredientName,
      branchId: params.item.branchId,
      branchName: params.item.branchName,
      reasonCode: params.reasonCode,
      reasonLabel: params.reasonLabel,
      reasonNote: params.reasonNote,
      currentUser,
    });
    setSavedReasons(loadSavedVarianceReasons());
  };

  // Handle Save & Adjust Stock
  const handleSaveAndAdjustStock = async (params: {
    item: UsageVarianceItem;
    reasonCode: StandardReasonCode;
    reasonLabel: string;
    reasonNote: string;
  }) => {
    await saveReasonAndAdjustStock({
      varianceItemId: params.item.id,
      ingredientId: params.item.ingredientId,
      ingredientCode: params.item.ingredientCode,
      ingredientName: params.item.ingredientName,
      branchId: params.item.branchId,
      branchName: params.item.branchName,
      unit: params.item.unit,
      unitPrice: params.item.purchasePrice,
      diffQty: params.item.diffQty,
      reasonCode: params.reasonCode,
      reasonLabel: params.reasonLabel,
      reasonNote: params.reasonNote,
      currentUser,
      addTransactionFn: addTransaction,
    });
    setSavedReasons(loadSavedVarianceReasons());
    setSavedAdjustments(loadSavedStockAdjustments());
  };

  // Handle Save New Recipe Version
  const handleSaveNewRecipeVersion = (newVer: RecipeVersion) => {
    const updated = [newVer, ...recipeVersions];
    setRecipeVersions(updated);
    saveRecipeVersions(updated);
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const exportData = calculatedItems.map((r, idx) => ({
        ลำดับ: idx + 1,
        รหัสวัตถุดิบ: r.ingredientCode,
        ชื่อวัตถุดิบ: r.ingredientName,
        หมวดหมู่: r.categoryName,
        สาขา: r.branchName,
        หน่วย: r.unit,
        ราคาต่อหน่วย: r.purchasePrice,
        ยอดต้นงวด: Number(r.beginningQty.toFixed(2)),
        รับเข้า: Number(r.purchaseQty.toFixed(2)),
        ยอดปลายงวดนับจริง: Number(r.endingActualQty.toFixed(2)),
        ใช้จริง_คำนวณ: Number(r.actualUsageQty.toFixed(2)),
        ใช้ตามสูตร_BOM: Number(r.theoreticalUsageQty.toFixed(2)),
        ผลต่าง_จำนวน: Number(r.diffQty.toFixed(2)),
        ผลต่าง_เปอร์เซ็นต์: Number(r.diffPct.toFixed(2)),
        มูลค่าผลต่าง_บาท: Number(r.diffValue.toFixed(2)),
        สถานะ:
          r.status === "adjusted"
            ? "ปรับปรุงแล้ว"
            : r.status === "abnormal_reviewed"
              ? "บันทึกเหตุผลแล้ว"
              : r.status === "abnormal_unreviewed"
                ? "ผิดปกติ (รอตรวจสอบ)"
                : "ปกติ",
        สาเหตุ_เหตุผล: r.currentReasonLabel || "-",
        รายละเอียดเพิ่มเติม: r.currentReasonNote || "-",
        ผู้ตรวจสอบ: r.reviewedBy || "-",
        วันที่ปรับปรุง: r.adjustedAt ? new Date(r.adjustedAt).toLocaleString("th-TH") : "-",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Usage_Variance");

      const filename = `Usage_Variance_${startDate || "all"}_to_${endDate || "all"}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success("ส่งออกไฟล์ Excel สำเร็จแล้ว");
    } catch (err) {
      toast.error("เกิดข้อผิดพลาดในการส่งออก Excel");
    }
  };

  // Print Report
  const handlePrint = () => {
    if (displayedItems.length === 0) {
      toast.error("ไม่มีข้อมูลสำหรับพิมพ์");
      return;
    }

    printUsageVarianceDocument({
      companyName: settings.companyName || "Sushi Hana Thailand",
      branchName:
        branchFilter === "all"
          ? "ทุกสาขา (All Branches)"
          : branches.find((b) => b.id === branchFilter)?.name || branchFilter,
      startDate: startDate || "—",
      endDate: endDate || "—",
      categoryName:
        categoryFilter === "all"
          ? "ทุกหมวดหมู่"
          : categories.find((c) => c.id === categoryFilter)?.name || categoryFilter,
      items: displayedItems,
      summary,
      currentUser,
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Printable Header Banner */}
      <div className="hidden print:block rounded-xl border border-slate-300 bg-white p-4 shadow-none mb-4">
        <div className="flex items-center justify-between border-b border-slate-300 pb-3 mb-3">
          <div>
            <h1 className="text-base font-bold text-slate-900">
              {settings.companyName || "Sushi Hana Thailand"}
            </h1>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">
              รายงานเปรียบเทียบการใช้วัตถุดิบจริง vs ใช้ตามสูตร (Usage Variance Report)
            </p>
          </div>
          <div className="text-right text-[10px] text-slate-500">
            <div>วันที่พิมพ์: {new Date().toLocaleString("th-TH")}</div>
            <div>ผู้จัดทำ: {currentUser?.name || "ผู้ใช้งานระบบ"}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-700">
          <div>
            <span className="font-semibold text-slate-500">สาขา:</span>{" "}
            {branchFilter === "all"
              ? "ทุกสาขา (All Branches)"
              : branches.find((b) => b.id === branchFilter)?.name || branchFilter}
          </div>
          <div>
            <span className="font-semibold text-slate-500">ช่วงเวลา:</span> {startDate || "—"} ถึง{" "}
            {endDate || "—"}
          </div>
          <div>
            <span className="font-semibold text-slate-500">หมวดหมู่:</span>{" "}
            {categoryFilter === "all"
              ? "ทุกหมวดหมู่"
              : categories.find((c) => c.id === categoryFilter)?.name || categoryFilter}
          </div>
          <div>
            <span className="font-semibold text-slate-500">รายการทั้งหมด:</span>{" "}
            {displayedItems.length} รายการ (ผิดปกติ {summary.abnormalItemsCount} รายการ)
          </div>
        </div>
      </div>

      {/* 1. Header & Title Bar (shown if not embedded in multi-tab Reports) */}
      {!hideTitleHeader ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
              <div className="p-2 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                <ShieldCheck className="w-5 h-5" />
              </div>
              รายงานเปรียบเทียบการใช้จริง vs ใช้ตามสูตร
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              วิเคราะห์ผลต่างการใช้วัตถุดิบจริงเทียบกับสูตรมาตรฐาน (BOM) และกระทบยอดสต็อก
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRecipeVersionModalOpen(true)}
              className="rounded-xl text-xs flex items-center gap-1.5 border-slate-300 dark:border-slate-700"
            >
              <GitBranch className="w-3.5 h-3.5 text-primary" />
              เวอร์ชันสูตร (BOM Versioning)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="rounded-xl text-xs flex items-center gap-1.5 border-slate-300 dark:border-slate-700"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              ส่งออก Excel
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="rounded-xl text-xs flex items-center gap-1.5 border-slate-300 dark:border-slate-700"
            >
              <Printer className="w-3.5 h-3.5" />
              พิมพ์รายงาน
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1 print:hidden">
          <div className="text-xs text-muted-foreground">
            วิเคราะห์ผลต่างการใช้วัตถุดิบจริงเทียบกับสูตรมาตรฐาน (BOM) บันทึกสาเหตุ Loss
            และกระทบยอดสต็อก
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRecipeVersionModalOpen(true)}
              className="rounded-xl text-xs flex items-center gap-1.5 border-slate-300 dark:border-slate-700"
            >
              <GitBranch className="w-3.5 h-3.5 text-primary" />
              เวอร์ชันสูตร (BOM)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="rounded-xl text-xs flex items-center gap-1.5 border-slate-300 dark:border-slate-700"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              ส่งออก Excel
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="rounded-xl text-xs flex items-center gap-1.5 border-slate-300 dark:border-slate-700"
            >
              <Printer className="w-3.5 h-3.5" />
              พิมพ์
            </Button>
          </div>
        </div>
      )}

      {/* 2. Filter Bar & Quick Controls */}
      <Card className="p-4 rounded-3xl border-slate-200 dark:border-slate-800 bg-card shadow-sm space-y-3 print:hidden">
        {/* Preset Date Buttons & Branch Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-muted-foreground mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> ช่วงเวลา:
            </span>
            {(
              [
                { key: "today", label: "วันนี้" },
                { key: "last7", label: "7 วันที่ผ่านมา" },
                { key: "thisMonth", label: "เดือนนี้" },
                { key: "all", label: "ทั้งหมด" },
                { key: "custom", label: "กำหนดเอง" },
              ] as { key: DatePreset; label: string }[]
            ).map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant={datePreset === p.key ? "default" : "outline"}
                onClick={() => applyPreset(p.key)}
                className={`rounded-xl text-xs h-8 px-3 ${
                  datePreset === p.key
                    ? "font-bold shadow-sm"
                    : "text-muted-foreground border-slate-200 dark:border-slate-800"
                }`}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowThresholdConfig(!showThresholdConfig)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-xl h-8"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              เกณฑ์แจ้งเตือน: &gt; {thresholdPct}% หรือ &gt; ฿{thresholdValue}
            </Button>
          </div>
        </div>

        {/* Date pickers when custom or specific, Branch & Category Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div>
            <Label className="text-[11px] text-muted-foreground font-semibold">
              ตั้งแต่วันที่ (Start Date)
            </Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset("custom");
              }}
              className="h-9 rounded-xl mt-0.5 text-xs"
            />
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground font-semibold">
              ถึงวันที่ (End Date)
            </Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset("custom");
              }}
              className="h-9 rounded-xl mt-0.5 text-xs"
            />
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground font-semibold">สาขา (Branch)</Label>
            <Select value={branchFilter} onValueChange={(val) => setBranchFilter(val)}>
              <SelectTrigger className="h-9 rounded-xl mt-0.5 text-xs">
                <SelectValue placeholder="เลือกสาขา" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  ทุกสาขา (All Branches)
                </SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs">
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground font-semibold">
              หมวดหมู่วัตถุดิบ (Category)
            </Label>
            <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val)}>
              <SelectTrigger className="h-9 rounded-xl mt-0.5 text-xs">
                <SelectValue placeholder="เลือกหมวดหมู่" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  ทุกหมวดหมู่ (All Categories)
                </SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Threshold Configuration Drawer (if toggled) */}
        {showThresholdConfig && (
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                ปรับเกณฑ์การตรวจจับความผิดปกติ (Anomaly Thresholds)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setThresholdPct(settings.variancePercentThreshold ?? 5);
                  setThresholdValue(settings.varianceValueThreshold ?? 100);
                }}
                className="text-[11px] h-6 px-2 text-muted-foreground"
              >
                คืนค่าเริ่มต้น
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px]">Diff Threshold (%)</Label>
                <div className="relative mt-0.5">
                  <Input
                    type="number"
                    min={0.1}
                    max={100}
                    step={0.5}
                    value={thresholdPct}
                    onChange={(e) => setThresholdPct(Math.max(0.1, Number(e.target.value)))}
                    className="h-8 rounded-xl text-xs pr-8"
                  />
                  <span className="absolute right-3 top-2 text-[11px] text-muted-foreground font-bold">
                    %
                  </span>
                </div>
              </div>
              <div>
                <Label className="text-[11px]">Diff Value Threshold (฿)</Label>
                <div className="relative mt-0.5">
                  <Input
                    type="number"
                    min={1}
                    step={10}
                    value={thresholdValue}
                    onChange={(e) => setThresholdValue(Math.max(1, Number(e.target.value)))}
                    className="h-8 rounded-xl text-xs pr-8"
                  />
                  <span className="absolute right-3 top-2 text-[11px] text-muted-foreground font-bold">
                    ฿
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 3. Executive Dashboard Component (KPIs, Charts, Leaderboard) */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Executive Summary &amp; Analytics
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDashboard(!showDashboard)}
            className="text-xs text-muted-foreground h-7 rounded-xl"
          >
            {showDashboard ? "ซ่อนแดชบอร์ด" : "แสดงแดชบอร์ดสรุป"}
          </Button>
        </div>
        {showDashboard && (
          <UsageVarianceDashboard
            summary={summary}
            thresholdPct={thresholdPct}
            thresholdValue={thresholdValue}
          />
        )}
      </div>

      {/* 4. Table Filter Bar & Search */}
      <Card className="rounded-3xl border-slate-200 dark:border-slate-800 bg-card shadow-sm overflow-hidden print:border-none print:shadow-none">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3 print:hidden">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: "all", label: `ทั้งหมด (${calculatedItems.length})` },
              {
                key: "abnormal",
                label: `ผิดปกติ (${summary.abnormalItemsCount})`,
                color: "text-rose-600 dark:text-rose-400",
              },
              {
                key: "unreviewed",
                label: `รอตรวจสอบ (${summary.abnormalItemsCount - summary.reviewedItemsCount})`,
                color: "text-amber-600 dark:text-amber-400",
              },
              {
                key: "reviewed",
                label: `บันทึกแล้ว (${summary.reviewedItemsCount - summary.adjustedItemsCount})`,
                color: "text-blue-600 dark:text-blue-400",
              },
              {
                key: "adjusted",
                label: `ปรับปรุงแล้ว (${summary.adjustedItemsCount})`,
                color: "text-emerald-600 dark:text-emerald-400",
              },
              {
                key: "normal",
                label: `ปกติ (${calculatedItems.length - summary.abnormalItemsCount})`,
              },
            ].map((tab) => (
              <Button
                key={tab.key}
                size="sm"
                variant={statusFilter === tab.key ? "default" : "ghost"}
                onClick={() => setStatusFilter(tab.key as StatusFilter)}
                className={`rounded-xl text-xs h-8 px-3 ${
                  statusFilter === tab.key
                    ? "font-bold shadow-sm"
                    : tab.color || "text-muted-foreground"
                }`}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <Input
              placeholder="ค้นหารหัส หรือ ชื่อวัตถุดิบ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 rounded-xl text-xs"
            />
          </div>
        </div>

        {/* 5. Main Usage Variance Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-muted-foreground font-semibold">
                <th className="py-3 px-3 text-center w-10 print:hidden"></th>
                <th className="py-3 px-3 text-left min-w-[140px]">วัตถุดิบ</th>
                <th className="py-3 px-3 text-left">หมวดหมู่</th>
                <th className="py-3 px-3 text-right">ยอดต้นงวด</th>
                <th className="py-3 px-3 text-right">รับเข้า</th>
                <th className="py-3 px-3 text-right">ยอดปลายงวด</th>
                <th className="py-3 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                  ใช้จริง (คำนวณ)
                </th>
                <th className="py-3 px-3 text-right font-bold text-blue-600 dark:text-blue-400">
                  ใช้ตามสูตร
                </th>
                <th className="py-3 px-3 text-right">Diff จำนวน</th>
                <th className="py-3 px-3 text-right">Diff %</th>
                <th className="py-3 px-3 text-right">มูลค่า Diff (฿)</th>
                <th className="py-3 px-3 text-center">สถานะ</th>
                <th className="py-3 px-3 text-center w-28 print:hidden">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {displayedItems.length > 0 ? (
                displayedItems.map((row) => {
                  const isExpanded = expandedRows.has(row.id);
                  const isLoss = row.diffValue > 0;
                  const isGain = row.diffValue < 0;

                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          row.isAbnormal && row.status === "abnormal_unreviewed"
                            ? "bg-rose-50/25 dark:bg-rose-950/10"
                            : ""
                        }`}
                      >
                        {/* Expand Toggle */}
                        <td className="py-3 px-2 text-center print:hidden">
                          <button
                            onClick={() => toggleRow(row.id)}
                            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-muted-foreground"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>

                        {/* Ingredient Code & Name */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {row.ingredientName}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {row.ingredientCode} • ฿{row.purchasePrice}/{row.unit}
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-3 text-muted-foreground">{row.categoryName}</td>

                        {/* Beginning Stock (Carry Forward) */}
                        <td className="py-3 px-3 text-right font-medium">
                          <div>
                            {row.beginningQty.toFixed(2)} {row.unit}
                          </div>
                          {row.beginningCountDate && (
                            <div className="text-[9px] text-muted-foreground">
                              นับ: {row.beginningCountDate}
                            </div>
                          )}
                        </td>

                        {/* Purchases */}
                        <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
                          {row.purchaseQty > 0 ? `+${row.purchaseQty.toFixed(2)}` : "0.00"}{" "}
                          {row.unit}
                        </td>

                        {/* Ending Actual Count */}
                        <td className="py-3 px-3 text-right font-medium">
                          <div className="text-slate-900 dark:text-slate-100">
                            {row.endingActualQty.toFixed(2)} {row.unit}
                          </div>
                          {row.endingCountDate && (
                            <div className="text-[9px] text-emerald-600 font-medium">
                              นับ: {row.endingCountDate}
                            </div>
                          )}
                        </td>

                        {/* Actual Usage (Calculated) */}
                        <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                          {row.actualUsageQty.toFixed(2)} {row.unit}
                        </td>

                        {/* Theoretical Usage (BOM) */}
                        <td className="py-3 px-3 text-right font-bold text-blue-600 dark:text-blue-400">
                          {row.theoreticalUsageQty.toFixed(2)} {row.unit}
                        </td>

                        {/* Diff Qty */}
                        <td className="py-3 px-3 text-right font-bold">
                          <span
                            className={
                              isLoss
                                ? "text-rose-600 dark:text-rose-400"
                                : isGain
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-muted-foreground"
                            }
                          >
                            {row.diffQty > 0 ? "+" : ""}
                            {row.diffQty.toFixed(2)} {row.unit}
                          </span>
                        </td>

                        {/* Diff % */}
                        <td className="py-3 px-3 text-right font-bold">
                          <span
                            className={
                              isLoss
                                ? "text-rose-600 dark:text-rose-400"
                                : isGain
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-muted-foreground"
                            }
                          >
                            {row.diffPct > 0 ? "+" : ""}
                            {row.diffPct.toFixed(1)}%
                          </span>
                        </td>

                        {/* Diff Value (THB) */}
                        <td className="py-3 px-3 text-right font-bold">
                          <span
                            className={
                              isLoss
                                ? "text-rose-600 dark:text-rose-400"
                                : isGain
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-muted-foreground"
                            }
                          >
                            {row.diffValue > 0 ? "+" : ""}
                            {formatCurrency(row.diffValue)}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3 text-center">
                          {row.status === "adjusted" ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 text-[10px] px-2 py-0.5">
                              ปรับปรุงแล้ว
                            </Badge>
                          ) : row.status === "abnormal_reviewed" ? (
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 text-[10px] px-2 py-0.5">
                              บันทึกแล้ว
                            </Badge>
                          ) : row.status === "abnormal_unreviewed" ? (
                            <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 text-[10px] px-2 py-0.5 animate-pulse">
                              ผิดปกติ (รอตรวจ)
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground text-[10px] px-2 py-0.5"
                            >
                              ปกติ
                            </Badge>
                          )}
                        </td>

                        {/* Action Button */}
                        <td className="py-3 px-3 text-center print:hidden">
                          <Button
                            size="sm"
                            variant={row.isAbnormal ? "default" : "outline"}
                            onClick={() => {
                              setSelectedItemForReason(row);
                              setIsReasonModalOpen(true);
                            }}
                            className={`rounded-xl text-[11px] h-7 px-2.5 ${
                              row.isAbnormal
                                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                : "text-muted-foreground"
                            }`}
                          >
                            {row.status === "adjusted"
                              ? "ดูประวัติ"
                              : row.status === "abnormal_reviewed"
                                ? "แก้ไขเหตุผล"
                                : "บันทึกเหตุผล"}
                          </Button>
                        </td>
                      </tr>

                      {/* Expanded Drilldown Details */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
                          <td colSpan={13} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Menu Breakdown contributing to theoretical usage */}
                              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                                <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                  <Utensils className="w-3.5 h-3.5 text-blue-500" />
                                  ที่มาของยอดใช้ตามสูตร (Recipe BOM &amp; Sales Breakdown)
                                </h5>
                                {row.menuBreakdown && row.menuBreakdown.length > 0 ? (
                                  <div className="overflow-x-auto max-h-48 overflow-y-auto">
                                    <table className="w-full text-[11px]">
                                      <thead>
                                        <tr className="text-muted-foreground border-b border-slate-100 dark:border-slate-800 font-semibold">
                                          <th className="text-left py-1">เมนูที่ขาย</th>
                                          <th className="text-right py-1">ยอดขาย</th>
                                          <th className="text-right py-1">สัดส่วนสูตร</th>
                                          <th className="text-right py-1">ใช้รวม</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                        {row.menuBreakdown.map((m) => (
                                          <tr key={m.menuCode}>
                                            <td className="py-1.5 font-medium">
                                              {m.menuName} ({m.menuCode})
                                              {m.recipeVersion && (
                                                <span className="ml-1 text-[9px] text-muted-foreground">
                                                  [{m.recipeVersion}]
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-1.5 text-right">
                                              {m.quantitySold} ที่
                                            </td>
                                            <td className="py-1.5 text-right text-muted-foreground">
                                              {m.recipePortion} {m.recipeUnit}
                                            </td>
                                            <td className="py-1.5 text-right font-bold text-blue-600">
                                              {m.contributedUsageConverted.toFixed(2)}{" "}
                                              {m.masterUnit}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground py-2">
                                    ไม่มีรายการขายเมนูที่ผูกสูตรกับวัตถุดิบนี้ในช่วงเวลาที่เลือก
                                  </p>
                                )}
                              </div>

                              {/* Physical Stock & Reasons Summary */}
                              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                                <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                  สรุปการตรวจนับจริง &amp; สาเหตุผลต่าง
                                </h5>

                                <div className="space-y-1.5 text-[11px]">
                                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-muted-foreground">
                                      สูตรคำนวณการใช้จริง:
                                    </span>
                                    <span className="font-mono font-medium">
                                      {row.beginningQty.toFixed(2)} + {row.purchaseQty.toFixed(2)} −{" "}
                                      {row.endingActualQty.toFixed(2)} ={" "}
                                      <strong>
                                        {row.actualUsageQty.toFixed(2)} {row.unit}
                                      </strong>
                                    </span>
                                  </div>

                                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-muted-foreground">
                                      สาเหตุที่บันทึกไว้:
                                    </span>
                                    <span className="font-bold text-slate-900 dark:text-slate-100">
                                      {row.currentReasonLabel || "ยังไม่ได้บันทึก"}
                                    </span>
                                  </div>

                                  {row.currentReasonNote && (
                                    <div className="py-1 text-muted-foreground bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                                      <strong>บันทึก:</strong> {row.currentReasonNote}
                                    </div>
                                  )}

                                  {row.isAdjusted && (
                                    <div className="py-1 text-emerald-700 dark:text-emerald-300 font-medium">
                                      ✓ ปรับปรุงสต็อกแล้ว ({row.adjustedQty} {row.unit}) เมื่อ{" "}
                                      {row.adjustedAt
                                        ? new Date(row.adjustedAt).toLocaleString("th-TH")
                                        : "-"}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-xs text-muted-foreground">
                    <Info className="w-8 h-8 text-muted-foreground/60 mx-auto mb-2" />
                    ไม่พบรายการวัตถุดิบตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 6. Reason Recording & Stock Adjustment Modal */}
      <VarianceReasonModal
        isOpen={isReasonModalOpen}
        onClose={() => {
          setIsReasonModalOpen(false);
          setSelectedItemForReason(null);
        }}
        item={selectedItemForReason}
        reasonsHistory={savedReasons}
        onSaveReasonOnly={handleSaveReasonOnly}
        onSaveAndAdjustStock={handleSaveAndAdjustStock}
      />

      {/* 7. Recipe BOM Versioning Modal */}
      <RecipeVersionModal
        isOpen={isRecipeVersionModalOpen}
        onClose={() => setIsRecipeVersionModalOpen(false)}
        recipes={recipes}
        versions={recipeVersions}
        onSaveNewVersion={handleSaveNewRecipeVersion}
        currentUser={currentUser}
      />
    </div>
  );
};
