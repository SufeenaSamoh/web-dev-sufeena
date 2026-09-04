import React, { useState, useMemo } from "react";
import type {
  PurchaseBranch,
  PurchaseSupplier,
  PurchaseProduct,
  PurchaseOrder,
  PurchaseOrderItem,
} from "./types";
import { useStore } from "@/lib/store";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { SearchableSupplierSelector } from "@/components/SearchableSupplierSelector";
import { isSupplierAllowedForBranch } from "@/lib/allocationOptimizer";
import {
  validateCartPolicies,
  findItemMinQtyRule,
  findSupplierPolicyRule,
  getSupplierMinOrderAmount,
  calculateExpectedDeliveryDate,
} from "./supplierPolicyRules";
import { SupplierPolicyHeroCard } from "./SupplierPolicyHeroCard";
import { calculateDeliveryRound, DeliveryRoundResult } from "./deliveryRoundRules";
import { DeliveryRoundBanner } from "./DeliveryRoundBanner";
import { DeliveryRoundConfigCard } from "./DeliveryRoundConfigCard";
import {
  Search,
  ShoppingCart,
  DollarSign,
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Minus,
  Trash2,
  FileText,
  Send,
  Calendar,
  Building2,
  Clock,
  Sparkles,
  Info,
  Layers,
  ChevronRight,
  Printer,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { PdfExportModal } from "./PdfExportModal";

interface BranchOrderViewProps {
  currentBranch: PurchaseBranch;
  suppliers: PurchaseSupplier[];
  products: PurchaseProduct[];
  orderDate: string;
  setOrderDate: (date: string) => void;
  expectedReceivedDate: string;
  setExpectedReceivedDate: (date: string) => void;
  orderCreator: string;
  setOrderCreator: (creator: string) => void;
  orderNotes: string;
  setOrderNotes: (notes: string) => void;
  onCreateOrders: (orders: Omit<PurchaseOrder, "id" | "updatedAt">[]) => Promise<PurchaseOrder[]>;
}

interface CartItemState {
  quantity: number;
  notes?: string;
}

export const BranchOrderView: React.FC<BranchOrderViewProps> = ({
  currentBranch,
  suppliers,
  products,
  orderDate,
  setOrderDate,
  expectedReceivedDate,
  setExpectedReceivedDate,
  orderCreator,
  setOrderCreator,
  orderNotes,
  setOrderNotes,
  onCreateOrders,
}) => {
  const { currentStock, items: dbBItems } = useStore();

  // General Raw Materials ordering operates exclusively on the standard branch delivery round
  const orderType: "normal" | "urgent" = "normal";
  const [cart, setCart] = useState<Record<string, CartItemState>>({});
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [showOnlySelected, setShowOnlySelected] = useState<boolean>(false);

  // Export Modal state
  const [previewOrders, setPreviewOrders] = useState<PurchaseOrder[] | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Scoped suppliers and products for this branch
  const branchSuppliers = useMemo(() => {
    return suppliers.filter((s) => isSupplierAllowedForBranch(s, currentBranch));
  }, [suppliers, currentBranch]);

  const branchProducts = useMemo(() => {
    const allowedSupIds = new Set(branchSuppliers.map((s) => s.id));
    return products.filter((p) => allowedSupIds.has(p.supplierId));
  }, [products, branchSuppliers]);

  // Extract unique categories from active products
  const categories = useMemo(() => {
    const set = new Set<string>();
    branchProducts.forEach((p) => {
      if (p.category && p.isActive !== false) {
        set.add(p.category);
      }
    });
    return Array.from(set);
  }, [branchProducts]);

  // Handle Cart Quantity updates
  const handleUpdateQty = (productId: string, newQty: number) => {
    const validQty = Math.max(0, newQty);
    setCart((prev) => {
      const next = { ...prev };
      if (validQty === 0) {
        delete next[productId];
      } else {
        next[productId] = {
          ...(next[productId] || {}),
          quantity: validQty,
        };
      }
      return next;
    });
  };

  const handleUpdateItemNotes = (productId: string, notes: string) => {
    setCart((prev) => {
      if (!prev[productId]) return prev;
      return {
        ...prev,
        [productId]: {
          ...prev[productId],
          notes,
        },
      };
    });
  };

  const handleQuickAdd = (productId: string, delta: number) => {
    const current = cart[productId]?.quantity || 0;
    handleUpdateQty(productId, current + delta);
  };

  const handleSetMinQty = (productId: string, minQty: number) => {
    handleUpdateQty(productId, minQty);
    toast.success(`ปรับจำนวนสินค้าเป็นขั้นต่ำ (${minQty}) เรียบร้อย`);
  };

  const handleClearCart = () => {
    if (Object.keys(cart).length === 0) return;
    if (confirm("คุณต้องการล้างรายการที่เลือกทั้งหมดใช่หรือไม่?")) {
      setCart({});
      toast.info("ล้างรายการสั่งซื้อเรียบร้อยแล้ว");
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return branchProducts.filter((p) => {
      if (p.isActive === false) return false;

      // Filter by Supplier
      if (selectedSupplierFilter !== "all" && p.supplierId !== selectedSupplierFilter) {
        return false;
      }

      // Filter by Category
      if (selectedCategoryFilter !== "all" && p.category !== selectedCategoryFilter) {
        return false;
      }

      // Filter by Selected only
      if (showOnlySelected && (!cart[p.id] || cart[p.id].quantity <= 0)) {
        return false;
      }

      // Search Query
      if (!query) return true;
      return (
        p.name.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query) ||
        p.supplierName.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
      );
    });
  }, [
    branchProducts,
    selectedSupplierFilter,
    selectedCategoryFilter,
    showOnlySelected,
    searchQuery,
    cart,
  ]);

  // Selected Cart Items mapped with full product data
  const selectedCartItems = useMemo(() => {
    return Object.entries(cart)
      .filter(([, state]) => state.quantity > 0)
      .map(([productId, state]) => {
        const product = products.find((p) => p.id === productId);
        return {
          product,
          quantity: state.quantity,
          notes: state.notes || "",
          subtotal: (product?.price || 0) * state.quantity,
        };
      })
      .filter((item): item is typeof item & { product: PurchaseProduct } => Boolean(item.product));
  }, [cart, products]);

  // Policy Validation Engine (Type A Supplier Min Amount & Type B Item Min Qty & Delivery schedules)
  const cartValidationResult = useMemo(() => {
    return validateCartPolicies(selectedCartItems, suppliers, orderDate, currentBranch.id);
  }, [selectedCartItems, suppliers, orderDate, currentBranch.id]);

  // Supplier Groups derived from validation engine
  const supplierGroups = cartValidationResult.supplierSummaries;

  // Selected Supplier details for Hero Card
  const selectedSupplierObj = useMemo(() => {
    if (selectedSupplierFilter === "all") return null;
    return branchSuppliers.find((s) => s.id === selectedSupplierFilter) || null;
  }, [selectedSupplierFilter, branchSuppliers]);

  const selectedSupplierCartSummary = useMemo(() => {
    if (!selectedSupplierObj) return undefined;
    return supplierGroups.find((g) => g.supplierId === selectedSupplierObj.id);
  }, [selectedSupplierObj, supplierGroups]);

  const selectedSupplierProductsCount = useMemo(() => {
    if (!selectedSupplierObj) return 0;
    return branchProducts.filter(
      (p) => p.supplierId === selectedSupplierObj.id && p.isActive !== false,
    ).length;
  }, [selectedSupplierObj, branchProducts]);

  // KPI Calculations
  const totalCartAmount = useMemo(
    () => selectedCartItems.reduce((sum, i) => sum + i.subtotal, 0),
    [selectedCartItems],
  );
  const totalCartItemsCount = selectedCartItems.length;
  const totalCartUnits = selectedCartItems.reduce((sum, i) => sum + i.quantity, 0);
  const suppliersInvolvedCount = supplierGroups.length;
  const allSuppliersMeetMinimum = cartValidationResult.isValid;

  // Generate Purchase Orders object payloads
  const prepareOrdersPayload = (confirmTime?: Date): Omit<PurchaseOrder, "id" | "updatedAt">[] => {
    const timestamp = confirmTime || new Date();
    const deliveryRound = calculateDeliveryRound({
      branch: currentBranch,
      orderType,
      orderTimestamp: timestamp,
    });

    const timeStr = `${String(timestamp.getHours()).padStart(2, "0")}:${String(
      timestamp.getMinutes(),
    ).padStart(2, "0")}`;

    return supplierGroups.map((group) => {
      const itemsPayload: PurchaseOrderItem[] = group.items.map((cartItem) => {
        const itemRule = findItemMinQtyRule(cartItem.product.code, cartItem.product.supplierName);
        return {
          productId: cartItem.product.id,
          productCode: cartItem.product.code,
          productName: cartItem.product.name,
          supplierId: cartItem.product.supplierId,
          supplierName: cartItem.product.supplierName,
          quantity: cartItem.quantity,
          unit: cartItem.product.unit,
          unitPrice: cartItem.product.price,
          totalPrice: cartItem.subtotal,
          deliveryTerms:
            itemRule?.schedulePattern ||
            deliveryRound.displayText ||
            group.supplier?.branchDeliveryTerms?.[currentBranch.id] ||
            cartItem.product.deliveryTerms ||
            group.supplier?.deliveryTerms ||
            "",
          notes: cartItem.notes || "",
        };
      });

      return {
        branchId: currentBranch.id,
        branchName: currentBranch.name,
        supplierId: group.supplierId,
        supplierName: group.supplierName,
        orderDate: deliveryRound.effectiveOrderDateIso,
        orderTime: timeStr,
        expectedReceivedDate: deliveryRound.expectedReceivedStartDateIso,
        deliveryTerms: deliveryRound.displayText,
        orderType: orderType,
        items: itemsPayload,
        totalAmount: group.totalAmount,
        status: "pending",
        notes: orderNotes.trim() || "",
        createdBy:
          orderCreator.trim() || currentBranch.manager || `ผู้จัดการ (${currentBranch.name})`,
        syncedToSheets: false,
      };
    });
  };

  // Preview before submit
  const handlePreviewOrders = () => {
    if (selectedCartItems.length === 0) {
      toast.error("กรุณาระบุจำนวนสินค้าที่ต้องการสั่งซื้ออย่างน้อย 1 รายการ");
      return;
    }
    const payloads = prepareOrdersPayload(new Date());
    const tempOrders: PurchaseOrder[] = payloads.map((p, idx) => ({
      ...p,
      id: `PO-${currentBranch.code}-${(p.orderDate || orderDate).replace(/-/g, "").slice(2)}-${String(idx + 1).padStart(3, "0")}`,
      updatedAt: new Date().toISOString(),
    }));
    setPreviewOrders(tempOrders);
    setIsPdfModalOpen(true);
  };

  // Submit and create Orders
  const handleSubmitOrders = async () => {
    if (selectedCartItems.length === 0) {
      toast.error("กรุณาระบุจำนวนสินค้าที่ต้องการสั่งซื้ออย่างน้อย 1 รายการ");
      return;
    }

    if (!cartValidationResult.isValid) {
      const totalViolations =
        cartValidationResult.itemViolations.length + cartValidationResult.supplierViolations.length;
      toast.error(
        `ไม่สามารถส่งคำสั่งซื้อได้: มีเงื่อนไขขั้นต่ำที่ไม่ผ่านเกณฑ์ ${totalViolations} จุด กรุณาตรวจสอบและปรับปรุงรายการ`,
        { duration: 5000 },
      );
      return;
    }

    try {
      setIsSubmitting(true);
      // Use exact confirmation timestamp
      const confirmationTimestamp = new Date();
      const payloads = prepareOrdersPayload(confirmationTimestamp);
      const created = await onCreateOrders(payloads);

      const roundInfo = calculateDeliveryRound({
        branch: currentBranch,
        orderType,
        orderTimestamp: confirmationTimestamp,
      });

      toast.success(
        `สร้างใบสั่งซื้อสำเร็จ ${created.length} ใบ (ยอดรวม ฿${totalCartAmount.toLocaleString()}) • ${roundInfo.displayText}`,
        { duration: 6000 },
      );

      // Open PDF modal for direct printing
      setPreviewOrders(created);
      setIsPdfModalOpen(true);

      // Clear cart
      setCart({});
    } catch (err: unknown) {
      console.error("Submit order error:", err);
      toast.error("เกิดข้อผิดพลาดในการสร้างใบสั่งซื้อ");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Interactive Delivery Round Banner (General Raw Materials: Normal Round Only) */}
      <DeliveryRoundBanner
        currentBranch={currentBranch}
        orderType={orderType}
        showTabs={false}
        orderDate={orderDate}
      />
      {/* Top Branch Header & Order Settings */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Branch Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 font-extrabold text-xs rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {currentBranch.code || "BR-01"}
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {currentBranch.name}
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              สถานที่: {currentBranch.location || "ตามที่ระบุในระบบ"} • ผู้จัดการ:{" "}
              {currentBranch.manager || "ผู้จัดการสาขา"} • โทร: {currentBranch.phone || "-"}
            </p>
          </div>

          {/* Quick Date, Creator & Order Notes Inputs */}
          <div className="flex flex-col gap-3 bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" /> วันที่สั่งซื้อ:
                </label>
                <ThaiDatePicker
                  value={orderDate}
                  onChange={setOrderDate}
                  className="bg-slate-900 border-slate-700 text-white hover:border-slate-500 font-bold text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" /> กำหนดรับสินค้า:
                </label>
                <ThaiDatePicker
                  value={expectedReceivedDate}
                  onChange={setExpectedReceivedDate}
                  className="bg-slate-900 border-slate-700 text-white hover:border-slate-500 font-bold text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1 flex items-center gap-1">
                  <span>ผู้ทำรายการ:</span>
                </label>
                <input
                  type="text"
                  value={orderCreator}
                  onChange={(e) => setOrderCreator(e.target.value)}
                  placeholder="ชื่อผู้สั่งซื้อ"
                  className="w-full p-2 bg-slate-900 border border-slate-700 text-white rounded-xl font-bold text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Prominent Notes / Remarks Field */}
            <div className="pt-2 border-t border-slate-700/70">
              <label className="text-[11px] font-extrabold text-amber-300 block mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>หมายเหตุใบสั่งซื้อ (PO Remarks - แสดงตัวหนาในใบ PO):</span>
              </label>
              <input
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="เช่น ส่งของช่วงเช้าก่อน 10.00 น., ผักสดคัดเกรด A เท่านั้น, เข้าส่งประตูหลังร้าน"
                className="w-full p-2 bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 rounded-xl font-semibold text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4 Summary KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Amount */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              ยอดสั่งซื้อรอบนี้
            </span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
            ฿{totalCartAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400">คำนวณราคาตามซัพพลายเออร์อัตโนมัติ</p>
        </div>

        {/* Card 2: Items Count */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              รายการที่เลือก
            </span>
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            {totalCartItemsCount} <span className="text-xs font-normal text-slate-400">รายการ</span>
          </p>
          <p className="text-[11px] text-slate-400">รวมทั้งหมด {totalCartUnits} หน่วย</p>
        </div>

        {/* Card 3: Suppliers Count */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              ซัพพลายเออร์ที่สั่ง
            </span>
            <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            {suppliersInvolvedCount}{" "}
            <span className="text-xs font-normal text-slate-400">เจ้า</span>
          </p>
          <p className="text-[11px] text-slate-400">
            {suppliersInvolvedCount > 0
              ? `แยกออกเป็น ${suppliersInvolvedCount} ใบสั่งซื้อ`
              : "ยังไม่มีรายการ"}
          </p>
        </div>

        {/* Card 4: Minimum Order Compliance */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              ตรวจสอบเงื่อนไขขั้นต่ำ
            </span>
            <div
              className={`p-2 rounded-xl ${
                supplierGroups.length === 0
                  ? "bg-slate-100 text-slate-400 dark:bg-slate-800"
                  : cartValidationResult.isValid
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-amber-500/10 text-amber-600"
              }`}
            >
              {supplierGroups.length === 0 ? (
                <Info className="w-4 h-4" />
              ) : cartValidationResult.isValid ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
            </div>
          </div>
          <p
            className={`text-base sm:text-lg font-black ${
              supplierGroups.length === 0
                ? "text-slate-500"
                : cartValidationResult.isValid
                  ? "text-emerald-600"
                  : "text-amber-600"
            }`}
          >
            {supplierGroups.length === 0
              ? "พร้อมเลือกสินค้า"
              : cartValidationResult.isValid
                ? "ผ่านเกณฑ์ขั้นต่ำครบถ้วน"
                : `ติดเงื่อนไข ${cartValidationResult.itemViolations.length + cartValidationResult.supplierViolations.length} จุด`}
          </p>
          <p className="text-[11px] text-slate-400">
            {supplierGroups.length === 0
              ? "คำนวณขั้นต่ำซัพฯ และรายสินค้า"
              : cartValidationResult.isValid
                ? "พร้อมกดยืนยันคำสั่งซื้อ"
                : `ซัพฯ ขาด ${cartValidationResult.supplierViolations.length} / สินค้าขาด ${cartValidationResult.itemViolations.length}`}
          </p>
        </div>
      </div>

      {/* Prominent Policy Alert Banner (When minimums are not met) */}
      {selectedCartItems.length > 0 && !cartValidationResult.isValid && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-rose-500/10 border-2 border-amber-400/80 dark:border-amber-500/60 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-2xl shrink-0 shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-black text-amber-950 dark:text-amber-200 flex items-center gap-2">
                <span>มีรายการสั่งซื้อที่ยังไม่ถึงเกณฑ์ขั้นต่ำ (ไม่สามารถกดยืนยันสั่งซื้อได้)</span>
                <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 text-[10px] font-black rounded-full">
                  ขาดอีก{" "}
                  {cartValidationResult.supplierViolations.length +
                    cartValidationResult.itemViolations.length}{" "}
                  เงื่อนไข
                </span>
              </h4>
              <p className="text-xs text-amber-800/90 dark:text-amber-300 mt-0.5">
                กรุณาตรวจสอบและปรับจำนวนสั่งซื้อให้ตรงตามนโยบายของซัพพลายเออร์ก่อนส่งใบสั่งซื้อ
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
            {/* Section A: Supplier Minimum Violations */}
            {cartValidationResult.supplierViolations.length > 0 && (
              <div className="bg-white/90 dark:bg-slate-900/90 rounded-2xl p-3.5 border border-amber-300 dark:border-amber-800/80 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-600" />
                    (ก) ซัพพลายเออร์ที่ยอดรวมยังไม่ถึงขั้นต่ำ (
                    {cartValidationResult.supplierViolations.length} เจ้า)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {cartValidationResult.supplierViolations.map((v) => (
                    <div
                      key={v.supplierId}
                      className="flex items-center justify-between text-xs p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50"
                    >
                      <div className="min-w-0">
                        <p className="font-extrabold text-slate-900 dark:text-slate-100 truncate">
                          {v.supplierName}
                        </p>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                          ยอดปัจจุบัน ฿{(v.currentTotal ?? v.currentAmount ?? 0).toLocaleString()} /
                          ขั้นต่ำ ฿{(v.minOrderAmount ?? 0).toLocaleString()}
                        </p>
                      </div>
                      <span className="text-xs font-black text-rose-600 dark:text-rose-400 shrink-0 ml-2">
                        ขาดอีก ฿{(v.deficitAmount ?? v.difference ?? 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section B: Item Minimum Quantity Violations */}
            {cartValidationResult.itemViolations.length > 0 && (
              <div className="bg-white/90 dark:bg-slate-900/90 rounded-2xl p-3.5 border border-amber-300 dark:border-amber-800/80 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-amber-600" />
                    (ข) สินค้าที่จำนวนยังไม่ถึงขั้นต่ำ ({
                      cartValidationResult.itemViolations.length
                    }{" "}
                    รายการ)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {cartValidationResult.itemViolations.map((v) => (
                    <div
                      key={v.productId}
                      className="flex items-center justify-between text-xs p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-slate-900 dark:text-slate-100 truncate">
                          {v.productName}{" "}
                          <span className="font-mono text-[10px] text-slate-500">
                            ({v.productCode})
                          </span>
                        </p>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                          สั่งอยู่ <strong>{v.currentQty}</strong> {v.unit} / ขั้นต่ำ{" "}
                          <strong>{v.minQty}</strong> {v.unit} (ซัพฯ: {v.supplierName})
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSetMinQty(v.productId, v.minQty)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] rounded-lg shadow-2xs transition-all shrink-0 flex items-center gap-1 cursor-pointer"
                      >
                        <span>
                          ปรับเป็น {v.minQty} {v.unit}
                        </span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Supplier Minimum Order Breakdown Cards */}
      {supplierGroups.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-emerald-600" />
              สรุปยอดสั่งซื้อแยกตามซัพพลายเออร์ ({supplierGroups.length} เจ้า)
            </h4>
            <span className="text-[11px] text-slate-400">
              *คลิกที่การ์ดเพื่อดูเงื่อนไขขั้นต่ำและรายการสินค้าของเจ้านั้น
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {supplierGroups.map((grp) => {
              const percentage =
                grp.minOrderAmount > 0
                  ? Math.min(100, Math.round((grp.totalAmount / grp.minOrderAmount) * 100))
                  : 100;

              const hasItemViolations = grp.itemViolations && grp.itemViolations.length > 0;
              const isCardSelected = selectedSupplierFilter === grp.supplierId;

              return (
                <div
                  key={grp.supplierId}
                  onClick={() => setSelectedSupplierFilter(isCardSelected ? "all" : grp.supplierId)}
                  role="button"
                  tabIndex={0}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left hover:scale-[1.01] ${
                    isCardSelected
                      ? "ring-2 ring-emerald-500 shadow-md border-emerald-500 bg-white dark:bg-slate-800"
                      : grp.meetsMinimum && !hasItemViolations
                        ? "bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-800/60 shadow-2xs hover:border-emerald-400"
                        : "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60 hover:border-amber-500"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate flex items-center gap-1">
                        <span>{grp.supplierName}</span>
                        {isCardSelected && (
                          <span className="text-[10px] text-emerald-600 font-bold">(กำลังดู)</span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {grp.items.length} รายการ • รวม{" "}
                        {grp.items.reduce((s, i) => s + i.quantity, 0)} หน่วย
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                        grp.meetsMinimum && !hasItemViolations
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {grp.meetsMinimum && !hasItemViolations
                        ? "✓ ครบยอดขั้นต่ำ"
                        : !grp.meetsMinimum
                          ? `ขาดอีก ฿${(grp.deficitAmount ?? grp.difference ?? 0).toLocaleString()}`
                          : "มีสินค้าไม่ถึงขั้นต่ำ"}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-baseline justify-between">
                    <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                      ฿{(grp.totalAmount ?? 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ขั้นต่ำ ฿{(grp.minOrderAmount ?? 0).toLocaleString()}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        grp.meetsMinimum ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  {/* Estimated Delivery and schedule info */}
                  {grp.deliveryEstimate && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3 text-emerald-500" />
                        รอบ: {grp.deliveryEstimate.pattern}
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        เข้า: {grp.deliveryEstimate.expectedDateThai}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters & Search Header */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        {/* Search Input */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อวัตถุดิบ, รหัสสินค้า, ซัพพลายเออร์ หรือหมวดหมู่..."
              className="w-full pl-10 pr-10 py-2.5 text-xs font-semibold rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowOnlySelected(!showOnlySelected)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              showOnlySelected
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>แสดงเฉพาะที่เลือก ({totalCartItemsCount})</span>
          </button>
        </div>

        {/* Supplier Filter & Search */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>กรองตามซัพพลายเออร์ (เลือกเพื่อดูเงื่อนไข & ขั้นต่ำ & รอบส่ง):</span>
            </label>
            <div className="w-full sm:w-80">
              <SearchableSupplierSelector
                value={selectedSupplierFilter}
                onChange={(val) => setSelectedSupplierFilter(val || "all")}
                suppliers={branchSuppliers}
                allowAll
                allValue="all"
                allLabel={`ทุกซัพพลายเออร์ (${branchProducts.length} รายการ)`}
                allowClear
                size="sm"
                className="h-9 text-xs font-bold rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                placeholder="🔍 ค้นหา / เลือกซัพพลายเออร์..."
                searchPlaceholder="พิมพ์ชื่อ, รหัส หรือเบอร์ซัพพลายเออร์..."
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedSupplierFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedSupplierFilter === "all"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              ทั้งหมด ({branchProducts.length})
            </button>
            {branchSuppliers.map((sup) => {
              const count = branchProducts.filter(
                (p) => p.supplierId === sup.id && p.isActive !== false,
              ).length;
              if (count === 0) return null;
              const isSelected = selectedSupplierFilter === sup.id;
              const minAmount = getSupplierMinOrderAmount(sup);

              return (
                <button
                  key={sup.id}
                  type="button"
                  onClick={() => setSelectedSupplierFilter(isSelected ? "all" : sup.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>{sup.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isSelected
                        ? "bg-emerald-700 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300"
                    }`}
                  >
                    {count}
                  </span>
                  {minAmount > 0 && (
                    <span
                      className={`text-[9.5px] px-1.5 py-0.5 rounded font-black ${
                        isSelected
                          ? "bg-emerald-800 text-emerald-100"
                          : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                      }`}
                    >
                      ขั้นต่ำ ฿{minAmount >= 1000 ? `${(minAmount / 1000).toFixed(0)}k` : minAmount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Filter Pills */}
        {categories.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
              กรองตามหมวดหมู่วัตถุดิบ (Categories):
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter("all")}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                  selectedCategoryFilter === "all"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                ทุกหมวดหมู่
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                    selectedCategoryFilter === cat
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Supplier Policy & Delivery Schedule Hero Card (When a Supplier Filter is Active) */}
      {selectedSupplierObj && (
        <SupplierPolicyHeroCard
          supplier={selectedSupplierObj}
          orderDate={orderDate}
          branchId={currentBranch.id}
          branchName={currentBranch.name}
          branchProductsCount={selectedSupplierProductsCount}
          cartSummary={selectedSupplierCartSummary}
          onClearFilter={() => setSelectedSupplierFilter("all")}
        />
      )}

      {/* Products Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            รายการวัตถุดิบสั่งซื้อ ({filteredProducts.length} รายการ)
          </h3>

          <div className="text-xs text-slate-400 font-medium">
            เลือกแล้ว{" "}
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {totalCartItemsCount}
            </span>{" "}
            รายการ
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Package className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-500">
              ไม่พบรายการวัตถุดิบตามเงื่อนไขที่ค้นหา
            </p>
            <p className="text-[11px] text-slate-400">
              ลองล้างคำค้นหาหรือเปลี่ยนตัวกรองซัพพลายเออร์
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4 w-28">รหัสสินค้า</th>
                  <th className="py-3 px-4">รายการวัตถุดิบ / หมวดหมู่</th>
                  <th className="py-3 px-4">ซัพพลายเออร์ & เงื่อนไข</th>
                  <th className="py-3 px-4 text-right">ราคา/หน่วย</th>
                  <th className="py-3 px-4 text-center w-48">จำนวนที่สั่ง (Qty)</th>
                  <th className="py-3 px-4 text-right w-28">รวมเงิน (฿)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {filteredProducts.map((product) => {
                  const cartState = cart[product.id];
                  const currentQty = cartState?.quantity || 0;
                  const itemSubtotal = currentQty * product.price;

                  // Minimum and Policy Rules for this item
                  const itemRule = findItemMinQtyRule(product.code, product.supplierName);
                  const supPolicy = findSupplierPolicyRule(product.supplierName);
                  const hasItemMin = Boolean(itemRule && itemRule.minQty > 0);
                  const isBelowItemMin =
                    currentQty > 0 && hasItemMin && currentQty < (itemRule?.minQty || 0);
                  const deficitQty = isBelowItemMin ? itemRule!.minQty - currentQty : 0;

                  // Check stock in Database B
                  const dbBMatched = dbBItems.find(
                    (i) =>
                      i.code.toLowerCase() === product.code.toLowerCase() ||
                      i.name.toLowerCase() === product.name.toLowerCase(),
                  );
                  const inStock = dbBMatched ? (currentStock[dbBMatched.id] ?? 0) : null;

                  return (
                    <tr
                      key={product.id}
                      className={`transition-colors ${
                        isBelowItemMin
                          ? "bg-amber-50/70 dark:bg-amber-950/30 border-l-4 border-amber-500"
                          : currentQty > 0
                            ? "bg-emerald-50/40 dark:bg-emerald-950/20 font-medium"
                            : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      {/* Product Code */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 align-top">
                        {product.code}
                      </td>

                      {/* Name, Category & Item Rules Badges */}
                      <td className="py-3 px-4 align-top">
                        <div className="space-y-1">
                          <p className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">
                            {product.name}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-[10px] font-bold">
                              {product.category}
                            </span>
                            {hasItemMin && (
                              <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md text-[10px] font-black border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" />
                                ขั้นต่ำ {itemRule!.minQty} {itemRule!.unit}
                              </span>
                            )}
                            {inStock !== null && (
                              <span className="text-[10px] text-slate-400">
                                สต็อกสาขา: <strong>{inStock}</strong> {product.unit}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Supplier & Delivery Policy */}
                      <td className="py-3 px-4 align-top">
                        <div className="space-y-1 max-w-xs">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedSupplierFilter(
                                selectedSupplierFilter === product.supplierId
                                  ? "all"
                                  : product.supplierId,
                              )
                            }
                            className="font-bold text-slate-800 dark:text-slate-200 text-xs hover:text-emerald-600 dark:hover:text-emerald-400 text-left transition-colors cursor-pointer flex items-center gap-1 group"
                            title="คลิกเพื่อดูเงื่อนไขขั้นต่ำและรอบส่งของซัพพลายเออร์นี้"
                          >
                            <span>{product.supplierName}</span>
                            <span className="text-[10px] text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              🔍
                            </span>
                          </button>
                          <div className="flex items-center gap-1 flex-wrap text-[10px]">
                            {supPolicy?.minOrderAmountBaht ? (
                              <span className="px-1.5 py-0.5 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-800 font-bold">
                                ยอดขั้นต่ำ ฿{supPolicy.minOrderAmountBaht.toLocaleString()}
                              </span>
                            ) : null}
                            {(itemRule?.schedulePattern || supPolicy?.schedulePattern) && (
                              <span className="text-slate-400 dark:text-slate-500 font-medium">
                                รอบ: {itemRule?.schedulePattern || supPolicy?.schedulePattern}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Unit Price */}
                      <td className="py-3 px-4 text-right align-top">
                        <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                          ฿{product.price.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 block">/ {product.unit}</span>
                      </td>

                      {/* Quantity Controller with +/- & Direct Input & Deficit Notice */}
                      <td className="py-3 px-4 align-top">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Minus Button */}
                            <button
                              type="button"
                              disabled={currentQty <= 0}
                              onClick={() => handleUpdateQty(product.id, currentQty - 1)}
                              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-800 dark:text-slate-200 flex items-center justify-center font-black transition-all cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5 stroke-[3]" />
                            </button>

                            {/* Direct Number Input */}
                            <div className="relative">
                              <input
                                type="number"
                                min={0}
                                value={currentQty === 0 ? "" : currentQty}
                                placeholder="0"
                                onChange={(e) =>
                                  handleUpdateQty(product.id, Number(e.target.value))
                                }
                                className={`w-16 h-8 text-center text-xs font-black rounded-xl border transition-all ${
                                  isBelowItemMin
                                    ? "bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-400"
                                    : currentQty > 0
                                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                      : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700"
                                }`}
                              />
                            </div>

                            {/* Plus Button */}
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(product.id, currentQty + 1)}
                              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center font-black transition-all cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          </div>

                          {/* Quick Add Pills */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleQuickAdd(product.id, 1)}
                              className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[9.5px] font-bold text-slate-600 dark:text-slate-400"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickAdd(product.id, 5)}
                              className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[9.5px] font-bold text-slate-600 dark:text-slate-400"
                            >
                              +5
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickAdd(product.id, 10)}
                              className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[9.5px] font-bold text-slate-600 dark:text-slate-400"
                            >
                              +10
                            </button>
                          </div>

                          {/* Minimum Quantity Warning & Quick Fix button */}
                          {isBelowItemMin && (
                            <div className="flex flex-col items-center gap-1 mt-1">
                              <span className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400 text-center leading-tight">
                                ⚠️ สั่งต่ำกว่าขั้นต่ำ (ขาดอีก {deficitQty} {itemRule!.unit})
                              </span>
                              <button
                                type="button"
                                onClick={() => handleSetMinQty(product.id, itemRule!.minQty)}
                                className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[9.5px] rounded-md shadow-2xs transition-all cursor-pointer"
                              >
                                ปรับเป็น {itemRule!.minQty} {itemRule!.unit}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Subtotal */}
                      <td className="py-3 px-4 text-right align-top">
                        <span
                          className={`font-black text-xs ${
                            currentQty > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-slate-400"
                          }`}
                        >
                          ฿{itemSubtotal.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Bottom Sticky Action Checkout Bar */}
      {selectedCartItems.length > 0 && (
        <div className="sticky bottom-4 z-40 bg-slate-900/95 backdrop-blur-md text-white p-4 sm:p-5 rounded-3xl shadow-2xl border border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-bottom duration-300">
          {/* Left summary info */}
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl shrink-0">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400">สรุปยอดสั่งซื้อ:</span>
                <span className="text-lg sm:text-xl font-black text-emerald-400">
                  ฿{totalCartAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                {cartValidationResult.isValid ? (
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10.5px] font-black rounded-full border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> ผ่านเกณฑ์ขั้นต่ำครบถ้วน
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10.5px] font-black rounded-full border border-amber-500/30 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> ขาดอีก{" "}
                    {cartValidationResult.supplierViolations.length +
                      cartValidationResult.itemViolations.length}{" "}
                    เงื่อนไข
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                เลือกแล้ว <strong>{totalCartItemsCount}</strong> รายการ ({totalCartUnits} หน่วย) •{" "}
                {suppliersInvolvedCount} ซัพพลายเออร์
              </p>
              {(() => {
                const liveRound = calculateDeliveryRound({
                  branch: currentBranch,
                  orderType,
                  orderTimestamp: new Date(),
                });
                return (
                  <p className="text-[11.5px] font-bold text-emerald-300 flex items-center gap-1 mt-0.5">
                    <Truck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span>{liveRound.displayText}</span>
                  </p>
                );
              })()}
              {orderNotes.trim() && (
                <p className="text-[11px] text-amber-300 flex items-center gap-1 mt-0.5 font-bold truncate max-w-md">
                  <FileText className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span>หมายเหตุ PO: {orderNotes.trim()}</span>
                </p>
              )}
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
            <button
              type="button"
              onClick={handleClearCart}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-red-950/60 hover:text-red-300 text-slate-300 rounded-2xl text-xs font-bold border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ล้าง</span>
            </button>

            <button
              type="button"
              onClick={handlePreviewOrders}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-2xl text-xs font-bold border border-slate-600 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>ดูตัวอย่าง / พิมพ์</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting || !cartValidationResult.canSubmit}
              onClick={handleSubmitOrders}
              title={
                !cartValidationResult.canSubmit
                  ? "ไม่สามารถส่งคำสั่งซื้อได้: กรุณาสั่งซื้อให้ถึงยอดขั้นต่ำและจำนวนขั้นต่ำก่อน"
                  : "ยืนยันส่งใบสั่งซื้อ"
              }
              className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold shadow-lg transition-all flex items-center gap-2 ${
                !cartValidationResult.canSubmit
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed opacity-60 border border-slate-600"
                  : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 cursor-pointer active:scale-95"
              }`}
            >
              <Send className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? "กำลังส่งคำสั่งซื้อ..."
                  : !cartValidationResult.canSubmit
                    ? "ยังไม่ถึงขั้นต่ำ (ไม่สามารถยืนยันได้)"
                    : "ยืนยันส่งใบสั่งซื้อ (Submit PO)"}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* PDF / PNG / Print Export Modal */}
      {previewOrders && (
        <PdfExportModal
          branch={currentBranch}
          orders={previewOrders}
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          batchTitle={`ใบสั่งซื้อสาขา ${currentBranch.name}`}
        />
      )}
    </div>
  );
};
