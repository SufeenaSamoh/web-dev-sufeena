import React, { useState, useEffect, useMemo } from "react";
import type { PurchaseOrder, PurchaseOrderItem, PurchaseProduct } from "./types";
import { useStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Edit3,
  AlertTriangle,
  Building2,
  Truck,
  Calendar,
  DollarSign,
  Plus,
  Trash2,
  FileText,
  Clock,
  Search,
  Package,
  Save,
  Check,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { saveOrderToDatabaseA } from "@/services/purchaseDbA";
import { formatDate } from "@/lib/dateFormat";
import { checkOrderModifiable } from "./orderRules";

interface EditPoModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PurchaseOrder | null;
  availableProducts?: PurchaseProduct[];
  onSuccessEdited?: (orderId: string) => void;
}

export const EditPoModal: React.FC<EditPoModalProps> = ({
  isOpen,
  onClose,
  order,
  availableProducts = [],
  onSuccessEdited,
}) => {
  const { currentUser } = useStore();
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [editReason, setEditReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Product Selector for adding new item
  const [isAddingItem, setIsAddingItem] = useState<boolean>(false);
  const [productSearch, setProductSearch] = useState<string>("");

  useEffect(() => {
    if (order && isOpen) {
      setItems(order.items.map((it) => ({ ...it })));
      setOrderNotes(order.notes || "");
      setEditReason("");
      setErrorMsg("");
      setIsAddingItem(false);
      setProductSearch("");
    }
  }, [order, isOpen]);

  // Products available to add (prefer same supplier)
  const candidateProducts = useMemo(() => {
    if (!order) return [];
    const q = productSearch.trim().toLowerCase();
    const existingCodes = new Set(items.map((i) => i.productCode));

    return availableProducts
      .filter((p) => {
        if (existingCodes.has(p.code)) return false;
        if (order.supplierId && p.supplierId !== order.supplierId) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
      })
      .slice(0, 15);
  }, [availableProducts, items, order, productSearch]);

  const QUICK_EDIT_REASONS = [
    "ปรับเปลี่ยนจำนวนตามหน้างาน",
    "แก้ไขรายการสินค้าตามสต็อกจริง",
    "ซัพพลายเออร์แจ้งปรับเปลี่ยนสินค้า",
    "แก้ไขข้อผิดพลาดในการคีย์ข้อมูล",
    "ลูกค้ายกเลิก/เปลี่ยนเมนู",
    "ปรับเพิ่มรายการด่วน",
  ];

  const getStatusText = (status: string) => {
    switch (status) {
      case "approved":
        return "🔵 อนุมัติแล้ว";
      case "in_transit":
        return "🚚 กำลังจัดส่ง";
      case "received":
        return "🟢 ตรวจรับแล้ว";
      case "cancelled":
        return "🔴 ยกเลิกแล้ว";
      case "pending":
      default:
        return "🟡 รอดำเนินการ";
    }
  };

  const validation = checkOrderModifiable(order, currentUser);

  const handleQuantityChange = (index: number, newQty: number) => {
    if (newQty < 0.1) return;
    setItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index] };
      target.quantity = Number(newQty.toFixed(2));
      target.totalPrice = Math.round(target.quantity * target.unitPrice);
      copy[index] = target;
      return copy;
    });
  };

  const handleItemNoteChange = (index: number, note: string) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], notes: note };
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error(
        "ใบสั่งซื้อต้องมีรายการสินค้าอย่างน้อย 1 รายการ หากต้องการยกเลิกทั้งใบ กรุณาใช้ปุ่มยกเลิกคำสั่งซื้อ",
      );
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddProduct = (prod: PurchaseProduct) => {
    const newItem: PurchaseOrderItem = {
      productId: prod.id,
      productCode: prod.code,
      productName: prod.name,
      supplierId: prod.supplierId || order.supplierId,
      supplierName: prod.supplierName || order.supplierName,
      quantity: 1,
      unit: prod.unit,
      unitPrice: prod.price,
      totalPrice: prod.price,
      deliveryTerms: prod.deliveryTerms || order.deliveryTerms,
      notes: prod.notes || "",
    };

    setItems((prev) => [...prev, newItem]);
    setIsAddingItem(false);
    setProductSearch("");
    toast.success(`เพิ่มรายการ "${prod.name}" เรียบร้อยแล้ว`);
  };

  // Calculations
  const newTotalAmount = items.reduce((sum, it) => sum + it.totalPrice, 0);
  const previousTotalAmount = order.totalAmount;
  const amountDiff = newTotalAmount - previousTotalAmount;
  const totalUnits = items.reduce((sum, it) => sum + it.quantity, 0);

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!validation.allowed) {
      setErrorMsg(validation.reason || "ไม่สามารถแก้ไขคำสั่งซื้อได้เนื่องจากไม่ตรงตามเงื่อนไข");
      return;
    }

    if (items.length === 0) {
      setErrorMsg("ใบสั่งซื้อต้องมีรายการสินค้าอย่างน้อย 1 รายการ");
      return;
    }

    const trimmedReason = editReason.trim();
    if (!trimmedReason) {
      setErrorMsg("กรุณาระบุเหตุผลในการแก้ไขรายการสินค้า (จำเป็นต้องระบุ)");
      return;
    }

    if (trimmedReason.length < 5) {
      setErrorMsg("กรุณาระบุเหตุผลในการแก้ไขให้ชัดเจนอย่างน้อย 5 ตัวอักษร");
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const nowStr = now.toISOString().replace("T", " ").substring(0, 16);
      const userName = currentUser?.name || "เจ้าหน้าที่สาขา";

      const historyEntry = {
        editedAt: nowStr,
        editedBy: userName,
        reason: trimmedReason,
        previousTotalAmount,
        newTotalAmount,
        previousItemsCount: order.items.length,
        newItemsCount: items.length,
      };

      const updatedHistory = [...(order.editHistory || []), historyEntry];

      const updatedOrder: PurchaseOrder = {
        ...order,
        items,
        totalAmount: newTotalAmount,
        notes: orderNotes.trim(),
        editReason: trimmedReason,
        editedAt: nowStr,
        editedBy: userName,
        updatedAt: nowStr,
        updatedBy: userName,
        editHistory: updatedHistory,
      };

      await saveOrderToDatabaseA(updatedOrder);
      toast.success(`บันทึกการแก้ไขใบสั่งซื้อ ${order.id} เรียบร้อยแล้ว`);
      onSuccessEdited?.(order.id);
      onClose();
    } catch (err) {
      console.error("Failed to edit order:", err);
      toast.error("เกิดข้อผิดพลาดในการบันทึกการแก้ไข กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-full p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="space-y-1.5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/80 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>แก้ไขรายการสินค้าในใบสั่งซื้อ (Edit PO Items)</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {order.id}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                แก้ไขจำนวน, เพิ่ม/ลบรายการ หรือแก้ไขหมายเหตุ
                {validation.isPrivileged
                  ? " (สิทธิ์ Admin/IT/Purchase สามารถแก้ไขได้ตลอดเวลา โดยต้องระบุเหตุผล)"
                  : " (ผู้ใช้ทั่วไปต้องทำภายในวันเดียวกันและก่อนฝ่ายจัดซื้ออนุมัติ)"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Privileged User Notice */}
        {validation.isPrivileged && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2 shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="font-black">สิทธิ์พิเศษ: Admin / IT / Purchase</p>
              <p className="text-[11px] opacity-90">
                คุณสามารถแก้ไขคำสั่งซื้อนี้ได้ตลอดเวลา
                แต่ต้องระบุเหตุผลในการแก้ไขทุกครั้งเพื่อบันทึกประวัติการเปลี่ยนแปลง (Audit Log)
              </p>
            </div>
          </div>
        )}

        {/* Validation Warning Alert if not allowed */}
        {!validation.allowed && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">ไม่สามารถดำเนินการแก้ไขได้</p>
              <p className="text-[11px] opacity-90">{validation.reason}</p>
            </div>
          </div>
        )}

        {/* Header Information strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-xs shrink-0">
          <div>
            <span className="text-slate-400 text-[10px] block">สาขา:</span>
            <strong className="text-slate-900 dark:text-slate-100 truncate block">
              {order.branchName}
            </strong>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] block">ซัพพลายเออร์:</span>
            <strong className="text-slate-900 dark:text-slate-100 truncate block">
              {order.supplierName}
            </strong>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] block">วันที่สั่ง:</span>
            <strong className="text-slate-900 dark:text-slate-100">
              {formatDate(order.orderDate)}
            </strong>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] block">สถานะปัจจุบัน:</span>
            <strong className="text-slate-800 dark:text-slate-200">
              {getStatusText(order.status)}
            </strong>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSaveSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Items Table Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  รายการวัตถุดิบ ({items.length} รายการ / {totalUnits} หน่วย)
                </span>
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddingItem(!isAddingItem)}
                className="rounded-xl text-xs font-bold h-7 gap-1 bg-white dark:bg-slate-800 text-emerald-600 hover:text-emerald-700 hover:border-emerald-400"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingItem ? "ปิดค้นหาสินค้า" : "เพิ่มรายการสินค้า"}</span>
              </Button>
            </div>

            {/* Add Item Dropdown Panel */}
            {isAddingItem && (
              <div className="p-3 bg-emerald-50/40 dark:bg-emerald-950/20 border-b border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="ค้นหาชื่อหรือรหัสวัตถุดิบของซัพพลายเออร์นี้..."
                    className="pl-8 h-8 text-xs bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>

                {candidateProducts.length === 0 ? (
                  <p className="text-[11px] text-slate-500 py-2 text-center">
                    ไม่พบรายการสินค้าที่สามารถเพิ่มได้ของซัพพลายเออร์นี้
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                    {candidateProducts.map((p) => (
                      <div
                        key={p.id}
                        className="p-2 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div>
                          <strong className="text-slate-900 dark:text-slate-100">{p.name}</strong>
                          <span className="text-[10px] text-slate-400 ml-2 font-mono">
                            {p.code}
                          </span>
                          <span className="text-[10px] text-slate-500 ml-2">({p.unit})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-600 text-xs">฿{p.price}</span>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleAddProduct(p)}
                            className="h-6 px-2 text-[10px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            + เพิ่ม
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Item Rows */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((item, idx) => (
                <div
                  key={`${item.productCode}-${idx}`}
                  className="p-3 space-y-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-500 font-bold">
                          {item.productCode}
                        </span>
                        <strong className="text-xs text-slate-900 dark:text-slate-100">
                          {item.productName}
                        </strong>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        ราคา: ฿{item.unitPrice.toLocaleString()} / {item.unit}
                      </div>
                    </div>

                    {/* Quantity Controls & Total */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            handleQuantityChange(idx, Math.max(0.1, item.quantity - 1))
                          }
                          className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 font-black cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleQuantityChange(idx, parseFloat(e.target.value) || 0)
                          }
                          className="w-14 text-center font-black text-xs text-slate-900 dark:text-slate-100 outline-none"
                        />
                        <span className="text-[10px] text-slate-400 pr-2">{item.unit}</span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(idx, item.quantity + 1)}
                          className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 font-black cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right min-w-[70px]">
                        <span className="font-black text-xs text-emerald-600 dark:text-emerald-400 block">
                          ฿{item.totalPrice.toLocaleString()}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                        title="ลบรายการนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Item Specific Note */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 shrink-0">หมายเหตุรายการ:</span>
                    <input
                      type="text"
                      value={item.notes || ""}
                      onChange={(e) => handleItemNoteChange(idx, e.target.value)}
                      placeholder="เช่น คัดสวยพิเศษ, บรรจุถุงละ 5 กก."
                      className="flex-1 text-[11px] p-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PO General Remarks */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span>หมายเหตุใบสั่งซื้อ (PO Remarks - แสดงตัวหนาในใบ PO):</span>
            </Label>
            <input
              type="text"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="เช่น ส่งช่วงเช้าก่อน 10:00 น., ประตูส่งของด้านหลัง..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          {/* Amount Comparison Box */}
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 block">ยอดรวมเดิม:</span>
              <strong className="text-xs line-through text-slate-400">
                ฿{previousTotalAmount.toLocaleString()}
              </strong>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">ยอดรวมใหม่หลังแก้ไข:</span>
              <strong className="text-base font-black text-emerald-600 dark:text-emerald-400">
                ฿{newTotalAmount.toLocaleString()}
              </strong>
              {amountDiff !== 0 && (
                <span
                  className={`text-[10px] font-bold block ${amountDiff > 0 ? "text-emerald-600" : "text-amber-600"}`}
                >
                  (
                  {amountDiff > 0
                    ? `+฿${amountDiff.toLocaleString()}`
                    : `-฿${Math.abs(amountDiff).toLocaleString()}`}
                  )
                </span>
              )}
            </div>
          </div>

          {/* Edit Reason Input (MANDATORY) */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>เหตุผลในการแก้ไขรายการสินค้า (จำเป็นต้องระบุ):</span>
                <span className="text-red-500 font-black">*</span>
              </Label>
              {validation.isPrivileged && (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                  Admin/IT/Purchase
                </span>
              )}
            </div>

            {/* Quick Reason Chips */}
            <div className="space-y-1">
              <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>เหตุผลด่วน (คลิกเพื่อเลือก):</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_EDIT_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setEditReason(r);
                      setErrorMsg("");
                    }}
                    className={`text-[10.5px] px-2 py-1 rounded-lg border transition-all cursor-pointer font-medium ${
                      editReason === r
                        ? "bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 font-bold"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={editReason}
              onChange={(e) => {
                setEditReason(e.target.value);
                setErrorMsg("");
              }}
              placeholder="ระบุเหตุผล เช่น ปรับลดจำนวนผักกาดขาวเนื่องจากเหลือสต็อก, เพิ่มไข่ไก่ 2 แผงตามยอดจองโต๊ะ, แก้ไขจำนวนให้ถูกต้อง..."
              rows={2}
              disabled={!validation.allowed || isSubmitting}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              required
            />
            {errorMsg && (
              <p className="text-[11px] font-bold text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>{errorMsg}</span>
              </p>
            )}
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-bold"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={
                !validation.allowed || !editReason.trim() || items.length === 0 || isSubmitting
              }
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
