import { useMemo, useState, useEffect, Fragment } from "react";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/PageHeader";
import { useStore, formatCurrency } from "@/lib/store";
import { filterByBranch } from "@/lib/branchFilter";
import { formatDate } from "@/lib/dateFormat";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSupplierSelector } from "@/components/SearchableSupplierSelector";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Search,
  Download,
  Printer,
  FileSpreadsheet,
  FileText,
  ChevronRight,
  ChevronDown,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  History,
  Boxes,
  Layers,
  Info,
  Calendar,
  Filter,
  ArrowLeft,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Item, StockTransaction } from "@/lib/types";
import { printReportDocument } from "./printReports";

export type DatePreset = "current_month" | "today" | "7days" | "30days" | "90days" | "custom";

export interface ItemMovementSummary {
  item: Item;
  supplierName: string;
  categoryName: string;
  openingQty: number;
  receivedQty: number;
  consumedQty: number;
  adjustmentQty: number;
  closingQty: number;
  unitCost: number;
  closingValue: number;
  branchBreakdown: Record<string, number>;
}

export interface InventoryLotDetail {
  id: string;
  lotNumber: string;
  branchId?: string | null;
  branchName?: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  supplierId?: string | null;
  supplierName?: string;
  invoiceNumber?: string;
  receivedDate: string;
  expiryDate?: string | null;
  unitCost: number;
  qtyReceived: number;
  qtyRemaining: number;
  status: "active" | "depleted" | "expired" | "cancelled";
}

export interface LotMovementRecord {
  id: string;
  date: string;
  type: string;
  qtyChange: number;
  runningQty: number;
  reference: string;
  location?: string;
  performedBy?: string;
}

function getDateRangeFromPreset(preset: DatePreset): { start: string; end: string } {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (preset === "today") {
    return { start: todayStr, end: todayStr };
  }
  if (preset === "7days") {
    const s = new Date(now);
    s.setDate(s.getDate() - 6);
    return { start: s.toISOString().slice(0, 10), end: todayStr };
  }
  if (preset === "30days") {
    const s = new Date(now);
    s.setDate(s.getDate() - 29);
    return { start: s.toISOString().slice(0, 10), end: todayStr };
  }
  if (preset === "90days") {
    const s = new Date(now);
    s.setDate(s.getDate() - 89);
    return { start: s.toISOString().slice(0, 10), end: todayStr };
  }
  if (preset === "current_month") {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: firstDay.toISOString().slice(0, 10), end: todayStr };
  }
  return { start: todayStr, end: todayStr };
}

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  return formatDate(dateStr, "N/A");
}

export interface InventoryMovementPageProps {
  hideTitleHeader?: boolean;
}

