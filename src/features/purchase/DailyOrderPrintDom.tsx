import React from "react";
import type { PurchaseOrder, PurchaseBranch, PurchaseSupplier } from "./types";
import { formatDate } from "@/lib/dateFormat";
import { sortOrdersForPrint, cleanOrderNotes } from "./printDailyOrders";

interface DailyOrderPrintDomProps {
  orders: PurchaseOrder[];
  branches: PurchaseBranch[];
  suppliers: PurchaseSupplier[];
  selectedDate: string;
  currentUser?: { name?: string };
}

export const DailyOrderPrintDom: React.FC<DailyOrderPrintDomProps> = ({
  orders,
  branches,
  suppliers,
}) => {
  if (!orders || orders.length === 0) return null;

  const sortedOrders = sortOrdersForPrint(orders, suppliers, branches);

  return (
    <div
      id="dedicated-daily-orders-print-area"
      className="hidden print:block print:w-full print:bg-white print:text-slate-900 print:m-0 print:p-0"
    >
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          .po-print-page {
            page-break-after: always;
            break-after: page;
            padding: 10px 0 20px 0;
            background: #ffffff;
          }
          .po-print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          table {
            page-break-inside: avoid;
            border-collapse: collapse;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
        }
      `}</style>

      {sortedOrders.map((order, orderIdx) => {
        const sup = suppliers.find((s) => s.id === order.supplierId);
        const br = branches.find((b) => b.id === order.branchId);

        const supplierName = sup?.name || order.supplierName || "ไม่ระบุซัพพลายเออร์";
        const supplierDeliveryTerms =
          order.deliveryTerms || sup?.deliveryTerms || "ตามเงื่อนไขซัพพลายเออร์";

        const branchName = br?.name || order.branchName || "ไม่ระบุสาขา";
        const branchLocation = br?.location || "-";
        const branchManager = br?.manager || order.createdBy || "ผู้จัดการสาขา";
        const branchPhone = br?.phone || "-";

        const expectedDate = order.expectedReceivedDate
          ? formatDate(order.expectedReceivedDate)
          : formatDate(order.orderDate);

        const cleanedNotes = cleanOrderNotes(order.notes);

        let statusLabel = "รอดำเนินการจัดซื้อ";
        if (order.status === "received") {
          statusLabel = "ได้รับสินค้าเข้าคลังแล้ว";
        } else if (order.status === "approved") {
          statusLabel = "จัดซื้ออนุมัติแล้ว";
        } else if (order.status === "in_transit") {
          statusLabel = "สินค้าอยู่ระหว่างขนส่ง";
        }

        return (
          <div key={order.id} className="po-print-page">
            {/* Header (Matches Standard PO 1:1) */}
            <div className="border-b-2 border-slate-900 pb-3 mb-3 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 bg-emerald-700 text-white font-extrabold text-xs rounded tracking-wide">
                    ใบสั่งซื้อวัตถุดิบ (PURCHASE ORDER)
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded border border-slate-300">
                    ใบที่ {orderIdx + 1}/{sortedOrders.length} • {order.id}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 m-0">{branchName}</h2>
                <p className="text-xs text-slate-600 m-0">สถานที่: {branchLocation}</p>
                <p className="text-xs text-slate-600 m-0">
                  ผู้จัดการสาขา: {branchManager} | โทร: {branchPhone}
                </p>
              </div>

              <div className="text-right text-xs space-y-1 text-slate-700">
                <p className="m-0">
                  <strong className="text-slate-900">วันที่สั่งซื้อ:</strong>{" "}
                  {formatDate(order.orderDate)}
                </p>
                <p className="m-0">
                  <strong className="text-slate-900">กำหนดรับเข้า:</strong> {expectedDate}
                </p>
                <p className="m-0">
                  <strong className="text-slate-900">ผู้ทำรายการ:</strong>{" "}
                  {order.createdBy || branchManager}
                </p>
              </div>
            </div>

            {/* Supplier Info Box (Matches Standard PO 1:1) */}
            <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-300 rounded-lg mb-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  รายละเอียดซัพพลายเออร์ (Supplier)
                </span>
                <p className="font-extrabold text-sm text-slate-900 m-0">{supplierName}</p>
                <p className="text-slate-600 text-xs mt-0.5 m-0">
                  เงื่อนไขการจัดส่ง: {supplierDeliveryTerms}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  สถานะใบสั่งซื้อ (Status)
                </span>
                <span className="font-bold text-emerald-700 text-xs">{statusLabel}</span>
              </div>
            </div>

            {/* Items Table (Matches Standard PO 1:1) */}
            <div className="space-y-1.5 mb-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                รายการวัตถุดิบสั่งซื้อ ({order.items.length} รายการ)
              </span>
              <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold">
                    <th className="p-2 border border-slate-900 text-center w-12">ลำดับ</th>
                    <th className="p-2 border border-slate-900 w-32 font-mono">รหัสสินค้า</th>
                    <th className="p-2 border border-slate-900">รายการสินค้า</th>
                    <th className="p-2 border border-slate-900 text-right w-24">จำนวน</th>
                    <th className="p-2 border border-slate-900 text-right w-24">ราคา/หน่วย</th>
                    <th className="p-2 border border-slate-900 text-right w-28">รวมเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, idx) => (
                    <tr
                      key={`${item.productCode}-${idx}`}
                      className={idx % 2 === 1 ? "bg-slate-50" : "bg-white"}
                    >
                      <td className="p-2 border border-slate-300 text-center text-slate-600 font-semibold">
                        {idx + 1}
                      </td>
                      <td className="p-2 border border-slate-300 font-mono font-bold text-slate-900">
                        {item.productCode || "-"}
                      </td>
                      <td className="p-2 border border-slate-300 font-bold text-slate-900">
                        {item.productName || "-"}
                      </td>
                      <td className="p-2 border border-slate-300 text-right font-bold text-slate-900">
                        {Number(item.quantity).toLocaleString()} {item.unit || ""}
                      </td>
                      <td className="p-2 border border-slate-300 text-right text-slate-700">
                        ฿{Number(item.unitPrice || 0).toLocaleString()}
                      </td>
                      <td className="p-2 border border-slate-300 text-right font-black text-slate-900">
                        ฿{Number(item.totalPrice || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total & Summary (Matches Standard PO 1:1) */}
            <div className="pt-1 flex flex-row justify-between items-start gap-4 mb-4">
              <div className="text-[10px] text-slate-500 space-y-0.5 max-w-sm">
                <p className="font-bold text-slate-700 m-0">เงื่อนไขและข้อตกลง:</p>
                <p className="leading-relaxed m-0">
                  1. กรุณาตรวจสอบจำนวนและสภาพวัตถุดิบก่อนลงนามรับสินค้า
                  <br />
                  2. หากพบสินค้าชำรุดเสียหายให้ระบุลงในใบส่งของทันที
                </p>
                {cleanedNotes && (
                  <div className="mt-2 p-2 bg-slate-50 border-2 border-slate-400 rounded-lg text-slate-900">
                    <span className="font-extrabold text-[11px]">หมายเหตุใบสั่งซื้อ: </span>
                    <strong className="font-black text-[11.5px] text-slate-950 block sm:inline">
                      {cleanedNotes}
                    </strong>
                  </div>
                )}
              </div>
              <div className="bg-slate-100 p-2.5 rounded-lg border-2 border-slate-400 text-right min-w-[200px]">
                <span className="text-[10px] text-slate-600 font-bold block">
                  ยอดเงินรวมใบนี้ (PO Total Amount)
                </span>
                <span className="text-xl font-black text-emerald-800">
                  ฿{Number(order.totalAmount || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Signatures (2 Roles Only - Matches Standard PO 1:1) */}
            <div className="mt-6 pt-2 grid grid-cols-2 gap-8 text-center text-xs">
              <div className="space-y-1">
                <div className="border-b border-slate-400 pb-6 mb-1"></div>
                <p className="font-bold text-slate-800 m-0">
                  ลงชื่อ......................................................
                </p>
                <p className="text-slate-500 text-[10.5px] m-0">( ผู้สั่งซื้อ / ผู้จัดการสาขา )</p>
                <p className="text-slate-400 text-[9.5px] m-0">
                  วันที่: ..... / ..... / ..........
                </p>
              </div>

              <div className="space-y-1">
                <div className="border-b border-slate-400 pb-6 mb-1"></div>
                <p className="font-bold text-slate-800 m-0">
                  ลงชื่อ......................................................
                </p>
                <p className="text-slate-500 text-[10.5px] m-0">( ผู้รับวัตถุดิบเข้าหน้าสาขา )</p>
                <p className="text-slate-400 text-[9.5px] m-0">
                  วันที่: ..... / ..... / ..........
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
