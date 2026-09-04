import React, { useEffect, useState } from "react";
import type { PurchaseOrder, PurchaseBranch } from "./types";
import { Printer, X, FileText, CheckCircle2, Image as ImageIcon, Loader2 } from "lucide-react";
import { toPng } from "html-to-image";
import { formatDate } from "@/lib/dateFormat";

interface PdfExportModalProps {
  order?: PurchaseOrder | null;
  orders?: PurchaseOrder[] | null;
  branch: PurchaseBranch;
  isOpen: boolean;
  onClose: () => void;
  batchTitle?: string;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  order,
  orders,
  branch,
  isOpen,
  onClose,
  batchTitle,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState("");

  // Determine active list of orders
  const orderList: PurchaseOrder[] = orders && orders.length > 0 ? orders : order ? [order] : [];

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isGenerating) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isGenerating]);

  if (!isOpen || orderList.length === 0) return null;

  const totalBatchAmount = orderList.reduce((sum, o) => sum + o.totalAmount, 0);

  // Direct Image (PNG) Download via html-to-image
  const handleDownloadImage = async () => {
    const element = document.getElementById("printable-po");
    if (!element) return;

    try {
      setIsGenerating(true);
      setStatusText("กำลังบันทึกรูปภาพใบสั่งซื้อ...");

      const dataUrl = await toPng(element, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        skipFonts: true,
      });

      const fileName =
        orderList.length === 1
          ? `ใบสั่งซื้อ_${branch.code}_${orderList[0].supplierName}_${orderList[0].orderDate.replace(/[/\s]/g, "-")}.png`
          : `ใบสั่งซื้อรวม_${orderList.length}ใบ_${branch.code}_${orderList[0].orderDate.replace(/[/\s]/g, "-")}.png`;

      const link = document.createElement("a");
      link.download = fileName;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to generate PNG:", err);
      alert(
        'เกิดข้อผิดพลาดในการสร้างรูปภาพ กรุณาลองกดปุ่ม "พิมพ์" เพื่อสั่งพิมพ์หรือบันทึกรูปนะคะ',
      );
    } finally {
      setIsGenerating(false);
      setStatusText("");
    }
  };

  // Export CSV for all orders in batch
  const handleExportCSV = () => {
    if (orderList.length === 0) return;
    const headers = [
      "ลำดับ",
      "เลขที่ PO",
      "ซัพพลายเออร์",
      "วันที่สั่งซื้อ",
      "กำหนดรับเข้า",
      "รหัสสินค้า",
      "รายการวัตถุดิบ",
      "จำนวน",
      "หน่วย",
      "ราคา/หน่วย (บาท)",
      "รวมเงิน (บาท)",
      "สถานะการรับของ",
      "หมายเหตุ",
    ];

    let rowIdx = 1;
    const rows: string[] = [];

    orderList.forEach((ord) => {
      ord.items.forEach((item) => {
        const statusStr =
          ord.status === "received"
            ? "ได้รับสินค้าแล้ว"
            : ord.status === "approved"
              ? "อนุมัติแล้ว"
              : ord.status === "in_transit"
                ? "อยู่ระหว่างขนส่ง"
                : "รอดำเนินการ";

        const combinedNotes = [ord.notes, item.notes].filter(Boolean).join(" | ");

        rows.push(
          [
            rowIdx++,
            `"${ord.id}"`,
            `"${ord.supplierName.replace(/"/g, '""')}"`,
            `"${formatDate(ord.orderDate)}"`,
            `"${formatDate(ord.expectedReceivedDate)}"`,
            `"${item.productCode}"`,
            `"${item.productName.replace(/"/g, '""')}"`,
            item.quantity,
            `"${item.unit}"`,
            item.unitPrice,
            item.totalPrice,
            `"${statusStr}"`,
            `"${combinedNotes.replace(/"/g, '""')}"`,
          ].join(","),
        );
      });
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `รายงานสั่งซื้อรวม_${orderList.length}ใบ_${branch.code}_${orderList[0].orderDate.replace(/[/\s]/g, "-")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Native Print fallback with clean pop-up window support
  const handlePrint = () => {
    const printElement = document.getElementById("printable-po");
    if (!printElement) {
      window.print();
      return;
    }

    try {
      const printWin = typeof window !== "undefined" ? window.open("", "_blank") : null;
      if (printWin && printWin.document) {
        printWin.document.write(`
          <!DOCTYPE html>
          <html lang="th">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ใบสั่งซื้อ ${branch.name} (${orderList.length} ใบ)</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Sarabun', sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 12px; }
              .po-page { page-break-after: always; break-after: page; }
              .po-page:last-child { page-break-after: auto; break-after: auto; }
              @media print {
                @page { size: A4 portrait; margin: 8mm 10mm; }
                body { background: #ffffff; padding: 0; }
                .no-print { display: none !important; }
                .po-page { page-break-after: always; break-after: page; }
                .po-page:last-child { page-break-after: auto; break-after: auto; }
              }
            </style>
          </head>
          <body>
            <div class="no-print max-w-4xl mx-auto mb-4 p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between gap-2 shadow-lg">
              <span class="text-xs font-bold truncate">📄 ใบสั่งซื้อวัตถุดิบ (${branch.name}) - รวม ${orderList.length} ใบสั่งซื้อ</span>
              <div class="flex items-center gap-2">
                <button onclick="window.print()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg shadow-sm cursor-pointer shrink-0">
                  🖨️ พิมพ์เอกสารรวม (${orderList.length} ใบ)
                </button>
                <button onclick="window.close()" class="px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white font-extrabold text-xs rounded-lg shadow-sm cursor-pointer shrink-0">
                  ❌ ปิด
                </button>
              </div>
            </div>
            <div class="max-w-4xl mx-auto bg-white border border-slate-300 p-6 sm:p-8 rounded-xl shadow-sm">
              ${printElement.innerHTML}
            </div>
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.focus();
                  window.print();
                }, 400);
              };
            </script>
          </body>
          </html>
        `);
        printWin.document.close();
        return;
      }
    } catch (err) {
      console.error("Pop-up window print failed, falling back to direct window.print()", err);
    }

    try {
      window.focus();
      setTimeout(() => {
        window.print();
      }, 100);
    } catch (e) {
      console.error("Window print error:", e);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !isGenerating) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs overflow-y-auto p-2 sm:p-4 md:p-6 flex justify-center items-start pt-2 sm:pt-6 pb-16 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden my-2 sm:my-4 border border-slate-200 dark:border-slate-800 flex flex-col">
        {/* Sticky Modal Top Controls Bar */}
        <div className="sticky top-0 z-30 print:hidden bg-slate-900 text-white p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between gap-2 shadow-md flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-white truncate flex items-center gap-2">
                <span>ใบสั่งซื้อวัตถุดิบ</span>
                <span className="bg-emerald-500 text-slate-950 text-[10px] px-2 py-0.5 rounded-full font-black">
                  {orderList.length > 1 ? `รวม ${orderList.length} ใบสั่งซื้อ` : `1 ใบสั่งซื้อ`}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 truncate hidden sm:block">
                {branch.name} •{" "}
                {batchTitle ||
                  (orderList.length === 1
                    ? orderList[0].supplierName
                    : `ยอดรวมรอบนี้ ฿${totalBatchAmount.toLocaleString()}`)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap">
            {/* Export CSV Button */}
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 border border-emerald-500"
              title="ส่งออกรายงานไฟล์ CSV รวมทุกใบสั่งซื้อในรอบนี้"
            >
              <span>📥 Export CSV</span>
            </button>

            {/* Save Image Button */}
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleDownloadImage}
              className="px-3.5 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="บันทึกเป็นรูปภาพ PNG สำหรับส่งไลน์ หรือบันทึกในมือถือ"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <ImageIcon className="w-4 h-4 text-amber-300" />
              )}
              <span>บันทึกรูป PNG</span>
            </button>

            {/* Native Print Button */}
            <button
              type="button"
              disabled={isGenerating}
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="สั่งพิมพ์รวมทุกแผ่นผ่านเครื่องพิมพ์ (Print)"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>พิมพ์รวม ({orderList.length} ใบ)</span>
            </button>

            {/* Red Close Button */}
            <button
              type="button"
              disabled={isGenerating}
              onClick={onClose}
              className="px-3.5 sm:px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-extrabold shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 border border-red-500"
              title="ปิดหน้าต่างพิมพ์ (Esc)"
            >
              <X className="w-4 h-4 stroke-[3]" />
              <span>ปิด</span>
            </button>
          </div>
        </div>

        {/* Loading Overlay when generating Image */}
        {isGenerating && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-2 justify-center print:hidden">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400" />
            <span>{statusText}</span>
          </div>
        )}

        {/* PRINTABLE DOCUMENT BODY (Sequential PO sheets with Page Breaks) */}
        <div id="printable-po" className="p-6 sm:p-8 bg-white text-slate-800 space-y-12 text-xs">
          {orderList.map((ord, orderIdx) => (
            <div
              key={ord.id}
              className="po-page space-y-4 border-b-2 border-slate-300 pb-8 last:border-b-0 last:pb-0 print:border-b-0 print:pb-0"
              style={{ pageBreakAfter: orderIdx < orderList.length - 1 ? "always" : "auto" }}
            >
              {/* Top Stamp & Document Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className={`inline-block px-3 py-1 font-extrabold text-xs rounded shadow-xs ${
                        ord.status === "cancelled"
                          ? "bg-red-700 text-white"
                          : ord.status === "approved"
                            ? "bg-blue-700 text-white"
                            : "bg-emerald-700 text-white"
                      }`}
                    >
                      {ord.status === "cancelled"
                        ? "ใบสั่งซื้อถูกยกเลิก (CANCELLED)"
                        : "ใบสั่งซื้อวัตถุดิบ (PURCHASE ORDER)"}
                    </span>
                    <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-[10px] rounded border border-slate-300">
                      ใบที่ {orderIdx + 1}/{orderList.length} • {ord.id}
                    </span>
                    {ord.orderType === "urgent" && (
                      <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-900 font-black text-[10px] rounded border border-amber-300">
                        ⚡ ผักด่วน
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">{branch.name}</h2>
                  <p className="text-[11px] text-slate-600 mt-0.5">สถานที่: {branch.location}</p>
                  <p className="text-[11px] text-slate-600">
                    ผู้จัดการสาขา: {branch.manager} | โทร: {branch.phone}
                  </p>
                </div>

                <div className="text-right text-xs space-y-1">
                  <p className="text-slate-600">
                    <strong>วันที่สั่งซื้อ:</strong> {formatDate(ord.orderDate)}
                  </p>
                  <p className="text-slate-600">
                    <strong>กำหนดรับเข้า:</strong>{" "}
                    {formatDate(ord.expectedReceivedDate || ord.orderDate)}
                  </p>
                  <p className="text-slate-600">
                    <strong>ผู้ทำรายการ:</strong> {ord.createdBy}
                  </p>
                </div>
              </div>

              {/* Cancellation Notice Banner */}
              {ord.status === "cancelled" && (
                <div className="p-3 bg-red-50 border-2 border-red-500 rounded-xl text-red-900">
                  <strong className="text-xs font-black block">
                    ⚠️ คำสั่งซื้อนี้ถูกยกเลิกแล้ว
                  </strong>
                  <p className="text-[11px] mt-0.5">
                    <strong>เหตุผลในการยกเลิก:</strong> {ord.cancelReason || "ไม่ระบุ"}
                  </p>
                  <p className="text-[10px] text-red-700 mt-0.5">
                    ยกเลิกโดย: {ord.cancelledBy || "-"} | วันที่ยกเลิก: {ord.cancelledAt || "-"}
                  </p>
                </div>
              )}

              {/* Revision / Edit Notice */}
              {ord.editReason && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-[11px]">
                  <strong className="font-bold">📝 มีการปรับปรุงรายการสินค้า: </strong>
                  <span>{ord.editReason}</span>
                  {ord.editedBy && (
                    <span className="text-[10px] text-amber-700 block sm:inline sm:ml-2">
                      (แก้ไขโดย {ord.editedBy} เมื่อ {ord.editedAt})
                    </span>
                  )}
                </div>
              )}

              {/* Supplier Info Box */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-300 text-[11px]">
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[9px] tracking-wider block mb-0.5">
                    รายละเอียดซัพพลายเออร์ (Supplier)
                  </span>
                  <p className="font-extrabold text-xs text-slate-900">{ord.supplierName}</p>
                  <p className="text-slate-600 mt-0.5">
                    <strong>เงื่อนไขการจัดส่ง:</strong> {ord.deliveryTerms}
                  </p>
                </div>
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[9px] tracking-wider block mb-0.5">
                    สถานะใบสั่งซื้อ (Status)
                  </span>
                  <p className="font-bold text-emerald-800 flex items-center gap-1 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    {ord.status === "received"
                      ? "ได้รับสินค้าเข้าคลังแล้ว"
                      : ord.status === "approved"
                        ? "จัดซื้ออนุมัติแล้ว"
                        : ord.status === "in_transit"
                          ? "สินค้าอยู่ระหว่างขนส่ง"
                          : "รอดำเนินการจัดซื้อ"}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  รายการวัตถุดิบสั่งซื้อ ({ord.items.length} รายการ)
                </h4>
                <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold">
                      <th className="py-2 px-2.5 border-b border-slate-800 text-center w-12">
                        ลำดับ
                      </th>
                      <th className="py-2 px-2.5 border-b border-slate-800">รหัสสินค้า</th>
                      <th className="py-2 px-2.5 border-b border-slate-800">รายการสินค้า</th>
                      <th className="py-2 px-2.5 border-b border-slate-800 text-right">จำนวน</th>
                      <th className="py-2 px-2.5 border-b border-slate-800 text-right">
                        ราคา/หน่วย
                      </th>
                      <th className="py-2 px-2.5 border-b border-slate-800 text-right">
                        รวมเงิน (บาท)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {ord.items.map((item, idx) => (
                      <tr key={idx} className="even:bg-slate-50/70">
                        <td className="py-2 px-2.5 text-center font-semibold text-slate-500 border-r border-slate-200">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2.5 font-mono font-bold text-slate-900 border-r border-slate-200">
                          {item.productCode}
                        </td>
                        <td className="py-2 px-2.5 font-bold text-slate-900 border-r border-slate-200">
                          <div>{item.productName}</div>
                          {item.notes && item.notes.trim() && (
                            <div className="text-[10px] text-amber-800 font-bold mt-0.5">
                              * หมายเหตุ: {item.notes.trim()}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-right font-bold border-r border-slate-200">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-2 px-2.5 text-right border-r border-slate-200">
                          ฿{item.unitPrice.toLocaleString()}
                        </td>
                        <td className="py-2 px-2.5 text-right font-extrabold text-slate-900">
                          ฿{item.totalPrice.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total & Summary with PO Notes Highlighted */}
              <div className="pt-1 flex flex-row justify-between items-start gap-4">
                <div className="text-[10px] text-slate-600 space-y-2 max-w-sm flex-1">
                  <div>
                    <p className="font-bold text-slate-700">เงื่อนไขและข้อตกลง:</p>
                    <p className="leading-relaxed text-slate-500">
                      1. กรุณาตรวจสอบจำนวนและสภาพวัตถุดิบก่อนลงนามรับสินค้า
                      <br />
                      2. หากพบสินค้าชำรุดเสียหายให้ระบุลงในใบส่งของทันที
                    </p>
                  </div>

                  {/* PO Remarks Field - Bold Highlighted as requested */}
                  {ord.notes && ord.notes.trim() && (
                    <div className="p-2.5 bg-slate-50 rounded-xl border-2 border-slate-400 text-slate-900">
                      <span className="font-extrabold text-[11px] text-slate-900">
                        หมายเหตุใบสั่งซื้อ:{" "}
                      </span>
                      <strong className="font-black text-[12px] text-slate-950 block sm:inline">
                        {ord.notes.trim()}
                      </strong>
                    </div>
                  )}
                </div>

                <div className="bg-slate-100 p-3 rounded-xl border-2 border-slate-400 text-right min-w-[200px]">
                  <span className="text-[10px] text-slate-600 font-bold block">
                    ยอดเงินรวมใบนี้ (PO Total Amount)
                  </span>
                  <span className="text-xl font-black text-emerald-800">
                    ฿{ord.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Signatures Line */}
              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-[11px] text-slate-700">
                <div>
                  <div className="border-b border-slate-400 mb-1 pb-6"></div>
                  <p className="font-bold">
                    ลงชื่อ......................................................
                  </p>
                  <p className="text-slate-500 mt-0.5">( ผู้สั่งซื้อ / ผู้จัดการสาขา )</p>
                  <p className="text-slate-400 text-[9px] mt-0.5">
                    วันที่: ..... / ..... / ..........
                  </p>
                </div>

                <div>
                  <div className="border-b border-slate-400 mb-1 pb-6"></div>
                  <p className="font-bold">
                    ลงชื่อ......................................................
                  </p>
                  <p className="text-slate-500 mt-0.5">( ผู้รับวัตถุดิบเข้าหน้าสาขา )</p>
                  <p className="text-slate-400 text-[9px] mt-0.5">
                    วันที่: ..... / ..... / ..........
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Modal Controls Bar (Hidden during Print) */}
        <div className="print:hidden bg-slate-100 dark:bg-slate-800 p-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              กดปุ่ม <strong>"พิมพ์รวม"</strong> เพื่อสั่งพิมพ์หรือบันทึก PDF ครบทุกแผ่นในครั้งเดียว
              หรือ <strong>"Export CSV"</strong> เพื่อดึงไฟล์สรุปข้อมูล
            </span>
          </p>

          <div className="flex items-center gap-2.5 ml-auto flex-wrap">
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-extrabold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 border border-emerald-500"
            >
              <span>📥 Export CSV</span>
            </button>
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleDownloadImage}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <ImageIcon className="w-4 h-4 text-amber-300" />
              )}
              <span>บันทึกรูป PNG</span>
            </button>
            <button
              type="button"
              disabled={isGenerating}
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>พิมพ์รวม ({orderList.length} ใบ)</span>
            </button>
            <button
              type="button"
              disabled={isGenerating}
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <X className="w-4 h-4" />
              <span>ปิดหน้าต่าง</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
