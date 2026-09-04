import React, { useMemo, useState } from "react";
import type {
  PurchaseBranch,
  PurchaseSupplier,
  PurchaseProduct,
  PurchaseOrder,
  PurchaseOrderItem,
} from "./types";
import {
  buildMasterCatalog,
  optimizeAllocation,
  isPortoChinoBranch,
  RequestedQty,
} from "../../lib/allocationOptimizer";
import {
  Search,
  Scale,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Sparkles,
  ShoppingBag,
  Send,
  Plus,
  Minus,
  RotateCcw,
  TrendingDown,
  Building2,
  DollarSign,
  Loader2,
  RefreshCw,
  Zap,
  Truck,
  Lock,
  Info,
  FileText,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import { PdfExportModal } from "./PdfExportModal";
import { seedDatabaseAWithVegetablesAndSuppliers } from "../../services/purchaseDbA";
import { notifyTelegramForUrgentOrders } from "../../services/telegramService";
import { formatDate } from "@/lib/dateFormat";
import { calculateDeliveryRound } from "./deliveryRoundRules";
import { DeliveryRoundBanner } from "./DeliveryRoundBanner";

interface SmartOrderCompareProps {
  currentBranch: PurchaseBranch;
  suppliers: PurchaseSupplier[];
  products: PurchaseProduct[];
  orders?: PurchaseOrder[];
  orderDate: string;
  expectedReceivedDate: string;
  orderCreator: string;
  orderNotes?: string;
  setOrderNotes?: (notes: string) => void;
  onCreateOrder?: (order: Omit<PurchaseOrder, "id" | "updatedAt">) => void;
  onCreateOrders?: (orders: Omit<PurchaseOrder, "id" | "updatedAt">[]) => Promise<PurchaseOrder[]>;
  onSubmitted?: (message: string) => void;
  onNavigateToHistory?: () => void;
}

export const SmartOrderCompare: React.FC<SmartOrderCompareProps> = ({
  currentBranch,
  suppliers,
  products,
  orders = [],
  orderDate,
  expectedReceivedDate,
  orderCreator,
  orderNotes: propOrderNotes,
  setOrderNotes: propSetOrderNotes,
  onCreateOrder,
  onCreateOrders,
  onSubmitted,
  onNavigateToHistory,
}) => {
  const isPorto = useMemo(() => isPortoChinoBranch(currentBranch), [currentBranch]);
  const masterCatalog = useMemo(
    () => buildMasterCatalog(products, currentBranch, suppliers),
    [products, currentBranch, suppliers],
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [localNotes, setLocalNotes] = useState("");

  const notes = propOrderNotes !== undefined ? propOrderNotes : localNotes;
  const setNotes = propSetOrderNotes || setLocalNotes;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Mode Selection: 'normal' (รอบมาตรฐาน - บังคับขั้นต่ำ) | 'urgent' (ผักด่วน - ไปพร้อมรถรอบปกติ ไม่บังคับขั้นต่ำ)
  const [orderMode, setOrderMode] = useState<"normal" | "urgent">("normal");

  // Modal for viewing & printing created POs
  const [createdOrdersForPrint, setCreatedOrdersForPrint] = useState<PurchaseOrder[] | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Find existing normal orders on the target expectedReceivedDate for this branch
  const normalOrdersOnTargetDate = useMemo(() => {
    if (!orders || !expectedReceivedDate) return [];
    return orders.filter((o) => {
      const matchBranch =
        o.branchId === currentBranch.id ||
        o.branchName === currentBranch.name ||
        (currentBranch.code && o.branchName.includes(currentBranch.code));
      const matchDate = o.expectedReceivedDate === expectedReceivedDate;
      const isNormal = !o.orderType || o.orderType === "normal";
      const isValidStatus = o.status !== "cancelled";
      return matchBranch && matchDate && isNormal && isValidStatus;
    });
  }, [orders, expectedReceivedDate, currentBranch]);

  // Suppliers that already have a truck delivering to this branch on expectedReceivedDate
  const availableSupplierIdsForUrgent = useMemo(() => {
    const sids = new Set<string>();
    normalOrdersOnTargetDate.forEach((o) => {
      if (o.supplierId) sids.add(o.supplierId);
    });
    return Array.from(sids);
  }, [normalOrdersOnTargetDate]);

  const hasNormalOrdersForTargetDate = availableSupplierIdsForUrgent.length > 0;

  // Available categories in master catalog
  const categories = useMemo(() => {
    const set = new Set<string>();
    masterCatalog.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set).sort();
  }, [masterCatalog]);

  const requested: RequestedQty[] = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([masterCode, quantity]) => ({ masterCode, quantity })),
    [quantities],
  );

  const allocation = useMemo(
    () =>
      optimizeAllocation(requested, masterCatalog, suppliers, {
        orderMode,
        availableSupplierIds: hasNormalOrdersForTargetDate ? availableSupplierIdsForUrgent : null,
      }),
    [
      requested,
      masterCatalog,
      suppliers,
      orderMode,
      hasNormalOrdersForTargetDate,
      availableSupplierIdsForUrgent,
    ],
  );

  const filteredCatalog = useMemo(() => {
    let list = masterCatalog;
    if (selectedCategory !== "all") {
      list = list.filter((m) => m.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          m.masterCode.toLowerCase().includes(q) ||
          m.options.some(
            (o) =>
              o.supplierName.toLowerCase().includes(q) || o.product.code.toLowerCase().includes(q),
          ),
      );
    }
    return list;
  }, [masterCatalog, selectedCategory, searchQuery]);

  const setQty = (masterCode: string, qty: number) => {
    setQuantities((prev) => {
      const next = { ...prev };
      const val = Math.max(0, qty);
      if (val === 0) {
        delete next[masterCode];
      } else {
        next[masterCode] = val;
      }
      return next;
    });
  };

  const addQty = (masterCode: string, delta: number) => {
    const curr = quantities[masterCode] || 0;
    setQty(masterCode, curr + delta);
  };

  const handleReset = () => {
    if (requested.length > 0 && !confirm("คุณต้องการล้างรายการสั่งซื้อทั้งหมดใช่หรือไม่?")) return;
    setQuantities({});
    setNotes("");
  };

  const hasItems = requested.length > 0;
  const totalItemCount = requested.reduce((sum, r) => sum + r.quantity, 0);

  // Submit Order and Split into POs
  const handleSubmit = async () => {
    if (!hasItems || isSubmitting) return;

    if (orderMode === "normal" && !allocation.allMinimumsMet) {
      toast.error(
        "ไม่สามารถยืนยันคำสั่งซื้อได้: เกลี่ยอัตโนมัติไม่สำเร็จ กรุณาเพิ่มสินค้าให้ครบยอดขั้นต่ำก่อน",
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const batchSeq = Date.now().toString(36).toUpperCase().slice(-5);
      const batchId = `BATCH-${batchSeq}`;
      const modeLabel = orderMode === "urgent" ? "สั่งด่วน (ผักด่วน)" : "สั่งปกติ";

      const confirmTime = new Date();
      const deliveryRound = calculateDeliveryRound({
        branch: currentBranch,
        orderType: orderMode,
        orderTimestamp: confirmTime,
      });

      const timeStr = `${String(confirmTime.getHours()).padStart(2, "0")}:${String(
        confirmTime.getMinutes(),
      ).padStart(2, "0")}`;

      const ordersPayload: Omit<PurchaseOrder, "id" | "updatedAt">[] = allocation.bySupplier.map(
        (group) => {
          const sup = suppliers.find((s) => s.id === group.supplierId);
          return {
            branchId: currentBranch.id,
            branchName: currentBranch.name,
            supplierId: group.supplierId,
            supplierName: group.supplierName,
            orderDate: deliveryRound.effectiveOrderDateIso,
            orderTime: timeStr,
            expectedReceivedDate: deliveryRound.expectedReceivedStartDateIso,
            orderType: orderMode,
            deliveryTerms: deliveryRound.displayText,
            items: group.items.map((it) => {
              const item: PurchaseOrderItem = {
                productId: it.productId,
                productCode: it.productCode,
                productName: it.productName,
                supplierId: it.supplierId,
                supplierName: it.supplierName,
                quantity: it.quantity,
                unit: it.unit,
                unitPrice: it.unitPrice,
                totalPrice: it.totalPrice,
                deliveryTerms: "",
              };
              if (it.isUnavoidableBelowMinimum) {
                item.notes =
                  "รายการนี้มีขายเจ้าเดียว ทำให้ยอดรวมซัพพลายเออร์นี้ไม่ถึงขั้นต่ำ — ฝ่ายจัดซื้อโปรดตรวจสอบ";
              }
              if (it.isLockedSupplierMismatchWarning) {
                item.notes =
                  "สินค้านี้ตั้งเป็น Locked Supplier แต่รอบปกติไม่มีรถของซัพพลายเออร์นี้มาส่ง — ฝ่ายจัดซื้อโปรดประสานงาน";
              }
              return item;
            }),
            totalAmount: group.subtotal,
            status: "pending",
            notes: notes ? notes.trim() : "",
            createdBy: orderCreator || currentBranch.manager || `ผู้จัดการ (${currentBranch.name})`,
            syncedToSheets: false,
          };
        },
      );

      let created: PurchaseOrder[] = [];
      if (onCreateOrders) {
        created = await onCreateOrders(ordersPayload);
      } else if (onCreateOrder) {
        for (const p of ordersPayload) {
          onCreateOrder(p);
        }
      }

      // Fallback created objects if not returned directly from callback
      if (!created || created.length === 0) {
        created = ordersPayload.map(
          (p, idx) =>
            ({
              ...p,
              id: `PO-${Date.now()}-${idx + 1}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }) as PurchaseOrder,
        );
      }

      // If urgent order mode was selected, dispatch Telegram alert notification
      if (orderMode === "urgent" && created.length > 0) {
        try {
          const res = await notifyTelegramForUrgentOrders({
            branchName: currentBranch.name,
            orderDate,
            createdBy: orderCreator || currentBranch.manager || `ผู้จัดการ (${currentBranch.name})`,
            orders: created,
          });
          if (res.success) {
            toast.info("⚡ ส่งข้อความแจ้งเตือนผักด่วนเข้า Telegram เรียบร้อยแล้ว");
          } else if (res.error) {
            console.warn("Telegram notification info:", res.error);
            toast.warning(`บันทึกคำสั่งซื้อสำเร็จ แต่ส่ง Telegram ไม่สำเร็จ: ${res.error}`);
          }
        } catch (tgErr) {
          console.error("Telegram trigger exception:", tgErr);
        }
      }

      // Success feedback
      const successMsg = `สร้างใบสั่งซื้อสำเร็จ ${ordersPayload.length} ฉบับ (${modeLabel}) ยอดรวม ฿${allocation.totalAmount.toLocaleString()}`;
      toast.success(successMsg);

      if (created.length > 0) {
        setCreatedOrdersForPrint(created);
        setIsPdfModalOpen(true);
      }

      setQuantities({});
      setNotes("");
      onSubmitted?.(successMsg);
    } catch (err) {
      console.error("Smart Compare Order Submission Error:", err);
      toast.error("เกิดข้อผิดพลาดในการสร้างใบสั่งซื้อ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Delivery Round Calculation Banner */}
      <DeliveryRoundBanner
        currentBranch={currentBranch}
        orderType={orderMode}
        onOrderTypeChange={setOrderMode}
        orderDate={orderDate}
      />

      {/* MODE TOGGLE: NORMAL ORDER VS. URGENT (VEGETABLE) ORDER */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              โหมดการสั่งซื้อผัก (Vegetable Order Mode: สั่งรอบปกติ vs ผักด่วน)
            </span>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>เลือกประเภทคำสั่งซื้อสำหรับรอบวันที่</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-mono text-sm font-bold">
                {formatDate(expectedReceivedDate || orderDate)}
              </span>
            </h3>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => setOrderMode("normal")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                orderMode === "normal"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>สั่งปกติ (รอบมาตรฐาน)</span>
            </button>

            <button
              type="button"
              onClick={() => setOrderMode("urgent")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                orderMode === "urgent"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>สั่งด่วน (ผักด่วน)</span>
            </button>
          </div>
        </div>

        {/* Dynamic Mode Context / Status Banner */}
        {orderMode === "urgent" ? (
          hasNormalOrdersForTargetDate ? (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-3.5 flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
              <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold">
                  เปิดโหมดสั่งด่วน (ผักด่วน) — สินค้าจะจัดส่งร่วมกับรถส่งผักรอบปกติของวันที่{" "}
                  {formatDate(expectedReceivedDate)} (ไม่บังคับยอดขั้นต่ำ)
                </p>
                <p className="text-amber-800 dark:text-amber-300 mt-1">
                  🚚 <b>ซัพพลายเออร์ที่มีรอบส่งปกติในวันดังกล่าว:</b>{" "}
                  {availableSupplierIdsForUrgent
                    .map((sid) => suppliers.find((s) => s.id === sid)?.name || sid)
                    .join(", ")}{" "}
                  ({availableSupplierIdsForUrgent.length} เจ้า)
                  {availableSupplierIdsForUrgent.length === 1
                    ? " -> รายการสินค้าทั้งหมดจะถูกส่งให้เจ้านี้เจ้าเดียว"
                    : " -> ระบบเลือกร้านที่ถูกที่สุดระหว่าง 2 เจ้าให้อัตโนมัติ"}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-100/80 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-2xl p-3.5 flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold">
                  ⚠️ ยังไม่พบคำสั่งซื้อรอบปกติสำหรับวันที่ {formatDate(expectedReceivedDate)}
                </p>
                <p className="text-amber-800 dark:text-amber-300 mt-0.5">
                  ระบบจะตรวจสอบและรวมยอดขั้นต่ำตามปกติแทน (
                  {isPorto
                    ? "ชินเซ็น ฿800, WFOOD ฿1,000, เซ็นทรัล ฿1,000"
                    : "ชินเซ็น ฿800, WFOOD ฿1,000"}
                  ) เพื่อป้องกันการสั่งของในวันที่ไม่มีรถมาส่งจริง
                </p>
              </div>
            </div>
          )
        ) : (
          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-3 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200">
            <span className="flex items-center gap-2 font-medium">
              <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              สั่งล่วงหน้าตามรอบปกติ — ระบบจะรวมยอดเพื่อผ่านขั้นต่ำ (
              {isPorto
                ? "ชินเซ็น ฿800 / WFOOD ฿1,000 / เซ็นทรัล ฿1,000"
                : "ชินเซ็น ฿800 / WFOOD ฿1,000"}
              ) พร้อมรักษารายการ Locked Supplier ให้ตรงตามที่กำหนด
            </span>
          </div>
        )}
      </div>

      {/* TOP 4 LIVE KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Amount */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-bold">ยอดสั่งซื้อรวม</span>
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            ฿{allocation.totalAmount.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              {requested.length} ชนิดสินค้า
            </span>{" "}
            ({totalItemCount} หน่วย)
          </p>
        </div>

        {/* Card 2: Selected Items */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-bold">สินค้าที่เลือก</span>
            <div className="p-1.5 bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 rounded-lg">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            {requested.length}{" "}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">รายการ</span>
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            จากทั้งหมด {masterCatalog.length} รายการในระบบ
          </p>
        </div>

        {/* Card 3: Allocated Suppliers */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-bold">ซัพพลายเออร์ที่จัดสรร</span>
            <div className="p-1.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-lg">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            {allocation.bySupplier.length}{" "}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">เจ้า</span>
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {allocation.bySupplier.length > 0
              ? allocation.bySupplier.map((s) => s.supplierName.split(" ")[0]).join(", ")
              : "ยังไม่ได้เลือกรายการ"}
          </p>
        </div>

        {/* Card 4: Minimum Order Status */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-bold">สถานะยอดขั้นต่ำ</span>
            <div
              className={`p-1.5 rounded-lg ${
                !hasItems
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  : allocation.allMinimumsMet
                    ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
              }`}
            >
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {!hasItems ? (
              <span className="text-sm font-bold text-slate-400">รอสั่งซื้อ</span>
            ) : orderMode === "urgent" && hasNormalOrdersForTargetDate ? (
              <span className="text-sm font-black text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Zap className="w-4 h-4 shrink-0 text-amber-500" /> ผักด่วน (ไม่จำกัดขั้นต่ำ)
              </span>
            ) : allocation.allMinimumsMet ? (
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> ผ่านขั้นต่ำทุกเจ้า
              </span>
            ) : (
              <span className="text-sm font-black text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 shrink-0" /> ไม่ถึงขั้นต่ำบางเจ้า
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {isPorto
              ? "ชินเซ็น ฿800 • WFOOD ฿1,000 • เซ็นทรัล ฿1,000"
              : "ชินเซ็น ฿800 • WFOOD ฿1,000"}
          </p>
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: PRODUCT COMPARISON LIST & QUANTITY ENTRY (7 cols) */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-4">
          {/* Search & Category Filter Header Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    เทียบราคาอัจฉริยะ (ผักสด)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {orderMode === "urgent"
                      ? "โหมดสั่งด่วน: จัดสรรไปยังซัพพลายเออร์ที่มีรถส่งในวันดังกล่าวโดยตรง"
                      : "กรอกจำนวนที่ต้องการ ระบบจะเลือกซัพพลายเออร์ที่ถูกที่สุดและรวมยอดขั้นต่ำให้อัตโนมัติ"}
                  </p>
                </div>
              </div>

              {hasItems && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors flex items-center gap-1 self-end sm:self-auto cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  ล้างค่าทั้งหมด
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อผัก, วัตถุดิบ, รหัสสินค้า, หรือซัพพลายเออร์..."
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  selectedCategory === "all"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                ทั้งหมด ({masterCatalog.length})
              </button>
              {categories.map((cat) => {
                const count = masterCatalog.filter((m) => m.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Items Comparison List */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs divide-y divide-slate-100 dark:divide-slate-800 max-h-[700px] overflow-y-auto">
            {filteredCatalog.length === 0 && (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-400" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {masterCatalog.length === 0
                    ? "ยังไม่มีข้อมูลแคตตาล็อกสินค้าในระบบ"
                    : "ไม่พบรายการวัตถุดิบที่ตรงกับคำค้นหา"}
                </p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  {masterCatalog.length === 0
                    ? "สามารถกดปุ่มด้านล่างเพื่อนำเข้าข้อมูลสินค้าหมวดผักจริง 116 รายการ และซัพพลายเออร์ (ชินเซ็น, WFOOD) เข้าสู่ Firestore ได้ทันที"
                    : "ลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่อื่น"}
                </p>

                {masterCatalog.length === 0 && (
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={async () => {
                      setIsSyncing(true);
                      try {
                        const res = await seedDatabaseAWithVegetablesAndSuppliers(true);
                        if (res.success) {
                          toast.success(res.message);
                        } else {
                          toast.error(res.message);
                        }
                      } catch {
                        toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
                      } finally {
                        setIsSyncing(false);
                      }
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                    <span>
                      {isSyncing
                        ? "กำลังนำเข้า 116 รายการ..."
                        : "นำเข้า/ซิงค์แคตตาล็อกผัก 116 รายการ"}
                    </span>
                  </button>
                )}
              </div>
            )}

            {filteredCatalog.map((m) => {
              const cheapest = m.options[0];
              const secondCheapest = m.options[1];
              const qty = quantities[m.masterCode] || 0;
              const hasMultiple = m.options.length > 1;
              const isLocked = Boolean(m.lockedSupplierId);
              const lockedSupplier = suppliers.find((s) => s.id === m.lockedSupplierId);

              // Calculate percentage diff if multiple suppliers available
              let savingPercent = 0;
              if (hasMultiple && secondCheapest && secondCheapest.product.price > 0) {
                savingPercent = Math.round(
                  ((secondCheapest.product.price - cheapest.product.price) /
                    secondCheapest.product.price) *
                    100,
                );
              }

              return (
                <div
                  key={m.masterCode}
                  className={`p-3.5 sm:p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    qty > 0
                      ? "bg-emerald-50/40 dark:bg-emerald-950/20"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  {/* Left: Product info and side-by-side supplier prices */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {m.masterCode}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300">
                        {m.category}
                      </span>
                      {isLocked && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Locked Supplier:{" "}
                          {lockedSupplier?.name || "ชินเซ็น"}
                        </span>
                      )}
                      {savingPercent > 0 && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 flex items-center gap-0.5">
                          <TrendingDown className="w-3 h-3" /> ประหยัด {savingPercent}%
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100">
                      {m.name}
                    </h4>

                    {/* Side-by-side Supplier Price Badges */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {m.options.map((o, optIdx) => {
                        const isBestPrice = optIdx === 0;
                        const isThisLocked = m.lockedSupplierId === o.supplierId;
                        return (
                          <div
                            key={o.supplierId}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all ${
                              isThisLocked
                                ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 shadow-2xs"
                                : isBestPrice
                                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-2xs"
                                  : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            <span>{o.supplierName}</span>
                            <span className="font-mono font-extrabold">
                              ฿{o.product.price}/{o.product.unit}
                            </span>
                            {isThisLocked ? (
                              <span className="bg-indigo-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black">
                                Locked Supplier
                              </span>
                            ) : isBestPrice ? (
                              <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black">
                                ถูกสุด
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: Quantity Stepper & Quick Add Buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {/* Quick increment buttons */}
                    <div className="hidden sm:flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => addQty(m.masterCode, 5)}
                        className="px-2 py-1 text-[10px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                        title="เพิ่ม 5 หน่วย"
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        onClick={() => addQty(m.masterCode, 10)}
                        className="px-2 py-1 text-[10px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                        title="เพิ่ม 10 หน่วย"
                      >
                        +10
                      </button>
                    </div>

                    {/* Numeric Stepper */}
                    <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => addQty(m.masterCode, -1)}
                        disabled={qty <= 0}
                        className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <input
                        type="number"
                        min={0}
                        value={qty || ""}
                        onChange={(e) => setQty(m.masterCode, Number(e.target.value))}
                        placeholder="0"
                        className="w-16 text-center text-xs font-black text-slate-900 dark:text-slate-100 bg-transparent focus:outline-hidden"
                      />

                      <button
                        type="button"
                        onClick={() => addQty(m.masterCode, 1)}
                        className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: SMART ALLOCATION BREAKDOWN & CONFIRMATION (5 cols) */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5 sticky top-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2.5 rounded-2xl ${
                    orderMode === "urgent"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {orderMode === "urgent" ? (
                    <Zap className="w-5 h-5" />
                  ) : (
                    <ShoppingBag className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                    สรุปการจัดสรรสั่งซื้อ
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {orderMode === "urgent"
                      ? "โหมดสั่งด่วน (ผักด่วน) — แยก PO อัตโนมัติ"
                      : "ระบบแยกใบ PO ตามซัพพลายเออร์อัตโนมัติ"}
                  </p>
                </div>
              </div>
              <span className="text-xs font-extrabold px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {currentBranch.code}
              </span>
            </div>

            {!hasItems ? (
              <div className="py-14 text-center text-slate-400 dark:text-slate-500 space-y-3">
                <Scale className="w-12 h-12 mx-auto opacity-30 text-slate-400" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  ยังไม่มีรายการที่เลือก
                </p>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                  กรอกจำนวนสินค้าที่ต้องการในตารางด้านซ้าย
                  ระบบจะคำนวณราคาที่คุ้มค่าที่สุดและแยกใบสั่งซื้อให้อัตโนมัติ
                </p>
              </div>
            ) : (
              <>
                {/* Transparent Auto-Adjustments Box (เมื่อมีการเกลี่ยสินค้าอัตโนมัติ) */}
                {orderMode === "normal" &&
                  allocation.autoAdjustments &&
                  allocation.autoAdjustments.length > 0 && (
                    <div className="rounded-2xl p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ArrowRightLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <h4 className="text-xs sm:text-sm font-black text-indigo-950 dark:text-indigo-200">
                            ระบบเกลี่ยอัตโนมัติ (Auto-Balanced)
                          </h4>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                          ปรับ {allocation.autoAdjustments.length} รายการ
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-800/90 dark:text-indigo-300 font-medium">
                        ระบบย้ายรายการสินค้าเพื่อช่วยให้ครบยอดสั่งซื้อขั้นต่ำ และรักษาเงื่อนไข
                        Locked Supplier:
                      </p>
                      <div className="space-y-1.5 pt-1 max-h-48 overflow-y-auto pr-1">
                        {allocation.autoAdjustments.map((adj, idx) => (
                          <div
                            key={`${adj.masterCode}-${idx}`}
                            className="text-[11px] p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/60 border border-indigo-100 dark:border-indigo-900/40 text-slate-700 dark:text-slate-300 flex items-start justify-between gap-2"
                          >
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-900 dark:text-slate-100">
                                ย้าย{" "}
                                <span className="text-indigo-600 dark:text-indigo-400 font-black">
                                  {adj.productName}
                                </span>{" "}
                                ({adj.quantity} {adj.unit})
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <span>{adj.fromSupplierName}</span>
                                <span className="text-indigo-500 font-bold">➔</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                  {adj.toSupplierName}
                                </span>
                                <span>(เพื่อให้ {adj.targetSupplierName} ครบขั้นต่ำ)</span>
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                  adj.costDiff > 0
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                    : adj.costDiff < 0
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                }`}
                              >
                                {adj.costDiff > 0
                                  ? `+฿${adj.costDiff.toLocaleString()}`
                                  : adj.costDiff < 0
                                    ? `-฿${Math.abs(adj.costDiff).toLocaleString()}`
                                    : "ราคาเท่าเดิม"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Allocation List by Supplier */}
                <div className="space-y-4">
                  {allocation.bySupplier.map((g) => {
                    const minAmount = g.minOrderAmount || 0;
                    const percent =
                      minAmount > 0 ? Math.min(100, (g.subtotal / minAmount) * 100) : 100;
                    const remaining = minAmount - g.subtotal;

                    return (
                      <div
                        key={g.supplierId}
                        className={`rounded-2xl p-4 sm:p-5 border-2 transition-all ${
                          orderMode === "urgent"
                            ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/60"
                            : g.meetsMinimum
                              ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
                              : "bg-amber-50/80 dark:bg-amber-950/25 border-amber-300 dark:border-amber-700/60"
                        }`}
                      >
                        {/* Supplier Top info */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <Building2
                                className={`w-4 h-4 ${
                                  orderMode === "urgent"
                                    ? "text-amber-600"
                                    : g.meetsMinimum
                                      ? "text-emerald-600"
                                      : "text-amber-600"
                                }`}
                              />
                              <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                                {g.supplierName}
                              </h4>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
                              {g.items.length} รายการ
                              {orderMode === "urgent" ? (
                                <span className="text-amber-700 dark:text-amber-400 font-bold ml-1">
                                  • สั่งด่วน (ไปกับรถรอบปกติ)
                                </span>
                              ) : (
                                ` · ขั้นต่ำ ฿${minAmount.toLocaleString()}`
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <span
                              className={`text-xl sm:text-2xl font-black ${
                                orderMode === "urgent"
                                  ? "text-amber-700 dark:text-amber-400"
                                  : g.meetsMinimum
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : "text-amber-700 dark:text-amber-400"
                              }`}
                            >
                              ฿{g.subtotal.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Minimum Status Badge & Progress Bar for Normal Mode */}
                        {orderMode === "normal" && minAmount > 0 && (
                          <div className="mt-3 space-y-1.5">
                            <div className="w-full h-2 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  g.meetsMinimum ? "bg-emerald-600" : "bg-amber-500"
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs pt-0.5">
                              {g.meetsMinimum ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 font-extrabold text-[11px]">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />{" "}
                                  ผ่านเกณฑ์ขั้นต่ำแล้ว
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-extrabold text-[11px]">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> ขาดอีก ฿
                                  {remaining.toLocaleString()} จะถึงขั้นต่ำ
                                </span>
                              )}
                              <span className="font-extrabold text-slate-600 dark:text-slate-400">
                                {Math.round(percent)}%
                              </span>
                            </div>

                            {g.isExclusiveBelowMinimumWarning && (
                              <div className="mt-2 p-2 bg-amber-100/90 dark:bg-amber-900/30 rounded-xl border border-amber-200 dark:border-amber-700/50 text-amber-900 dark:text-amber-200 text-[11px] font-bold flex items-start gap-1.5">
                                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                                <span>
                                  มีรายการที่ขายเฉพาะเจ้านี้ ยอดรวมจึงยังไม่ถึงขั้นต่ำ
                                  (ติดธงให้ฝ่ายจัดซื้อตรวจสอบพิเศษ)
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Items Preview in this PO */}
                        <div className="mt-3.5 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {g.items.map((it) => (
                            <div
                              key={it.productId}
                              className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300"
                            >
                              <span className="truncate pr-2 font-medium flex items-center gap-1">
                                {it.isLockedSupplierItem && (
                                  <Lock className="w-3 h-3 text-indigo-600 shrink-0" />
                                )}
                                <span>{it.productName}</span>
                              </span>
                              <span className="font-mono text-slate-600 dark:text-slate-400 shrink-0 font-bold">
                                {it.quantity} {it.unit} = ฿{it.totalPrice.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Grand Total Summary Box */}
                <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>ประเภทคำสั่งซื้อ:</span>
                    <span
                      className={`font-bold ${
                        orderMode === "urgent"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {orderMode === "urgent"
                        ? "⚡ สั่งด่วน (ผักด่วน)"
                        : "🚚 สั่งปกติ (รอบมาตรฐาน)"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>จำนวนใบสั่งซื้อที่จะสร้าง:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {allocation.bySupplier.length} ฉบับ
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>สถานะเริ่มต้น:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      รอดำเนินการ (Pending)
                    </span>
                  </div>
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-baseline justify-between">
                    <div>
                      <span className="text-xs sm:text-sm font-extrabold text-slate-700 dark:text-slate-300 block">
                        ยอดรวมทั้งสิ้น
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        (รวมทุกใบสั่งซื้อ)
                      </span>
                    </div>
                    <span
                      className={`text-3xl sm:text-4xl font-black tracking-tight ${
                        orderMode === "urgent"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      ฿{allocation.totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Additional Notes with Clear Bold PO Indication */}
                <div className="space-y-1.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                  <label className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>หมายเหตุใบสั่งซื้อ (แสดงตัวหนาในใบ PO ทั้งหมด):</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      orderMode === "urgent"
                        ? "เช่น ผักด่วน ส่งช่วงเช้าก่อน 10.00 น., คัดสวยพิเศษ (ข้อความจะขึ้นตัวหนาในใบ PO)"
                        : "เช่น ส่งช่วงเช้าก่อน 10.00 น., ขอผักคัดสดใหม่, เข้าส่งประตูหลัง (ข้อความจะขึ้นตัวหนาในใบ PO)"
                    }
                    rows={2}
                    className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>

                {/* Action Buttons & Minimum Order Blocking Banner */}
                <div className="space-y-3 pt-1">
                  {/* Warning: Auto-Balance Failed / Minimum Order Deficit Banner */}
                  {orderMode === "normal" && !allocation.allMinimumsMet && (
                    <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800/80 text-xs space-y-2.5">
                      <div className="flex items-center gap-2 font-black text-rose-800 dark:text-rose-200">
                        <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
                        <span>⚠️ เกลี่ยอัตโนมัติไม่สำเร็จ เพิ่มสินค้าให้ถึงยอดขั้นต่ำ</span>
                      </div>
                      <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
                        ระบบพยายามเกลี่ยและรวมยอดแล้ว
                        แต่ยังมีซัพพลายเออร์ที่ยอดสั่งซื้อไม่ถึงขั้นต่ำ:
                      </p>
                      <div className="space-y-1.5 pl-2">
                        {allocation.bySupplier
                          .filter((g) => !g.meetsMinimum)
                          .map((g) => {
                            const deficit = g.deficit ?? Math.max(0, g.minOrderAmount - g.subtotal);
                            return (
                              <div
                                key={g.supplierId}
                                className="p-2 rounded-xl bg-white/90 dark:bg-slate-900/60 border border-rose-200 dark:border-rose-900/50 text-[11px] text-rose-900 dark:text-rose-200"
                              >
                                • <b className="font-bold">{g.supplierName}</b>: ยอดสั่งซื้อ ฿
                                {g.subtotal.toLocaleString()} ยังขาดอีก{" "}
                                <span className="font-black text-rose-600 dark:text-rose-400 text-xs">
                                  ฿{deficit.toLocaleString()}
                                </span>{" "}
                                (ขั้นต่ำ ฿{g.minOrderAmount.toLocaleString()})
                              </div>
                            );
                          })}
                      </div>
                      <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold italic pt-0.5">
                        * ปุ่มยืนยันคำสั่งซื้อถูกปิดใช้งาน (Disabled)
                        จนกว่าจะเพิ่มสินค้าจนครบขั้นต่ำทุกซัพพลายเออร์
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={
                      isSubmitting ||
                      !hasItems ||
                      (orderMode === "normal" && !allocation.allMinimumsMet)
                    }
                    onClick={handleSubmit}
                    className={`w-full flex items-center justify-center gap-2.5 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm sm:text-base font-black py-4 px-6 rounded-2xl shadow-md transition-all cursor-pointer ${
                      orderMode === "urgent"
                        ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                        : !allocation.allMinimumsMet
                          ? "bg-slate-400 dark:bg-slate-700 shadow-none cursor-not-allowed"
                          : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>กำลังบันทึกใบสั่งซื้อ...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        <span>
                          {orderMode === "urgent"
                            ? "⚡ ยืนยันสั่งผักด่วน"
                            : !allocation.allMinimumsMet
                              ? "ยอดไม่ถึงขั้นต่ำ (ไม่สามารถสั่งได้)"
                              : "ยืนยันสั่งซื้อ"}{" "}
                          ({allocation.bySupplier.length} ใบสั่งซื้อ)
                        </span>
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />{" "}
                    {orderMode === "urgent"
                      ? "สร้างใบสั่งซื้อผักด่วน พร้อมส่งการแจ้งเตือน Telegram อัตโนมัติ"
                      : "ระบบเกลี่ยอัตโนมัติและแยกใบสั่งซื้อตามเงื่อนไขซัพพลายเออร์"}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: PRINT & PREVIEW GENERATED POs */}
      {isPdfModalOpen && createdOrdersForPrint && (
        <PdfExportModal
          isOpen={isPdfModalOpen}
          onClose={() => {
            setIsPdfModalOpen(false);
            onNavigateToHistory?.();
          }}
          orders={createdOrdersForPrint}
          branch={currentBranch}
          batchTitle={`สร้างจากระบบเทียบราคาอัจฉริยะ (ผักสด) (${createdOrdersForPrint.length} ใบสั่งซื้อ)`}
        />
      )}
    </div>
  );
};
