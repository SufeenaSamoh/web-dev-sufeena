import React, { useState } from "react";
import type { PurchaseOrder } from "./types";
import {
  AlertTriangle,
  PhoneCall,
  Copy,
  Check,
  X,
  FileText,
  Calendar,
  Building2,
  Truck,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

interface ContactProcurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PurchaseOrder | null;
  actionType?: "edit" | "cancel" | "delete" | "modify";
  customMessage?: string;
}

export const ContactProcurementModal: React.FC<ContactProcurementModalProps> = ({
  isOpen,
  onClose,
  order,
  actionType = "edit",
  customMessage,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen || !order) return null;

  const getActionTitle = () => {
    switch (actionType) {
      case "edit":
        return "ต้องการแก้ไขรายการสั่งซื้อ";
      case "cancel":
        return "ต้องการยกเลิกคำสั่งซื้อ";
      case "delete":
        return "ต้องการลบคำสั่งซื้อ";
      default:
        return "ต้องการปรับปรุงรายการสั่งซื้อ";
    }
  };

  const formattedMsg = `เรียน ฝ่ายจัดซื้อ,
ขอความกรุณาดำเนินการ ${getActionTitle()} เนื่องจากเลยกำหนดเวลาภายในวันที่สั่งซื้อแล้ว:
• เลขที่ใบสั่งซื้อ: ${order.id}
• สาขา: ${order.branchName}
• ซัพพลายเออร์: ${order.supplierName}
• วันที่สั่งซื้อ: ${order.orderDate}
• ผู้สั่งซื้อ: ${order.createdBy || "เจ้าหน้าที่สาขา"}
• ยอดรวม: ฿${order.totalAmount.toLocaleString()}
• ความประสงค์: [กรุณาระบุรายละเอียดที่ต้องการแก้ไข/ยกเลิก]`;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(formattedMsg);
      setCopied(true);
      toast.success("คัดลอกข้อความแจ้งฝ่ายจัดซื้อเรียบร้อยแล้ว");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("ไม่สามารถคัดลอกข้อความได้");
    }
  };

  return (
    <div
      id="contact-procurement-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-amber-200 dark:border-amber-800/80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-6 py-4 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-white/20 backdrop-blur-xs">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base leading-tight">
                ติดต่อฝ่ายจัดซื้อเพื่อปรับปรุงรายการ
              </h3>
              <p className="text-[11px] text-amber-100 font-medium">
                {getActionTitle()} (เลยกำหนดเวลาแก้ไขภายในวัน)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors cursor-pointer text-white/90 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Main Notice Box */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <p className="font-black text-[13px] text-amber-950 dark:text-amber-100 mb-1">
                  กรุณาติดต่อฝ่ายจัดซื้อเพื่อแก้ไข เพื่อยกเลิก ปรับปรุงรายการ
                </p>
                <p className="text-amber-800 dark:text-amber-300 font-medium">
                  {customMessage ||
                    "คำสั่งซื้อนี้เลยกำหนดเวลาแก้ไขภายในวันที่สั่งซื้อแล้ว (ระบบอนุญาตให้ผู้สั่งแก้ไข ลบ หรือยกเลิกได้เฉพาะภายในวันเท่านั้น เพื่อป้องกันความผิดพลาดในการเตรียมสินค้าหรือการจัดส่ง)"}
                </p>
              </div>
            </div>
          </div>

          {/* Order Details Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-slate-100 font-mono">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>PO: {order.id}</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                สถานะ: {order.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5 truncate">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">สาขา: {order.branchName}</span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">ซัพพลายเออร์: {order.supplierName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>วันที่สั่ง: {order.orderDate}</span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">ผู้สั่ง: {order.createdBy || "เจ้าหน้าที่"}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-semibold">ยอดรวมทั้งใบสั่งซื้อ:</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                ฿{order.totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Quick Copy Message for Line/Chat to Procurement */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-bold px-1">
              <span>ข้อความสำหรับส่งให้ฝ่ายจัดซื้อ:</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                กดคัดลอกส่ง Line / แชตได้ทันที
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300 relative border border-slate-200 dark:border-slate-700 leading-relaxed whitespace-pre-line">
              {formattedMsg}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>คัดลอกแล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>คัดลอกข้อความ</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer"
            >
              รับทราบ / ปิด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
