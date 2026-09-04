import React, { useState } from "react";
import type {
  PurchaseSupplier,
  PurchaseProduct,
  PurchaseBranch,
  PurchaseProductChangeLog,
} from "./types";
import {
  Package,
  Truck,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  History,
  Database,
  RefreshCw,
  Search,
  DollarSign,
  AlertCircle,
  Save,
  Key,
  Zap,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { SyncProcurementModal } from "@/features/items/SyncProcurementModal";
import {
  saveProductToDatabaseA,
  deleteProductFromDatabaseA,
  saveSupplierToDatabaseA,
  deleteSupplierFromDatabaseA,
  saveProductLogToDatabaseA,
  testDatabaseAConnection,
  getDatabaseAConfig,
  saveDatabaseAConfig,
  seedDatabaseAWithVegetablesAndSuppliers,
} from "@/services/purchaseDbA";
import {
  testTelegramBotConnection,
  getTelegramConfig,
  saveTelegramConfig,
  DEFAULT_CHAT_ID,
  DEFAULT_BOT_TOKEN,
} from "@/services/telegramService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSupplierSelector } from "@/components/SearchableSupplierSelector";

interface ProcurementMasterViewProps {
  products: PurchaseProduct[];
  suppliers: PurchaseSupplier[];
  branches: PurchaseBranch[];
  logs: PurchaseProductChangeLog[];
  onRefresh: () => void;
}

export const ProcurementMasterView: React.FC<ProcurementMasterViewProps> = ({
  products,
  suppliers,
  branches,
  logs,
  onRefresh,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"products" | "suppliers" | "logs" | "database">(
    "products",
  );
  const [searchQuery, setSearchQuery] = useState("");

  const {
    items: masterItems,
    categories: masterCategories,
    suppliers: masterSuppliers,
    addItem: addMasterItem,
    updateItem: updateMasterItem,
  } = useStore();

  // Master Items Sync Modal State
  const [isSyncMasterModalOpen, setIsSyncMasterModalOpen] = useState(false);

  // Product Edit/Create Modal State
  const [editingProduct, setEditingProduct] = useState<Partial<PurchaseProduct> | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [priceChangeReason, setPriceChangeReason] = useState("");

  // Supplier Edit/Create Modal State
  const [editingSupplier, setEditingSupplier] = useState<Partial<PurchaseSupplier> | null>(null);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  // DB Config Test State
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<string | null>(null);
  const [isSyncingVegs, setIsSyncingVegs] = useState(false);

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.supplierName.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  // Filtered Suppliers
  const filteredSuppliers = suppliers.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      s.contactPerson.toLowerCase().includes(q)
    );
  });

  // Handle Save Product
  const handleSaveProduct = async () => {
    if (!editingProduct?.name || !editingProduct?.code || !editingProduct?.supplierId) {
      toast.error("กรุณากรอกข้อมูลสำคัญ (ชื่อ, รหัส, ซัพพลายเออร์) ให้ครบถ้วน");
      return;
    }

    const sup = suppliers.find((s) => s.id === editingProduct.supplierId);
    const existing = products.find((p) => p.id === editingProduct.id);

    const isPriceChanged = existing && existing.price !== editingProduct.price;
    if (isPriceChanged && !priceChangeReason.trim()) {
      toast.error("กรุณาระบุเหตุผลการปรับราคา (Reason for Price Change)");
      return;
    }

    const productToSave: PurchaseProduct = {
      id: editingProduct.id || `PROD-${Date.now().toString().slice(-6)}`,
      code: editingProduct.code.trim().toUpperCase(),
      name: editingProduct.name.trim(),
      supplierId: editingProduct.supplierId,
      supplierName: sup?.name || editingProduct.supplierName || "ซัพพลายเออร์",
      category: editingProduct.category || "ทั่วไป",
      unit: editingProduct.unit || "กก.",
      price: Number(editingProduct.price) || 0,
      deliveryTerms: editingProduct.deliveryTerms || sup?.deliveryTerms || "",
      minOrderQty: Number(editingProduct.minOrderQty) || 1,
      isActive: editingProduct.isActive !== false,
      notes: editingProduct.notes || "",
      reason: priceChangeReason || undefined,
      masterCode: editingProduct.masterCode || editingProduct.code.trim().toUpperCase(),
    };

    try {
      await saveProductToDatabaseA(productToSave);

      // If price or spec changed, record log
      if (isPriceChanged || !existing) {
        const newLog: PurchaseProductChangeLog = {
          id: `LOG-${Date.now()}`,
          productId: productToSave.id,
          productCode: productToSave.code,
          productName: productToSave.name,
          supplierName: productToSave.supplierName,
          changeType: !existing ? "create" : "price_change",
          changedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
          effectiveDate: new Date().toISOString().slice(0, 10),
          reason: priceChangeReason || "เพิ่มรายการใหม่",
          changedBy: "ผู้ดูแลฝ่ายจัดซื้อ",
          previousData: existing
            ? { price: existing.price, unit: existing.unit, name: existing.name }
            : undefined,
          newData: {
            price: productToSave.price,
            unit: productToSave.unit,
            name: productToSave.name,
          },
        };
        await saveProductLogToDatabaseA(newLog);
      }

      toast.success(`บันทึกข้อมูลสินค้า ${productToSave.name} สำเร็จ`);
      setIsProductModalOpen(false);
      setEditingProduct(null);
      setPriceChangeReason("");
      onRefresh();
    } catch {
      toast.error("ไม่สามารถบันทึกสินค้าลง Database A ได้");
    }
  };

  const [telegramConfig, setTelegramConfig] = useState(getTelegramConfig());
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<string | null>(null);

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    setTelegramTestResult(null);
    try {
      const res = await testTelegramBotConnection(telegramConfig);
      if (res.success) {
        toast.success("ส่งข้อความทดสอบเข้ากลุ่ม Telegram สำเร็จ!");
        setTelegramTestResult(`🟢 ${res.message}`);
      } else {
        toast.error(`ส่งข้อความไม่สำเร็จ: ${res.message}`);
        setTelegramTestResult(`🔴 ${res.message}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(msg);
      setTelegramTestResult(`🔴 ${msg}`);
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleSaveTelegramConfig = () => {
    saveTelegramConfig(telegramConfig);
    toast.success("บันทึกการตั้งค่า Telegram เรียบร้อยแล้ว");
  };

  const handleResetTelegramConfig = () => {
    const fresh = {
      botToken: DEFAULT_BOT_TOKEN,
      chatId: DEFAULT_CHAT_ID,
      isEnabled: true,
    };
    setTelegramConfig(fresh);
    saveTelegramConfig(fresh);
    toast.success("รีเซ็ตเป็นกลุ่ม NongPhak (-5339946631) เรียบร้อยแล้ว");
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`คุณต้องการลบสินค้า ${name} ออกจากระบบ Database A หรือไม่?`)) return;
    try {
      await deleteProductFromDatabaseA(id);
      toast.success(`ลบสินค้า ${name} เรียบร้อยแล้ว`);
      onRefresh();
    } catch {
      toast.error("เกิดข้อผิดพลาดในการลบสินค้า");
    }
  };

  const handleTestDatabaseA = async () => {
    setIsTestingDb(true);
    setDbTestResult(null);
    try {
      const res = await testDatabaseAConnection();
      if (res.success) {
        toast.success(res.message);
        setDbTestResult(
          `🟢 เชื่อมต่อสำเร็จ! พบคำสั่งซื้อ ${res.orderCount} ใบ, สินค้า ${res.productCount} รายการ, ซัพพลายเออร์ ${res.supplierCount} ราย`,
        );
      } else {
        toast.error(res.message);
        setDbTestResult(`🔴 ${res.message}`);
      }
    } finally {
      setIsTestingDb(false);
    }
  };

  const handleSyncVegetables = async () => {
    setIsSyncingVegs(true);
    try {
      const res = await seedDatabaseAWithVegetablesAndSuppliers(true);
      if (res.success) {
        toast.success(res.message);
        onRefresh();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("เกิดข้อผิดพลาดในการซิงค์ข้อมูล");
    } finally {
      setIsSyncingVegs(false);
    }
  };

  const vegetableCount = products.filter(
    (p) => p.category === "ผัก" || p.supplierId === "sup-5" || p.supplierId === "sup-6",
  ).length;

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveSubTab("products")}
          className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === "products"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>รายการสินค้าวัตถุดิบ ({products.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("suppliers")}
          className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === "suppliers"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>ซัพพลายเออร์ & เงื่อนไขสาขา ({suppliers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("logs")}
          className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === "logs"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>ประวัติปรับราคา ({logs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("database")}
          className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === "database"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>สถานะการเชื่อมต่อ Database A</span>
        </button>
      </div>

      {/* 1. Products Tab */}
      {activeSubTab === "products" && (
        <div className="space-y-4">
          {/* Quick Seed & Sync Alert Card for Vegetables */}
          <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent p-4 rounded-3xl border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">
                  Database A Sync
                </span>
                <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                  แคตตาล็อกหมวดผัก & ซัพพลายเออร์ Master (116 รายการ)
                </h4>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                มีรายการผักในระบบปัจจุบัน {vegetableCount} รายการ | ซัพพลายเออร์: ชินเซ็น (ขั้นต่ำ
                ฿800) และ WFOOD (ขั้นต่ำ ฿1,000)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                onClick={() => setIsSyncMasterModalOpen(true)}
                size="sm"
                variant="outline"
                className="bg-white/90 dark:bg-slate-900/90 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-2xl text-xs font-extrabold gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Auto Sync เข้า Master Items</span>
              </Button>

              <Button
                onClick={handleSyncVegetables}
                disabled={isSyncingVegs}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-extrabold gap-1.5 shrink-0 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingVegs ? "animate-spin" : ""}`} />
                <span>
                  {isSyncingVegs ? "กำลังนำเข้า 116 รายการ..." : "ซิงค์ผักเข้า Firestore"}
                </span>
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อสินค้า, รหัส, ซัพพลายเออร์..."
                className="w-full pl-10 pr-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingProduct({
                  id: "",
                  code: "",
                  name: "",
                  supplierId: suppliers[0]?.id || "",
                  category: "เนื้อสัตว์สด",
                  unit: "กก.",
                  price: 0,
                  isActive: true,
                });
                setIsProductModalOpen(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มสินค้าใหม่ (DB A)</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">รหัส</th>
                    <th className="py-3 px-4">ชื่อสินค้า</th>
                    <th className="py-3 px-4">หมวดหมู่</th>
                    <th className="py-3 px-4">ซัพพลายเออร์</th>
                    <th className="py-3 px-4 text-right">ราคา/หน่วย</th>
                    <th className="py-3 px-4 text-center">สถานะ</th>
                    <th className="py-3 px-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {p.code}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-slate-800 dark:text-slate-200">
                        <div>{p.name}</div>
                        {p.lockedSupplierId && (
                          <div className="mt-0.5">
                            <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              🔒 Locked Supplier:{" "}
                              {suppliers.find((s) => s.id === p.lockedSupplierId)?.name ||
                                p.lockedSupplierId}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[10px] font-bold text-slate-600 dark:text-slate-400">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                        {p.supplierName}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600">
                        ฿{p.price.toLocaleString()} / {p.unit}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            p.isActive !== false
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {p.isActive !== false ? "เปิดใช้งาน" : "ปิด"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(p);
                              setIsProductModalOpen(true);
                            }}
                            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 dark:text-slate-300"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="p-1.5 rounded-xl hover:bg-red-100 text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. Suppliers Tab */}
      {activeSubTab === "suppliers" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suppliers.map((sup) => (
              <div
                key={sup.id}
                className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                        {sup.code}
                      </span>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        {sup.name}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      ผู้ติดต่อ: {sup.contactPerson} • โทร: {sup.phone}
                    </p>
                  </div>

                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    ขั้นต่ำ ฿{sup.minOrderAmount?.toLocaleString() || 0}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                  <p className="font-bold text-slate-700 dark:text-slate-300">
                    เงื่อนไขการจัดส่งทั่วไป:
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">{sup.deliveryTerms}</p>

                  {sup.branchDeliveryTerms && Object.keys(sup.branchDeliveryTerms).length > 0 && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                      <p className="font-bold text-slate-700 dark:text-slate-300">
                        เงื่อนไขรายสาขา:
                      </p>
                      {Object.entries(sup.branchDeliveryTerms).map(([bId, terms]) => {
                        const br = branches.find((b) => b.id === bId);
                        return (
                          <div key={bId} className="flex items-start gap-1.5 text-[11px]">
                            <span className="font-bold text-emerald-600 shrink-0">
                              {br?.name || bId}:
                            </span>
                            <span className="text-slate-500">{terms}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Price Change Logs */}
      {activeSubTab === "logs" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              ประวัติการปรับราคา & แก้ไขข้อมูลวัตถุดิบ (Audit Trail)
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.map((log) => (
              <div key={log.id} className="p-4 flex items-start justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {log.productCode}
                    </span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">
                      {log.productName}
                    </span>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-bold">
                      {log.supplierName}
                    </span>
                  </div>
                  <p className="text-slate-500">
                    เหตุผล: <strong>{log.reason}</strong> • ผู้แก้ไข: {log.changedBy}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-black text-emerald-600 block">
                    {log.previousData?.price ? `฿${log.previousData.price} → ` : ""}฿
                    {log.newData?.price?.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400">{log.changedAt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Database A Connection Status */}
      {activeSubTab === "database" && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                การเชื่อมต่อ Database A (ระบบสั่งซื้อ - Ordering System)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                ระบบดึงและเขียนใบสั่งซื้อ แคตตาล็อก และซัพพลายเออร์ผ่าน Firestore Real-time
                โดยอัตโนมัติ
              </p>
            </div>

            <Button
              onClick={handleTestDatabaseA}
              disabled={isTestingDb}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingDb ? "animate-spin" : ""}`} />
              <span>{isTestingDb ? "กำลังทดสอบ..." : "ทดสอบการเชื่อมต่อ"}</span>
            </Button>
          </div>

          {dbTestResult && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold">
              {dbTestResult}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">Project ID:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {getDatabaseAConfig().projectId}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Firestore Database ID:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                {getDatabaseAConfig().firestoreDatabaseId}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                นำเข้าข้อมูลตั้งต้น (Master Vegetables & Suppliers Seeding)
              </h4>
              <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                บันทึกสินค้าหมวดผักจริง 116 รายการ พร้อมซัพพลายเออร์ชินเซ็นและ WFOOD เข้า Firestore
                Real-time
              </p>
            </div>
            <Button
              onClick={handleSyncVegetables}
              disabled={isSyncingVegs}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-1.5 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingVegs ? "animate-spin" : ""}`} />
              <span>
                {isSyncingVegs ? "กำลังบันทึกลง Firestore..." : "ซิงค์ข้อมูลตั้งต้น (Force Seed)"}
              </span>
            </Button>
          </div>

          {/* Telegram Notification Test Section */}
          <div className="p-5 rounded-3xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>ระบบแจ้งเตือนผักด่วนผ่าน Telegram — กลุ่ม &quot;NongPhak&quot;</span>
                </h4>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                  ส่งข้อความสรุปผักด่วนเข้ากลุ่มอัตโนมัติเมื่อสาขากดยืนยันสั่งผักด่วนในระบบ Smart
                  Compare
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={handleResetTelegramConfig}
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs font-bold border-amber-300 text-amber-900 dark:text-amber-200 hover:bg-amber-100"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  <span>รีเซ็ตเป็น NongPhak (-5339946631)</span>
                </Button>
                <Button
                  onClick={handleTestTelegram}
                  disabled={isTestingTelegram}
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold gap-1.5 shrink-0 shadow-sm"
                >
                  <Send className={`w-3.5 h-3.5 ${isTestingTelegram ? "animate-pulse" : ""}`} />
                  <span>{isTestingTelegram ? "กำลังส่งข้อความ..." : "ทดสอบส่ง Telegram"}</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-200 dark:border-amber-800/60">
              <div>
                <Label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Telegram Chat ID ปลายทาง (กลุ่ม NongPhak):
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={telegramConfig.chatId}
                    onChange={(e) =>
                      setTelegramConfig({ ...telegramConfig, chatId: e.target.value })
                    }
                    className="h-8 text-xs font-mono font-bold rounded-lg"
                    placeholder="-5339946631"
                  />
                  <Button
                    onClick={handleSaveTelegramConfig}
                    size="sm"
                    className="h-8 px-3 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                  >
                    <Save className="w-3 h-3 mr-1" />
                    บันทึก
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Telegram Bot:
                </Label>
                <div className="flex items-center gap-2 h-8 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-mono text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <span>@NongPhakBot (Online)</span>
                </div>
              </div>
            </div>

            {telegramTestResult && (
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 text-xs font-bold">
                {telegramTestResult}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Edit Dialog */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold">
              {editingProduct?.id ? "แก้ไขข้อมูลสินค้า (DB A)" : "เพิ่มสินค้าใหม่ (DB A)"}
            </DialogTitle>
          </DialogHeader>

          {editingProduct && (
            <div className="space-y-3 text-xs">
              <div>
                <Label className="text-xs font-bold block mb-1">รหัสสินค้า</Label>
                <Input
                  value={editingProduct.code || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, code: e.target.value })}
                  placeholder="เช่น RAW-010"
                  className="rounded-xl h-9 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <Label className="text-xs font-bold block mb-1">ชื่อวัตถุดิบ</Label>
                <Input
                  value={editingProduct.name || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  placeholder="เช่น อกไก่สดตัดแต่ง"
                  className="rounded-xl h-9 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold block mb-1">หมวดหมู่</Label>
                  <Input
                    value={editingProduct.category || ""}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, category: e.target.value })
                    }
                    placeholder="เช่น เนื้อสัตว์สด"
                    className="rounded-xl h-9 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold block mb-1">หน่วยนับ</Label>
                  <Input
                    value={editingProduct.unit || ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                    placeholder="เช่น กก."
                    className="rounded-xl h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold block mb-1">ราคาต่อหน่วย (฿)</Label>
                  <Input
                    type="number"
                    value={editingProduct.price || 0}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, price: Number(e.target.value) })
                    }
                    className="rounded-xl h-9 text-xs font-bold text-emerald-600"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold block mb-1">ซัพพลายเออร์</Label>
                  <SearchableSupplierSelector
                    value={editingProduct.supplierId || ""}
                    onChange={(v, sup) =>
                      setEditingProduct({
                        ...editingProduct,
                        supplierId: v,
                        supplierName: sup?.name || editingProduct.supplierName,
                      })
                    }
                    suppliers={suppliers}
                    size="sm"
                    className="h-9 rounded-xl text-xs font-bold"
                    placeholder="เลือกซัพพลายเออร์..."
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold block mb-1">
                  Locked Supplier (เจาะจงซัพพลายเออร์ที่ต้องการ)
                </Label>
                <SearchableSupplierSelector
                  value={editingProduct.lockedSupplierId || ""}
                  onChange={(v) =>
                    setEditingProduct({
                      ...editingProduct,
                      lockedSupplierId: v || undefined,
                    })
                  }
                  suppliers={[
                    {
                      id: "",
                      name: "— ไม่ได้ตั้ง Locked Supplier (ระบบเลือกตามราคาถูกสุด) —",
                      code: "",
                      contactPerson: "",
                      phone: "",
                      minOrderAmount: 0,
                    } as PurchaseSupplier,
                    ...suppliers,
                  ]}
                  size="sm"
                  className="h-9 rounded-xl text-xs font-bold"
                  placeholder="เลือกซัพพลายเออร์ (ตั้งเป็น Locked Supplier)..."
                />
              </div>

              <div>
                <Label className="text-xs font-bold block mb-1">เหตุผลการปรับราคา / หมายเหตุ</Label>
                <Input
                  value={priceChangeReason}
                  onChange={(e) => setPriceChangeReason(e.target.value)}
                  placeholder="เช่น ราคาตลาดปรับตัวสูงขึ้น"
                  className="rounded-xl h-9 text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-3">
            <Button
              variant="outline"
              onClick={() => setIsProductModalOpen(false)}
              className="rounded-xl text-xs"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleSaveProduct}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold"
            >
              บันทึกสินค้า
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync from Procurement to Master Items */}
      <SyncProcurementModal
        open={isSyncMasterModalOpen}
        onOpenChange={setIsSyncMasterModalOpen}
        existingItems={masterItems}
        categories={masterCategories}
        suppliers={masterSuppliers}
        liveProcurementProducts={products}
        onAddItem={addMasterItem}
        onUpdateItem={updateMasterItem}
      />
    </div>
  );
};
