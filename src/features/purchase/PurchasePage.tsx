import { useState, useEffect, useMemo } from "react";
import type {
  PurchaseBranch,
  PurchaseSupplier,
  PurchaseProduct,
  PurchaseOrder,
  PurchaseProductChangeLog,
} from "./types";
import {
  subscribeDatabaseAOrders,
  subscribeDatabaseAProducts,
  subscribeDatabaseASuppliers,
  subscribeDatabaseABranches,
  subscribeDatabaseAProductLogs,
  saveOrderToDatabaseA,
  INITIAL_BRANCHES_A,
  INITIAL_SUPPLIERS_A,
  INITIAL_PRODUCTS_A,
  INITIAL_ORDERS_A,
  INITIAL_PRODUCT_LOGS_A,
} from "@/services/purchaseDbA";
import { useStore } from "@/lib/store";
import { isAllBranches } from "@/lib/branchFilter";
import { BranchOrderView } from "./BranchOrderView";
import { SmartOrderCompare } from "./SmartOrderCompare";
import { PoTrackerView } from "./PoTrackerView";
import { ProcurementMasterView } from "./ProcurementMasterView";
import { DailyGroupedOrdersView } from "./DailyGroupedOrdersView";
import { DeliveryRoundConfigCard } from "./DeliveryRoundConfigCard";
import {
  ShoppingCart,
  Scale,
  FileText,
  Building2,
  AlertTriangle,
  Layers,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

export function PurchasePage() {
  const { currentUser, selectedBranchId, branches: dbBBranches } = useStore();
  const isAll = isAllBranches(selectedBranchId);

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<
    "order" | "grouped" | "compare" | "history" | "procurement" | "delivery_config"
  >("order");

  // Database A Data States
  const [branchesA, setBranchesA] = useState<PurchaseBranch[]>(INITIAL_BRANCHES_A);
  const [suppliersA, setSuppliersA] = useState<PurchaseSupplier[]>(INITIAL_SUPPLIERS_A);
  const [productsA, setProductsA] = useState<PurchaseProduct[]>(INITIAL_PRODUCTS_A);
  const [ordersA, setOrdersA] = useState<PurchaseOrder[]>(INITIAL_ORDERS_A);
  const [productLogsA, setProductLogsA] =
    useState<PurchaseProductChangeLog[]>(INITIAL_PRODUCT_LOGS_A);
  const [isDbAConnected, setIsDbAConnected] = useState<boolean>(true);

  // Order Details Form State
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [expectedReceivedDate, setExpectedReceivedDate] = useState<string>(() => {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    return tmrw.toISOString().slice(0, 10);
  });
  const [orderCreator, setOrderCreator] = useState<string>(currentUser?.name || "ผู้จัดการสาขา");
  const [orderNotes, setOrderNotes] = useState<string>("");

  // Subscribe to Database A (Real-time Firestore)
  useEffect(() => {
    const unsubOrders = subscribeDatabaseAOrders(
      (data) => {
        setOrdersA(data);
        setIsDbAConnected(true);
      },
      () => setIsDbAConnected(false),
    );

    const unsubProds = subscribeDatabaseAProducts((data) => setProductsA(data));
    const unsubSups = subscribeDatabaseASuppliers((data) => setSuppliersA(data));
    const unsubBranches = subscribeDatabaseABranches((data) => setBranchesA(data));
    const unsubLogs = subscribeDatabaseAProductLogs((data) => setProductLogsA(data));

    return () => {
      unsubOrders();
      unsubProds();
      unsubSups();
      unsubBranches();
      unsubLogs();
    };
  }, []);

  // Resolve current branch based on global selectedBranchId
  const currentBranch: PurchaseBranch = useMemo(() => {
    if (isAll) {
      return {
        id: "all",
        name: "ทุกสาขา",
        code: "ALL",
        location: "ทุกสาขา",
        manager: currentUser?.name || "ส่วนกลาง",
        phone: "-",
      };
    }

    const tid = (selectedBranchId || "").trim().toLowerCase();

    // 1. Direct ID match in branchesA
    const directMatchA = branchesA.find(
      (b) => b.id.toLowerCase() === tid || b.id === selectedBranchId,
    );
    if (directMatchA) return directMatchA;

    // 2. Name or code matching with branchesA from dbBBranches
    const dbb = dbBBranches.find((b) => b.id.toLowerCase() === tid || b.id === selectedBranchId);
    const dbbName = (dbb?.name || "").trim().toLowerCase();

    if (dbbName) {
      const matchByNameA = branchesA.find((b) => {
        const bName = b.name.toLowerCase();
        return bName === dbbName || bName.includes(dbbName) || dbbName.includes(bName);
      });
      if (matchByNameA) return matchByNameA;
    }

    // 3. Keyword matching (วัชรพล, พระราม33, บางแก้ว, บางนา, พอโตชิโน่)
    const keywords = [
      { key: "วัชรพล", id: "branch-1", code: "BR-01" },
      { key: "พระราม33", id: "branch-2", code: "BR-02", alt: "พระราม 33" },
      { key: "บางแก้ว", id: "branch-3", code: "BR-03" },
      { key: "บางนา", id: "branch-4", code: "BR-04" },
      { key: "พอโตชิโน่", id: "branch-5", code: "BR-05", alt: "portochino" },
    ];

    for (const kw of keywords) {
      if (
        tid === kw.id.toLowerCase() ||
        tid === kw.code.toLowerCase() ||
        tid.includes(kw.key) ||
        dbbName.includes(kw.key) ||
        (kw.alt && dbbName.includes(kw.alt))
      ) {
        const found = branchesA.find(
          (b) => b.id === kw.id || b.code === kw.code || b.name.includes(kw.key),
        );
        if (found) return found;
      }
    }

    // 4. Fallback using dbB or initial branches
    if (dbb) {
      return {
        id: dbb.id,
        name: dbb.name,
        code: `BR-${
          dbb.name
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(0, 3)
            .toUpperCase() || "01"
        }`,
        location: "สถานที่ตั้งสาขา",
        manager: currentUser?.name || "ผู้จัดการสาขา",
        phone: "-",
      };
    }

    return branchesA[0] || INITIAL_BRANCHES_A[0];
  }, [isAll, selectedBranchId, branchesA, dbBBranches, currentUser]);

  // Handle Order Creations
  const handleCreateOrders = async (
    ordersPayload: Omit<PurchaseOrder, "id" | "updatedAt">[],
  ): Promise<PurchaseOrder[]> => {
    const now = new Date();
    const dateStr = orderDate.replace(/-/g, "").slice(2);
    const createdOrders: PurchaseOrder[] = [];

    for (let i = 0; i < ordersPayload.length; i++) {
      const payload = ordersPayload[i];
      const seq = String(ordersA.length + i + 1).padStart(3, "0");
      const orderId = `PO-${currentBranch.code}-${dateStr}-${seq}`;

      const newOrder: PurchaseOrder = {
        ...payload,
        id: orderId,
        updatedAt: now.toISOString().replace("T", " ").substring(0, 16),
      };

      await saveOrderToDatabaseA(newOrder);
      createdOrders.push(newOrder);
    }

    return createdOrders;
  };

  const handleSmartOrderCreate = async (orderPayload: Omit<PurchaseOrder, "id" | "updatedAt">) => {
    const created = await handleCreateOrders([orderPayload]);
    if (created[0]) {
      toast.success(`สร้างใบสั่งซื้อ ${created[0].id} สำเร็จ`);
      setActiveTab("history");
    }
  };

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayOrdersCount = useMemo(
    () => ordersA.filter((o) => o.orderDate === todayStr).length,
    [ordersA, todayStr],
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Top Application Navigation Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-2xl shadow-md shadow-emerald-500/20">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                ระบบสั่งซื้อวัตถุดิบหน้าร้าน
              </h1>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Store Ordering
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              จัดการใบสั่งซื้อ เทียบราคาอัตโนมัติ และเชื่อมโยงตรวจรับเข้าคลังหลัก (Database A ↔
              Database B)
            </p>
          </div>
        </div>

        {/* Dual Database Sync Status Indicator */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
            <span
              className={`w-2 h-2 rounded-full ${isDbAConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}
            />
            <span className="text-slate-600 dark:text-slate-300">
              Database A (Ordering):{" "}
              <strong className="text-emerald-600">
                {isDbAConnected ? "Live Sync" : "Cached"}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-600 dark:text-slate-300">
              Database B (Inventory): <strong className="text-emerald-600">Connected</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Tab Controls */}
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("order")}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === "order"
              ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>สั่งซื้อวัตถุดิบ (Order Form)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("compare")}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === "compare"
              ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>สั่งซื้อผัก (Vegetable Orders)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === "history"
              ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>ประวัติใบสั่งซื้อ & ตรวจรับ ({ordersA.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("grouped")}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === "grouped"
              ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>มุมมองกลุ่มรายวัน (Daily Grouped)</span>
          {todayOrdersCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              {todayOrdersCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("procurement")}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === "procurement"
              ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>ซัพพลายเออร์ & แคตตาล็อก</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("delivery_config")}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === "delivery_config"
              ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>ตั้งค่ารอบจัดส่ง (Delivery Schedule)</span>
        </button>
      </div>

      {/* Tab 1: Store Raw Material Ordering Screen */}
      {activeTab === "order" &&
        (isAll ? (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 rounded-3xl p-8 sm:p-12 text-center space-y-4 max-w-2xl mx-auto my-8 shadow-sm">
            <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
                กรุณาเลือกสาขาที่ต้องการสั่งซื้อจากเมนูด้านบนก่อน
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg mx-auto">
                การสั่งซื้อวัตถุดิบจำเป็นต้องระบุสาขาปลายทางที่ต้องการรับสินค้าอย่างชัดเจน
                กรุณาเลือกสาขาที่ต้องการจากตัวเลือกสาขาที่มุมขวาบนของหน้าจอ
                ก่อนเริ่มทำรายการสั่งซื้อ
              </p>
            </div>
          </div>
        ) : (
          <BranchOrderView
            currentBranch={currentBranch}
            suppliers={suppliersA}
            products={productsA}
            orderDate={orderDate}
            setOrderDate={setOrderDate}
            expectedReceivedDate={expectedReceivedDate}
            setExpectedReceivedDate={setExpectedReceivedDate}
            orderCreator={orderCreator}
            setOrderCreator={setOrderCreator}
            orderNotes={orderNotes}
            setOrderNotes={setOrderNotes}
            onCreateOrders={handleCreateOrders}
          />
        ))}

      {/* Tab: Daily Grouped Orders View */}
      {activeTab === "grouped" && (
        <DailyGroupedOrdersView
          orders={ordersA}
          branches={branchesA}
          suppliers={suppliersA}
          products={productsA}
        />
      )}

      {/* Tab 2: Smart Order Compare */}
      {activeTab === "compare" &&
        (isAll ? (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 rounded-3xl p-8 sm:p-12 text-center space-y-4 max-w-2xl mx-auto my-8 shadow-sm">
            <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
                กรุณาเลือกสาขาที่ต้องการสั่งซื้อจากเมนูด้านบนก่อน
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg mx-auto">
                ระบบเทียบราคาอัจฉริยะจำเป็นต้องทราบสาขาปลายทางเพื่อคำนวณและสร้างใบสั่งซื้อได้อย่างถูกต้อง
                กรุณาเลือกสาขาจากเมนูด้านบนก่อนเริ่มใช้งาน
              </p>
            </div>
          </div>
        ) : (
          <SmartOrderCompare
            currentBranch={currentBranch}
            suppliers={suppliersA}
            products={productsA}
            orders={ordersA}
            orderDate={orderDate}
            expectedReceivedDate={expectedReceivedDate}
            orderCreator={orderCreator}
            orderNotes={orderNotes}
            setOrderNotes={setOrderNotes}
            onCreateOrder={handleSmartOrderCreate}
            onCreateOrders={handleCreateOrders}
            onSubmitted={(msg) => {
              toast.success(msg);
            }}
            onNavigateToHistory={() => setActiveTab("history")}
          />
        ))}

      {/* Tab 3: PO History & Real-time Tracking & Receiving into DB B */}
      {activeTab === "history" && (
        <PoTrackerView
          orders={ordersA}
          branches={branchesA}
          suppliers={suppliersA}
          products={productsA}
          currentBranch={currentBranch}
        />
      )}

      {/* Tab 4: Procurement Master & DB A Settings */}
      {activeTab === "procurement" && (
        <ProcurementMasterView
          products={productsA}
          suppliers={suppliersA}
          branches={branchesA}
          logs={productLogsA}
          onRefresh={() => {
            // Re-fetch triggers
            toast.success("รีเฟรชข้อมูลสำเร็จ");
          }}
        />
      )}

      {/* Tab 5: Delivery Schedule Configuration (ตารางอ้างอิงรอบสั่ง-ส่งสินค้า) */}
      {activeTab === "delivery_config" && (
        <div className="space-y-4">
          <DeliveryRoundConfigCard />
        </div>
      )}
    </div>
  );
}