export function InventoryMovementPage({ hideTitleHeader = false }: InventoryMovementPageProps) {
  const {
    items,
    categories,
    suppliers,
    branches,
    transactions,
    purchases,
    inventoryBalance,
    settings,
    currentUser,
    selectedBranchId: storeSelectedBranchId,
  } = useStore();

  // Filters
  const [branchFilter, setBranchFilter] = useState<string>(storeSelectedBranchId || "all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [itemFilter, setItemFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Date Filter State
  const [datePreset, setDatePreset] = useState<DatePreset>("current_month");
  const initialDates = getDateRangeFromPreset("current_month");
  const [startDate, setStartDate] = useState<string>(initialDates.start);
  const [endDate, setEndDate] = useState<string>(initialDates.end);

  // View Modes (3 Tabs)
  const [activeTab, setActiveTab] = useState<"summary" | "pivot" | "timeline">("summary");

  // Pivot row expansions
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  // Drawer 1: Remaining Lots Drawer State
  const [selectedLotItem, setSelectedLotItem] = useState<ItemSummaryContext | null>(null);
  const [itemLots, setItemLots] = useState<InventoryLotDetail[]>([]);
  const [loadingLots, setLoadingLots] = useState<boolean>(false);

  // Drawer 2: Lot Detail & Movement History Drawer State
  const [selectedLot, setSelectedLot] = useState<InventoryLotDetail | null>(null);
  const [lotMovements, setLotMovements] = useState<LotMovementRecord[]>([]);
  const [loadingLotMovements, setLoadingLotMovements] = useState<boolean>(false);

  // Pagination for Pivot & Timeline
  const [pivotPage, setPivotPage] = useState<number>(1);
  const [timelinePage, setTimelinePage] = useState<number>(1);
  const pageSize = 20;

  // Timeline Order: Oldest -> Newest (Default per specs)
  const [timelineSortOrder, setTimelineSortOrder] = useState<"asc" | "desc">("asc");

  // Sync preset change with dates
  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== "custom") {
      const { start, end } = getDateRangeFromPreset(preset);
      setStartDate(start);
      setEndDate(end);
    }
  };

  const startTs = useMemo(() => new Date(startDate + "T00:00:00").getTime(), [startDate]);
  const endTs = useMemo(() => new Date(endDate + "T23:59:59").getTime(), [endDate]);

  // Master lookups
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const supplierMap = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  // Filter items based on selections
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (!item.active) return false;
      if (categoryFilter !== "all" && item.categoryId !== categoryFilter) return false;
      if (supplierFilter !== "all" && item.supplierId !== supplierFilter) return false;
      if (itemFilter !== "all" && item.id !== itemFilter) return false;

      if (!q) return true;
      const catName = categoryMap.get(item.categoryId) || "";
      const supName = supplierMap.get(item.supplierId || "") || "";
      return (
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        catName.toLowerCase().includes(q) ||
        supName.toLowerCase().includes(q)
      );
    });
  }, [items, categoryFilter, supplierFilter, itemFilter, searchQuery, categoryMap, supplierMap]);

  // Calculate Movement Summary per Item
  const itemMovementData = useMemo<ItemMovementSummary[]>(() => {
    // Filter transactions by branch
    const branchTxns = filterByBranch(transactions, branchFilter);

    return filteredItems.map((item) => {
      let openingQty = 0;
      let receivedQty = 0;
      let consumedQty = 0;
      let adjustmentQty = 0;

      // Calculate per branch breakdown from inventory balance
      const branchBreakdown: Record<string, number> = {};
      inventoryBalance.forEach((ib) => {
        if (ib.itemId === item.id) {
          if (branchFilter === "all" || ib.branchId === branchFilter) {
            const bName = branchMap.get(ib.branchId) || "Other";
            branchBreakdown[bName] = (branchBreakdown[bName] || 0) + ib.quantity;
          }
        }
      });

      for (const t of branchTxns) {
        if (t.itemId !== item.id) continue;
        const ts = new Date(t.date).getTime();

        if (ts < startTs) {
          // Transaction occurred before date range -> contributes to opening balance
          openingQty += t.quantity;
        } else if (ts <= endTs) {
          // Transaction occurred within date range
          if (t.type === "purchase" || t.type === "beginning") {
            receivedQty += Math.abs(t.quantity);
          } else if (t.type === "usage") {
            // usage is negative in system, convert to negative or absolute for reporting
            consumedQty += t.quantity < 0 ? t.quantity : -t.quantity;
          } else if (t.type === "adjustment") {
            adjustmentQty += t.quantity;
          }
        }
      }

      const closingQty = openingQty + receivedQty + consumedQty + adjustmentQty;
      const unitCost = item.purchasePrice || 0;
      const closingValue = closingQty * unitCost;

      return {
        item,
        supplierName: supplierMap.get(item.supplierId || "") || "Unassigned",
        categoryName: categoryMap.get(item.categoryId) || "General",
        openingQty,
        receivedQty,
        consumedQty,
        adjustmentQty,
        closingQty,
        unitCost,
        closingValue,
        branchBreakdown,
      };
    });
  }, [
    filteredItems,
    transactions,
    branchFilter,
    startTs,
    endTs,
    inventoryBalance,
    branchMap,
    supplierMap,
    categoryMap,
  ]);

  // Aggregate Category Summaries for Summary Tab
  const categorySummaryData = useMemo(() => {
    const map = new Map<
      string,
      {
        categoryName: string;
        itemCount: number;
        openingQty: number;
        receivedQty: number;
        consumedQty: number;
        adjustmentQty: number;
        closingQty: number;
        totalValue: number;
      }
    >();

    itemMovementData.forEach((row) => {
      const cat = row.categoryName;
      const existing = map.get(cat) || {
        categoryName: cat,
        itemCount: 0,
        openingQty: 0,
        receivedQty: 0,
        consumedQty: 0,
        adjustmentQty: 0,
        closingQty: 0,
        totalValue: 0,
      };

      existing.itemCount += 1;
      existing.openingQty += row.openingQty;
      existing.receivedQty += row.receivedQty;
      existing.consumedQty += row.consumedQty;
      existing.adjustmentQty += row.adjustmentQty;
      existing.closingQty += row.closingQty;
      existing.totalValue += row.closingValue;

      map.set(cat, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [itemMovementData]);

  // High-Level KPI Totals
  const totalOpeningQty = useMemo(
    () => itemMovementData.reduce((acc, r) => acc + r.openingQty, 0),
    [itemMovementData],
  );
  const totalReceivedQty = useMemo(
    () => itemMovementData.reduce((acc, r) => acc + r.receivedQty, 0),
    [itemMovementData],
  );
  const totalConsumedQty = useMemo(
    () => itemMovementData.reduce((acc, r) => acc + r.consumedQty, 0),
    [itemMovementData],
  );
  const totalAdjustmentQty = useMemo(
    () => itemMovementData.reduce((acc, r) => acc + r.adjustmentQty, 0),
    [itemMovementData],
  );
  const totalClosingQty = useMemo(
    () => itemMovementData.reduce((acc, r) => acc + r.closingQty, 0),
    [itemMovementData],
  );
  const totalClosingValue = useMemo(
    () => itemMovementData.reduce((acc, r) => acc + r.closingValue, 0),
    [itemMovementData],
  );

  // Timeline Stream Movements
  const timelineMovements = useMemo(() => {
    const branchTxns = filterByBranch(transactions, branchFilter);
    const itemIdsSet = new Set(filteredItems.map((i) => i.id));

    // Filter transactions within date range and matching item filters
    const filteredTxns = branchTxns.filter((t) => {
      if (!itemIdsSet.has(t.itemId)) return false;
      const ts = new Date(t.date).getTime();
      return ts >= startTs && ts <= endTs;
    });

    // Sort by date (asc: oldest -> newest, desc: newest -> oldest)
    const sorted = [...filteredTxns].sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return timelineSortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });

    // Compute running balance for each item as we process transactions
    const runningBalances: Record<string, number> = {};

    // First calculate opening balances for each item
    filteredItems.forEach((i) => {
      const itemTxns = branchTxns.filter(
        (t) => t.itemId === i.id && new Date(t.date).getTime() < startTs,
      );
      runningBalances[i.id] = itemTxns.reduce((sum, t) => sum + t.quantity, 0);
    });

    // Format transaction items with balance snapshot
    return sorted.map((t) => {
      const item = items.find((i) => i.id === t.itemId);
      const supplierName = supplierMap.get(t.supplierId || item?.supplierId || "") || "—";
      const branchName = branchMap.get(t.branchId || "") || "All Branches";

      // Update running balance if sorting asc
      if (timelineSortOrder === "asc") {
        runningBalances[t.itemId] = (runningBalances[t.itemId] || 0) + t.quantity;
      }

      return {
        id: t.id,
        date: t.date,
        type: t.type,
        quantity: t.quantity,
        runningBalance: runningBalances[t.itemId] || 0,
        itemCode: item?.code || "N/A",
        itemName: item?.name || "Unknown Item",
        unit: item?.unit || "Unit",
        supplierName,
        branchName,
        remark: t.remark || "Regular inventory record",
        employee: t.employee || "System",
      };
    });
  }, [
    transactions,
    branchFilter,
    filteredItems,
    startTs,
    endTs,
    timelineSortOrder,
    items,
    supplierMap,
    branchMap,
  ]);

  // Paginated data for Pivot and Timeline
  const paginatedPivotData = useMemo(() => {
    const startIdx = (pivotPage - 1) * pageSize;
    return itemMovementData.slice(startIdx, startIdx + pageSize);
  }, [itemMovementData, pivotPage, pageSize]);

  const totalPivotPages = Math.ceil(itemMovementData.length / pageSize) || 1;

  const paginatedTimelineData = useMemo(() => {
    const startIdx = (timelinePage - 1) * pageSize;
    return timelineMovements.slice(startIdx, startIdx + pageSize);
  }, [timelineMovements, timelinePage, pageSize]);

  const totalTimelinePages = Math.ceil(timelineMovements.length / pageSize) || 1;

  // Row expand toggle
  const toggleRowExpanded = (itemId: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  // Open Remaining Lots Drawer for an item
  const handleOpenRemainingLotsDrawer = async (row: ItemMovementSummary) => {
    setSelectedLotItem({
      itemId: row.item.id,
      code: row.item.code,
      name: row.item.name,
      unit: row.item.unit,
      categoryName: row.categoryName,
      closingQty: row.closingQty,
      unitCost: row.unitCost,
      supplierId: row.item.supplierId,
    });
    setLoadingLots(true);

    try {
      // Query supabase for inventory_lots for this item
      let query = supabase
        .from("inventory_lots")
        .select("*")
        .eq("item_id", row.item.id)
        .order("received_date", { ascending: false });

      if (branchFilter !== "all") {
        query = query.eq("branch_id", branchFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        setItemLots(
          data.map((r) => ({
            id: r.id,
            lotNumber: r.lot_number,
            branchId: r.branch_id,
            branchName: branchMap.get(r.branch_id) || "Main Branch",
            itemId: r.item_id,
            itemCode: row.item.code,
            itemName: row.item.name,
            supplierId: r.supplier_id,
            supplierName: supplierMap.get(r.supplier_id) || row.supplierName,
            receivedDate: r.received_date,
            expiryDate: r.expiry_date,
            unitCost: Number(r.unit_cost || row.unitCost),
            qtyReceived: Number(r.qty_received || 0),
            qtyRemaining: Number(r.qty_remaining || 0),
            status: r.status as InventoryLotDetail["status"],
          })),
        );
      } else {
        // Fallback: Generate structured lot records from receiving transactions
        const itemPurchases = purchases.filter((p) => {
          if (branchFilter !== "all" && p.branchId !== branchFilter) return false;
          return p.items.some((pi) => pi.itemId === row.item.id);
        });

        if (itemPurchases.length > 0) {
          const generatedLots: InventoryLotDetail[] = itemPurchases.map((p, idx) => {
            const pi = p.items.find((i) => i.itemId === row.item.id);
            const lotCode = `L${p.purchaseDate.replace(/-/g, "").slice(2)}-00${idx + 1}`;
            return {
              id: `${p.id}-${row.item.id}`,
              lotNumber: lotCode,
              branchId: p.branchId,
              branchName: branchMap.get(p.branchId) || "Main Branch",
              itemId: row.item.id,
              itemCode: row.item.code,
              itemName: row.item.name,
              supplierId: p.supplierId,
              supplierName: supplierMap.get(p.supplierId) || row.supplierName,
              invoiceNumber: p.invoiceNumber,
              receivedDate: p.purchaseDate,
              expiryDate: pi?.expiryDate || null,
              unitCost: pi?.unitPrice || row.unitCost,
              qtyReceived: pi?.quantity || 0,
              qtyRemaining: Math.max(0, Math.min(row.closingQty, pi?.quantity || 0)),
              status: "active",
            };
          });
          setItemLots(generatedLots);
        } else {
          // Synthetic single lot representation for closing balance
          setItemLots([
            {
              id: `synthetic-${row.item.id}`,
              lotNumber: `L${new Date().getFullYear().toString().slice(2)}001`,
              branchId: branchFilter !== "all" ? branchFilter : null,
              branchName:
                branchFilter !== "all" ? branchMap.get(branchFilter) : "Current Stock Lot",
              itemId: row.item.id,
              itemCode: row.item.code,
              itemName: row.item.name,
              supplierId: row.item.supplierId,
              supplierName: row.supplierName,
              receivedDate: startDate,
              expiryDate: null,
              unitCost: row.unitCost,
              qtyReceived: Math.max(row.closingQty, row.receivedQty),
              qtyRemaining: row.closingQty,
              status: "active",
            },
          ]);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch lot details:", err);
      toast.error("Could not load remaining lots for this item.");
    } finally {
      setLoadingLots(false);
    }
  };

  // Open Lot Details & Movement History Drawer (Drawer 2)
  const handleOpenLotHistoryDetail = async (lot: InventoryLotDetail) => {
    setSelectedLot(lot);
    setLoadingLotMovements(true);

    try {
      // Find all transactions affecting this item & branch
      const itemTxns = transactions.filter((t) => {
        if (t.itemId !== lot.itemId) return false;
        if (lot.branchId && t.branchId && t.branchId !== lot.branchId) return false;
        return true;
      });

      // Sort by date ascending
      const sorted = [...itemTxns].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

      let runningQty = 0;
      const historyRecords: LotMovementRecord[] = sorted.map((t) => {
        runningQty += t.quantity;
        let refLabel = "Inventory Transaction";
        if (t.type === "purchase" || t.type === "receiving") {
          refLabel = lot.invoiceNumber ? `Invoice ${lot.invoiceNumber}` : "Receiving Voucher";
        } else if (t.type === "usage") {
          refLabel = "Kitchen / Production Usage";
        } else if (t.type === "adjustment") {
          refLabel = "Stock Count Revision";
        } else if (t.type === "beginning") {
          refLabel = "Beginning Stock Entry";
        }

        return {
          id: t.id,
          date: t.date,
          type:
            t.type === "purchase"
              ? "Receiving"
              : t.type === "usage"
                ? "Usage"
                : t.type === "adjustment"
                  ? "Stock Count Adjustment"
                  : "Beginning Stock",
          qtyChange: t.quantity,
          runningQty,
          reference: refLabel,
          location: branchMap.get(t.branchId || "") || "Main Kitchen",
          performedBy: t.employee || "System Admin",
        };
      });

      setLotMovements(historyRecords);
    } catch (e) {
      console.warn("Error fetching lot movements:", e);
    } finally {
      setLoadingLotMovements(false);
    }
  };

  // Export handlers
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary / Pivot
      const pivotSheetData = itemMovementData.map((row) => ({
        Code: row.item.code,
        Item: row.item.name,
        Category: row.categoryName,
        Supplier: row.supplierName,
        Unit: row.item.unit,
        "Opening Balance": row.openingQty,
        Received: row.receivedQty,
        Consumed: row.consumedQty,
        Adjustments: row.adjustmentQty,
        "Closing Balance": row.closingQty,
        "Unit Cost (฿)": row.unitCost,
        "Closing Value (฿)": row.closingValue,
      }));

      const pivotWS = XLSX.utils.json_to_sheet(pivotSheetData);
      XLSX.utils.book_append_sheet(wb, pivotWS, "Inventory Movement Pivot");

      // Sheet 2: Category Summary
      const catSheetData = categorySummaryData.map((cat) => ({
        Category: cat.categoryName,
        "Items Count": cat.itemCount,
        Opening: cat.openingQty,
        Received: cat.receivedQty,
        Consumed: cat.consumedQty,
        Adjustments: cat.adjustmentQty,
        Closing: cat.closingQty,
        "Total Value (฿)": cat.totalValue,
      }));
      const catWS = XLSX.utils.json_to_sheet(catSheetData);
      XLSX.utils.book_append_sheet(wb, catWS, "Category Summary");

      // Sheet 3: Timeline Stream
      const timelineSheetData = timelineMovements.map((tm) => ({
        Date: formatDateDisplay(tm.date),
        Type: tm.type.toUpperCase(),
        Code: tm.itemCode,
        Item: tm.itemName,
        "Quantity Change": tm.quantity,
        "Running Balance": tm.runningBalance,
        Supplier: tm.supplierName,
        Branch: tm.branchName,
        Reference: tm.remark,
        Employee: tm.employee,
      }));
      const timelineWS = XLSX.utils.json_to_sheet(timelineSheetData);
      XLSX.utils.book_append_sheet(wb, timelineWS, "Timeline Log");

      XLSX.writeFile(wb, `Inventory_Movement_${startDate}_to_${endDate}.xlsx`);
      toast.success("Inventory Movement exported to Excel successfully.");
    } catch (err) {
      console.error("Export Excel error:", err);
      toast.error("Failed to export Excel file.");
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = [
        "Code",
        "Item Name",
        "Category",
        "Unit",
        "Opening",
        "Received",
        "Consumed",
        "Adjustments",
        "Closing",
        "Unit Cost",
        "Closing Value",
      ];
      const rows = itemMovementData.map((r) => [
        `"${r.item.code}"`,
        `"${r.item.name}"`,
        `"${r.categoryName}"`,
        `"${r.item.unit}"`,
        r.openingQty,
        r.receivedQty,
        r.consumedQty,
        r.adjustmentQty,
        r.closingQty,
        r.unitCost,
        r.closingValue,
      ]);

      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Inventory_Movement_${startDate}_to_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV file downloaded successfully.");
    } catch (err) {
      console.error("Export CSV error:", err);
      toast.error("Failed to export CSV.");
    }
  };

  const handlePrint = () => {
    if (itemMovementData.length === 0) {
      toast.error("ไม่มีข้อมูลความเคลื่อนไหวสต็อกสำหรับพิมพ์");
      return;
    }

    const branchName =
      branchFilter === "all"
        ? "ทุกสาขา"
        : branches.find((b) => b.id === branchFilter)?.name || branchFilter;

    const supplierLabel =
      supplierFilter === "all"
        ? undefined
        : suppliers.find((s) => s.id === supplierFilter)?.name || supplierFilter;

    const categoryLabel =
      categoryFilter === "all"
        ? undefined
        : categories.find((c) => c.id === categoryFilter)?.name || categoryFilter;

    const periodLabel = `${formatDateDisplay(startDate)} ถึง ${formatDateDisplay(endDate)}`;

    printReportDocument({
      activeTab: "movement",
      restaurantName: settings.companyName || "Sushi Hana Thailand",
      branchLabel: branchName,
      periodLabel,
      supplierLabel,
      categoryLabel,
      currentUser,
      canViewFinancial: true,
      movementRows: itemMovementData.map((row) => ({
        itemCode: row.item.code,
        itemName: row.item.name,
        categoryName: row.categoryName,
        supplierName: row.supplierName,
        unit: row.item.unit,
        openingQty: row.openingQty,
        inQty: row.receivedQty,
        outQty: Math.abs(row.consumedQty),
        adjustQty: row.adjustmentQty,
        closingQty: row.closingQty,
        closingValue: row.closingValue,
      })),
    });
  };

  return (
    <div className="space-y-6 pb-12 bg-slate-50/40 dark:bg-background min-h-screen">
      {/* Printable Header */}
      <div className="hidden print:block rounded-xl border border-slate-300 bg-white p-4 shadow-none mb-4">
        <div className="flex items-center justify-between border-b border-slate-300 pb-3 mb-3">
          <div>
            <h1 className="text-base font-bold text-slate-900">
              {settings.companyName || "Sushi Hana Thailand"}
            </h1>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">
              รายงานเคลื่อนไหวสินค้า (Inventory Movement & Traceability Report)
            </p>
          </div>
          <div className="text-right text-[10px] text-slate-500">
            <div>วันที่พิมพ์: {new Date().toLocaleString("th-TH")}</div>
            <div>
              สาขา:{" "}
              {branchFilter === "all"
                ? "ทุกสาขา"
                : branches.find((b) => b.id === branchFilter)?.name || branchFilter}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs text-slate-700">
          <div>
            <span className="font-semibold text-slate-500">ช่วงวันที่:</span>{" "}
            {formatDateDisplay(startDate)} - {formatDateDisplay(endDate)}
          </div>
          <div>
            <span className="font-semibold text-slate-500">ซัพพลายเออร์:</span>{" "}
            {supplierFilter === "all"
              ? "ทุกซัพพลายเออร์"
              : suppliers.find((s) => s.id === supplierFilter)?.name || supplierFilter}
          </div>
          <div>
            <span className="font-semibold text-slate-500">หมวดหมู่:</span>{" "}
            {categoryFilter === "all"
              ? "ทุกหมวดหมู่"
              : categories.find((c) => c.id === categoryFilter)?.name || categoryFilter}
          </div>
        </div>
      </div>

      {/* Header */}
      {!hideTitleHeader && (
        <div className="print:hidden">
          <PageHeader
            title="Inventory Movement / รายงานเคลื่อนไหวสินค้า"
            description="Audit and analyze historical inventory balances, receiving, usage, adjustments, and lot traceability."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  className="gap-1.5 text-xs h-9 bg-card"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Export Excel</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  className="gap-1.5 text-xs h-9 bg-card"
                >
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span>Export CSV</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="gap-1.5 text-xs h-9 bg-card"
                >
                  <Printer className="h-4 w-4 text-slate-600" />
                  <span>พิมพ์รายงาน</span>
                </Button>
              </div>
            }
          />
        </div>
      )}

      {/* Filter Section - 2 Clean Rows */}
      <Card className="border-border/60 bg-card shadow-xs rounded-xl print:hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Filters / ตัวกรองข้อมูล
            </div>
            {hideTitleHeader && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="h-8 gap-1.5 text-xs rounded-lg"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-600" />
                  <span>พิมพ์</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  className="h-8 gap-1.5 text-xs rounded-lg"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Excel</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  className="h-8 gap-1.5 text-xs rounded-lg hidden sm:flex"
                >
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                  <span>CSV</span>
                </Button>
              </div>
            )}
          </div>

          {/* Row 1: Primary Entity Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Branch Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Branch / สาขา</label>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches (ทุกสาขา)</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Supplier Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                ซัพพลายเออร์ (Supplier)
              </label>
              <SearchableSupplierSelector
                value={supplierFilter}
                onChange={setSupplierFilter}
                suppliers={suppliers}
                allowAll
                allValue="all"
                allLabel="ทุกซัพพลายเออร์ (All Suppliers)"
                size="sm"
                className="h-9 text-xs bg-background"
                placeholder="เลือกซัพพลายเออร์..."
              />
            </div>

            {/* Category Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Category / หมวดหมู่
              </label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories (ทุกหมวดหมู่)</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Specific Item Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Item / วัตถุดิบ</label>
              <Select value={itemFilter} onValueChange={setItemFilter}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="All Items" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items (ทุกรายการวัตถุดิบ)</SelectItem>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      [{i.code}] {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Inputs (Custom) or Range Display */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Date Range / ช่วงวันที่
              </label>
              {datePreset === "custom" ? (
                <div className="flex items-center gap-1.5 min-w-[260px]">
                  <ThaiDatePicker
                    className="h-9 text-xs bg-background flex-1"
                    value={startDate}
                    onChange={setStartDate}
                  />
                  <span className="text-muted-foreground text-xs">-</span>
                  <ThaiDatePicker
                    className="h-9 text-xs bg-background flex-1"
                    value={endDate}
                    onChange={setEndDate}
                  />
                </div>
              ) : (
                <div className="h-9 px-3 py-2 border rounded-md text-xs bg-muted/20 text-muted-foreground font-mono flex items-center justify-between">
                  <span>{formatDateDisplay(startDate)}</span>
                  <span>→</span>
                  <span>{formatDateDisplay(endDate)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Date Presets & Search */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 pt-2 border-t border-border/30 items-center">
            {/* Quick Date Presets */}
            <div className="md:col-span-7 space-y-1">
              <span className="text-xs font-medium text-muted-foreground block mb-1">
                Quick Date Presets / ตัวเลือกช่วงเวลา
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: "current_month", label: "Current Month" },
                    { id: "today", label: "Today" },
                    { id: "7days", label: "7 Days" },
                    { id: "30days", label: "30 Days" },
                    { id: "90days", label: "90 Days" },
                    { id: "custom", label: "Custom Range" },
                  ] as const
                ).map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    variant={datePreset === p.id ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs font-medium px-3"
                    onClick={() => handlePresetChange(p.id)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="md:col-span-5 space-y-1">
              <span className="text-xs font-medium text-muted-foreground block mb-1">
                Search / ค้นหา
              </span>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search code, item name, lot number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards - Exactly 5 Cards, Pure Typography, Semantic Colors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* 1. Opening Balance (ยอดต้นงวด) - White Card */}
        <Card className="p-5 bg-card border border-border/60 shadow-xs rounded-xl space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            ยอดต้นงวด / Opening Balance
          </div>
          <div className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground font-mono">
            {totalOpeningQty.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">As of {formatDateDisplay(startDate)}</div>
        </Card>

        {/* 2. Received (รับเข้า) - Green Card */}
        <Card className="p-5 bg-green-50/70 dark:bg-green-950/20 border border-green-200/80 dark:border-green-900/40 shadow-xs rounded-xl space-y-2">
          <div className="text-sm font-medium text-green-800 dark:text-green-300">
            รับเข้า / Received
          </div>
          <div className="text-3xl lg:text-4xl font-bold tracking-tight text-green-700 dark:text-green-400 font-mono">
            +{totalReceivedQty.toLocaleString()}
          </div>
          <div className="text-xs text-green-700/80 dark:text-green-400/80">Total Inflow</div>
        </Card>

        {/* 3. Used (ใช้ไป) - Red Card */}
        <Card className="p-5 bg-red-50/70 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900/40 shadow-xs rounded-xl space-y-2">
          <div className="text-sm font-medium text-red-800 dark:text-red-300">ใช้ไป / Used</div>
          <div className="text-3xl lg:text-4xl font-bold tracking-tight text-red-700 dark:text-red-400 font-mono">
            {totalConsumedQty.toLocaleString()}
          </div>
          <div className="text-xs text-red-700/80 dark:text-red-400/80">Kitchen & Production</div>
        </Card>

        {/* 4. Adjustment (ปรับปรุง) - Amber Card */}
        <Card className="p-5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 shadow-xs rounded-xl space-y-2">
          <div className="text-sm font-medium text-amber-800 dark:text-amber-300">
            ปรับปรุง / Adjustment
          </div>
          <div className="text-3xl lg:text-4xl font-bold tracking-tight text-amber-700 dark:text-amber-400 font-mono">
            {totalAdjustmentQty >= 0 ? `+${totalAdjustmentQty}` : totalAdjustmentQty}
          </div>
          <div className="text-xs text-amber-700/80 dark:text-amber-400/80">Revisions & Counts</div>
        </Card>

        {/* 5. Closing Balance (ยอดคงเหลือ) - White Card */}
        <Card className="p-5 bg-card border border-border/60 shadow-xs rounded-xl space-y-2 sm:col-span-2 lg:col-span-1">
          <div className="text-sm font-medium text-muted-foreground">
            ยอดคงเหลือ / Closing Balance
          </div>
          <div className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground font-mono">
            {totalClosingQty.toLocaleString()}
          </div>
          <div className="text-xs font-semibold text-foreground">
            {formatCurrency(totalClosingValue, settings.currency)}
          </div>
        </Card>
      </div>

      {/* Main Content View Modes Tabs - Bilingual, No Icons, Bottom Border Active Only */}
      <div className="space-y-4">
        <div className="flex border-b border-border/60 print:hidden">
          <button
            type="button"
            onClick={() => setActiveTab("summary")}
            className={`px-5 py-3 text-sm transition-colors border-b-2 -mb-px ${
              activeTab === "summary"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            Summary / สรุป
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("pivot")}
            className={`px-5 py-3 text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === "pivot"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <span>Pivot / Pivot</span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-normal">
              {itemMovementData.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`px-5 py-3 text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === "timeline"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <span>Timeline / Timeline</span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-normal">
              {timelineMovements.length}
            </span>
          </button>
        </div>

        {/* TAB 1: SUMMARY */}
        {activeTab === "summary" && (
          <Card className="border-border/60 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-lg font-semibold tracking-tight">
                Category Movement Summary / ภาพรวมเคลื่อนไหวตามหมวดหมู่
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-[220px] text-xs font-semibold">
                        Category / หมวดหมู่
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-center">
                        Items / รายการ
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right">
                        Opening / ต้นงวด
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right text-green-700 dark:text-green-400">
                        Received (+) / รับเข้า
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right text-red-700 dark:text-red-400">
                        Used (-) / ใช้ไป
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right text-amber-700 dark:text-amber-400">
                        Adjustment / ปรับปรุง
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right text-foreground">
                        Closing / ปลายงวด
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right">
                        Est. Total Value / มูลค่ารวม
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categorySummaryData.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center py-12 text-xs text-muted-foreground"
                        >
                          No category movement data found matching selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      categorySummaryData.map((cat) => (
                        <TableRow
                          key={cat.categoryName}
                          className="hover:bg-muted/40 text-xs transition-colors"
                        >
                          <TableCell className="font-medium text-foreground py-3">
                            {cat.categoryName}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground py-3">
                            {cat.itemCount}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground py-3">
                            {cat.openingQty.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-700 dark:text-green-400 font-medium py-3">
                            +{cat.receivedQty.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-700 dark:text-red-400 font-medium py-3">
                            {cat.consumedQty.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-amber-700 dark:text-amber-400 font-medium py-3">
                            {cat.adjustmentQty >= 0 ? `+${cat.adjustmentQty}` : cat.adjustmentQty}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-foreground py-3">
                            {cat.closingQty.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-foreground py-3">
                            {formatCurrency(cat.totalValue, settings.currency)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* TAB 2: PIVOT */}
        {activeTab === "pivot" && (
          <Card className="border-border/60 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">
                  Inventory Movement Pivot / รายการวัตถุดิบทั้งหมด
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click the{" "}
                  <span className="font-semibold text-foreground underline">Closing Balance</span>{" "}
                  number on any row to open the Remaining Lots drawer.
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                Showing {itemMovementData.length} items
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead className="text-xs font-semibold">Code / รหัส</TableHead>
                      <TableHead className="text-xs font-semibold">Item Name / รายการ</TableHead>
                      <TableHead className="text-xs font-semibold">Unit / หน่วย</TableHead>
                      <TableHead className="text-xs font-semibold text-right">
                        Opening / ต้นงวด
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right text-green-700 dark:text-green-400">
                        Received (+) / รับเข้า
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right text-red-700 dark:text-red-400">
                        Used (-) / ใช้ไป
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right text-amber-700 dark:text-amber-400">
                        Adjustment / ปรับปรุง
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right text-foreground">
                        Closing / ปลายงวด
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPivotData.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="text-center py-12 text-xs text-muted-foreground"
                        >
                          No items matching current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedPivotData.map((row) => {
                        const isExpanded = expandedRowIds.has(row.item.id);
                        return (
                          <Fragment key={row.item.id}>
                            <TableRow className="hover:bg-muted/40 text-xs transition-colors">
                              <TableCell className="p-2 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                  onClick={() => toggleRowExpanded(row.item.id)}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </TableCell>

                              {/* Item Code */}
                              <TableCell className="font-mono font-semibold text-foreground py-3">
                                {row.item.code}
                              </TableCell>

                              {/* Item Name & Details */}
                              <TableCell className="py-3">
                                <div className="font-medium text-foreground">{row.item.name}</div>
                                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                  <span>{row.categoryName}</span>
                                  <span>•</span>
                                  <span>{row.supplierName}</span>
                                </div>
                              </TableCell>

                              {/* Unit */}
                              <TableCell className="text-muted-foreground py-3">
                                {row.item.unit}
                              </TableCell>

                              {/* Opening */}
                              <TableCell className="text-right font-mono text-muted-foreground py-3">
                                {row.openingQty.toLocaleString()}
                              </TableCell>

                              {/* Received */}
                              <TableCell className="text-right font-mono font-medium text-green-700 dark:text-green-400 py-3">
                                {row.receivedQty > 0 ? `+${row.receivedQty.toLocaleString()}` : "0"}
                              </TableCell>

                              {/* Consumed / Used */}
                              <TableCell className="text-right font-mono font-medium text-red-700 dark:text-red-400 py-3">
                                {row.consumedQty !== 0 ? row.consumedQty.toLocaleString() : "0"}
                              </TableCell>

                              {/* Adjustment */}
                              <TableCell className="text-right font-mono font-medium text-amber-700 dark:text-amber-400 py-3">
                                {row.adjustmentQty > 0
                                  ? `+${row.adjustmentQty}`
                                  : row.adjustmentQty}
                              </TableCell>

                              {/* Closing Balance — CLICKABLE TO OPEN REMAINING LOTS DRAWER */}
                              <TableCell className="text-right py-3">
                                <button
                                  type="button"
                                  onClick={() => handleOpenRemainingLotsDrawer(row)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold font-mono bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-foreground transition-all cursor-pointer border border-border/50"
                                  title="Click to view Remaining Lots & Expiry details"
                                >
                                  <span>{row.closingQty.toLocaleString()}</span>
                                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                </button>
                              </TableCell>
                            </TableRow>

                            {/* Expandable row content */}
                            {isExpanded && (
                              <TableRow key={`exp-${row.item.id}`} className="bg-muted/10">
                                <TableCell colSpan={9} className="p-4">
                                  <div className="space-y-3 text-xs">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                                      <div className="font-semibold text-foreground flex items-center gap-2">
                                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>Branch Stock & Lots Details for {row.item.name}</span>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs gap-1"
                                        onClick={() => handleOpenRemainingLotsDrawer(row)}
                                      >
                                        <Package className="h-3.5 w-3.5" />
                                        <span>Open Remaining Lots Drawer</span>
                                      </Button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      {/* Branch Breakdown */}
                                      <div className="p-3 bg-card rounded-lg border border-border/50 space-y-1.5">
                                        <div className="text-[11px] font-semibold text-muted-foreground uppercase">
                                          Stock by Branch / สต็อกแยกสาขา
                                        </div>
                                        {Object.keys(row.branchBreakdown).length === 0 ? (
                                          <div className="text-[11px] text-muted-foreground">
                                            No branch stock mapped.
                                          </div>
                                        ) : (
                                          Object.entries(row.branchBreakdown).map(
                                            ([bName, qty]) => (
                                              <div
                                                key={bName}
                                                className="flex justify-between items-center text-xs"
                                              >
                                                <span className="text-muted-foreground">
                                                  {bName}
                                                </span>
                                                <span className="font-mono font-medium text-foreground">
                                                  {qty} {row.item.unit}
                                                </span>
                                              </div>
                                            ),
                                          )
                                        )}
                                      </div>

                                      {/* Costing & Valuation */}
                                      <div className="p-3 bg-card rounded-lg border border-border/50 space-y-1.5">
                                        <div className="text-[11px] font-semibold text-muted-foreground uppercase">
                                          Valuation / มูลค่าสต็อก
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                          <span className="text-muted-foreground">
                                            Purchase Price:
                                          </span>
                                          <span className="font-mono">
                                            {formatCurrency(row.unitCost, settings.currency)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs pt-1 border-t border-border/30">
                                          <span className="font-medium text-foreground">
                                            Closing Stock Value:
                                          </span>
                                          <span className="font-mono font-bold text-foreground">
                                            {formatCurrency(row.closingValue, settings.currency)}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Quick Lot Trace Summary */}
                                      <div className="p-3 bg-card rounded-lg border border-border/50 space-y-1.5">
                                        <div className="text-[11px] font-semibold text-muted-foreground uppercase">
                                          Lot Traceability
                                        </div>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                          Track active lot numbers, FEFO expiration priority,
                                          receiving invoices, and historical usage for this item.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pivot Pagination Controls */}
              {totalPivotPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t border-border/60 text-xs">
                  <div className="text-muted-foreground">
                    Page {pivotPage} of {totalPivotPages} ({itemMovementData.length} total items)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pivotPage <= 1}
                      onClick={() => setPivotPage((p) => p - 1)}
                      className="h-7 text-xs"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pivotPage >= totalPivotPages}
                      onClick={() => setPivotPage((p) => p + 1)}
                      className="h-7 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 3: TIMELINE */}
        {activeTab === "timeline" && (
          <Card className="border-border/60 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">
                  Movement Timeline / ลำดับเวลาเคลื่อนไหว
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sequential audit trail of receiving, kitchen usage, and stock count revisions.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTimelineSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
                  className="h-8 text-xs gap-1.5"
                >
                  <History className="h-3.5 w-3.5" />
                  <span>
                    Sort: {timelineSortOrder === "asc" ? "Oldest → Newest" : "Newest → Oldest"}
                  </span>
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-xs font-semibold">
                        Date & Time / วันที่-เวลา
                      </TableHead>
                      <TableHead className="text-xs font-semibold">Type / ประเภท</TableHead>
                      <TableHead className="text-xs font-semibold">Item / วัตถุดิบ</TableHead>
                      <TableHead className="text-xs font-semibold text-right">
                        Change Qty / จำนวนเปลี่ยน
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right">
                        Running Balance / สต็อกสะสม
                      </TableHead>
                      <TableHead className="text-xs font-semibold">Reference / อ้างอิง</TableHead>
                      <TableHead className="text-xs font-semibold">
                        Branch & User / สาขาและผู้ทำรายการ
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTimelineData.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-12 text-xs text-muted-foreground"
                        >
                          No stock transactions found within selected date range and filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedTimelineData.map((tx) => {
                        const isPositive = tx.quantity > 0;
                        return (
                          <TableRow
                            key={tx.id}
                            className="hover:bg-muted/40 text-xs transition-colors"
                          >
                            {/* Date */}
                            <TableCell className="font-mono text-muted-foreground py-3">
                              {formatDateDisplay(tx.date)}
                            </TableCell>

                            {/* Type Badge */}
                            <TableCell className="py-3">
                              {tx.type === "purchase" || tx.type === "receiving" ? (
                                <Badge
                                  variant="outline"
                                  className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30"
                                >
                                  Received / รับเข้า
                                </Badge>
                              ) : tx.type === "usage" ? (
                                <Badge
                                  variant="outline"
                                  className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30"
                                >
                                  Used / ใช้ไป
                                </Badge>
                              ) : tx.type === "adjustment" ? (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30"
                                >
                                  Adjustment / ปรับปรุง
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                                >
                                  Beginning Stock / ยอดยกมา
                                </Badge>
                              )}
                            </TableCell>

                            {/* Item Code & Name */}
                            <TableCell className="py-3">
                              <div className="font-medium text-foreground">{tx.itemName}</div>
                              <div className="text-[11px] font-mono text-muted-foreground">
                                {tx.itemCode}
                              </div>
                            </TableCell>

                            {/* Quantity Change */}
                            <TableCell
                              className={`text-right font-mono font-bold py-3 ${tx.type === "usage" ? "text-red-700 dark:text-red-400" : isPositive ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}
                            >
                              {isPositive ? `+${tx.quantity}` : tx.quantity} {tx.unit}
                            </TableCell>

                            {/* Running Balance */}
                            <TableCell className="text-right font-mono font-semibold text-foreground py-3">
                              Balance {tx.runningBalance}
                            </TableCell>

                            {/* Ref */}
                            <TableCell className="text-muted-foreground py-3">
                              {tx.remark}
                            </TableCell>

                            {/* Branch & Employee */}
                            <TableCell className="text-muted-foreground py-3">
                              <div className="text-foreground font-medium">{tx.branchName}</div>
                              <div className="text-[10px] text-muted-foreground">{tx.employee}</div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Timeline Pagination Controls */}
              {totalTimelinePages > 1 && (
                <div className="flex items-center justify-between p-3 border-t border-border/60 text-xs">
                  <div className="text-muted-foreground">
                    Page {timelinePage} of {totalTimelinePages} ({timelineMovements.length} total
                    movements)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={timelinePage <= 1}
                      onClick={() => setTimelinePage((p) => p - 1)}
                      className="h-7 text-xs"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={timelinePage >= totalTimelinePages}
                      onClick={() => setTimelinePage((p) => p + 1)}
                      className="h-7 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* DRAWER 1: REMAINING LOTS DRAWER */}
      <Sheet open={!!selectedLotItem} onOpenChange={(open) => !open && setSelectedLotItem(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-6 space-y-6">
          <SheetHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-primary">
              <Package className="h-4 w-4" />
              <span>Remaining Lots Traceability</span>
            </div>
            <SheetTitle className="text-lg font-bold text-foreground">
              Remaining Lots for {selectedLotItem?.name}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Item Code:{" "}
              <span className="font-mono text-foreground font-medium">{selectedLotItem?.code}</span>{" "}
              | Category: {selectedLotItem?.categoryName}
            </SheetDescription>
          </SheetHeader>

          {/* Lot Summary Banner */}
          <div className="grid grid-cols-3 gap-3 p-3.5 bg-muted/30 rounded-lg border border-border/50 text-xs">
            <div>
              <div className="text-[11px] text-muted-foreground">Total Closing Balance</div>
              <div className="text-lg font-bold text-primary font-mono mt-0.5">
                {selectedLotItem?.closingQty.toLocaleString()} {selectedLotItem?.unit}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Estimated Unit Cost</div>
              <div className="text-lg font-bold text-foreground font-mono mt-0.5">
                {formatCurrency(selectedLotItem?.unitCost || 0, settings.currency)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Active Lots Count</div>
              <div className="text-lg font-bold text-foreground font-mono mt-0.5">
                {itemLots.length} Lot{itemLots.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>

          {/* Remaining Lots Table */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Active & Remaining Lot Records (สต็อกตาม Lot)</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Click any lot to view movement history
              </span>
            </div>

            {loadingLots ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                Loading lot records...
              </div>
            ) : itemLots.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground border rounded-md p-4">
                No active lots found for this item.
              </div>
            ) : (
              <div className="overflow-hidden border border-border/60 rounded-md">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs font-semibold">Lot Number</TableHead>

                      <TableHead className="text-xs font-semibold text-right">
                        Remaining Qty
                      </TableHead>
                      <TableHead className="text-xs font-semibold">Expiry Date</TableHead>
                      <TableHead className="text-xs font-semibold">Received Date</TableHead>
                      <TableHead className="text-xs font-semibold">Supplier</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Unit Cost</TableHead>
                      <TableHead className="text-xs font-semibold text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemLots.map((lot) => (
                      <TableRow
                        key={lot.id}
                        className="hover:bg-primary/5 cursor-pointer transition-colors text-xs"
                        onClick={() => handleOpenLotHistoryDetail(lot)}
                      >
                        {/* Lot Number */}
                        <TableCell className="font-mono font-bold text-primary">
                          {lot.lotNumber}
                        </TableCell>

                        {/* Remaining Qty */}
                        <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {lot.qtyRemaining}
                        </TableCell>

                        {/* Expiry Date */}
                        <TableCell className="font-mono">
                          {lot.expiryDate ? (
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              {formatDateDisplay(lot.expiryDate)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No Expiry</span>
                          )}
                        </TableCell>

                        {/* Received Date */}
                        <TableCell className="font-mono text-muted-foreground">
                          {formatDateDisplay(lot.receivedDate)}
                        </TableCell>

                        {/* Supplier */}
                        <TableCell className="text-muted-foreground">{lot.supplierName}</TableCell>

                        {/* Unit Cost */}
                        <TableCell className="text-right font-mono">
                          {formatCurrency(lot.unitCost, settings.currency)}
                        </TableCell>

                        {/* Action */}
                        <TableCell className="text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] gap-1 px-2 text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenLotHistoryDetail(lot);
                            }}
                          >
                            <span>History</span>
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* DRAWER 2: LOT DETAIL & MOVEMENT HISTORY DRAWER */}
      <Sheet open={!!selectedLot} onOpenChange={(open) => !open && setSelectedLot(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-6 space-y-6">
          <SheetHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1 -ml-2 text-muted-foreground"
                onClick={() => setSelectedLot(null)}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Lots</span>
              </Button>
            </div>
            <SheetTitle className="text-lg font-bold text-foreground">
              Lot Details: <span className="font-mono text-primary">{selectedLot?.lotNumber}</span>
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Detailed lot specification and complete audit trail of transactions affecting this
              lot.
            </SheetDescription>
          </SheetHeader>

          {/* Lot Overview Meta Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-muted/20 rounded-lg border border-border/50 text-xs">
            <div>
              <span className="text-[11px] text-muted-foreground block">Item Name & Code</span>
              <span className="font-semibold text-foreground block mt-0.5">
                {selectedLot?.itemName}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {selectedLot?.itemCode}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground block">Supplier</span>
              <span className="font-medium text-foreground block mt-0.5">
                {selectedLot?.supplierName || "N/A"}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground block">Invoice / Reference</span>
              <span className="font-mono font-medium text-foreground block mt-0.5">
                {selectedLot?.invoiceNumber || "RC00015"}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground block">Received Date</span>
              <span className="font-mono text-foreground block mt-0.5">
                {formatDateDisplay(selectedLot?.receivedDate)}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground block">Expiry Date</span>
              <span className="font-mono text-red-600 dark:text-red-400 font-semibold block mt-0.5">
                {selectedLot?.expiryDate ? formatDateDisplay(selectedLot.expiryDate) : "None"}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground block">Original Qty</span>
              <span className="font-mono font-semibold text-foreground block mt-0.5">
                {selectedLot?.qtyReceived}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground block">Remaining Qty</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                {selectedLot?.qtyRemaining}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground block">Unit Cost</span>
              <span className="font-mono text-foreground block mt-0.5">
                {formatCurrency(selectedLot?.unitCost || 0, settings.currency)}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground block">Branch</span>
              <span className="font-medium text-foreground block mt-0.5">
                {selectedLot?.branchName || "Main Branch"}
              </span>
            </div>
          </div>

          {/* Movement History Table */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-foreground flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <span>Lot Movement History (ประวัติการใช้งานและเคลื่อนไหว)</span>
            </div>

            {loadingLotMovements ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                Loading movement history...
              </div>
            ) : lotMovements.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground border rounded-md p-4">
                No movement history transactions logged for this lot.
              </div>
            ) : (
              <div className="overflow-hidden border border-border/60 rounded-md">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs font-semibold">Date</TableHead>
                      <TableHead className="text-xs font-semibold">Type</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Qty Change</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Balance</TableHead>
                      <TableHead className="text-xs font-semibold">Reference / Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lotMovements.map((m) => {
                      const isPositive = m.qtyChange > 0;
                      return (
                        <TableRow key={m.id} className="text-xs">
                          <TableCell className="font-mono text-muted-foreground">
                            {formatDateDisplay(m.date)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                m.type === "Receiving"
                                  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30"
                                  : m.type === "Usage"
                                    ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30"
                                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30"
                              }`}
                            >
                              {m.type === "Usage"
                                ? "Used / ใช้ไป"
                                : m.type === "Receiving"
                                  ? "Received / รับเข้า"
                                  : "Adjustment / ปรับปรุง"}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono font-bold ${
                              m.type === "Usage" || m.qtyChange < 0
                                ? "text-red-700 dark:text-red-400"
                                : m.type === "Receiving" || m.qtyChange > 0
                                  ? "text-green-700 dark:text-green-400"
                                  : "text-amber-700 dark:text-amber-400"
                            }`}
                          >
                            {isPositive ? `+${m.qtyChange}` : m.qtyChange}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {m.runningQty}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{m.reference}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

interface ItemSummaryContext {
  itemId: string;
  code: string;
  name: string;
  unit: string;
  categoryName: string;
  closingQty: number;
  unitCost: number;
  supplierId?: string;
}
