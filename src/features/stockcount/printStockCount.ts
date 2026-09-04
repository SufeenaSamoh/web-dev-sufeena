import { formatDate, formatDateTime } from "@/lib/dateFormat";
import { formatUnitThai } from "@/lib/unitConversion";
import type { Item, Category, Branch, StockCountDocument, User } from "@/lib/types";
import { toast } from "sonner";
import { printHtmlDocument } from "@/lib/printUtils";

export interface StockCountPrintRow {
  no: number;
  code: string;
  name: string;
  category: string;
  stockUnit: string;
  systemQty: number;
  countedQty: number | null;
  variance: number | null;
  remark: string;
}

export interface GenerateStockCountPrintParams {
  document?: StockCountDocument | null;
  rows: StockCountPrintRow[];
  branch: Branch | null;
  categoryName: string;
  countDate: string;
  countedBy: string;
  printMode: "system" | "blank";
  appName?: string;
}

/**
 * Generate full, self-contained HTML document for printing Stock Count sheet
 */
export function generateStockCountPrintHtml({
  document,
  rows,
  branch,
  categoryName,
  countDate,
  countedBy,
  printMode,
  appName = "Hana Inventory & Ordering System",
}: GenerateStockCountPrintParams): string {
  const displayDate = formatDate(countDate);
  const docNumber = document?.documentNumber || `DRAFT-${countDate.replace(/-/g, "")}`;
  const isHQ =
    !branch ||
    branch.id === "b1" ||
    branch.name.includes("สำนักงานใหญ่") ||
    branch.name.includes("HQ");

  const branchLabel = isHQ
    ? "สำนักงานใหญ่ (Headquarters / HQ)"
    : `สาขา: ${branch.name} (${branch.code || "BR"})`;

  const printedAtStr = formatDateTime(new Date());

  const tableRowsHtml = rows
    .map((r) => {
      const isBlank = printMode === "blank" && !document;
      const sysQtyFormatted = isBlank
        ? "—"
        : r.systemQty.toLocaleString(undefined, { maximumFractionDigits: 3 });

      const countedQtyFormatted = isBlank
        ? '<div style="height: 20px; border-bottom: 1px dotted #000;"></div>'
        : r.countedQty !== null && r.countedQty !== undefined
          ? `<span style="font-weight: bold; font-family: monospace;">${r.countedQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>`
          : '<div style="height: 20px; border-bottom: 1px dotted #000;"></div>';

      const varianceFormatted =
        isBlank || r.variance === null
          ? "—"
          : r.variance > 0
            ? `+${r.variance.toLocaleString(undefined, { maximumFractionDigits: 3 })}`
            : r.variance.toLocaleString(undefined, { maximumFractionDigits: 3 });

      const remarkFormatted =
        r.remark || '<div style="height: 16px; border-bottom: 1px dotted #cbd5e1;"></div>';

      return `
        <tr class="item-row">
          <td style="text-align: center;">${r.no}</td>
          <td style="font-family: monospace; font-size: 11px;">${r.code}</td>
          <td style="font-weight: 600;">${r.name}</td>
          <td style="font-size: 11px;">${r.category}</td>
          <td style="text-align: center; font-weight: bold;">${r.stockUnit}</td>
          <td style="text-align: right; font-family: monospace;">${sysQtyFormatted}</td>
          <td style="text-align: center; background-color: #f8fafc;">${countedQtyFormatted}</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold;">${varianceFormatted}</td>
          <td style="font-size: 10px;">${remarkFormatted}</td>
        </tr>
      `;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ใบตรวจนับสต็อก - ${docNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 10mm 12mm 10mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 16px;
      color: #0f172a;
      background: #ffffff;
      font-size: 12px;
      line-height: 1.4;
    }
    .print-container {
      max-width: 210mm;
      margin: 0 auto;
      background: #fff;
    }
    /* Toolbar at top for web preview */
    .no-print-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      margin-bottom: 20px;
      background: #0f172a;
      color: #fff;
      border-radius: 8px;
      font-family: 'Sarabun', sans-serif;
    }
    .btn-print {
      background: #10b981;
      color: white;
      border: none;
      padding: 8px 18px;
      font-size: 13px;
      font-weight: bold;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-print:hover {
      background: #059669;
    }
    .header-box {
      border-bottom: 2px solid #000;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .header-grid {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 16px;
      align-items: start;
    }
    .app-title {
      font-size: 18px;
      font-weight: 800;
      text-transform: uppercase;
      margin: 0 0 2px 0;
      color: #000;
    }
    .doc-title {
      font-size: 16px;
      font-weight: 800;
      margin: 0 0 6px 0;
      color: #000;
    }
    .meta-box {
      border: 1px solid #000;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 11px;
      line-height: 1.5;
      min-width: 200px;
      background: #f8fafc;
    }
    .sub-meta-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 10px;
      font-size: 11px;
      color: #334155;
      font-weight: 500;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-bottom: 20px;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #000;
      padding: 5px 6px;
      vertical-align: middle;
    }
    table.data-table thead th {
      background-color: #f1f5f9;
      font-weight: 700;
      color: #000;
      text-align: left;
    }
    table.data-table thead {
      display: table-header-group;
    }
    table.data-table tbody tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .signatures-section {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 2px solid #000;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
      text-align: center;
    }
    .sig-block {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 100px;
    }
    .sig-title {
      font-weight: 700;
      font-size: 11px;
      margin-bottom: 30px;
    }
    .sig-line {
      border-bottom: 1px dotted #000;
      margin: 0 16px 6px 16px;
    }
    .sig-name {
      font-size: 10.5px;
      color: #334155;
    }
    .sig-date {
      font-size: 10px;
      color: #64748b;
      margin-top: 3px;
    }
    .footer-note {
      margin-top: 20px;
      padding-top: 6px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      color: #64748b;
    }
    @media print {
      body {
        padding: 0 !important;
        background: #fff !important;
      }
      .no-print-toolbar {
        display: none !important;
      }
      .print-container {
        width: 100% !important;
        max-width: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <!-- Non-print toolbar for when opened in standalone tab -->
    <div class="no-print-toolbar">
      <div>
        <strong>ใบตรวจนับสต็อก: ${docNumber}</strong> &nbsp;|&nbsp; วันที่: ${displayDate} &nbsp;|&nbsp; ${branchLabel}
      </div>
      <div>
        <button class="btn-print" onclick="window.print()">🖨️ สั่งพิมพ์เอกสารนี้ (Print A4)</button>
      </div>
    </div>

    <!-- Document Header -->
    <div class="header-box">
      <div class="header-grid">
        <div>
          <h1 class="app-title">${appName}</h1>
          <h2 class="doc-title">ใบตรวจนับสต็อกวัตถุดิบและสินค้า (Stock Count Sheet)</h2>
          <div style="font-size: 11.5px; margin-top: 4px;">
            <strong>สถานที่ / หน่วยงาน:</strong>
            <span style="display: inline-block; padding: 2px 8px; border: 1px solid #000; border-radius: 4px; font-weight: bold; margin-left: 4px;">
              ${branchLabel}
            </span>
          </div>
        </div>

        <div class="meta-box">
          <div><strong>เลขที่เอกสาร:</strong> <span style="font-family: monospace; font-weight: bold;">${docNumber}</span></div>
          <div><strong>วันที่ตรวจนับ:</strong> <span>${displayDate}</span></div>
          <div><strong>ผู้ตรวจนับ:</strong> <span>${countedBy || "เจ้าหน้าที่ตรวจนับ"}</span></div>
          ${
            document
              ? `<div><strong>สถานะ:</strong> <span>${document.status || "Completed"} (Rev ${document.revision || 1})</span></div>`
              : `<div><strong>รูปแบบ:</strong> <span>${printMode === "blank" ? "แบบฟอร์มเปล่าสำหรับหน้างาน" : "แสดงยอดตามระบบ"}</span></div>`
          }
        </div>
      </div>

      <div class="sub-meta-bar">
        <div><strong>หมวดหมู่:</strong> ${categoryName}</div>
        <div><strong>จำนวนรายการทั้งหมด:</strong> ${rows.length} รายการ</div>
        <div><strong>หน่วยที่ใช้:</strong> หน่วยสต็อก (Stock Units)</div>
      </div>
    </div>

    <!-- Data Table -->
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 36px; text-align: center;">ลำดับ</th>
          <th style="width: 80px;">รหัส</th>
          <th>รายการวัตถุดิบ / สินค้า</th>
          <th style="width: 90px;">หมวดหมู่</th>
          <th style="width: 60px; text-align: center;">หน่วยสต็อก</th>
          <th style="width: 75px; text-align: right;">${printMode === "blank" && !document ? "ยอดในระบบ" : "ตามระบบ"}</th>
          <th style="width: 85px; text-align: center; background-color: #e2e8f0;">จำนวนที่นับจริง</th>
          <th style="width: 65px; text-align: right;">ส่วนต่าง</th>
          <th style="width: 90px;">หมายเหตุ</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows.length > 0
            ? tableRowsHtml
            : `<tr><td colspan="9" style="text-align: center; padding: 20px;">ไม่พบรายการวัตถุดิบตามเงื่อนไขที่เลือก</td></tr>`
        }
      </tbody>
    </table>

    <!-- Signatures & Approval Section -->
    <div class="signatures-section">
      <div class="signatures-grid">
        <div class="sig-block">
          <div class="sig-title">ผู้ตรวจนับสินค้า (Counted By)</div>
          <div>
            <div class="sig-line"></div>
            <div class="sig-name">(${countedBy || "................................................"})</div>
            <div class="sig-date">วันที่ ..... / ..... / ..........</div>
          </div>
        </div>

        <div class="sig-block">
          <div class="sig-title">ผู้ตรวจสอบ / ผู้จัดการสาขา (Verified By)</div>
          <div>
            <div class="sig-line"></div>
            <div class="sig-name">(................................................)</div>
            <div class="sig-date">วันที่ ..... / ..... / ..........</div>
          </div>
        </div>

        <div class="sig-block">
          <div class="sig-title">ผู้อนุมัติการปรับปรุงสต็อก (Approved By)</div>
          <div>
            <div class="sig-line"></div>
            <div class="sig-name">(................................................)</div>
            <div class="sig-date">วันที่ ..... / ..... / ..........</div>
          </div>
        </div>
      </div>

      <div class="footer-note">
        <span>เอกสารนี้ออกโดยระบบบริหารจัดการคลังสินค้า ${appName}</span>
        <span>พิมพ์เมื่อ: ${printedAtStr}</span>
      </div>
    </div>
  </div>

  <script>
    // Auto-trigger print when opened in standalone window
    window.addEventListener('DOMContentLoaded', function() {
      // Short delay for fonts to render
      setTimeout(function() {
        if (window.opener) {
          window.print();
        }
      }, 350);
    });
  </script>
</body>
</html>`;
}

/**
 * Open a dedicated printable tab/window with the formatted Stock Count document
 */
export function openStockCountPrintWindow(params: GenerateStockCountPrintParams): boolean {
  try {
    const htmlContent = generateStockCountPrintHtml(params);
    const docNumber =
      params.document?.documentNumber || `DRAFT-${params.countDate.replace(/-/g, "")}`;
    printHtmlDocument(htmlContent, `ใบตรวจนับสต็อก_${docNumber}`);
    return true;
  } catch (err) {
    console.error("Open stock count print error:", err);
    toast.error("ไม่สามารถเปิดหน้าพิมพ์ได้");
    return false;
  }
}

/**
 * Print via dynamic iframe without leaving the current view
 */
export function printViaIframe(htmlContent: string): boolean {
  try {
    printHtmlDocument(htmlContent, "ใบตรวจนับสต็อก");
    return true;
  } catch (err) {
    console.error("printViaIframe failed:", err);
    window.print();
    return true;
  }
}

/**
 * Download standalone printable HTML file (Works offline / in any browser)
 */
export function downloadStockCountPrintHtml(params: GenerateStockCountPrintParams) {
  try {
    const docNumber =
      params.document?.documentNumber || `DRAFT-${params.countDate.replace(/-/g, "")}`;
    const htmlContent = generateStockCountPrintHtml(params);
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ใบตรวจนับสต็อก_${docNumber}_${params.countDate}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("ดาวน์โหลดไฟล์เอกสารพร้อมพิมพ์สำเร็จ (สามารถเปิดไฟล์เพื่อพิมพ์ได้ทันที)");
  } catch (err) {
    console.error("Download print html error:", err);
    toast.error("ไม่สามารถดาวน์โหลดไฟล์ได้");
  }
}

/**
 * Primary execute function for Stock Count Print Modal
 */
export function executeStockCountPrint(params: GenerateStockCountPrintParams) {
  if (!params.rows || params.rows.length === 0) {
    toast.error("ไม่มีรายการวัตถุดิบสำหรับพิมพ์");
    return;
  }

  openStockCountPrintWindow(params);
}
