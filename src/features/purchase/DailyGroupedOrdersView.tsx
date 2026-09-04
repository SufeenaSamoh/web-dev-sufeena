import React, { useState, useMemo } from "react";
import type {
  PurchaseOrder,
  PurchaseBranch,
  PurchaseSupplier,
  PurchaseProduct,
  PurchaseOrderStatus,
} from "./types";
import {
  Calendar,
  Printer,
  Search,
  Truck,
  Building2,
  CheckSquare,
  Square,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign,
  Package,
  Edit3,
  XCircle,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { formatDate } from "@/lib/dateFormat";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { SearchableSupplierSelector } from "@/components/SearchableSupplierSelector";
import { DailyPrintModal, DailyPrintMode } from "./DailyPrintModal";
import { EditPoModal } from "./EditPoModal";
import { CancelPoModal } from "./CancelPoModal";
import { DeletePoModal } from "./DeletePoModal";
import { checkOrderModifiable, canApproveOrder, checkOrderDeletable } from "./orderRules";
import { ContactProcurementModal } from "./ContactProcurementModal";
import { saveOrderToDatabaseA } from "@/services/purchaseDbA";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { executeDailyOrdersPrint } from "./printDailyOrders";
import { DailyOrderPrintDom } from "./DailyOrderPrintDom";

interface DailyGroupedOrdersViewProps {
  orders: PurchaseOrder[];
  branches: PurchaseBranch[];
  suppliers: PurchaseSupplier[];
  products: PurchaseProduct[];
}

const getLocalDateString = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getOrderStatusBadge = (status: PurchaseOrderStatus) => {
  switch (status) {
    case "pending":
      return {
        label: "รอดำเนินการ",
        className:
          "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800",
      };
    case "approved":
      return {
        label: "กำลังจัดซื้อ",
        className:
          "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800",
      };
    case "in_transit":
      return {
        label: "สั่งซื้อแล้ว",
        className:
          "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800",
      };
    case "received":
      return {
        label: "ได้รับสินค้าแล้ว",
        className:
          "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
      };
    case "cancelled":
      return {
        label: "ยกเลิก",
        className:
          "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800",
      };
    default:
      return {
        label: "รอดำเนินการ",
        className:
          "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300",
      };
  }
};

const getOrderTime = (order: PurchaseOrder): string => {
  if (order.orderTime) return order.orderTime;
  if (order.updatedAt) {
    if (order.updatedAt.includes("T")) {
      return order.updatedAt.split("T")[1].slice(0, 5);
    }
    const timeMatch = order.updatedAt.match(/\d{2}:\d{2}/);
    if (timeMatch) return timeMatch[0];
  }
  return "08:00";
};

export const DailyGroupedOrdersView: React.FC<DailyGroupedOrdersViewProps> = ({
  orders,
  branches,
  suppliers,
  products: _products,
}) => {
  // Today, Yesterday reference strings (Local Timezone YYYY-MM-DD)
  const todayStr = useMemo(() => getLocalDateString(0), []);
  const yesterdayStr = useMemo(() => getLocalDateString(-1), []);

  // Date State (Defaults to Today's date YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Active state indicators for quick date buttons
  const isYesterdayActive = selectedDate === yesterdayStr;
  const isTodayActive = selectedDate === todayStr;

  // View Mode:
  // 'supplier' = Primary: Date ➔ Supplier ➔ Branch ➔ PO
  // 'branch' = Secondary: Date ➔ Branch ➔ Supplier ➔ PO
  // 'item' = Consolidated Master Item Summary
  const [viewMode, setViewMode] = useState<"supplier" | "branch" | "item">("supplier");

  // Search & Filter within the day
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");

  // Selection State for POs
  const [selectedPoIds, setSelectedPoIds] = useState<string[]>([]);
  const [directPrintTargetOrders, setDirectPrintTargetOrders] = useState<PurchaseOrder[] | null>(
    null,
  );
  const { currentUser } = useStore();

  // Print Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printInitialMode, setPrintInitialMode] = useState<DailyPrintMode>("all");
  const [printTargetSupplierId, setPrintTargetSupplierId] = useState<string | undefined>(undefined);
  const [printTargetBranchId, setPrintTargetBranchId] = useState<string | undefined>(undefined);
  const [printTargetPoIds, setPrintTargetPoIds] = useState<string[]>([]);

  // Edit & Cancel Modals State
  const [selectedPoForEdit, setSelectedPoForEdit] = useState<PurchaseOrder | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedPoForCancel, setSelectedPoForCancel] = useState<PurchaseOrder | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [selectedPoForDelete, setSelectedPoForDelete] = useState<PurchaseOrder | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [contactProcurementPo, setContactProcurementPo] = useState<PurchaseOrder | null>(null);
  const [contactProcurementAction, setContactProcurementAction] = useState<
    "edit" | "cancel" | "delete"
  >("edit");

  const handleOpenEdit = (po: PurchaseOrder) => {
    const validation = checkOrderModifiable(po, currentUser);
    if (!validation.allowed) {
      if (validation.needsContactProcurement || validation.isPastDate || !validation.isSameDay) {
        setContactProcurementPo(po);
        setContactProcurementAction("edit");
        toast.warning(
          "เลยวันที่สั่งซื้อแล้ว กรุณาติดต่อฝ่ายจัดซื้อเพื่อแก้ไข เพื่อยกเลิก ปรับปรุงรายการ",
        );
        return;
      }
      toast.error(validation.reason || "ไม่สามารถแก้ไขรายการได้");
      return;
    }
    setSelectedPoForEdit(po);
    setIsEditModalOpen(true);
  };

  const handleOpenCancel = (po: PurchaseOrder) => {
    const validation = checkOrderModifiable(po, currentUser);
    if (!validation.allowed) {
      if (validation.needsContactProcurement || validation.isPastDate || !validation.isSameDay) {
        setContactProcurementPo(po);
        setContactProcurementAction("cancel");
        toast.warning(
          "เลยวันที่สั่งซื้อแล้ว กรุณาติดต่อฝ่ายจัดซื้อเพื่อแก้ไข เพื่อยกเลิก ปรับปรุงรายการ",
        );
        return;
      }
      toast.error(validation.reason || "ไม่สามารถยกเลิกคำสั่งซื้อได้");
      return;
    }
    setSelectedPoForCancel(po);
    setIsCancelModalOpen(true);
  };

  const handleOpenDelete = (po: PurchaseOrder) => {
    const deletable = checkOrderDeletable(po, currentUser);
    if (!deletable.allowed) {
      if (deletable.needsContactProcurement || deletable.isPastDate || !deletable.isSameDay) {
        setContactProcurementPo(po);
        setContactProcurementAction("delete");
        toast.warning(
          "เลยวันที่สั่งซื้อแล้ว กรุณาติดต่อฝ่ายจัดซื้อเพื่อแก้ไข เพื่อยกเลิก ปรับปรุงรายการ",
        );
        return;
      }
      toast.error(deletable.reason || "คุณไม่มีสิทธิ์ในการลบคำสั่งซื้อ");
      return;
    }
    setSelectedPoForDelete(po);
    setIsDeleteModalOpen(true);
  };

  const handleApproveOrder = async (po: PurchaseOrder) => {
    if (!canApproveOrder(po, currentUser)) {
      toast.error("คุณไม่มีสิทธิ์ในการอนุมัติใบสั่งซื้อ");
      return;
    }
    try {
      const nowStr = new Date().toISOString().replace("T", " ").substring(0, 16);
      const userName = currentUser?.name || "ฝ่ายจัดซื้อ";
      const updated: PurchaseOrder = {
        ...po,
        status: "approved",
        approvedAt: nowStr,
        approvedBy: userName,
        updatedAt: nowStr,
        updatedBy: userName,
      };
      await saveOrderToDatabaseA(updated);
      toast.success(`อนุมัติใบสั่งซื้อ ${po.id} เรียบร้อยแล้ว (รายการจะถูกล็อกไม่ให้แก้ไข/ยกเลิก)`);
    } catch {
      toast.error("ไม่สามารถบันทึกการอนุมัติได้");
    }
  };

  // Quick Date Handlers
  const handleSetToday = () => {
    setSelectedDate(todayStr);
    setSelectedPoIds([]);
  };

  const handleSetYesterday = () => {
    setSelectedDate(yesterdayStr);
    setSelectedPoIds([]);
  };

  // 1. Orders matching selected date (Sorted by Date ➔ Time ➔ PO ID - Oldest First)
  const dayOrders = useMemo(() => {
    return orders
      .filter((o) => o.orderDate === selectedDate)
      .sort((a, b) => {
        if (a.orderDate !== b.orderDate) {
          return a.orderDate.localeCompare(b.orderDate);
        }
        const timeA = getOrderTime(a);
        const timeB = getOrderTime(b);
        if (timeA !== timeB) {
          return timeA.localeCompare(timeB);
        }
        return a.id.localeCompare(b.id);
      });
  }, [orders, selectedDate]);

  // Filtered day orders by search and drop-downs
  const filteredDayOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dayOrders.filter((o) => {
      if (supplierFilter !== "all" && o.supplierId !== supplierFilter) return false;
      if (branchFilter !== "all" && o.branchId !== branchFilter) return false;
      if (!q) return true;

      return (
        o.id.toLowerCase().includes(q) ||
        o.branchName.toLowerCase().includes(q) ||
        o.supplierName.toLowerCase().includes(q) ||
        o.items.some(
          (i) => i.productName.toLowerCase().includes(q) || i.productCode.toLowerCase().includes(q),
        )
      );
    });
  }, [dayOrders, searchQuery, supplierFilter, branchFilter]);

  // KPI Calculations for the day
  const totalDayOrdersCount = filteredDayOrders.length;
  const totalDayAmount = filteredDayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const uniqueBranchesCount = new Set(filteredDayOrders.map((o) => o.branchId)).size;
  const uniqueSuppliersCount = new Set(filteredDayOrders.map((o) => o.supplierId)).size;
  const totalDayItemsCount = filteredDayOrders.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
    0,
  );

  // Checkbox Selection Helpers
  const handleTogglePoSelect = (poId: string) => {
    setSelectedPoIds((prev) =>
      prev.includes(poId) ? prev.filter((id) => id !== poId) : [...prev, poId],
    );
  };

  const handleSelectAll = () => {
    setSelectedPoIds(filteredDayOrders.map((o) => o.id));
  };

  const handleDeselectAll = () => {
    setSelectedPoIds([]);
  };

  const isAllSelected =
    filteredDayOrders.length > 0 && filteredDayOrders.every((o) => selectedPoIds.includes(o.id));

  // =========================================================================
  // STRUCTURE 1: Primary Grouping: Supplier ➔ Branch ➔ PO (Spec Rule)
  // =========================================================================
  const groupedBySupplierData = useMemo(() => {
    const supMap = new Map<
      string,
      {
        supplierId: string;
        supplierName: string;
        supplierCode: string;
        supplierPhone: string;
        orders: PurchaseOrder[];
        branchesMap: Map<
          string,
          {
            branchId: string;
            branchName: string;
            branchCode: string;
            location: string;
            orders: PurchaseOrder[];
            branchTotal: number;
          }
        >;
        totalAmount: number;
        totalItemsCount: number;
      }
    >();

    filteredDayOrders.forEach((o) => {
      const sId = o.supplierId || "unknown";
      if (!supMap.has(sId)) {
        const foundSup = suppliers.find((s) => s.id === sId);
        supMap.set(sId, {
          supplierId: sId,
          supplierName: foundSup?.name || o.supplierName || "ซัพพลายเออร์ทั่วไป",
          supplierCode: foundSup?.code || "SUP",
          supplierPhone: foundSup?.phone || "-",
          orders: [],
          branchesMap: new Map(),
          totalAmount: 0,
          totalItemsCount: 0,
        });
      }

      const supEntry = supMap.get(sId)!;
      supEntry.orders.push(o);
      supEntry.totalAmount += o.totalAmount;
      supEntry.totalItemsCount += o.items.reduce((sum, it) => sum + it.quantity, 0);

      const bId = o.branchId || "unknown";
      if (!supEntry.branchesMap.has(bId)) {
        const foundBranch = branches.find((b) => b.id === bId);
        supEntry.branchesMap.set(bId, {
          branchId: bId,
          branchName: foundBranch?.name || o.branchName || "สาขา",
          branchCode: foundBranch?.code || "BR",
          location: foundBranch?.location || "-",
          orders: [],
          branchTotal: 0,
        });
      }

      const brEntry = supEntry.branchesMap.get(bId)!;
      brEntry.orders.push(o);
      brEntry.branchTotal += o.totalAmount;
    });

    return Array.from(supMap.values()).sort((a, b) => a.supplierName.localeCompare(b.supplierName));
  }, [filteredDayOrders, suppliers, branches]);

  // =========================================================================
  // STRUCTURE 2: Grouped by Branch ➔ Supplier ➔ PO
  // =========================================================================
  const groupedByBranchData = useMemo(() => {
    const branchMap = new Map<
      string,
      {
        branchId: string;
        branchName: string;
        branchCode: string;
        location: string;
        orders: PurchaseOrder[];
        suppliersMap: Map<string, { supplierName: string; orders: PurchaseOrder[] }>;
        totalAmount: number;
        totalItemsCount: number;
      }
    >();

    filteredDayOrders.forEach((o) => {
      const bId = o.branchId || "unknown";
      if (!branchMap.has(bId)) {
        const bObj = branches.find((b) => b.id === bId);
        branchMap.set(bId, {
          branchId: bId,
          branchName: bObj?.name || o.branchName || "สาขา",
          branchCode: bObj?.code || "BR",
          location: bObj?.location || "-",
          orders: [],
          suppliersMap: new Map(),
          totalAmount: 0,
          totalItemsCount: 0,
        });
      }

      const bEntry = branchMap.get(bId)!;
      bEntry.orders.push(o);
      bEntry.totalAmount += o.totalAmount;
      bEntry.totalItemsCount += o.items.reduce((s, i) => s + i.quantity, 0);

      const sId = o.supplierId || "unknown";
      if (!bEntry.suppliersMap.has(sId)) {
        bEntry.suppliersMap.set(sId, {
          supplierName: o.supplierName || "ซัพพลายเออร์",
          orders: [],
        });
      }
      bEntry.suppliersMap.get(sId)!.orders.push(o);
    });

    return Array.from(branchMap.values()).sort((a, b) => a.branchCode.localeCompare(b.branchCode));
  }, [filteredDayOrders, branches]);

  // =========================================================================
  // STRUCTURE 3: Grouped by Master Item (รวมตามสินค้า - สินค้าเดียวกันข้ามสาขา)
  // =========================================================================
  const groupedByItemData = useMemo(() => {
    const itemMap = new Map<
      string,
      {
        itemKey: string;
        productCode: string;
        productName: string;
        unit: string;
        supplierName: string;
        supplierId: string;
        unitPrice: number;
        totalQuantity: number;
        totalAmount: number;
        branchBreakdown: {
          branchId: string;
          branchName: string;
          branchCode: string;
          quantity: number;
          totalPrice: number;
          poId: string;
        }[];
      }
    >();

    filteredDayOrders.forEach((ord) => {
      const bObj = branches.find((b) => b.id === ord.branchId);
      const bCode = bObj?.code || "BR";
      const bName = bObj?.name || ord.branchName;

      ord.items.forEach((it) => {
        const pKey = it.productCode || it.productName;
        if (!itemMap.has(pKey)) {
          itemMap.set(pKey, {
            itemKey: pKey,
            productCode: it.productCode,
            productName: it.productName,
            unit: it.unit,
            supplierName: it.supplierName || ord.supplierName,
            supplierId: it.supplierId || ord.supplierId,
            unitPrice: it.unitPrice,
            totalQuantity: 0,
            totalAmount: 0,
            branchBreakdown: [],
          });
        }

        const iEntry = itemMap.get(pKey)!;
        iEntry.totalQuantity += it.quantity;
        iEntry.totalAmount += it.totalPrice;

        const existingBranch = iEntry.branchBreakdown.find((bb) => bb.branchId === ord.branchId);
        if (existingBranch) {
          existingBranch.quantity += it.quantity;
          existingBranch.totalPrice += it.totalPrice;
        } else {
          iEntry.branchBreakdown.push({
            branchId: ord.branchId,
            branchName: bName,
            branchCode: bCode,
            quantity: it.quantity,
            totalPrice: it.totalPrice,
            poId: ord.id,
          });
        }
      });
    });

    return Array.from(itemMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredDayOrders, branches]);

  // ==========================================
  // DIRECT BROWSER PRINT TRIGGERS (FAST & RELIABLE)
  // ==========================================

  const triggerDirectPrint = (
    ordersToPrint: PurchaseOrder[],
    mode: DailyPrintMode = "all",
    supplierId?: string,
    branchId?: string,
  ) => {
    if (!ordersToPrint || ordersToPrint.length === 0) {
      toast.error("ไม่มีรายการสั่งซื้อสำหรับสั่งพิมพ์");
      return;
    }
    setDirectPrintTargetOrders(ordersToPrint);
    setPrintInitialMode(mode);
    setPrintTargetSupplierId(supplierId);
    setPrintTargetBranchId(branchId);
    if (mode === "selected") {
      setPrintTargetPoIds(ordersToPrint.map((o) => o.id));
    }
    // Open modal so user always has visual preview and all fallback export options
    setIsPrintModalOpen(true);

    // Also trigger dedicated print window
    setTimeout(() => {
      executeDailyOrdersPrint({
        orders: ordersToPrint,
        branches,
        suppliers,
        selectedDate,
        currentUser,
      });
    }, 80);
  };

  // 1. Direct Native Print - Everything currently filtered for the day
  const handleDirectPrintAll = () => {
    if (filteredDayOrders.length === 0) {
      toast.error("ไม่มีรายการสั่งซื้อสำหรับวันที่เลือก");
      return;
    }
    triggerDirectPrint(filteredDayOrders, "all");
  };

  // 2. Direct Native Print - Selected POs only
  const handleDirectPrintSelected = () => {
    if (selectedPoIds.length === 0) {
      toast.error("กรุณาเลือกใบสั่งซื้อที่ต้องการพิมพ์อย่างน้อย 1 รายการ");
      return;
    }
    const selectedOrders = filteredDayOrders.filter((o) => selectedPoIds.includes(o.id));
    if (selectedOrders.length === 0) {
      toast.error("ไม่พบรายการสั่งซื้อที่เลือก");
      return;
    }
    triggerDirectPrint(selectedOrders, "selected");
  };

  // 3. Direct Native Print - By Supplier
  const handleDirectPrintSupplier = (supId: string) => {
    const supOrders = filteredDayOrders.filter((o) => o.supplierId === supId);
    if (supOrders.length === 0) {
      toast.error("ไม่มีรายการสั่งซื้อของซัพพลายเออร์นี้ในวันที่เลือก");
      return;
    }
    triggerDirectPrint(supOrders, "by_supplier", supId);
  };

  // 4. Direct Native Print - By Branch
  const handleDirectPrintBranch = (brId: string) => {
    const brOrders = filteredDayOrders.filter((o) => o.branchId === brId);
    if (brOrders.length === 0) {
      toast.error("ไม่มีรายการสั่งซื้อของสาขานี้ในวันที่เลือก");
      return;
    }
    triggerDirectPrint(brOrders, "by_branch", undefined, brId);
  };

  // 5. Direct Native Print - Single PO
  const handleDirectPrintSinglePo = (po: PurchaseOrder) => {
    triggerDirectPrint([po], "selected");
  };

  // Open Print Preview Modal for All
  const handleOpenPrintAll = () => {
    if (filteredDayOrders.length === 0) {
      toast.error("ไม่มีรายการสั่งซื้อสำหรับวันที่เลือก");
      return;
    }
    setPrintInitialMode("all");
    setPrintTargetSupplierId(undefined);
    setPrintTargetBranchId(undefined);
    setPrintTargetPoIds([]);
    setIsPrintModalOpen(true);
  };

  // Open Print Preview Modal for Selected POs
  const handleOpenPrintSelected = () => {
    if (selectedPoIds.length === 0) {
      toast.error("กรุณาเลือกใบสั่งซื้อที่ต้องการพิมพ์อย่างน้อย 1 รายการ");
      return;
    }
    setPrintInitialMode("selected");
    setPrintTargetPoIds(selectedPoIds);
    setPrintTargetSupplierId(undefined);
    setPrintTargetBranchId(undefined);
    setIsPrintModalOpen(true);
  };

  // Open Print Preview Modal by Supplier
  const handleOpenPrintBySupplier = (supId?: string) => {
    if (filteredDayOrders.length === 0) {
      toast.error("ไม่มีรายการสั่งซื้อสำหรับวันที่เลือก");
      return;
    }
    setPrintInitialMode("by_supplier");
    setPrintTargetSupplierId(supId || (supplierFilter !== "all" ? supplierFilter : undefined));
    setPrintTargetBranchId(undefined);
    setPrintTargetPoIds([]);
    setIsPrintModalOpen(true);
  };

  // Open Print Preview Modal by Branch
  const handleOpenPrintByBranch = (brId?: string) => {
    if (filteredDayOrders.length === 0) {
      toast.error("ไม่มีรายการสั่งซื้อสำหรับวันที่เลือก");
      return;
    }
    setPrintInitialMode("by_branch");
    setPrintTargetBranchId(brId || (branchFilter !== "all" ? branchFilter : undefined));
    setPrintTargetSupplierId(undefined);
    setPrintTargetPoIds([]);
    setIsPrintModalOpen(true);
  };

  return (
    <>
      <div className="space-y-6 print:hidden">
        {/* 1. Date Controls & Quick Selection Header */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  มุมมองกลุ่มคำสั่งซื้อรายวัน (Daily Grouped Orders)
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Procurement Hub
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                จัดกลุ่มตาม Supplier ➔ สาขา ➔ PO พร้อมสั่งพิมพ์แยก 1 PO ต่อหน้า ไม่รวมตาราง
              </p>
            </div>

            {/* Date Picker and Quick Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={handleSetYesterday}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isYesterdayActive
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  เมื่อวาน
                </button>
                <button
                  type="button"
                  onClick={handleSetToday}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isTodayActive
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  วันนี้
                </button>
              </div>

              <div className="w-40">
                <ThaiDatePicker
                  value={selectedDate}
                  onChange={(val) => {
                    setSelectedDate(val);
                    setSelectedPoIds([]);
                  }}
                  className="h-9 py-1 text-xs font-black bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* 2. KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
            {/* Card 1: Total Orders */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                จำนวนใบสั่งซื้อ (Total POs)
              </span>
              <div className="text-xl font-black text-slate-900 dark:text-slate-100">
                {totalDayOrdersCount}{" "}
                <span className="text-xs font-semibold text-slate-400">ใบ</span>
              </div>
            </div>

            {/* Card 2: Total Spent */}
            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-3.5 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/30 space-y-1">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                ยอดสั่งซื้อรวมทั้งสิ้น
              </span>
              <div className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                ฿{totalDayAmount.toLocaleString()}
              </div>
            </div>

            {/* Card 3: Branches Involved */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                สาขาที่สั่งซื้อ
              </span>
              <div className="text-xl font-black text-slate-900 dark:text-slate-100">
                {uniqueBranchesCount} / {branches.length}{" "}
                <span className="text-xs font-semibold text-slate-400">สาขา</span>
              </div>
            </div>

            {/* Card 4: Suppliers Involved */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                ซัพพลายเออร์ที่เกี่ยวข้อง
              </span>
              <div className="text-xl font-black text-slate-900 dark:text-slate-100">
                {uniqueSuppliersCount}{" "}
                <span className="text-xs font-semibold text-slate-400">ราย</span>
              </div>
            </div>

            {/* Card 5: Total Items */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                ปริมาณสินค้ารวม
              </span>
              <div className="text-xl font-black text-slate-900 dark:text-slate-100">
                {totalDayItemsCount.toLocaleString()}{" "}
                <span className="text-xs font-semibold text-slate-400">หน่วย</span>
              </div>
            </div>
          </div>

          {/* 3. Action Toolbar: View Mode Toggle & Print Group */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-black">
              <button
                type="button"
                onClick={() => setViewMode("supplier")}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  viewMode === "supplier"
                    ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                ตาม Supplier ➔ สาขา
              </button>
              <button
                type="button"
                onClick={() => setViewMode("branch")}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  viewMode === "branch"
                    ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                ตามสาขา ➔ Supplier
              </button>
              <button
                type="button"
                onClick={() => setViewMode("item")}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  viewMode === "item"
                    ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                รวมตามสินค้า (Master Item)
              </button>
            </div>

            {/* Consolidated Print Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Direct Instant Print Button */}
              <button
                type="button"
                onClick={
                  selectedPoIds.length > 0 ? handleDirectPrintSelected : handleDirectPrintAll
                }
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                title="สั่งพิมพ์คำสั่งซื้อประจำวันนี้ทันที (เปิดหน้าพิมพ์ของเบราว์เซอร์)"
              >
                <Printer className="w-4 h-4" />
                <span>
                  {selectedPoIds.length > 0
                    ? `พิมพ์ที่เลือก (${selectedPoIds.length} PO)`
                    : "พิมพ์"}
                </span>
              </button>

              {/* Print All Button */}
              <button
                type="button"
                onClick={handleDirectPrintAll}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 transition-all cursor-pointer active:scale-95"
                title="พิมพ์ใบสั่งซื้อทั้งหมดของวันที่เลือก"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-600" />
                <span>พิมพ์ทั้งหมด</span>
              </button>

              {/* Selective Print Button (Active if any PO selected) */}
              {selectedPoIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleDirectPrintSelected}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                  title="พิมพ์เฉพาะใบสั่งซื้อที่เลือก"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>พิมพ์ที่เลือก ({selectedPoIds.length} PO)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (supplierFilter !== "all") {
                    handleDirectPrintSupplier(supplierFilter);
                  } else {
                    handleOpenPrintBySupplier();
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 transition-all cursor-pointer"
                title="พิมพ์จัดกลุ่มตามซัพพลายเออร์"
              >
                <Truck className="w-3.5 h-3.5 text-slate-500" />
                <span>พิมพ์ตาม Supplier</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (branchFilter !== "all") {
                    handleDirectPrintBranch(branchFilter);
                  } else {
                    handleOpenPrintByBranch();
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 transition-all cursor-pointer"
                title="พิมพ์จัดกลุ่มตามสาขา"
              >
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>พิมพ์ตามสาขา</span>
              </button>

              {/* Preview Modal Trigger */}
              <button
                type="button"
                onClick={handleOpenPrintAll}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 transition-all cursor-pointer"
                title="เปิดหน้าต่างดูตัวอย่างและปรับแต่งก่อนพิมพ์"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>ดูตัวอย่างก่อนพิมพ์</span>
              </button>
            </div>
          </div>

          {/* Search, Filter & Multi-Select Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาเลขที่ PO, ชื่อสินค้า, รหัสสินค้า, สาขา, ซัพพลายเออร์..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <div className="w-full sm:w-64">
                <SearchableSupplierSelector
                  value={supplierFilter}
                  onChange={(val) => setSupplierFilter(val || "all")}
                  suppliers={suppliers}
                  allowAll
                  allValue="all"
                  allLabel={`ทุกซัพพลายเออร์ (${suppliers.length})`}
                  allowClear
                  size="sm"
                  className="h-9 text-xs font-bold rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  placeholder="ทุกซัพพลายเออร์"
                  searchPlaceholder="พิมพ์ชื่อ, รหัส ซัพพลายเออร์..."
                />
              </div>

              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-bold outline-none cursor-pointer"
              >
                <option value="all">ทุกสาขา ({branches.length})</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Multi-Select Status Strip */}
          {filteredDayOrders.length > 0 && viewMode !== "item" && (
            <div className="flex items-center justify-between pt-2 px-2 text-xs border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={isAllSelected ? handleDeselectAll : handleSelectAll}
                  className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>{isAllSelected ? "ยกเลิกการเลือกทั้งหมด" : "เลือกทั้งหมด"}</span>
                </button>

                <span className="text-slate-400">|</span>
                <span className="text-slate-500">
                  เลือกแล้ว {selectedPoIds.length} จาก {filteredDayOrders.length} ใบสั่งซื้อ
                </span>
              </div>

              {selectedPoIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-xs text-rose-500 hover:underline cursor-pointer"
                >
                  ล้างการเลือก
                </button>
              )}
            </div>
          )}
        </div>

        {/* 4. Display Area based on View Mode */}
        {filteredDayOrders.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 space-y-3">
            <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              ไม่มีคำสั่งซื้อในวันที่ {formatDate(selectedDate)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              ไม่พบรายการสั่งซื้อที่ตรงกับวันที่และเงื่อนไขตัวกรอง
              คุณสามารถเปลี่ยนวันที่เพื่อดูข้อมูลย้อนหลังหรือเลือกแท็บสั่งซื้อเพื่อสร้างใบสั่งซื้อใหม่
            </p>
          </div>
        ) : viewMode === "supplier" ? (
          /* =========================================================================
           PRIMARY MODE: Grouped by Supplier ➔ Branch ➔ PO (Detailed with Checkboxes)
           ========================================================================= */
          <div className="space-y-6">
            {groupedBySupplierData.map((supGroup) => (
              <div
                key={supGroup.supplierId}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden"
              >
                {/* Supplier Header */}
                <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-xs">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{supGroup.supplierName}</span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {supGroup.supplierCode}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {supGroup.orders.length} PO
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        เบอร์โทร: {supGroup.supplierPhone} | รวม {supGroup.branchesMap.size} สาขา |{" "}
                        {supGroup.totalItemsCount} หน่วย
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        ยอดสั่งซื้อรวมซัพพลายเออร์นี้
                      </span>
                      <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                        ฿{supGroup.totalAmount.toLocaleString()}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDirectPrintSupplier(supGroup.supplierId)}
                      className="p-2 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-emerald-600 hover:border-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      title="พิมพ์เอกสารของซัพพลายเออร์นี้ทันที"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden sm:inline">พิมพ์</span>
                    </button>
                  </div>
                </div>

                {/* Sub-branches inside this Supplier */}
                <div className="p-4 sm:p-5 space-y-6">
                  {Array.from(supGroup.branchesMap.values()).map((brData) => (
                    <div
                      key={brData.branchId}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden bg-slate-50/40 dark:bg-slate-800/20 space-y-4 p-4"
                    >
                      {/* Branch Sub-header */}
                      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800/60 pb-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-500" />
                          <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                            จัดส่งสาขา: {brData.branchName} ({brData.branchCode})
                          </span>
                          <span className="text-[10px] text-slate-500">
                            ที่ตั้ง: {brData.location}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                            รวมสาขานี้: ฿{brData.branchTotal.toLocaleString()} (
                            {brData.orders.length} PO)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDirectPrintBranch(brData.branchId)}
                            className="p-1 px-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="พิมพ์เอกสารของสาขานี้"
                          >
                            <Printer className="w-3 h-3 text-emerald-600" />
                            <span>พิมพ์สาขานี้</span>
                          </button>
                        </div>
                      </div>

                      {/* PO List inside this Branch */}
                      <div className="space-y-4">
                        {brData.orders.map((po) => {
                          const isPoSelected = selectedPoIds.includes(po.id);
                          const statusBadge = getOrderStatusBadge(po.status);
                          const orderTime = getOrderTime(po);
                          const modifiable = checkOrderModifiable(po, currentUser);
                          const deletable = checkOrderDeletable(po, currentUser);
                          const isApprovable = canApproveOrder(po, currentUser);

                          return (
                            <div
                              key={po.id}
                              className={`rounded-xl border transition-all p-3.5 ${
                                isPoSelected
                                  ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-700 shadow-xs"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                              }`}
                            >
                              {/* PO Top Bar */}
                              <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2.5">
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePoSelect(po.id)}
                                    className="text-slate-500 hover:text-emerald-600 cursor-pointer"
                                  >
                                    {isPoSelected ? (
                                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-400" />
                                    )}
                                  </button>
                                  <span className="font-mono font-black text-xs text-slate-900 dark:text-slate-100">
                                    PO: {po.id}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.className}`}
                                  >
                                    {statusBadge.label}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-xs flex-wrap">
                                  <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{orderTime} น.</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                                    <User className="w-3.5 h-3.5" />
                                    <span>{po.createdBy || "เจ้าหน้าที่"}</span>
                                  </div>
                                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                                    ฿{po.totalAmount.toLocaleString()}
                                  </span>

                                  {/* Print Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleDirectPrintSinglePo(po)}
                                    className="p-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                    title="พิมพ์ใบสั่งซื้อนี้ทันที"
                                  >
                                    <Printer className="w-3 h-3 text-emerald-600" />
                                    <span>พิมพ์</span>
                                  </button>

                                  {/* Edit Items Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(po)}
                                    className={`p-1 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${
                                      modifiable.allowed
                                        ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800"
                                        : "bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-slate-400 dark:text-slate-500 hover:text-amber-600 border border-slate-200 dark:border-slate-700"
                                    }`}
                                    title={
                                      modifiable.allowed
                                        ? "แก้ไขรายการสินค้าในใบสั่งซื้อ (ต้องระบุเหตุผล)"
                                        : "เลยกำหนดเวลาแก้ไขภายในวันแล้ว — คลิกเพื่อดูช่องทางติดต่อฝ่ายจัดซื้อ"
                                    }
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>แก้ไข</span>
                                  </button>

                                  {/* Cancel Order Button */}
                                  {po.status !== "cancelled" && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenCancel(po)}
                                      className={`p-1 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${
                                        modifiable.allowed
                                          ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 border border-red-200 dark:border-red-800"
                                          : "bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 dark:text-slate-500 hover:text-red-600 border border-slate-200 dark:border-slate-700"
                                      }`}
                                      title={
                                        modifiable.allowed
                                          ? "ยกเลิกคำสั่งซื้อ (ต้องระบุเหตุผล)"
                                          : "เลยกำหนดเวลายกเลิกภายในวันแล้ว — คลิกเพื่อดูช่องทางติดต่อฝ่ายจัดซื้อ"
                                      }
                                    >
                                      <XCircle className="w-3 h-3" />
                                      <span>ยกเลิก</span>
                                    </button>
                                  )}

                                  {/* Delete Order Button (Staff within same day, Admin/IT/Purchase anytime, or click for procurement contact) */}
                                  {(deletable.allowed ||
                                    deletable.needsContactProcurement ||
                                    modifiable.isPrivileged ||
                                    currentUser?.role === "staff" ||
                                    currentUser?.role === "manager") && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenDelete(po)}
                                      className={`p-1 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                                        deletable.allowed
                                          ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 border border-red-200 dark:border-red-800"
                                          : "bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 dark:text-slate-500 hover:text-red-600 border border-slate-200 dark:border-slate-700"
                                      }`}
                                      title={
                                        deletable.allowed
                                          ? "ลบคำสั่งซื้ออย่างถาวร (ต้องระบุเหตุผล)"
                                          : "เลยกำหนดเวลาลบภายในวันแล้ว — คลิกเพื่อดูช่องทางติดต่อฝ่ายจัดซื้อ"
                                      }
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>ลบ</span>
                                    </button>
                                  )}

                                  {/* Approve Order Button */}
                                  {isApprovable && (
                                    <button
                                      type="button"
                                      onClick={() => handleApproveOrder(po)}
                                      className="p-1 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                      title="ฝ่ายจัดซื้อกดอนุมัติคำสั่งซื้อ (ล็อกไม่ให้แก้ไข/ยกเลิก)"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>อนุมัติ</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* PO Remarks Header / Cancel / Edit Notices */}
                              {(po.notes || po.cancelReason || po.editReason) && (
                                <div className="pt-2 pb-1 space-y-1">
                                  {po.notes && po.notes.trim() && (
                                    <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 p-1.5 px-2.5 rounded-lg border border-amber-200/80 dark:border-amber-800/60 font-black flex items-center gap-1.5">
                                      <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                      <span>หมายเหตุใบสั่งซื้อ: {po.notes}</span>
                                    </div>
                                  )}
                                  {po.status === "cancelled" && po.cancelReason && (
                                    <div className="text-[11px] text-red-700 dark:text-red-300 bg-red-50/80 dark:bg-red-950/40 p-1.5 px-2.5 rounded-lg border border-red-200/80 dark:border-red-800/60 font-black flex items-center gap-1.5">
                                      <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                      <span>
                                        ยกเลิกคำสั่งซื้อ: {po.cancelReason} (โดย{" "}
                                        {po.cancelledBy || "-"} เมื่อ {po.cancelledAt || "-"})
                                      </span>
                                    </div>
                                  )}
                                  {po.editReason && po.status !== "cancelled" && (
                                    <div className="text-[10px] text-amber-800 dark:text-amber-200 bg-amber-50/50 dark:bg-amber-950/30 p-1 px-2 rounded border border-amber-200/50 font-bold flex items-center gap-1">
                                      <Edit3 className="w-3 h-3 text-amber-600 shrink-0" />
                                      <span>
                                        แก้ไขรายการล่าสุด: {po.editReason} (โดย {po.editedBy || "-"}{" "}
                                        เมื่อ {po.editedAt || "-"})
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* PO Items Table */}
                              <div className="overflow-x-auto pt-2">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="text-slate-400 text-[10px] font-bold border-b border-slate-100 dark:border-slate-800">
                                      <th className="py-1.5 px-2 w-8 text-center">#</th>
                                      <th className="py-1.5 px-2 w-24 font-mono">รหัสสินค้า</th>
                                      <th className="py-1.5 px-2">รายการวัตถุดิบ</th>
                                      <th className="py-1.5 px-2 text-center w-20">จำนวน</th>
                                      <th className="py-1.5 px-2 text-center w-16">หน่วย</th>
                                      <th className="py-1.5 px-2 text-right w-24">ราคา/หน่วย</th>
                                      <th className="py-1.5 px-2 text-right w-28">รวมเงิน</th>
                                      <th className="py-1.5 px-2">หมายเหตุ</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
                                    {po.items.map((it, idx) => (
                                      <tr key={`${it.productCode}-${idx}`} className="text-[11px]">
                                        <td className="py-1.5 px-2 text-center text-slate-400">
                                          {idx + 1}
                                        </td>
                                        <td className="py-1.5 px-2 font-mono font-bold text-slate-600 dark:text-slate-400">
                                          {it.productCode}
                                        </td>
                                        <td className="py-1.5 px-2 font-bold text-slate-800 dark:text-slate-200">
                                          {it.productName}
                                        </td>
                                        <td className="py-1.5 px-2 text-center font-black text-slate-900 dark:text-slate-100">
                                          {it.quantity}
                                        </td>
                                        <td className="py-1.5 px-2 text-center text-slate-500">
                                          {it.unit}
                                        </td>
                                        <td className="py-1.5 px-2 text-right text-slate-600 dark:text-slate-400">
                                          ฿{it.unitPrice.toLocaleString()}
                                        </td>
                                        <td className="py-1.5 px-2 text-right font-black text-emerald-600 dark:text-emerald-400">
                                          ฿{it.totalPrice.toLocaleString()}
                                        </td>
                                        <td className="py-1.5 px-2 text-slate-400 text-[10px]">
                                          {it.notes || "-"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === "branch" ? (
          /* =========================================================================
           SECONDARY MODE: Grouped by Branch ➔ Supplier
           ========================================================================= */
          <div className="space-y-6">
            {groupedByBranchData.map((branchGroup) => (
              <div
                key={branchGroup.branchId}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden"
              >
                {/* Branch Card Header */}
                <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-mono font-black text-xs">
                      {branchGroup.branchCode}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{branchGroup.branchName}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {branchGroup.orders.length} ใบสั่งซื้อ
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        ที่ตั้ง: {branchGroup.location}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        ยอดสั่งซื้อรวมสาขานี้
                      </span>
                      <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                        ฿{branchGroup.totalAmount.toLocaleString()}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDirectPrintBranch(branchGroup.branchId)}
                      className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-emerald-600 hover:border-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      title="พิมพ์เอกสารเฉพาะสาขานี้"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden sm:inline">พิมพ์สาขานี้</span>
                    </button>
                  </div>
                </div>

                {/* Sub-suppliers inside this Branch */}
                <div className="p-4 sm:p-5 space-y-6">
                  {Array.from(branchGroup.suppliersMap.entries()).map(([supId, sData]) => {
                    const supTotal = sData.orders.reduce((sum, o) => sum + o.totalAmount, 0);
                    const supItems = sData.orders.flatMap((o) => o.items);

                    return (
                      <div
                        key={supId}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden bg-slate-50/40 dark:bg-slate-800/20"
                      >
                        {/* Supplier Sub-header */}
                        <div className="px-4 py-3 bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                              {sData.supplierName}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              (PO: {sData.orders.map((o) => o.id).join(", ")})
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                              รวม ฿{supTotal.toLocaleString()}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDirectPrintSupplier(supId)}
                              className="p-1.5 px-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                              title="พิมพ์เฉพาะซัพพลายเออร์นี้"
                            >
                              <Printer className="w-3.5 h-3.5 text-emerald-600" />
                              <span>พิมพ์</span>
                            </button>
                          </div>
                        </div>

                        {/* Items Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold">
                                <th className="py-2.5 px-4 w-12 text-center">#</th>
                                <th className="py-2.5 px-4 w-28 font-mono">รหัสสินค้า</th>
                                <th className="py-2.5 px-4">ชื่อวัตถุดิบ</th>
                                <th className="py-2.5 px-4 text-center w-24">จำนวน</th>
                                <th className="py-2.5 px-4 text-center w-20">หน่วย</th>
                                <th className="py-2.5 px-4 text-right w-28">ราคา/หน่วย</th>
                                <th className="py-2.5 px-4 text-right w-32">รวมเงิน</th>
                                <th className="py-2.5 px-4">หมายเหตุ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                              {supItems.map((item, idx) => (
                                <tr
                                  key={`${item.productCode}-${idx}`}
                                  className="hover:bg-white dark:hover:bg-slate-800/40 transition-colors"
                                >
                                  <td className="py-2.5 px-4 text-center text-slate-400 text-[11px]">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2.5 px-4 font-mono font-bold text-slate-600 dark:text-slate-400 text-[11px]">
                                    {item.productCode}
                                  </td>
                                  <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                                    {item.productName}
                                  </td>
                                  <td className="py-2.5 px-4 text-center font-black text-slate-900 dark:text-slate-100">
                                    {item.quantity}
                                  </td>
                                  <td className="py-2.5 px-4 text-center text-slate-500">
                                    {item.unit}
                                  </td>
                                  <td className="py-2.5 px-4 text-right text-slate-600 dark:text-slate-400">
                                    ฿{item.unitPrice.toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                                    ฿{item.totalPrice.toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                                    {item.notes || "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* =========================================================================
           MODE 3: Grouped by Master Item across Branches
           ========================================================================= */
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                รายการวัตถุดิบรวมทุกสาขา ({groupedByItemData.length} รายการ)
              </h3>
              <span className="text-xs font-bold text-slate-500">
                รวมยอดสั่งซื้อ:{" "}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  ฿{totalDayAmount.toLocaleString()}
                </strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold bg-slate-50/40 dark:bg-slate-800/20">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4 w-28 font-mono">รหัสสินค้า</th>
                    <th className="py-3 px-4 min-w-[180px]">รายการวัตถุดิบ</th>
                    <th className="py-3 px-4 w-44">ซัพพลายเออร์</th>
                    <th className="py-3 px-4 text-center w-28">ยอดรวมทุกสาขา</th>
                    <th className="py-3 px-4 text-right w-24">ราคา/หน่วย</th>
                    <th className="py-3 px-4 text-right w-28">ยอดเงินรวม</th>
                    <th className="py-3 px-4 min-w-[240px]">จำแนกตามสาขา (Breakdown)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {groupedByItemData.map((item, idx) => (
                    <tr
                      key={item.itemKey}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 text-center text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-600 dark:text-slate-400 text-[11px]">
                        {item.productCode}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">
                          {item.productName}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                        {item.supplierName}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-black text-slate-900 dark:text-slate-100 text-sm">
                          {item.totalQuantity.toLocaleString()}
                        </span>{" "}
                        <span className="text-[11px] text-slate-500">{item.unit}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                        ฿{item.unitPrice.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-xs">
                        ฿{item.totalAmount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.branchBreakdown.map((bb) => (
                            <span
                              key={bb.branchId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-800 dark:text-slate-200"
                              title={`${bb.branchName}: ฿${bb.totalPrice.toLocaleString()}`}
                            >
                              <span className="text-emerald-700 dark:text-emerald-400">
                                {bb.branchCode}:
                              </span>
                              <span>
                                {bb.quantity} {item.unit}
                              </span>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. Printable Modal */}
        {isPrintModalOpen && (
          <DailyPrintModal
            isOpen={isPrintModalOpen}
            onClose={() => setIsPrintModalOpen(false)}
            selectedDate={selectedDate}
            orders={orders}
            branches={branches}
            suppliers={suppliers}
            initialMode={printInitialMode}
            targetSupplierId={printTargetSupplierId}
            targetBranchId={printTargetBranchId}
            selectedPoIds={printTargetPoIds}
          />
        )}

        {/* Edit PO Modal */}
        {selectedPoForEdit && (
          <EditPoModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            order={selectedPoForEdit}
            availableProducts={products}
            onSuccessEdited={() => {}}
          />
        )}

        {/* Cancel PO Modal */}
        {selectedPoForCancel && (
          <CancelPoModal
            isOpen={isCancelModalOpen}
            onClose={() => setIsCancelModalOpen(false)}
            order={selectedPoForCancel}
            onSuccessCancelled={() => {}}
          />
        )}

        {/* Contact Procurement Modal (when expired or locked) */}
        <ContactProcurementModal
          isOpen={Boolean(contactProcurementPo)}
          onClose={() => setContactProcurementPo(null)}
          order={contactProcurementPo}
          actionType={contactProcurementAction}
        />

        {/* Delete PO Modal */}
        {selectedPoForDelete && (
          <DeletePoModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            order={selectedPoForDelete}
            onSuccessDeleted={() => {}}
          />
        )}
      </div>

      {/* 6. Hidden On-Screen DOM for Print Fallback */}
      <DailyOrderPrintDom
        orders={directPrintTargetOrders || filteredDayOrders}
        branches={branches}
        suppliers={suppliers}
        selectedDate={selectedDate}
        currentUser={currentUser}
      />
    </>
  );
};
