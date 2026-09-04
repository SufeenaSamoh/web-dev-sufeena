import React, { useState, useMemo, useEffect } from "react";
import type {
  PurchaseOrder,
  PurchaseBranch,
  PurchaseSupplier,
  PurchaseProduct,
  PurchaseOrderStatus,
} from "./types";
import {
  Search,
  Filter,
  FileText,
  Printer,
  PackageCheck,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  AlertCircle,
  Calendar,
  Building2,
  DollarSign,
  ChevronDown,
  Trash2,
  Sparkles,
  Download,
  Eye,
  RefreshCw,
  Zap,
  Lock,
  Edit3,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { PdfExportModal } from "./PdfExportModal";
import { ReceivePoModal } from "./ReceivePoModal";
import { EditPoModal } from "./EditPoModal";
import { CancelPoModal } from "./CancelPoModal";
import {
  saveOrderToDatabaseA,
  updateOrderStatusInDatabaseA,
  deleteOrderFromDatabaseA,
} from "@/services/purchaseDbA";
import { SearchableSupplierSelector } from "@/components/SearchableSupplierSelector";
import { isOrderMatchingBranch } from "@/features/receiving/ImportPoModal";
import { formatDate } from "@/lib/dateFormat";
import { useStore } from "@/lib/store";
import { checkOrderModifiable, canApproveOrder, checkOrderDeletable } from "./orderRules";
import { DeletePoModal } from "./DeletePoModal";
import { ContactProcurementModal } from "./ContactProcurementModal";

interface PoTrackerViewProps {
  orders: PurchaseOrder[];
  branches: PurchaseBranch[];
  suppliers: PurchaseSupplier[];
  products?: PurchaseProduct[];
  currentBranch?: PurchaseBranch;
  onRefresh?: () => void;
}

export const PoTrackerView: React.FC<PoTrackerViewProps> = ({
  orders,
  branches,
  suppliers,
  products = [],
  currentBranch,
  onRefresh,
}) => {
  const { currentUser } = useStore();

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>(currentBranch?.id || "all");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedOrderType, setSelectedOrderType] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");

  // Sync selected branch with currentBranch if it changes
  useEffect(() => {
    if (currentBranch?.id) {
      setSelectedBranchId(currentBranch.id);
    }
  }, [currentBranch?.id]);

  // Modals & Selected PO
  const [selectedPoForPdf, setSelectedPoForPdf] = useState<PurchaseOrder[] | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [selectedPoForReceive, setSelectedPoForReceive] = useState<PurchaseOrder | null>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState<boolean>(false);
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

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (selectedBranchId !== "all" && !isOrderMatchingBranch(o, selectedBranchId, branches))
        return false;
      if (selectedSupplierId !== "all" && o.supplierId !== selectedSupplierId) return false;
      if (selectedStatus !== "all" && o.status !== selectedStatus) return false;
      if (selectedOrderType !== "all" && (o.orderType || "normal") !== selectedOrderType)
        return false;
      if (dateFilter && o.orderDate !== dateFilter) return false;

      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        o.supplierName.toLowerCase().includes(q) ||
        o.branchName.toLowerCase().includes(q) ||
        (o.createdBy || "").toLowerCase().includes(q) ||
        (o.cancelReason || "").toLowerCase().includes(q) ||
        (o.editReason || "").toLowerCase().includes(q) ||
        o.items.some(
          (it) =>
            it.productName.toLowerCase().includes(q) || it.productCode.toLowerCase().includes(q),
        )
      );
    });
  }, [
    orders,
    selectedBranchId,
    selectedSupplierId,
    selectedStatus,
    selectedOrderType,
    dateFilter,
    searchQuery,
    branches,
  ]);

  // KPI calculations
  const totalOrdersCount = filteredOrders.length;
  const totalOrdersAmount = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const pendingOrdersCount = filteredOrders.filter((o) => o.status === "pending").length;
  const receivedOrdersCount = filteredOrders.filter((o) => o.status === "received").length;

  const handleOpenEdit = (order: PurchaseOrder) => {
    const validation = checkOrderModifiable(order, currentUser);
    if (!validation.allowed) {
      if (validation.needsContactProcurement || validation.isPastDate || !validation.isSameDay) {
        setContactProcurementPo(order);
        setContactProcurementAction("edit");
        toast.warning(
          "เลยวันที่สั่งซื้อแล้ว กรุณาติดต่อฝ่ายจัดซื้อเพื่อแก้ไข เพื่อยกเลิก ปรับปรุงรายการ",
        );
        return;
      }
      toast.error(validation.reason || "ไม่สามารถแก้ไขรายการได้");
      return;
    }
    setSelectedPoForEdit(order);
    setIsEditModalOpen(true);
  };

  const handleOpenCancel = (order: PurchaseOrder) => {
    const validation = checkOrderModifiable(order, currentUser);
    if (!validation.allowed) {
      if (validation.needsContactProcurement || validation.isPastDate || !validation.isSameDay) {
        setContactProcurementPo(order);
        setContactProcurementAction("cancel");
        toast.warning(
          "เลยวันที่สั่งซื้อแล้ว กรุณาติดต่อฝ่ายจัดซื้อเพื่อแก้ไข เพื่อยกเลิก ปรับปรุงรายการ",
        );
        return;
      }
      toast.error(validation.reason || "ไม่สามารถยกเลิกคำสั่งซื้อได้");
      return;
    }
    setSelectedPoForCancel(order);
    setIsCancelModalOpen(true);
  };

  const handleOpenDelete = (order: PurchaseOrder) => {
    const deletable = checkOrderDeletable(order, currentUser);
    if (!deletable.allowed) {
      if (deletable.needsContactProcurement || deletable.isPastDate || !deletable.isSameDay) {
        setContactProcurementPo(order);
        setContactProcurementAction("delete");
        toast.warning(
          "เลยวันที่สั่งซื้อแล้ว กรุณาติดต่อฝ่ายจัดซื้อเพื่อแก้ไข เพื่อยกเลิก ปรับปรุงรายการ",
        );
        return;
      }
      toast.error(deletable.reason || "คุณไม่มีสิทธิ์ในการลบคำสั่งซื้อ");
      return;
    }
    setSelectedPoForDelete(order);
    setIsDeleteModalOpen(true);
  };

  const handleApproveOrder = async (order: PurchaseOrder) => {
    if (!canApproveOrder(order, currentUser)) {
      toast.error("คุณไม่มีสิทธิ์ในการอนุมัติใบสั่งซื้อ");
      return;
    }
    try {
      const nowStr = new Date().toISOString().replace("T", " ").substring(0, 16);
      const userName = currentUser?.name || "ฝ่ายจัดซื้อ";
      const updatedOrder: PurchaseOrder = {
        ...order,
        status: "approved",
        approvedAt: nowStr,
        approvedBy: userName,
        updatedAt: nowStr,
        updatedBy: userName,
      };

      await saveOrderToDatabaseA(updatedOrder);
      toast.success(
        `อนุมัติใบสั่งซื้อ ${order.id} เรียบร้อยแล้ว (รายการจะถูกล็อกไม่ให้แก้ไข/ยกเลิก)`,
      );
      onRefresh?.();
    } catch {
      toast.error("ไม่สามารถบันทึกการอนุมัติได้");
    }
  };

  const handleStatusChange = async (order: PurchaseOrder, newStatus: PurchaseOrderStatus) => {
    if (newStatus === "cancelled") {
      handleOpenCancel(order);
      return;
    }

    try {
      await updateOrderStatusInDatabaseA(
        order.id,
        newStatus,
        undefined,
        currentUser?.name || undefined,
      );
      toast.success(`อัปเดตสถานะ PO: ${order.id} เป็น "${newStatus}" เรียบร้อยแล้ว`);
      onRefresh?.();
    } catch {
      toast.error("ไม่สามารถอัปเดตสถานะใน Database A ได้");
    }
  };

  const handleDeleteOrder = async (order: PurchaseOrder) => {
    const validation = checkOrderModifiable(order, currentUser);
    if (!validation.allowed) {
      toast.error(validation.reason || "ไม่สามารถลบคำสั่งซื้อได้");
      return;
    }
    if (
      !confirm(
        `คุณต้องการลบใบสั่งซื้อเลขที่ ${order.id} ออกจากระบบอย่างถาวรใช่หรือไม่? (หากต้องการเก็บประวัติแนะนำให้ใช้ปุ่มยกเลิก)`,
      )
    )
      return;
    try {
      await deleteOrderFromDatabaseA(order.id);
      toast.success(`ลบใบสั่งซื้อ ${order.id} สำเร็จ`);
      onRefresh?.();
    } catch {
      toast.error("เกิดข้อผิดพลาดในการลบคำสั่งซื้อ");
    }
  };

  const handleOpenPdf = (order: PurchaseOrder) => {
    const branch = branches.find((b) => b.id === order.branchId) || currentBranch || branches[0];
    setSelectedPoForPdf([order]);
    setIsPdfModalOpen(true);
  };

  const handleExportAllFiltered = () => {
    if (filteredOrders.length === 0) {
      toast.error("ไม่มีรายการสั่งซื้อสำหรับส่งออก");
      return;
    }
    setSelectedPoForPdf(filteredOrders);
    setIsPdfModalOpen(true);
  };

  const handleOpenReceiveModal = (order: PurchaseOrder) => {
    setSelectedPoForReceive(order);
    setIsReceiveModalOpen(true);
  };

  const getStatusBadge = (status: PurchaseOrderStatus) => {
    switch (status) {
      case "received":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            ตรวจรับแล้ว (DB B)
          </span>
        );
      case "in_transit":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
            <Truck className="w-3.5 h-3.5" />
            กำลังจัดส่ง
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            <Check className="w-3.5 h-3.5" />
            อนุมัติแล้ว
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
            <XCircle className="w-3.5 h-3.5" />
            ยกเลิก
          </span>
        );
      case "pending":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <Clock className="w-3.5 h-3.5" />
            รอดำเนินการ
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span>ประวัติ & ตรวจสอบสถานะใบสั่งซื้อ (PO Tracker)</span>
            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Database A Live
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ติดตามสถานะใบสั่งซื้อ แก้ไขรายการ/ยกเลิกคำสั่งซื้อ (เฉพาะในวันและก่อนอนุมัติ)
            และตรวจรับเข้าสต็อก
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Filtered Orders as PDF */}
          <button
            type="button"
            onClick={handleExportAllFiltered}
            disabled={filteredOrders.length === 0}
            className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 text-xs font-black shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>พิมพ์รวมที่กรองไว้ ({filteredOrders.length})</span>
          </button>

          {/* Refresh Button */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            คำสั่งซื้อทั้งหมด
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
              {totalOrdersCount}
            </span>
            <span className="text-xs text-slate-500 font-bold">ใบ</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            ยอดสั่งซื้อรวม (฿)
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ฿{totalOrdersAmount.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            รอดำเนินการ / ยังไม่อนุมัติ
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
              {pendingOrdersCount}
            </span>
            <span className="text-xs text-slate-500 font-bold">ใบ</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            ตรวจรับเข้า Database B แล้ว
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {receivedOrdersCount}
            </span>
            <span className="text-xs text-slate-500 font-bold">ใบ</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {/* Search Box */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่ PO, สาขา, ซัพพลายเออร์, สินค้า, เหตุผล..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 transition-all font-medium"
            />
          </div>

          {/* Branch Filter */}
          <div>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full p-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="all">🏢 ทุกสาขา ({branches.length})</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* Supplier Filter */}
          <div>
            <SearchableSupplierSelector
              value={selectedSupplierId}
              onChange={(val) => setSelectedSupplierId(val || "all")}
              suppliers={suppliers}
              allowAll
              allValue="all"
              allLabel={`🏭 ทุกซัพพลายเออร์ (${suppliers.length})`}
              allowClear
              size="sm"
              className="h-9 text-xs font-semibold rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              placeholder="ทุกซัพพลายเออร์"
              searchPlaceholder="พิมพ์ชื่อ, รหัส ซัพพลายเออร์..."
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="all">🏷️ ทุกสถานะ</option>
              <option value="pending">🟡 รอดำเนินการ (Pending)</option>
              <option value="approved">🔵 อนุมัติแล้ว (Approved)</option>
              <option value="in_transit">🟣 กำลังจัดส่ง (In Transit)</option>
              <option value="received">🟢 ตรวจรับแล้ว (Received)</option>
              <option value="cancelled">🔴 ยกเลิก (Cancelled)</option>
            </select>
          </div>

          {/* Order Type Filter (Normal vs Urgent) */}
          <div>
            <select
              value={selectedOrderType}
              onChange={(e) => setSelectedOrderType(e.target.value)}
              className="w-full p-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
            >
              <option value="all">⚡ ทุกรูปแบบคำสั่งซื้อ</option>
              <option value="normal">🚚 สั่งรอบปกติ</option>
              <option value="urgent">⚡ สั่งด่วน (ผักด่วน)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <FileText className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
              ไม่พบประวัติใบสั่งซื้อตามเงื่อนไขที่เลือก
            </p>
            <p className="text-[11px] text-slate-400">
              ลองเปลี่ยนตัวกรองสาขา สถานะ หรือกดสร้างใบสั่งซื้อใหม่
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">เลขที่ใบสั่งซื้อ (PO)</th>
                  <th className="py-3 px-4">สาขา / ผู้สั่ง</th>
                  <th className="py-3 px-4">ซัพพลายเออร์</th>
                  <th className="py-3 px-4">วันที่สั่ง / กำหนดรับ</th>
                  <th className="py-3 px-4 text-center">รายการ</th>
                  <th className="py-3 px-4 text-right">ยอดรวม (฿)</th>
                  <th className="py-3 px-4 text-center">สถานะ</th>
                  <th className="py-3 px-4 text-center">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {filteredOrders.map((order) => {
                  const modifiable = checkOrderModifiable(order, currentUser);
                  const deletable = checkOrderDeletable(order, currentUser);
                  const isApprovable = canApproveOrder(order, currentUser);

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* PO Number */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-black text-xs text-slate-900 dark:text-slate-100">
                              {order.id}
                            </span>
                            {order.orderType === "urgent" ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                <Zap className="w-2.5 h-2.5" /> ด่วน
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                ปกติ
                              </span>
                            )}
                          </div>

                          {/* PO Remarks */}
                          {order.notes && order.notes.trim() && (
                            <div
                              className="text-[10px] text-amber-600 dark:text-amber-400 font-extrabold flex items-center gap-1 max-w-[200px] truncate"
                              title={order.notes}
                            >
                              <FileText className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">หมายเหตุ: {order.notes}</span>
                            </div>
                          )}

                          {/* Cancellation Reason Info */}
                          {order.status === "cancelled" && order.cancelReason && (
                            <div
                              className="text-[10px] text-red-600 dark:text-red-400 font-black flex items-center gap-1 max-w-[220px] truncate bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded"
                              title={`เหตุผลที่ยกเลิก: ${order.cancelReason} (โดย ${order.cancelledBy || "-"} เมื่อ ${order.cancelledAt || "-"})`}
                            >
                              <XCircle className="w-2.5 h-2.5 shrink-0 text-red-500" />
                              <span className="truncate">ยกเลิก: {order.cancelReason}</span>
                            </div>
                          )}

                          {/* Edit Reason Info */}
                          {order.editReason && order.status !== "cancelled" && (
                            <div
                              className="text-[9.5px] text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1 max-w-[220px] truncate bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded"
                              title={`แก้ไขล่าสุด: ${order.editReason} (โดย ${order.editedBy || "-"} เมื่อ ${order.editedAt || "-"})`}
                            >
                              <Edit3 className="w-2.5 h-2.5 shrink-0 text-amber-600" />
                              <span className="truncate">แก้ไข: {order.editReason}</span>
                            </div>
                          )}

                          {order.syncedToSheets && (
                            <span className="block text-[9.5px] text-emerald-600 font-bold">
                              ✓ Synced Sheets
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Branch & Creator */}
                      <td className="py-3 px-4">
                        <p className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">
                          {order.branchName}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          ผู้สั่ง: {order.createdBy || "-"}
                        </p>
                      </td>

                      {/* Supplier */}
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                          {order.supplierName}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[180px]">
                          {order.deliveryTerms}
                        </p>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                          สั่ง: {formatDate(order.orderDate)}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          รับ: {formatDate(order.expectedReceivedDate)}
                        </p>
                      </td>

                      {/* Items Count */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {order.items.length} รายการ
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          ({order.items.reduce((s, i) => s + i.quantity, 0)} หน่วย)
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-xs">
                        ฿{order.totalAmount.toLocaleString()}
                      </td>

                      {/* Status with Quick Change */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {getStatusBadge(order.status)}

                          {order.approvedBy && order.status === "approved" && (
                            <span className="text-[9px] text-blue-600 dark:text-blue-400 font-bold block">
                              อนุมัติโดย: {order.approvedBy}
                            </span>
                          )}

                          {/* If not modifiable and pending/approved, show lock badge */}
                          {!modifiable.allowed && order.status === "pending" && (
                            <span
                              className="inline-flex items-center gap-1 text-[9.5px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60"
                              title={modifiable.reason}
                            >
                              <Lock className="w-2.5 h-2.5" /> ล็อกแก้ไข
                            </span>
                          )}

                          {modifiable.isPrivileged && (
                            <span
                              className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800"
                              title="สิทธิ์ Admin / IT / Purchase: สามารถแก้ไขและลบได้ตลอดเวลา (ต้องระบุเหตุผล)"
                            >
                              <Check className="w-2.5 h-2.5 text-emerald-600" /> สิทธิ์แก้ไข/ลบ
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* Print / View PDF */}
                          <button
                            type="button"
                            onClick={() => handleOpenPdf(order)}
                            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold transition-all cursor-pointer shadow-2xs"
                            title="ดูและพิมพ์ใบสั่งซื้อ (PDF/PNG/CSV)"
                          >
                            <Printer className="w-4 h-4 text-emerald-600" />
                          </button>

                          {/* Edit Items Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(order)}
                            className={`p-1.5 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95 ${
                              modifiable.allowed
                                ? "bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                : "bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-slate-400 dark:text-slate-500 hover:text-amber-600 border border-slate-200 dark:border-slate-700"
                            }`}
                            title={
                              modifiable.allowed
                                ? "แก้ไขรายการสินค้าในใบสั่งซื้อ (ต้องระบุเหตุผล)"
                                : "เลยกำหนดเวลาแก้ไขภายในวันแล้ว — คลิกเพื่อดูช่องทางติดต่อฝ่ายจัดซื้อ"
                            }
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Cancel Order Button */}
                          {order.status !== "cancelled" && (
                            <button
                              type="button"
                              onClick={() => handleOpenCancel(order)}
                              className={`p-1.5 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95 ${
                                modifiable.allowed
                                  ? "bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
                                  : "bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 dark:text-slate-500 hover:text-rose-600 border border-slate-200 dark:border-slate-700"
                              }`}
                              title={
                                modifiable.allowed
                                  ? "ยกเลิกคำสั่งซื้อ (ต้องระบุเหตุผล)"
                                  : "เลยกำหนดเวลายกเลิกภายในวันแล้ว — คลิกเพื่อดูช่องทางติดต่อฝ่ายจัดซื้อ"
                              }
                            >
                              <XCircle className="w-4 h-4" />
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
                              onClick={() => handleOpenDelete(order)}
                              className={`p-1.5 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95 ${
                                deletable.allowed
                                  ? "bg-red-50 dark:bg-red-950/50 hover:bg-red-100 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
                                  : "bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 dark:text-slate-500 hover:text-red-600 border border-slate-200 dark:border-slate-700"
                              }`}
                              title={
                                deletable.allowed
                                  ? "ลบคำสั่งซื้ออย่างถาวร (ต้องระบุเหตุผล)"
                                  : "เลยกำหนดเวลาลบภายในวันแล้ว — คลิกเพื่อดูช่องทางติดต่อฝ่ายจัดซื้อ"
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Quick Approve Button for Procurement/Admin */}
                          {isApprovable && (
                            <button
                              type="button"
                              onClick={() => handleApproveOrder(order)}
                              className="px-2 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[10.5px] shadow-sm transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                              title="ฝ่ายจัดซื้อกดอนุมัติคำสั่งซื้อ (เมื่ออนุมัติแล้วสาขาจะไม่สามารถแก้ไขหรือยกเลิกได้)"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>อนุมัติ PO</span>
                            </button>
                          )}

                          {/* Dual DB Bridge: Receive into Database B */}
                          {order.status !== "received" && order.status !== "cancelled" && (
                            <button
                              type="button"
                              onClick={() => handleOpenReceiveModal(order)}
                              className="px-2 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10.5px] shadow-sm transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                              title="บันทึกตรวจรับเข้าคลังสต็อกหลัก (Database B)"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>ตรวจรับ</span>
                            </button>
                          )}
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

      {/* Edit PO Modal */}
      {selectedPoForEdit && (
        <EditPoModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          order={selectedPoForEdit}
          availableProducts={products}
          onSuccessEdited={() => onRefresh?.()}
        />
      )}

      {/* Cancel PO Modal */}
      {selectedPoForCancel && (
        <CancelPoModal
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
          order={selectedPoForCancel}
          onSuccessCancelled={() => onRefresh?.()}
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
          onSuccessDeleted={() => onRefresh?.()}
        />
      )}

      {/* PDF Export Modal */}
      {selectedPoForPdf && (
        <PdfExportModal
          branch={currentBranch || branches[0]}
          orders={selectedPoForPdf}
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          batchTitle="ใบสั่งซื้อวัตถุดิบ (PO Export)"
        />
      )}

      {/* Dual Database Receive Bridge Modal */}
      {selectedPoForReceive && (
        <ReceivePoModal
          isOpen={isReceiveModalOpen}
          onClose={() => setIsReceiveModalOpen(false)}
          order={selectedPoForReceive}
          branches={branches}
          onSuccessReceived={() => onRefresh?.()}
        />
      )}
    </div>
  );
};
