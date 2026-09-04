import React, { useState } from "react";
import type { PurchaseOrder } from "./types";
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
import { Label } from "@/components/ui/label";
import {
  XCircle,
  AlertTriangle,
  Building2,
  Truck,
  Calendar,
  DollarSign,
  Package,
  FileText,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { saveOrderToDatabaseA } from "@/services/purchaseDbA";
import { formatDate } from "@/lib/dateFormat";
import { checkOrderModifiable } from "./orderRules";

interface CancelPoModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PurchaseOrder | null;
  onSuccessCancelled?: (orderId: string) => void;
}

export const CancelPoModal: React.FC<CancelPoModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccessCancelled,
}) => {
  const { currentUser } = useStore();
  const [reason, setReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  if (!order) return null;

  const validation = checkOrderModifiable(order, currentUser);

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!validation.allowed) {
      setErrorMsg(validation.reason || "ไม่สามารถยกเลิกคำสั่งซื้อได้เนื่องจากไม่ตรงตามเงื่อนไข");
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setErrorMsg("กรุณาระบุเหตุผลในการยกเลิกคำสั่งซื้อ (จำเป็นต้องระบุ)");
      return;
    }

    if (trimmedReason.length < 5) {
      setErrorMsg("กรุณาระบุเหตุผลในการยกเลิกให้ชัดเจนอย่างน้อย 5 ตัวอักษร");
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const nowStr = now.toISOString().replace("T", " ").substring(0, 16);
      const userName = currentUser?.name || "เจ้าหน้าที่สาขา";

      const updatedOrder: PurchaseOrder = {
        ...order,
        status: "cancelled",
        cancelReason: trimmedReason,
        cancelledAt: nowStr,
        cancelledBy: userName,
        updatedAt: nowStr,
        updatedBy: userName,
      };

      await saveOrderToDatabaseA(updatedOrder);
      toast.success(`ยกเลิกใบสั่งซื้อ ${order.id} เรียบร้อยแล้ว`);
      setReason("");
      onSuccessCancelled?.(order.id);
      onClose();
    } catch (err) {
      console.error("Failed to cancel order:", err);
      toast.error("เกิดข้อผิดพลาดในการยกเลิกคำสั่งซื้อ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/80 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-slate-900 dark:text-slate-100">
                ยกเลิกคำสั่งซื้อ (Cancel Order)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                เลขที่ใบสั่งซื้อ:{" "}
                <strong className="text-slate-900 dark:text-slate-100 font-mono">{order.id}</strong>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Privileged notice */}
        {validation.isPrivileged && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold">สิทธิ์พิเศษ: Admin / IT / Purchase</p>
              <p className="text-[11px] opacity-90">
                คุณสามารถยกเลิกคำสั่งซื้อนี้ได้ตลอดเวลา
                แต่ต้องระบุเหตุผลทุกครั้งเพื่อบันทึกประวัติความปลอดภัย
              </p>
            </div>
          </div>
        )}

        {/* Validation Warning Alert if not allowed */}
        {!validation.allowed && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">ไม่สามารถดำเนินการยกเลิกได้</p>
              <p className="text-[11px] opacity-90">{validation.reason}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleCancelSubmit} className="space-y-4 pt-1">
          {/* Order Summary Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> สาขา:
              </span>
              <strong className="text-slate-800 dark:text-slate-200">{order.branchName}</strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-slate-400" /> ซัพพลายเออร์:
              </span>
              <strong className="text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                {order.supplierName}
              </strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> วันที่สั่งซื้อ:
              </span>
              <strong className="text-slate-800 dark:text-slate-200">
                {formatDate(order.orderDate)}
              </strong>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700/60 pt-2">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-slate-400" /> จำนวนสินค้า:
              </span>
              <strong className="text-slate-800 dark:text-slate-200">
                {order.items.length} รายการ ({order.items.reduce((s, i) => s + i.quantity, 0)}{" "}
                หน่วย)
              </strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> ยอดเงินรวม:
              </span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                ฿{order.totalAmount.toLocaleString()}
              </strong>
            </div>
          </div>

          {/* Condition Info Banner */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800/60 text-[11px] text-blue-800 dark:text-blue-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>เงื่อนไขการยกเลิกคำสั่งซื้อ:</span>
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-[10.5px] opacity-90">
              <li>ต้องทำภายในวันที่มีการสั่งซื้อเท่านั้น</li>
              <li>ต้องทำก่อนที่ฝ่ายจัดซื้อจะกดอนุมัติรายการ (สถานะรอดำเนินการ)</li>
              <li>ต้องระบุเหตุผลในการยกเลิกเพื่อเก็บเป็นหลักฐานการตรวจสอบ</li>
            </ul>
          </div>

          {/* Reason Input (Mandatory) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-red-500" />
              <span>เหตุผลในการยกเลิกคำสั่งซื้อ (จำเป็นต้องระบุ):</span>
              <span className="text-red-500 font-black">*</span>
            </Label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setErrorMsg("");
              }}
              placeholder="ระบุเหตุผล เช่น สั่งสินค้าซ้ำซ้อน, ยอดสต็อกในครัวยังมีเพียงพอ, คีย์ผิดสาขา..."
              rows={3}
              disabled={!validation.allowed || isSubmitting}
              className="w-full text-xs p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 font-medium"
              required
            />
            {errorMsg && (
              <p className="text-[11px] font-bold text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>{errorMsg}</span>
              </p>
            )}
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-bold"
            >
              ปิดหน้าต่าง
            </Button>
            <Button
              type="submit"
              disabled={!validation.allowed || !reason.trim() || isSubmitting}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-md flex items-center gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              <span>{isSubmitting ? "กำลังยกเลิก..." : "ยืนยันยกเลิกคำสั่งซื้อ"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
