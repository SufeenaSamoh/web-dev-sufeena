import React, { useEffect, useState, useMemo } from "react";
import type { PurchaseOrder, PurchaseBranch, PurchaseSupplier, PurchaseOrderStatus } from "./types";
import {
  executeDailyOrdersPrint,
  openDailyOrdersPrintWindow,
  downloadDailyOrdersPrintHtml,
  getCurrentPrintTimestamp,
  formatThaiDateFull,
  cleanOrderNotes,
} from "./printDailyOrders";
import {
  Printer,
  X,
  FileText,
  Building2,
  Truck,
  Download,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  User,
  CheckSquare,
  Square,
  ExternalLink,
  FileCode,
} from "lucide-react";

import { formatDate } from "@/lib/dateFormat";
import { SearchableSupplierSelector } from "@/components/SearchableSupplierSelector";
import { useStore } from "@/lib/store";

export type DailyPrintMode = "all" | "by_supplier" | "by_branch" | "selected";

interface DailyPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  orders: PurchaseOrder[];
  branches: PurchaseBranch[];
  suppliers: PurchaseSupplier[];
  initialMode?: DailyPrintMode;
  targetSupplierId?: string;
  targetBranchId?: string;
  selectedPoIds?: string[];
}

const getOrderStatusLabel = (status: PurchaseOrderStatus): string => {
  switch (status) {
    case "pending":
      return "รอดำเนินการ";
    case "approved":
      return "กำลังจัดซื้อ";
    case "in_transit":
      return "สั่งซื้อแล้ว";
    case "received":
      return "ได้รับสินค้าแล้ว";
    case "cancelled":
      return "ยกเลิก";
    default:
      return "รอดำเนินการ";
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

export const DailyPrintModal: React.FC<DailyPrintModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  orders,
  branches,
  suppliers,
  initialMode = "all",
  targetSupplierId,
  targetBranchId,
  selectedPoIds = [],
}) => {
  const { currentUser } = useStore();
  const [printMode, setPrintMode] = useState<DailyPrintMode>(initialMode);
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>(
    targetSupplierId || "all",
  );
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>(targetBranchId || "all");
  const [modalSelectedPoIds, setModalSelectedPoIds] = useState<string[]>(selectedPoIds);

  useEffect(() => {
    setPrintMode(initialMode);
    if (targetSupplierId) setSelectedSupplierFilter(targetSupplierId);
    if (targetBranchId) setSelectedBranchFilter(targetBranchId);
    if (selectedPoIds && selectedPoIds.length > 0) {
      setModalSelectedPoIds(selectedPoIds);
    }
  }, [initialMode, targetSupplierId, targetBranchId, selectedPoIds, isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // All Orders for the selected date, sorted by Date ➔ Time ➔ PO ID (Oldest first)
  const allDateOrders = useMemo(() => {
    return orders
      .filter((o) => o.orderDate === selectedDate)
      .sort((a, b) => {
        // 1. Date
        if (a.orderDate !== b.orderDate) {
          return a.orderDate.localeCompare(b.orderDate);
        }
        // 2. Time
        const timeA = getOrderTime(a);
        const timeB = getOrderTime(b);
        if (timeA !== timeB) {
          return timeA.localeCompare(timeB);
        }
        // 3. PO Number
        return a.id.localeCompare(b.id);
      });
  }, [orders, selectedDate]);

  // Filtered orders according to active Print Mode
  const printableOrders = useMemo(() => {
    return allDateOrders.filter((o) => {
      if (printMode === "selected") {
        return modalSelectedPoIds.includes(o.id);
      }
      if (printMode === "by_supplier" && selectedSupplierFilter !== "all") {
        return o.supplierId === selectedSupplierFilter;
      }
      if (printMode === "by_branch" && selectedBranchFilter !== "all") {
        return o.branchId === selectedBranchFilter;
      }
      return true;
    });
  }, [allDateOrders, printMode, modalSelectedPoIds, selectedSupplierFilter, selectedBranchFilter]);

  const grandTotalAmount = useMemo(() => {
    return printableOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  }, [printableOrders]);

  const grandTotalItems = useMemo(() => {
    return printableOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
  }, [printableOrders]);

  // Handle PO selection toggle inside modal
  const handleTogglePoSelect = (poId: string) => {
    setModalSelectedPoIds((prev) =>
      prev.includes(poId) ? prev.filter((id) => id !== poId) : [...prev, poId],
    );
  };

  const handleSelectAllInModal = () => {
    setModalSelectedPoIds(allDateOrders.map((o) => o.id));
  };

  const handleDeselectAllInModal = () => {
    setModalSelectedPoIds([]);
  };

  // Print Action
  const handlePrint = () => {
    executeDailyOrdersPrint({
      orders: printableOrders,
      branches,
      suppliers,
      selectedDate,
      currentUser,
    });
  };

  // Open Standalone Print Tab
  const handleOpenNewTab = () => {
    openDailyOrdersPrintWindow({
      orders: printableOrders,
      branches,
      suppliers,
      selectedDate,
      currentUser,
    });
  };

  // Download Standalone Printable HTML File
  const handleDownloadHTML = () => {
    downloadDailyOrdersPrintHtml({
      orders: printableOrders,
      branches,
      suppliers,
      selectedDate,
      currentUser,
    });
  };

  // CSV Export Action
  const handleExportCSV = () => {
    if (printableOrders.length === 0) return;
    const headers = [
      "ลำดับ",
      "วันที่สั่งซื้อ",
      "เวลาที่สั่ง",
      "เลขที่ PO",
      "สาขา",
      "ซัพพลายเออร์",
      "รหัสสินค้า",
      "ชื่อวัตถุดิบ",
      "จำนวน",
      "หน่วย",
      "ราคา/หน่วย (บาท)",
      "ยอดรวม (บาท)",
      "สถานะ",
      "ผู้สั่ง",
      "หมายเหตุ",
    ];

    let rowIdx = 1;
    const rows: string[] = [];

    printableOrders.forEach((ord) => {
      const orderTime = getOrderTime(ord);
      ord.items.forEach((item) => {
        rows.push(
          [
            rowIdx++,
            `"${formatDate(ord.orderDate)}"`,
            `"${orderTime}"`,
            `"${ord.id}"`,
            `"${ord.branchName.replace(/"/g, '""')}"`,
            `"${ord.supplierName.replace(/"/g, '""')}"`,
            `"${item.productCode}"`,
            `"${item.productName.replace(/"/g, '""')}"`,
            item.quantity,
            `"${item.unit}"`,
            item.unitPrice,
            item.totalPrice,
            `"${getOrderStatusLabel(ord.status)}"`,
            `"${(ord.createdBy || "").replace(/"/g, '""')}"`,
            `"${(item.notes || ord.notes || "").replace(/"/g, '""')}"`,
          ].join(","),
        );
      });
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ใบสั่งซื้อรวม_${selectedDate}_${printMode}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
      @media print {
        body * {
          visibility: hidden;
        }
        #printable-daily-po,
        #printable-daily-po * {
          visibility: visible;
        }
        #printable-daily-po {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          margin: 0;
          padding: 0;
          max-width: none;
          max-height: none;
          overflow: visible;
        }
        @page {
          size: A4 portrait;
          margin: 12mm;
        }
        thead {
          display: table-header-group;
        }
        tfoot {
          display: table-footer-group;
        }
        .po-section {
          break-after: page;
          page-break-after: always;
        }
        .po-section:last-child {
          break-after: auto;
          page-break-after: auto;
        }
        tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }
      }
    `}</style>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
        <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden print:max-h-none print:overflow-visible print:shadow-none print:border-none print:w-full print:rounded-none">
          {/* Modal Controls Header (Hidden during Print) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 print:hidden shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-sm">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>พิมพ์เอกสารสั่งซื้อ (Print Preview)</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                    {formatDate(selectedDate)}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  เตรียมพิมพ์ {printableOrders.length} ใบสั่งซื้อ (แยก 1 PO ต่อหน้า) | ยอดรวม ฿
                  {grandTotalAmount.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Mode Selector */}
              <div className="flex items-center bg-slate-200/70 dark:bg-slate-700/60 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPrintMode("all")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    printMode === "all"
                      ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  พิมพ์ทั้งหมด ({allDateOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMode("by_supplier")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    printMode === "by_supplier"
                      ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  ตาม Supplier
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMode("by_branch")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    printMode === "by_branch"
                      ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  ตามสาขา
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMode("selected")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    printMode === "selected"
                      ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  เลือกเฉพาะ ({modalSelectedPoIds.length})
                </button>
              </div>

              {/* CSV Export Button */}
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-all cursor-pointer"
                title="ส่งออกเป็นไฟล์ CSV สำหรับ Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>

              {/* Download Standalone HTML Button */}
              <button
                type="button"
                onClick={handleDownloadHTML}
                disabled={printableOrders.length === 0}
                className="px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-all cursor-pointer disabled:opacity-50"
                title="ดาวน์โหลดไฟล์เอกสาร HTML พร้อมพิมพ์ (เปิดพิมพ์ได้ทุกเบราว์เซอร์)"
              >
                <FileCode className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>โหลด HTML</span>
              </button>

              {/* Open in New Tab Button */}
              <button
                type="button"
                onClick={handleOpenNewTab}
                disabled={printableOrders.length === 0}
                className="px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all cursor-pointer disabled:opacity-50"
                title="เปิดหน้าพิมพ์ในแท็บใหม่แยกต่างหาก"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>เปิดแท็บพิมพ์</span>
              </button>

              {/* Print Trigger Button */}
              <button
                type="button"
                onClick={handlePrint}
                disabled={printableOrders.length === 0}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
                title="สั่งพิมพ์เอกสารทันที"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์เอกสาร ({printableOrders.length} PO)</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Sub-Filter Controls for Supplier / Branch / Selective Modes */}
          {printMode === "by_supplier" && (
            <div className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/40 flex items-center gap-3 print:hidden">
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 shrink-0">
                เลือกซัพพลายเออร์ที่ต้องการพิมพ์:
              </span>
              <div className="w-72">
                <SearchableSupplierSelector
                  value={selectedSupplierFilter}
                  onChange={(val) => setSelectedSupplierFilter(val || "all")}
                  suppliers={suppliers}
                  allowAll
                  allValue="all"
                  allLabel={`ทุกซัพพลายเออร์ (${suppliers.length})`}
                  allowClear
                  size="sm"
                  className="h-8 text-xs font-bold rounded-lg border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 text-emerald-900 dark:text-emerald-100"
                  placeholder="ทุกซัพพลายเออร์"
                  searchPlaceholder="พิมพ์ชื่อ, รหัส ซัพพลายเออร์..."
                />
              </div>
            </div>
          )}

          {printMode === "by_branch" && (
            <div className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 print:hidden">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 shrink-0">
                เลือกสาขาที่ต้องการพิมพ์:
              </span>
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="text-xs font-bold py-1 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 cursor-pointer"
              >
                <option value="all">ทุกสาขา ({branches.length})</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {printMode === "selected" && (
            <div className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2 print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  เลือกพิมพ์ {modalSelectedPoIds.length} จาก {allDateOrders.length} ใบสั่งซื้อ:
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllInModal}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
                >
                  เลือกทั้งหมด
                </button>
                <span className="text-slate-400">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllInModal}
                  className="text-xs text-slate-500 hover:underline cursor-pointer"
                >
                  ยกเลิกทั้งหมด
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1">
                {allDateOrders.map((ord) => {
                  const isChecked = modalSelectedPoIds.includes(ord.id);
                  return (
                    <button
                      key={ord.id}
                      type="button"
                      onClick={() => handleTogglePoSelect(ord.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                        isChecked
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-3.5 h-3.5" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                      <span>{ord.id}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Printable Document Body (A4 Portrait Layout with Clean PO-by-PO Separation) */}
          <div
            id="printable-daily-po"
            className="p-6 sm:p-8 overflow-y-auto space-y-8 bg-slate-100 dark:bg-slate-950/60 print:bg-white text-slate-900 print:p-0 print:overflow-visible print:text-black font-sans text-xs"
          >
            {/* If No Orders */}
            {printableOrders.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  ไม่มีใบสั่งซื้อที่ตรงกับเงื่อนไขการพิมพ์
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  กรุณาตรวจสอบการเลือกหรือเปลี่ยนโหมดการพิมพ์
                </p>
              </div>
            ) : (
              /* ========================================================
                 PO-by-PO SECTION RENDERING (Guarantees no PO merging)
                 Each PO is formatted 1:1 to match standard PO layout
                 ======================================================== */
              <div className="space-y-8 print:space-y-0">
                {printableOrders.map((ord, poIndex) => {
                  const branchObj = branches.find((b) => b.id === ord.branchId);
                  const supplierObj = suppliers.find((s) => s.id === ord.supplierId);

                  const supplierName =
                    supplierObj?.name || ord.supplierName || "ไม่ระบุซัพพลายเออร์";
                  const supplierDeliveryTerms =
                    ord.deliveryTerms || supplierObj?.deliveryTerms || "ตามเงื่อนไขซัพพลายเออร์";

                  const branchName = branchObj?.name || ord.branchName || "ไม่ระบุสาขา";
                  const branchLocation = branchObj?.location || "-";
                  const branchManager = branchObj?.manager || ord.createdBy || "ผู้จัดการสาขา";
                  const branchPhone = branchObj?.phone || "-";

                  const expectedDate = ord.expectedReceivedDate
                    ? formatDate(ord.expectedReceivedDate)
                    : formatDate(ord.orderDate);

                  const cleanedNotes = cleanOrderNotes(ord.notes);

                  let statusLabel = "รอดำเนินการจัดซื้อ";
                  if (ord.status === "received") {
                    statusLabel = "ได้รับสินค้าเข้าคลังแล้ว";
                  } else if (ord.status === "approved") {
                    statusLabel = "จัดซื้ออนุมัติแล้ว";
                  } else if (ord.status === "in_transit") {
                    statusLabel = "สินค้าอยู่ระหว่างขนส่ง";
                  }

                  return (
                    <div
                      key={ord.id}
                      className="po-section bg-white border border-slate-300 print:border-none p-6 sm:p-8 rounded-2xl shadow-xs print:shadow-none space-y-5 print:p-0 print:m-0"
                    >
                      {/* Document Top Header (Matches Standard PO 1:1) */}
                      <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 bg-emerald-700 text-white font-extrabold text-xs rounded tracking-wide">
                              ใบสั่งซื้อวัตถุดิบ (PURCHASE ORDER)
                            </span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded border border-slate-300">
                              ใบที่ {poIndex + 1}/{printableOrders.length} • {ord.id}
                            </span>
                          </div>
                          <h2 className="text-lg font-bold text-slate-900 m-0">{branchName}</h2>
                          <p className="text-xs text-slate-600 m-0">สถานที่: {branchLocation}</p>
                          <p className="text-xs text-slate-600 m-0">
                            ผู้จัดการสาขา: {branchManager} | โทร: {branchPhone}
                          </p>
                        </div>

                        <div className="text-right text-xs space-y-1 text-slate-700">
                          <p className="m-0">
                            <strong className="text-slate-900">วันที่สั่งซื้อ:</strong>{" "}
                            {formatDate(ord.orderDate)}
                          </p>
                          <p className="m-0">
                            <strong className="text-slate-900">กำหนดรับเข้า:</strong> {expectedDate}
                          </p>
                          <p className="m-0">
                            <strong className="text-slate-900">ผู้ทำรายการ:</strong>{" "}
                            {ord.createdBy || branchManager}
                          </p>
                        </div>
                      </div>

                      {/* PO Meta Info Box (Matches Standard PO 1:1) */}
                      <div className="grid grid-cols-2 gap-4 bg-slate-50 print:bg-white border border-slate-300 rounded-xl p-3.5 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            รายละเอียดซัพพลายเออร์ (Supplier)
                          </span>
                          <p className="font-extrabold text-sm text-slate-900 m-0">
                            {supplierName}
                          </p>
                          <p className="text-slate-600 text-xs mt-0.5 m-0">
                            เงื่อนไขการจัดส่ง: {supplierDeliveryTerms}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            สถานะใบสั่งซื้อ (Status)
                          </span>
                          <span className="font-bold text-emerald-700 text-xs">{statusLabel}</span>
                        </div>
                      </div>

                      {/* Order Items Table (Matches Standard PO 1:1) */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                          รายการวัตถุดิบสั่งซื้อ ({ord.items.length} รายการ)
                        </span>
                        <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                          <thead>
                            <tr className="bg-slate-900 text-white font-bold">
                              <th className="p-2 border border-slate-900 text-center w-12">
                                ลำดับ
                              </th>
                              <th className="p-2 border border-slate-900 w-32 font-mono">
                                รหัสสินค้า
                              </th>
                              <th className="p-2 border border-slate-900">รายการสินค้า</th>
                              <th className="p-2 border border-slate-900 text-right w-24">จำนวน</th>
                              <th className="p-2 border border-slate-900 text-right w-24">
                                ราคา/หน่วย
                              </th>
                              <th className="p-2 border border-slate-900 text-right w-28">
                                รวมเงิน (บาท)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {ord.items.map((item, itemIdx) => (
                              <tr
                                key={`${item.productCode}-${itemIdx}`}
                                className={itemIdx % 2 === 1 ? "bg-slate-50" : "bg-white"}
                              >
                                <td className="p-2 border border-slate-300 text-center text-slate-600 font-semibold">
                                  {itemIdx + 1}
                                </td>
                                <td className="p-2 border border-slate-300 font-mono font-bold text-slate-900">
                                  {item.productCode || "-"}
                                </td>
                                <td className="p-2 border border-slate-300 font-bold text-slate-900">
                                  {item.productName || "-"}
                                </td>
                                <td className="p-2 border border-slate-300 text-right font-bold text-slate-900">
                                  {Number(item.quantity).toLocaleString()} {item.unit || ""}
                                </td>
                                <td className="p-2 border border-slate-300 text-right text-slate-700">
                                  ฿{Number(item.unitPrice || 0).toLocaleString()}
                                </td>
                                <td className="p-2 border border-slate-300 text-right font-black text-slate-900">
                                  ฿{Number(item.totalPrice || 0).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Total & Summary Section (Matches Standard PO 1:1) */}
                      <div className="pt-1 flex flex-row justify-between items-start gap-4">
                        <div className="text-[10px] text-slate-500 space-y-0.5 max-w-sm">
                          <p className="font-bold text-slate-700 m-0">เงื่อนไขและข้อตกลง:</p>
                          <p className="leading-relaxed m-0">
                            1. กรุณาตรวจสอบจำนวนและสภาพวัตถุดิบก่อนลงนามรับสินค้า
                            <br />
                            2. หากพบสินค้าชำรุดเสียหายให้ระบุลงในใบส่งของทันที
                          </p>
                          {cleanedNotes && (
                            <p className="mt-1 font-semibold text-slate-700 m-0">
                              หมายเหตุ: {cleanedNotes}
                            </p>
                          )}
                        </div>
                        <div className="bg-slate-100 p-2.5 rounded-lg border-2 border-slate-400 text-right min-w-[200px]">
                          <span className="text-[10px] text-slate-600 font-bold block">
                            ยอดเงินรวมใบนี้ (PO Total Amount)
                          </span>
                          <span className="text-xl font-black text-emerald-800">
                            ฿{Number(ord.totalAmount || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Signatures (2 Roles Only - Matches Standard PO 1:1) */}
                      <div className="mt-6 pt-2 grid grid-cols-2 gap-8 text-center text-xs">
                        <div className="space-y-1">
                          <div className="border-b border-slate-400 pb-6 mb-1"></div>
                          <p className="font-bold text-slate-800 m-0">
                            ลงชื่อ......................................................
                          </p>
                          <p className="text-slate-500 text-[10.5px] m-0">
                            ( ผู้สั่งซื้อ / ผู้จัดการสาขา )
                          </p>
                          <p className="text-slate-400 text-[9.5px] m-0">
                            วันที่: ..... / ..... / ..........
                          </p>
                        </div>

                        <div className="space-y-1">
                          <div className="border-b border-slate-400 pb-6 mb-1"></div>
                          <p className="font-bold text-slate-800 m-0">
                            ลงชื่อ......................................................
                          </p>
                          <p className="text-slate-500 text-[10.5px] m-0">
                            ( ผู้รับวัตถุดิบเข้าหน้าสาขา )
                          </p>
                          <p className="text-slate-400 text-[9.5px] m-0">
                            วันที่: ..... / ..... / ..........
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
