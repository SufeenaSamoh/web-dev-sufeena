import React, { useState, useEffect } from "react";
import type { PurchaseOrder, PurchaseBranch } from "./types";
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
  PackageCheck,
  Building2,
  Calendar,
  Truck,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { updateOrderStatusInDatabaseA } from "@/services/purchaseDbA";
import { formatDate } from "@/lib/dateFormat";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";

interface ReceivePoModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PurchaseOrder | null;
  branches: PurchaseBranch[];
  onSuccessReceived?: (orderId: string) => void;
}

interface ReceiveLineItem {
  poItemIndex: number;
  productCode: string;
  productName: string;
  orderedQty: number;
  receivedQty: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  matchedDbBItemId?: string;
  matchedDbBItemName?: string;
  vatType: "V" | "N";
  expiryDate: string;
  remark: string;
}

export const ReceivePoModal: React.FC<ReceivePoModalProps> = ({
  isOpen,
  onClose,
  order,
  branches,
  onSuccessReceived,
}) => {
  const {
    items: dbBItems,
    suppliers: dbBSuppliers,
    branches: dbBBranches,
    addPurchase,
  } = useStore();

  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [receiveDate, setReceiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [receivedBy, setReceivedBy] = useState<string>("");
  const [remark, setRemark] = useState<string>("");
  const [receiveItems, setReceiveItems] = useState<ReceiveLineItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

  useEffect(() => {
    if (!order || !isOpen) return;

    // Pre-fill invoice number
    setInvoiceNumber(`INV-${order.id.replace("ORD-", "")}`);
    setReceiveDate(new Date().toISOString().slice(0, 10));
    setReceivedBy(order.createdBy || "ผู้จัดการสาขา");
    setRemark(`ตรวจรับจากใบสั่งซื้อเลขที่ ${order.id} (${order.supplierName})`);

    // Match Branch in Database B
    const matchedBranch =
      dbBBranches.find((b) => b.name === order.branchName || b.id === order.branchId) ||
      dbBBranches[0];
    setSelectedBranchId(matchedBranch ? matchedBranch.id : order.branchId);

    // Match Supplier in Database B
    const matchedSup =
      dbBSuppliers.find(
        (s) =>
          s.name.toLowerCase().includes(order.supplierName.toLowerCase()) ||
          order.supplierName.toLowerCase().includes(s.name.toLowerCase()) ||
          s.id === order.supplierId,
      ) || dbBSuppliers[0];
    setSelectedSupplierId(matchedSup ? matchedSup.id : order.supplierId);

    // Map PO Items and match with Database B Items
    const lines: ReceiveLineItem[] = order.items.map((it, idx) => {
      // Find matching item in Database B by code or name
      const matched = dbBItems.find(
        (dbItem) =>
          dbItem.code.toLowerCase() === it.productCode.toLowerCase() ||
          dbItem.name.toLowerCase() === it.productName.toLowerCase() ||
          dbItem.name.toLowerCase().includes(it.productName.toLowerCase()),
      );

      return {
        poItemIndex: idx,
        productCode: it.productCode,
        productName: it.productName,
        orderedQty: it.quantity,
        receivedQty: it.quantity, // default to 100% received
        unit: it.unit,
        unitPrice: it.unitPrice,
        totalPrice: it.quantity * it.unitPrice,
        matchedDbBItemId: matched?.id || dbBItems[0]?.id || "",
        matchedDbBItemName: matched?.name || dbBItems[0]?.name || it.productName,
        vatType: "V",
        expiryDate: "",
        remark: "",
      };
    });

    setReceiveItems(lines);
  }, [order, isOpen, dbBItems, dbBSuppliers, dbBBranches]);

  if (!isOpen || !order) return null;

  const totalReceivedAmount = receiveItems.reduce(
    (sum, line) => sum + line.receivedQty * line.unitPrice,
    0,
  );

  const handleQtyChange = (index: number, newQty: number) => {
    setReceiveItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const validQty = Math.max(0, newQty);
        return {
          ...item,
          receivedQty: validQty,
          totalPrice: validQty * item.unitPrice,
        };
      }),
    );
  };

  const handleMatchedItemChange = (index: number, dbBItemId: string) => {
    const target = dbBItems.find((i) => i.id === dbBItemId);
    setReceiveItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        return {
          ...item,
          matchedDbBItemId: dbBItemId,
          matchedDbBItemName: target?.name || item.productName,
        };
      }),
    );
  };

  const handleConfirmReceive = async () => {
    if (!invoiceNumber.trim()) {
      toast.error("กรุณากรอกเลขที่ใบส่งของ / ใบกำกับภาษี (Invoice No.)");
      return;
    }

    const validLines = receiveItems.filter((i) => i.receivedQty > 0 && i.matchedDbBItemId);
    if (validLines.length === 0) {
      toast.error("กรุณาระบุจำนวนสินค้าที่ตรวจรับอย่างน้อย 1 รายการ");
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Write to Database B (Main Inventory Database)
      await addPurchase({
        supplierId: selectedSupplierId || order.supplierId,
        branchId: selectedBranchId || order.branchId,
        purchaseDate: new Date(receiveDate).toISOString(),
        invoiceNumber: invoiceNumber.trim(),
        poNumber: order.id.trim(), // Key bridge reference: stores Database A's PO number in Database B
        employee: receivedBy.trim() || order.createdBy,
        remark: `${remark} (อ้างอิง PO: ${order.id})`.trim(),
        items: validLines.map((line) => ({
          itemId: line.matchedDbBItemId!,
          quantity: line.receivedQty,
          unitPrice: line.unitPrice,
          vatType: line.vatType,
          expiryDate: line.expiryDate || undefined,
          remark: line.remark || undefined,
        })),
        total: totalReceivedAmount,
      });

      // 2. Update Database A status to 'received'
      await updateOrderStatusInDatabaseA(
        order.id,
        "received",
        receiveDate,
        receivedBy || "ระบบตรวจรับสินค้า",
      );

      toast.success(
        `ตรวจรับสินค้าจาก PO: ${order.id} เข้าคลังสต็อกหลัก (Database B) เรียบร้อยแล้ว!`,
      );
      onSuccessReceived?.(order.id);
      onClose();
    } catch (err: unknown) {
      console.error("Error receiving PO into Database B:", err);
      toast.error("เกิดข้อผิดพลาดในการบันทึกตรวจรับเข้าคลังหลัก");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <PackageCheck className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>ตรวจรับสินค้าเข้าคลังสต็อกหลัก (Goods Receipt)</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono px-2.5 py-0.5 rounded-full font-bold">
                  {order.id}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                ดึงข้อมูลจาก Database A (ใบสั่งซื้อ) เพื่อบันทึกเข้า Database B (คลังสินค้าหลัก)
                พร้อมผูกรหัส PO อัตโนมัติ
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* PO Overview Header Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block mb-0.5 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" /> สาขาปลายทาง (Database A)
            </span>
            <p className="font-extrabold text-slate-800 dark:text-slate-200">{order.branchName}</p>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 block mb-0.5">
              ซัพพลายเออร์ (Supplier)
            </span>
            <p className="font-extrabold text-slate-800 dark:text-slate-200 truncate">
              {order.supplierName}
            </p>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 block mb-0.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" /> วันที่สั่งซื้อ / กำหนดรับ
            </span>
            <p className="font-extrabold text-slate-800 dark:text-slate-200">
              {formatDate(order.orderDate)} → {formatDate(order.expectedReceivedDate)}
            </p>
          </div>
        </div>

        {/* Receipt Header Form */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <Label className="text-xs font-bold block mb-1.5">
              เลขที่ใบส่งของ / Invoice <span className="text-red-500">*</span>
            </Label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="เช่น INV-88992"
              className="rounded-xl h-10 text-xs font-bold"
            />
          </div>
          <div>
            <Label className="text-xs font-bold block mb-1.5">
              วันที่ตรวจรับจริง <span className="text-red-500">*</span>
            </Label>
            <ThaiDatePicker
              value={receiveDate}
              onChange={setReceiveDate}
              className="rounded-xl h-10 text-xs font-bold"
            />
          </div>
          <div>
            <Label className="text-xs font-bold block mb-1.5">ผู้ตรวจรับเข้าคลัง</Label>
            <Input
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              placeholder="ชื่อผู้รับสินค้า"
              className="rounded-xl h-10 text-xs font-bold"
            />
          </div>
        </div>

        {/* Items Table */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              รายการวัตถุดิบและจับคู่สต็อกหลัก (Database B Mapping)
            </h4>
            <span className="text-xs text-slate-500">รวม {receiveItems.length} รายการ</span>
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-white font-bold">
                <tr>
                  <th className="py-2.5 px-3">สินค้าสั่งซื้อ (PO)</th>
                  <th className="py-2.5 px-3">จับคู่สต็อกใน Database B</th>
                  <th className="py-2.5 px-3 text-center">สั่งซื้อ</th>
                  <th className="py-2.5 px-3 text-center w-28">รับเข้าจริง</th>
                  <th className="py-2.5 px-3 text-right">ราคา/หน่วย</th>
                  <th className="py-2.5 px-3 text-right">รวม (฿)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {receiveItems.map((item, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        {item.productName}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400">{item.productCode}</p>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={item.matchedDbBItemId}
                        onChange={(e) => handleMatchedItemChange(idx, e.target.value)}
                        className="w-full p-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                      >
                        {dbBItems.map((dbItem) => (
                          <option key={dbItem.id} value={dbItem.id}>
                            {dbItem.code} • {dbItem.name} ({dbItem.unit})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                      {item.orderedQty} {item.unit}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          value={item.receivedQty}
                          onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                          className="w-20 h-8 text-center text-xs font-extrabold rounded-lg"
                        />
                        <span className="text-[11px] text-slate-400">{item.unit}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      ฿{item.unitPrice.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                      ฿{item.totalPrice.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary and Bridge Note */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2 text-xs text-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              ระบบจะทำการเพิ่มสต็อกเข้าคลังหลัก (Database B) พร้อมลงประวัติรับของ และอัปเดตสถานะ PO
              ใน Database A เป็น <strong>"ได้รับสินค้าแล้ว"</strong>
            </span>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-bold">
              ยอดเงินรวมตรวจรับ
            </span>
            <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">
              ฿{totalReceivedAmount.toLocaleString()}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
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
            type="button"
            onClick={handleConfirmReceive}
            disabled={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-md gap-1.5"
          >
            <PackageCheck className="w-4 h-4" />
            <span>
              {isSubmitting ? "กำลังบันทึกเข้าคลัง..." : "ยืนยันตรวจรับเข้าคลังหลัก (Save to DB B)"}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
