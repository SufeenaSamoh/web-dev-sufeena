import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/store";
import {
  STANDARD_VARIANCE_REASONS,
  type StandardReasonCode,
  type UsageVarianceItem,
  type UsageVarianceReason,
} from "@/features/reports/types/usageVariance";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  RotateCcw,
  ShieldCheck,
  Tag,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

interface VarianceReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: UsageVarianceItem | null;
  reasonsHistory: UsageVarianceReason[];
  onSaveReasonOnly: (params: {
    item: UsageVarianceItem;
    reasonCode: StandardReasonCode;
    reasonLabel: string;
    reasonNote: string;
  }) => Promise<void>;
  onSaveAndAdjustStock: (params: {
    item: UsageVarianceItem;
    reasonCode: StandardReasonCode;
    reasonLabel: string;
    reasonNote: string;
  }) => Promise<void>;
}

export const VarianceReasonModal: React.FC<VarianceReasonModalProps> = ({
  isOpen,
  onClose,
  item,
  reasonsHistory,
  onSaveReasonOnly,
  onSaveAndAdjustStock,
}) => {
  const [selectedReason, setSelectedReason] = useState<StandardReasonCode>("spoilage");
  const [reasonNote, setReasonNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) {
      setSelectedReason(item.currentReasonCode || "spoilage");
      setReasonNote(item.currentReasonNote || "");
    }
  }, [item]);

  if (!item) return null;

  const currentOption = STANDARD_VARIANCE_REASONS.find((r) => r.code === selectedReason);
  const isOther = selectedReason === "other";

  const handleSaveOnly = async () => {
    if (isOther && !reasonNote.trim()) {
      toast.error("กรุณาระบุรายละเอียดเพิ่มเติมสำหรับเหตุผล 'อื่นๆ'");
      return;
    }
    setLoading(true);
    try {
      await onSaveReasonOnly({
        item,
        reasonCode: selectedReason,
        reasonLabel: currentOption?.label || "อื่นๆ",
        reasonNote,
      });
      toast.success("บันทึกเหตุผลเรียบร้อยแล้ว");
      onClose();
    } catch (err) {
      toast.error("เกิดข้อผิดพลาดในการบันทึกเหตุผล");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndAdjust = async () => {
    if (isOther && !reasonNote.trim()) {
      toast.error("กรุณาระบุรายละเอียดเพิ่มเติมสำหรับเหตุผล 'อื่นๆ'");
      return;
    }
    setLoading(true);
    try {
      await onSaveAndAdjustStock({
        item,
        reasonCode: selectedReason,
        reasonLabel: currentOption?.label || "อื่นๆ",
        reasonNote,
      });
      toast.success("บันทึกเหตุผลและปรับปรุงยอดสต็อกเรียบร้อยแล้ว");
      onClose();
    } catch (err) {
      toast.error("เกิดข้อผิดพลาดในการปรับปรุงสต็อก");
    } finally {
      setLoading(false);
    }
  };

  const itemHistory = reasonsHistory.filter((r) => r.ingredientId === item.ingredientId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              บันทึกเหตุผล & ปรับปรุงยอดสต็อก
            </DialogTitle>
            <Badge
              variant="outline"
              className={
                item.diffValue > 0
                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
              }
            >
              {item.diffValue > 0 ? "ใช้เกินสูตร (Loss)" : "ประหยัดกว่าสูตร"}
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            {item.ingredientCode} — {item.ingredientName} ({item.categoryName})
          </DialogDescription>
        </DialogHeader>

        {/* 1. Metric Breakdown Grid */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-white dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-muted-foreground block text-[10px]">
                ต้นงวด (Carry-forward)
              </span>
              <span className="font-bold text-sm">
                {item.beginningQty.toFixed(2)} {item.unit}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-muted-foreground block text-[10px]">รับเข้า (Purchases)</span>
              <span className="font-bold text-sm text-blue-600">
                +{item.purchaseQty.toFixed(2)} {item.unit}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-muted-foreground block text-[10px]">ปลายงวดนับจริง</span>
              <span className="font-bold text-sm text-emerald-600">
                {item.endingActualQty.toFixed(2)} {item.unit}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-slate-200 dark:border-slate-800">
            <div className="p-2">
              <span className="text-muted-foreground block text-[10px]">ใช้จริง (คำนวณ)</span>
              <span className="font-black text-sm text-slate-800 dark:text-slate-100">
                {item.actualUsageQty.toFixed(2)} {item.unit}
              </span>
            </div>
            <div className="p-2">
              <span className="text-muted-foreground block text-[10px]">ใช้ตามสูตร (BOM)</span>
              <span className="font-black text-sm text-blue-600 dark:text-blue-400">
                {item.theoreticalUsageQty.toFixed(2)} {item.unit}
              </span>
            </div>
            <div className="p-2 bg-slate-100 dark:bg-slate-800/60 rounded-xl">
              <span className="text-muted-foreground block text-[10px]">ผลต่าง (Diff)</span>
              <span
                className={`font-black text-sm ${
                  item.diffQty > 0 ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {item.diffQty > 0 ? "+" : ""}
                {item.diffQty.toFixed(2)} {item.unit} ({formatCurrency(item.diffValue)})
              </span>
            </div>
          </div>
        </div>

        {/* 2. Reason Selection Form */}
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              สาเหตุของผลต่าง (Standard Reason) <span className="text-rose-500">*</span>
            </Label>
            <Select
              value={selectedReason}
              onValueChange={(val: StandardReasonCode) => setSelectedReason(val)}
            >
              <SelectTrigger className="h-11 rounded-xl mt-1 text-xs">
                <SelectValue placeholder="เลือกสาเหตุความคลาดเคลื่อน" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {STANDARD_VARIANCE_REASONS.map((r) => (
                  <SelectItem key={r.code} value={r.code} className="text-xs py-2">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {r.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{r.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>รายละเอียดเพิ่มเติม / บันทึก (Notes)</span>
              {isOther && (
                <span className="text-rose-500 font-normal text-[10px]">
                  * บังคับกรอกเนื่องจากเลือก 'อื่นๆ'
                </span>
              )}
            </Label>
            <Textarea
              placeholder="ระบุข้อเท็จจริง เช่น โต๊ะ 5 คืนปลาแซลมอนเนื่องจากลูกค้าเปลี่ยนใจ, หรือพบของชำรุดจากการขนส่ง..."
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              className="mt-1 min-h-[80px] rounded-xl text-xs"
            />
          </div>
        </div>

        {/* 3. Reason Audit History Timeline */}
        {itemHistory.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <h5 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 mb-2">
              <History className="w-3.5 h-3.5" /> ประวัติการบันทึกเหตุผล ({itemHistory.length})
            </h5>
            <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
              {itemHistory.map((h) => (
                <div
                  key={h.id}
                  className="text-[11px] p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 flex items-start justify-between gap-2"
                >
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {h.reasonLabel}
                    </span>
                    {h.reasonNote && <p className="text-muted-foreground mt-0.5">{h.reasonNote}</p>}
                  </div>
                  <div className="text-right text-[10px] text-muted-foreground shrink-0">
                    <div>{h.recordedByName}</div>
                    <div>{new Date(h.recordedAt).toLocaleString("th-TH")}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl text-xs"
          >
            ยกเลิก
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleSaveOnly}
              disabled={loading}
              className="rounded-xl text-xs"
            >
              บันทึกเหตุผลเท่านั้น
            </Button>
            <Button
              onClick={handleSaveAndAdjust}
              disabled={loading}
              className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              บันทึกและปรับปรุงสต็อกทันที
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
