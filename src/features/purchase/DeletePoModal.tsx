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
  Trash2,
  AlertTriangle,
  Building2,
  Calendar,
  DollarSign,
  Package,
  FileText,
  ShieldAlert,
  Clock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { deleteOrderFromDatabaseA } from "@/services/purchaseDbA";
import { formatDate } from "@/lib/dateFormat";
import { checkOrderDeletable } from "./orderRules";

interface DeletePoModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PurchaseOrder | null;
  onSuccessDeleted?: (orderId: string) => void;
}

const QUICK_REASONS = [
  "สั่งซื้อซ้ำซ้อน",
  "สาขายกเลิกรายการจัดซื้อ",
  "ข้อมูลรายการ/ราคาผิดพลาด",
  "สั่งซื้อผิดสาขา",
  "เปลี่ยนซัพพลายเออร์",
  "รายการทดสอบระบบ",
];

export const DeletePoModal: React.FC<DeletePoModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccessDeleted,
}) => {
  const { currentUser } = useStore();
  const [deleteReason, setDeleteReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  if (!order) return null;

  const deletable = checkOrderDeletable(order, currentUser);

  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!deletable.allowed) {
      setErrorMsg(deletable.reason || "คุณไม่มีสิทธิ์ในการลบคำสั่งซื้อ");
      return;
    }

    const trimmedReason = deleteReason.trim();
    if (!trimmedReason) {
      setErrorMsg("กรุณาระบุเหตุผลในการลบคำสั่งซื้อ (จำเป็นต้องระบุทุกครั้ง)");
      return;
    }

    if (trimmedReason.length < 5) {
      setErrorMsg("กรุณาระบุเหตุผลในการลบให้ชัดเจนอย่างน้อย 5 ตัวอักษร");
      return;
    }

    setIsSubmitting(true);
    try {
      const userName = currentUser?.name || currentUser?.role || "ผู้ดูแลระบบ";
      await deleteOrderFromDatabaseA(order.id, trimmedReason, userName);

      toast.success(`ลบใบสั่งซื้อ ${order.id} เรียบร้อยแล้ว`, {
        description: `เหตุผล: ${trimmedReason}`,
      });

      setDeleteReason("");
      onSuccessDeleted?.(order.id);
      onClose();
    } catch (err) {
      console.error("Failed to delete order:", err);
      toast.error("เกิดข้อผิดพลาดในการลบคำสั่งซื้อ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectQuickReason = (reasonText: string) => {
    setDeleteReason(reasonText);
    setErrorMsg("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/80 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>ลบคำสั่งซื้ออย่างถาวร (Delete PO)</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                เลขที่ใบสั่งซื้อ:{" "}
                <strong className="text-slate-800 dark:text-slate-200">{order.id}</strong>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Permission Info / Restriction Alert */}
        {deletable.allowed ? (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-black">
                {deletable.isPrivileged
                  ? "สิทธิ์ Admin / IT / Purchase"
                  : "สิทธิ์พนักงานผู้สั่งซื้อ (ภายในวันที่สั่ง)"}
              </p>
              <p className="text-[11px] opacity-90">
                {deletable.isPrivileged
                  ? "สามารถลบคำสั่งซื้อได้ตลอดเวลา แต่ต้องระบุเหตุผลทุกครั้งเพื่อบันทึกประวัติความปลอดภัย (Audit Log)"
                  : "สามารถลบคำสั่งซื้อที่ตนเองสั่งได้ภายในวันที่สั่งซื้อ โดยต้องระบุเหตุผลในการลบเพื่อบันทึกประวัติ"}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">ไม่สามารถดำเนินการลบได้</p>
              <p className="text-[11px] opacity-90">{deletable.reason}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleDeleteSubmit} className="space-y-4 pt-1">
          {/* Order Summary Details */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> สาขา:
              </span>
              <strong className="text-slate-800 dark:text-slate-200">{order.branchName}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> วันที่สั่ง:
              </span>
              <span className="text-slate-700 dark:text-slate-300">
                {formatDate(order.orderDate)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-slate-400" /> จำนวนรายการ:
              </span>
              <span className="text-slate-700 dark:text-slate-300 font-bold">
                {order.items.length} รายการ
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700/60">
              <span className="text-slate-500 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" /> ยอดรวม:
              </span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-black">
                ฿{order.totalAmount.toLocaleString()}
              </strong>
            </div>
          </div>

          {/* Quick Reasons */}
          {deletable.allowed && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>เหตุผลด่วน (คลิกเลือก):</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleSelectQuickReason(r)}
                    className={`text-[10.5px] px-2 py-1 rounded-lg border transition-all cursor-pointer font-medium ${
                      deleteReason === r
                        ? "bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 font-bold"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Delete Reason Input (MANDATORY) */}
          <div className="space-y-1.5 p-3 rounded-2xl bg-red-500/10 border-2 border-red-500/30">
            <Label className="text-xs font-black text-red-900 dark:text-red-200 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              <span>ระบุเหตุผลในการลบคำสั่งซื้อ (จำเป็นต้องระบุทุกครั้ง):</span>
              <span className="text-red-500 font-black">*</span>
            </Label>
            <textarea
              value={deleteReason}
              onChange={(e) => {
                setDeleteReason(e.target.value);
                setErrorMsg("");
              }}
              placeholder="ระบุเหตุผล เช่น สั่งซื้อซ้ำซ้อนกับ PO-2026-001, สาขาแจ้งยกเลิกออร์เดอร์, กรอกข้อมูลผิดสาขา..."
              rows={3}
              disabled={!deletable.allowed || isSubmitting}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-red-500 font-medium"
              required
            />
            {errorMsg && (
              <p className="text-[11px] font-bold text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>{errorMsg}</span>
              </p>
            )}
          </div>

          <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
            * การลบคำสั่งซื้อจะไม่สามารถกู้คืนได้ ข้อมูลผู้ลบ วันเวลา
            และเหตุผลจะถูกบันทึกเพื่อการตรวจสอบ
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
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
              disabled={!deletable.allowed || !deleteReason.trim() || isSubmitting}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-md flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isSubmitting ? "กำลังลบ..." : "ยืนยันการลบคำสั่งซื้อ"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
