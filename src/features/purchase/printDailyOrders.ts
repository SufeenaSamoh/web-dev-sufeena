import type { PurchaseOrder, PurchaseBranch, PurchaseSupplier, PurchaseOrderStatus } from "./types";
import { formatDate } from "@/lib/dateFormat";
import { toast } from "sonner";
import { printHtmlDocument } from "@/lib/printUtils";

/**
 * Converts YYYY-MM-DD or date to Full Thai Date (e.g. "20 สิงหาคม 2569" or "20 สิงหาคม 2026")
 */
export function formatThaiDateFull(dateStr: string): string {
  if (!dateStr) return "-";
  const thaiMonths = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];

  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const thaiYear = year > 2400 ? year : year + 543;
      const monthName = thaiMonths[monthIdx] || "";
      return `${day} ${monthName} ${thaiYear}`;
    }

    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = d.getDate();
      const monthName = thaiMonths[d.getMonth()];
      const year = d.getFullYear();
      const thaiYear = year > 2400 ? year : year + 543;
      return `${day} ${monthName} ${thaiYear}`;
    }
  } catch {
    // fallback
  }
  return formatDate(dateStr);
}

/**
 * Returns current date and time formatted in Thai format: "DD/MM/YYYY HH:mm น."
 */
export function getCurrentPrintTimestamp(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const thaiYear = year > 2400 ? year : year + 543;
  const hours = String(now.getHours()).padStart(2, "0");
  const mins = String(now.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${thaiYear} ${hours}:${mins} น.`;
}

/**
 * Extract time string (HH:mm) from PO
 */
export function getOrderTime(order: PurchaseOrder): string {
  if (order.orderTime) return order.orderTime;
  if (order.updatedAt) {
    if (order.updatedAt.includes("T")) {
      return order.updatedAt.split("T")[1].slice(0, 5);
    }
    const timeMatch = order.updatedAt.match(/\d{2}:\d{2}/);
    if (timeMatch) return timeMatch[0];
  }
  return "08:00";
}

/**
 * Thai label for PO status
 */
export function getOrderStatusLabel(status: PurchaseOrderStatus): string {
  switch (status) {
    case "pending":
      return "รอดำเนินการ";
    case "approved":
      return "กำลังจัดซื้อ";
    case "in_transit":
      return "สั่งซื้อแล้ว";
    case "received":
      return "ได้รับสินค้าแล้ว";
    case "cancelled":
      return "ยกเลิก";
    default:
      return "รอดำเนินการ";
  }
}

/**
 * Sort orders chronologically: Date -> Supplier -> Branch -> Time -> PO ID
 */
export function sortOrdersForPrint(
  orders: PurchaseOrder[],
  suppliers: PurchaseSupplier[],
  branches: PurchaseBranch[],
): PurchaseOrder[] {
  return [...orders].sort((a, b) => {
    // 1. Date
    if (a.orderDate !== b.orderDate) {
      return a.orderDate.localeCompare(b.orderDate);
    }

    // 2. Supplier
    const supA = (
      suppliers.find((s) => s.id === a.supplierId)?.name ||
      a.supplierName ||
      ""
    ).toLowerCase();
    const supB = (
      suppliers.find((s) => s.id === b.supplierId)?.name ||
      b.supplierName ||
      ""
    ).toLowerCase();
    if (supA !== supB) {
      return supA.localeCompare(supB, "th");
    }

    // 3. Branch
    const brA = (
      branches.find((b) => b.id === a.branchId)?.code ||
      a.branchName ||
      ""
    ).toLowerCase();
    const brB = (
      branches.find((b) => b.id === b.branchId)?.code ||
      b.branchName ||
      ""
    ).toLowerCase();
    if (brA !== brB) {
      return brA.localeCompare(brB, "th");
    }

    // 4. Time
    const timeA = getOrderTime(a);
    const timeB = getOrderTime(b);
    if (timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }

    // 5. PO ID
    return a.id.localeCompare(b.id);
  });
}

/**
 * Clean automated smart compare/batch text from notes
 */
export function cleanOrderNotes(notes?: string): string {
  if (!notes) return "";
  let text = notes.trim();
  text = text.replace(/สร้างจากระบบเทียบราคาอัตโนมัติ.*?(\]|$)/gi, "");
  text = text.replace(/สร้างจากระบบเทียบราคาอัจฉริยะ.*?(\]|$)/gi, "");
  text = text.replace(/Smart Compare/gi, "");
  text = text.replace(/\[\s*สั่งปกติ\s*\|\s*Batch:[^\]]*\]/gi, "");
  text = text.replace(/\[\s*สั่งด่วน\s*\|\s*Batch:[^\]]*\]/gi, "");
  text = text.replace(/Batch:\s*BATCH-[A-Z0-9]+/gi, "");
  text = text.replace(/BATCH-[A-Z0-9]+/gi, "");
  text = text.trim();
  text = text.replace(/^\[\s*\]$/, "").replace(/^[-–—\s]+$/, "");
  return text;
}

/**
 * Generate full, self-contained printable HTML document for grouped POs matching standard PO format exactly
 */
export function generateDailyOrdersPrintHtml(
  orders: PurchaseOrder[],
  branches: PurchaseBranch[],
  suppliers: PurchaseSupplier[],
  selectedDate: string,
  currentUser?: { name?: string },
): string {
  const sortedOrders = sortOrdersForPrint(orders, suppliers, branches);
  const printTimestamp = getCurrentPrintTimestamp();
  const thaiDisplayDate = formatThaiDateFull(selectedDate);

  const poSectionsHtml = sortedOrders
    .map((order, orderIdx) => {
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

      const itemsRowsHtml = order.items
        .map(
          (item, idx) => `
          <tr style="${idx % 2 === 1 ? "background-color: #f8fafc;" : ""}">
            <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: center; color: #475569; font-weight: 600; font-size: 11px;">
              ${idx + 1}
            </td>
            <td style="padding: 7px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #0f172a; font-size: 11px;">
              ${item.productCode || "-"}
            </td>
            <td style="padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #0f172a; font-size: 11.5px;">
              ${item.productName || "-"}
            </td>
            <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #0f172a; font-size: 11.5px;">
              ${Number(item.quantity).toLocaleString()} ${item.unit || ""}
            </td>
            <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: right; color: #334155; font-size: 11px;">
              ฿${Number(item.unitPrice || 0).toLocaleString()}
            </td>
            <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: 900; color: #0f172a; font-size: 11.5px;">
              ฿${Number(item.totalPrice || 0).toLocaleString()}
            </td>
          </tr>
        `,
        )
        .join("");

      return `
        <div class="po-document">
          <!-- Top Stamp & Document Header (Matches Standard PO 1:1) -->
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 12px;">
            <table style="width: 100%; border-collapse: collapse; border: none;">
              <tr>
                <td style="vertical-align: top; width: 60%;">
                  <div style="margin-bottom: 6px;">
                    <span style="display: inline-block; padding: 4px 10px; background-color: #047857; color: #ffffff; font-weight: 900; font-size: 11px; border-radius: 4px; letter-spacing: 0.5px;">
                      ใบสั่งซื้อวัตถุดิบ (PURCHASE ORDER)
                    </span>
                    <span style="display: inline-block; padding: 3px 8px; background-color: #f1f5f9; color: #334155; font-weight: bold; font-size: 10px; border-radius: 4px; border: 1px solid #cbd5e1; margin-left: 6px;">
                      ใบที่ ${orderIdx + 1}/${sortedOrders.length} • ${order.id}
                    </span>
                  </div>
                  <h2 style="margin: 4px 0 2px 0; font-size: 17px; font-weight: 800; color: #0f172a;">
                    ${branchName}
                  </h2>
                  <div style="font-size: 11px; color: #475569;">
                    สถานที่: ${branchLocation}
                  </div>
                  <div style="font-size: 11px; color: #475569; margin-top: 1px;">
                    ผู้จัดการสาขา: ${branchManager} | โทร: ${branchPhone}
                  </div>
                </td>
                <td style="text-align: right; vertical-align: top; width: 40%; font-size: 11.5px; color: #334155; line-height: 1.6;">
                  <div>
                    <strong style="color: #0f172a;">วันที่สั่งซื้อ:</strong> ${formatDate(order.orderDate)}
                  </div>
                  <div>
                    <strong style="color: #0f172a;">กำหนดรับเข้า:</strong> ${expectedDate}
                  </div>
                  <div>
                    <strong style="color: #0f172a;">ผู้ทำรายการ:</strong> ${order.createdBy || branchManager}
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <!-- Supplier Info Box (Matches Standard PO 1:1) -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; background-color: #f8fafc; border-radius: 8px; margin-bottom: 14px; font-size: 11px;">
            <tr>
              <td style="width: 50%; padding: 10px 14px; vertical-align: top; border-right: 1px solid #cbd5e1;">
                <div style="font-size: 9.5px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">
                  รายละเอียดซัพพลายเออร์ (Supplier)
                </div>
                <div style="font-size: 12.5px; font-weight: 900; color: #0f172a;">
                  ${supplierName}
                </div>
                <div style="font-size: 11px; color: #475569; margin-top: 3px;">
                  <strong style="color: #0f172a;">เงื่อนไขการจัดส่ง:</strong> ${supplierDeliveryTerms}
                </div>
              </td>
              <td style="width: 50%; padding: 10px 14px; vertical-align: top;">
                <div style="font-size: 9.5px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">
                  สถานะใบสั่งซื้อ (Status)
                </div>
                <div style="font-size: 12px; font-weight: bold; color: #047857;">
                  ${statusLabel}
                </div>
              </td>
            </tr>
          </table>

          <!-- Items Table (Matches Standard PO 1:1) -->
          <div style="margin-bottom: 12px;">
            <div style="font-size: 11px; font-weight: bold; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
              รายการวัตถุดิบสั่งซื้อ (${order.items.length} รายการ)
            </div>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 11px;">
              <thead>
                <tr style="background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: left;">
                  <th style="padding: 7px 8px; border: 1px solid #0f172a; text-align: center; width: 45px;">ลำดับ</th>
                  <th style="padding: 7px 8px; border: 1px solid #0f172a; width: 110px;">รหัสสินค้า</th>
                  <th style="padding: 7px 8px; border: 1px solid #0f172a;">รายการสินค้า</th>
                  <th style="padding: 7px 8px; border: 1px solid #0f172a; text-align: right; width: 90px;">จำนวน</th>
                  <th style="padding: 7px 8px; border: 1px solid #0f172a; text-align: right; width: 90px;">ราคา/หน่วย</th>
                  <th style="padding: 7px 8px; border: 1px solid #0f172a; text-align: right; width: 110px;">รวมเงิน (บาท)</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRowsHtml}
              </tbody>
            </table>
          </div>

          <!-- Total & Summary Section (Matches Standard PO 1:1) -->
          <table style="width: 100%; border-collapse: collapse; border: none; margin-top: 4px; margin-bottom: 18px;">
            <tr>
              <td style="vertical-align: top; width: 55%; font-size: 10px; color: #64748b; line-height: 1.5;">
                <div style="font-weight: bold; color: #334155; margin-bottom: 2px;">เงื่อนไขและข้อตกลง:</div>
                <div>1. กรุณาตรวจสอบจำนวนและสภาพวัตถุดิบก่อนลงนามรับสินค้า</div>
                <div>2. หากพบสินค้าชำรุดเสียหายให้ระบุลงในใบส่งของทันที</div>
                ${
                  cleanedNotes
                    ? `<div style="margin-top: 6px; padding: 6px 10px; background-color: #f8fafc; border: 1.5px solid #94a3b8; border-radius: 6px; color: #0f172a; font-size: 11px;"><span style="font-weight: 800; color: #0f172a;">หมายเหตุใบสั่งซื้อ:</span> <strong style="font-weight: 900; color: #000000; font-size: 11.5px;">${cleanedNotes}</strong></div>`
                    : ""
                }
              </td>
              <td style="vertical-align: top; width: 45%; text-align: right;">
                <div style="display: inline-block; background-color: #f1f5f9; border: 2px solid #94a3b8; border-radius: 8px; padding: 8px 16px; text-align: right; min-width: 220px;">
                  <div style="font-size: 10px; font-weight: bold; color: #475569;">
                    ยอดเงินรวมใบนี้ (PO Total Amount)
                  </div>
                  <div style="font-size: 18px; font-weight: 900; color: #047857; margin-top: 2px;">
                    ฿${Number(order.totalAmount || 0).toLocaleString()}
                  </div>
                </div>
              </td>
            </tr>
          </table>

          <!-- Signatures (2 Roles Only - Matches Standard PO 1:1) -->
          <div style="margin-top: 24px; padding-top: 10px; page-break-inside: avoid;">
            <table style="width: 100%; border-collapse: collapse; border: none; text-align: center; font-size: 11px; color: #334155;">
              <tr>
                <td style="width: 50%; padding: 0 20px; vertical-align: top;">
                  <div style="border-bottom: 1px solid #94a3b8; margin-bottom: 6px; padding-bottom: 24px;"></div>
                  <div style="font-weight: bold; color: #0f172a;">
                    ลงชื่อ......................................................
                  </div>
                  <div style="color: #64748b; font-size: 10.5px; margin-top: 2px;">
                    ( ผู้สั่งซื้อ / ผู้จัดการสาขา )
                  </div>
                  <div style="color: #94a3b8; font-size: 9.5px; margin-top: 2px;">
                    วันที่: ..... / ..... / ..........
                  </div>
                </td>

                <td style="width: 50%; padding: 0 20px; vertical-align: top;">
                  <div style="border-bottom: 1px solid #94a3b8; margin-bottom: 6px; padding-bottom: 24px;"></div>
                  <div style="font-weight: bold; color: #0f172a;">
                    ลงชื่อ......................................................
                  </div>
                  <div style="color: #64748b; font-size: 10.5px; margin-top: 2px;">
                    ( ผู้รับวัตถุดิบเข้าหน้าสาขา )
                  </div>
                  <div style="color: #94a3b8; font-size: 9.5px; margin-top: 2px;">
                    วันที่: ..... / ..... / ..........
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </div>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ใบสั่งซื้อประจำวันที่ ${formatDate(selectedDate)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Sarabun", "Noto Sans Thai", "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .po-document {
      page-break-after: always;
      break-after: page;
      padding: 16px 20px;
      max-width: 820px;
      margin: 0 auto 20px auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
    }
    .po-document:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    table {
      page-break-inside: avoid;
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
    .no-print {
      display: block;
    }
    @media print {
      body {
        background: #ffffff !important;
      }
      .no-print {
        display: none !important;
      }
      .po-document {
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
        border: none !important;
      }
    }
  </style>
</head>
<body style="background: #f1f5f9; padding-bottom: 40px;">
  <!-- Print Control Bar for Screen View (No Emojis) -->
  <div class="no-print" style="position: sticky; top: 0; z-index: 9999; background: #0f172a; color: #ffffff; padding: 12px 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
    <div>
      <div style="font-size: 14px; font-weight: bold; line-height: 1.2;">
        ใบสั่งซื้อรวมประจำวัน (Purchase Orders Print)
      </div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
        วันที่ ${formatThaiDateFull(selectedDate)} • ทั้งหมด ${orders.length} ใบสั่งซื้อ (แยก 1 PO ต่อหน้า)
      </div>
    </div>

    <div style="display: flex; align-items: center; gap: 10px;">
      <button onclick="window.print()" style="background: #047857; color: #ffffff; border: none; padding: 8px 20px; border-radius: 8px; font-weight: bold; font-size: 13px; cursor: pointer; box-shadow: 0 2px 6px rgba(4,120,87,0.4);">
        พิมพ์เอกสาร (Print / Save as PDF)
      </button>
      <button onclick="window.close()" style="background: #334155; color: #e2e8f0; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; font-size: 12px; cursor: pointer;">
        ปิดหน้าต่าง (Close)
      </button>
    </div>
  </div>

  ${poSectionsHtml}

  <script>
    window.addEventListener("DOMContentLoaded", function() {
      setTimeout(function() {
        try {
          window.focus();
          window.print();
        } catch(e) {
          console.warn("Auto print failed:", e);
        }
      }, 400);
    });
  </script>
</body>
</html>
  `.trim();
}

/**
 * Open a dedicated printable tab/window with the formatted PO document
 */
export function openDailyOrdersPrintWindow({
  orders,
  branches,
  suppliers,
  selectedDate,
  currentUser,
}: {
  orders: PurchaseOrder[];
  branches: PurchaseBranch[];
  suppliers: PurchaseSupplier[];
  selectedDate: string;
  currentUser?: { name?: string };
}): boolean {
  if (!orders || orders.length === 0) {
    toast.error("ไม่มีรายการสั่งซื้อสำหรับวันที่เลือก");
    return false;
  }

  try {
    const htmlContent = generateDailyOrdersPrintHtml(
      orders,
      branches,
      suppliers,
      selectedDate,
      currentUser,
    );

    printHtmlDocument(htmlContent, `PO_DailyOrders_${selectedDate}`);
    return true;
  } catch (err) {
    console.error("Open print window error:", err);
    toast.error("ไม่สามารถเปิดหน้าพิมพ์ได้");
    return false;
  }
}

/**
 * Download standalone printable HTML file (Works offline / in any browser)
 */
export function downloadDailyOrdersPrintHtml({
  orders,
  branches,
  suppliers,
  selectedDate,
  currentUser,
}: {
  orders: PurchaseOrder[];
  branches: PurchaseBranch[];
  suppliers: PurchaseSupplier[];
  selectedDate: string;
  currentUser?: { name?: string };
}) {
  if (!orders || orders.length === 0) {
    toast.error("ไม่มีรายการสั่งซื้อสำหรับดาวน์โหลด");
    return;
  }

  const htmlContent = generateDailyOrdersPrintHtml(
    orders,
    branches,
    suppliers,
    selectedDate,
    currentUser,
  );

  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ใบสั่งซื้อรวม_${selectedDate}_${orders.length}PO.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success("ดาวน์โหลดไฟล์เอกสารพร้อมพิมพ์สำเร็จ (เปิดไฟล์เพื่อพิมพ์ได้ทันที)");
}

/**
 * Execute native browser print dialog immediately
 */
export function executeDailyOrdersPrint({
  orders,
  branches,
  suppliers,
  selectedDate,
  currentUser,
}: {
  orders: PurchaseOrder[];
  branches: PurchaseBranch[];
  suppliers: PurchaseSupplier[];
  selectedDate: string;
  currentUser?: { name?: string };
}): boolean {
  if (!orders || orders.length === 0) {
    toast.error("ไม่มีรายการสั่งซื้อสำหรับวันที่เลือก");
    return false;
  }

  // Use openDailyOrdersPrintWindow for clean, isolated printable tab, or fallback to window.print
  return openDailyOrdersPrintWindow({
    orders,
    branches,
    suppliers,
    selectedDate,
    currentUser,
  });
}
