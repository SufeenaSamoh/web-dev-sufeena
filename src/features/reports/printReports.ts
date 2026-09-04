import { printHtmlDocument, getThaiPrintTimestamp } from "@/lib/printUtils";
import { formatCurrency } from "@/lib/utils";
import type { User } from "@/lib/types";
import type { VarianceExecutiveSummary } from "@/features/reports/types/usageVariance";

export interface InventoryPrintRow {
  code: string;
  name: string;
  unit: string;
  category: string;
  stock: number;
  min: number;
  status: string;
}

export interface PurchasePrintRow {
  date: string;
  code: string;
  item: string;
  unit: string;
  supplier: string;
  qty: number;
  price: number;
  total: number;
}

export interface StockCountPrintRow {
  date: string;
  code: string;
  item: string;
  unit: string;
  diff: number;
  remark: string;
}

export interface TheoreticalPrintRow {
  ingredientCode: string;
  ingredientName: string;
  categoryName: string;
  masterUnit: string;
  totalUsageConverted: number;
  recipeUnit: string;
  totalUsageRaw: number;
  menuCount: number;
  isConverted: boolean;
}

export interface PriceAnalysisPrintRow {
  code: string;
  name: string;
  category: string;
  unit: string;
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
  latestPrice: number;
  differencePct: number;
  volatility: string;
  purchaseCount: number;
}

export interface StockMovementPrintRow {
  code: string;
  name: string;
  category: string;
  supplier: string;
  unit: string;
  openingQty: number;
  receivedQty: number;
  consumedQty: number;
  adjustmentQty: number;
  closingQty: number;
  unitCost: number;
  closingValue: number;
}

export interface ReportPrintParams {
  activeTab: "inventory" | "purchase" | "count" | "theoretical" | "movement" | "price";
  restaurantName: string;
  branchLabel: string;
  periodLabel: string;
  supplierLabel?: string;
  categoryLabel?: string;
  menuLabel?: string;
  volatilityLabel?: string;
  generatedDateTime?: string;
  currentUser?: User | null;
  canViewFinancial?: boolean;
  inventoryRows?: InventoryPrintRow[];
  purchaseRows?: PurchasePrintRow[];
  stockCountRows?: StockCountPrintRow[];
  theoreticalRows?: TheoreticalPrintRow[];
  priceRows?: PriceAnalysisPrintRow[];
  movementRows?: StockMovementPrintRow[];
}

export interface UsageVarianceItemPrint {
  ingredientCode: string;
  ingredientName: string;
  categoryName: string;
  branchName: string;
  unit: string;
  purchasePrice: number;
  beginningQty: number;
  purchaseQty: number;
  endingActualQty: number;
  actualUsageQty: number;
  theoreticalUsageQty: number;
  diffQty: number;
  diffPct: number;
  diffValue: number;
  status: string;
  isAbnormal: boolean;
  currentReasonLabel?: string;
  currentReasonNote?: string;
  reviewedBy?: string;
}

export interface UsageVariancePrintParams {
  companyName: string;
  branchName: string;
  startDate: string;
  endDate: string;
  categoryName: string;
  items: UsageVarianceItemPrint[];
  summary: Partial<VarianceExecutiveSummary> & {
    totalTheoreticalCost?: number;
    totalActualCost?: number;
    netVarianceCost?: number;
    netVariancePct?: number;
    totalDiffValue?: number;
    overallDiffPct?: number;
    abnormalItemsCount?: number;
    reviewedItemsCount?: number;
  };
  currentUser?: User | null;
}

/**
 * Generates printable HTML for standard Reports (Inventory, Purchase, Stock Count)
 */
export function generateReportsPrintHtml(params: ReportPrintParams): string {
  const {
    activeTab,
    restaurantName,
    branchLabel,
    periodLabel,
    supplierLabel,
    categoryLabel,
    generatedDateTime = getThaiPrintTimestamp(),
    currentUser,
    canViewFinancial = true,
    inventoryRows = [],
    purchaseRows = [],
    stockCountRows = [],
  } = params;

  let reportTitle = "";
  let reportSubTitle = "";
  let tableHeadersHtml = "";
  let tableRowsHtml = "";
  let totalSummaryHtml = "";
  let isLandscape = false;

  if (activeTab === "inventory") {
    reportTitle = "รายงานยอดสต็อกคงเหลือ (Inventory Balance Report)";
    reportSubTitle = "รายการวัตถุดิบและยอดคงเหลือในคลังสินค้า";
    isLandscape = false;

    const lowStockCount = inventoryRows.filter((r) => r.status === "ต่ำกว่าเกณฑ์").length;

    tableHeadersHtml = `
      <tr>
        <th style="width: 40px; text-align: center;">#</th>
        <th style="width: 100px;">รหัสสินค้า</th>
        <th>ชื่อวัตถุดิบ</th>
        <th>หมวดหมู่</th>
        <th style="text-align: right; width: 110px;">สต็อกคงเหลือ</th>
        <th style="text-align: right; width: 100px;">สต็อกขั้นต่ำ</th>
        <th style="text-align: center; width: 100px;">สถานะ</th>
      </tr>
    `;

    tableRowsHtml = inventoryRows
      .map((r, idx) => {
        const isLow = r.status === "ต่ำกว่าเกณฑ์";
        const badgeBg = isLow ? "#ffe4e6" : "#dcfce7";
        const badgeColor = isLow ? "#be123c" : "#15803d";
        return `
        <tr style="${isLow ? "background-color: #fff1f2;" : idx % 2 === 1 ? "background-color: #f8fafc;" : ""}">
          <td style="text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: 600; color: #334155;">${r.code}</td>
          <td><strong>${r.name}</strong> <span style="color: #64748b; font-size: 11px;">(${r.unit})</span></td>
          <td>${r.category}</td>
          <td style="text-align: right; font-weight: 700; color: ${isLow ? "#e11d48" : "#0f172a"};">${r.stock.toLocaleString()} ${r.unit}</td>
          <td style="text-align: right; color: #64748b;">${r.min.toLocaleString()} ${r.unit}</td>
          <td style="text-align: center;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background-color: ${badgeBg}; color: ${badgeColor};">
              ${r.status}
            </span>
          </td>
        </tr>
      `;
      })
      .join("");

    totalSummaryHtml = `
      <div class="summary-box">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div><strong>รายการทั้งหมด:</strong> ${inventoryRows.length} รายการ</div>
          <div><strong>รายการต่ำกว่าเกณฑ์:</strong> <span style="color: #e11d48; font-weight: bold;">${lowStockCount}</span> รายการ</div>
        </div>
      </div>
    `;
  } else if (activeTab === "purchase") {
    reportTitle = "รายงานประวัติการจัดซื้อและรับเข้า (Purchase & Receiving Report)";
    reportSubTitle = "ประวัติการสั่งซื้อและรับเข้าวัตถุดิบแยกตามช่วงเวลา";
    isLandscape = canViewFinancial;

    const totalQty = purchaseRows.reduce((acc, r) => acc + (r.qty || 0), 0);
    const totalAmount = purchaseRows.reduce((acc, r) => acc + (r.total || 0), 0);

    tableHeadersHtml = `
      <tr>
        <th style="width: 35px; text-align: center;">#</th>
        <th style="width: 85px;">วันที่</th>
        <th style="width: 90px;">รหัสสินค้า</th>
        <th>ชื่อวัตถุดิบ</th>
        <th>ซัพพลายเออร์</th>
        <th style="text-align: right; width: 100px;">จำนวนรับเข้า</th>
        ${
          canViewFinancial
            ? `
          <th style="text-align: right; width: 100px;">ราคา/หน่วย</th>
          <th style="text-align: right; width: 110px;">มูลค่ารวม (บาท)</th>
        `
            : ""
        }
      </tr>
    `;

    tableRowsHtml = purchaseRows
      .map(
        (r, idx) => `
        <tr style="${idx % 2 === 1 ? "background-color: #f8fafc;" : ""}">
          <td style="text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="color: #475569;">${r.date}</td>
          <td style="font-family: monospace; font-weight: 600; color: #334155;">${r.code}</td>
          <td><strong>${r.item}</strong> <span style="color: #64748b; font-size: 11px;">(${r.unit})</span></td>
          <td>${r.supplier}</td>
          <td style="text-align: right; font-weight: 600;">${r.qty.toLocaleString()} ${r.unit}</td>
          ${
            canViewFinancial
              ? `
            <td style="text-align: right; color: #475569;">${formatCurrency(r.price)}</td>
            <td style="text-align: right; font-weight: 700; color: #0f172a;">${formatCurrency(r.total)}</td>
          `
              : ""
          }
        </tr>
      `,
      )
      .join("");

    totalSummaryHtml = `
      <div class="summary-box">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div><strong>รายการทั้งหมด:</strong> ${purchaseRows.length} รายการ</div>
          ${
            canViewFinancial
              ? `<div><strong>ยอดมูลค่ารวมทั้งสิ้น:</strong> <span style="font-size: 15px; font-weight: bold; color: #0f172a;">${formatCurrency(totalAmount)}</span></div>`
              : `<div><strong>จำนวนรับเข้ารวม:</strong> ${totalQty.toLocaleString()}</div>`
          }
        </div>
      </div>
    `;
  } else if (activeTab === "count") {
    reportTitle = "รายงานผลต่างการตรวจนับสต็อก (Stock Count Variance Report)";
    reportSubTitle = "ประวัติการตรวจนับสต็อกจริงและรายการปรับปรุงยอด";
    isLandscape = false;

    tableHeadersHtml = `
      <tr>
        <th style="width: 40px; text-align: center;">#</th>
        <th style="width: 95px;">วันที่</th>
        <th style="width: 100px;">รหัสสินค้า</th>
        <th>ชื่อวัตถุดิบ</th>
        <th style="text-align: right; width: 120px;">ผลต่างที่ปรับปรุง</th>
        <th>หมายเหตุ / สาเหตุ</th>
      </tr>
    `;

    tableRowsHtml = stockCountRows
      .map((r, idx) => {
        const isPos = r.diff > 0;
        const isNeg = r.diff < 0;
        const diffColor = isPos ? "#16a34a" : isNeg ? "#dc2626" : "#475569";
        return `
        <tr style="${idx % 2 === 1 ? "background-color: #f8fafc;" : ""}">
          <td style="text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="color: #475569;">${r.date}</td>
          <td style="font-family: monospace; font-weight: 600; color: #334155;">${r.code}</td>
          <td><strong>${r.item}</strong> <span style="color: #64748b; font-size: 11px;">(${r.unit})</span></td>
          <td style="text-align: right; font-weight: 700; color: ${diffColor};">
            ${isPos ? `+${r.diff}` : r.diff} ${r.unit}
          </td>
          <td style="color: #475569;">${r.remark || "-"}</td>
        </tr>
      `;
      })
      .join("");

    totalSummaryHtml = `
      <div class="summary-box">
        <div><strong>จำนวนรายการตรวจนับ/ปรับปรุง:</strong> ${stockCountRows.length} รายการ</div>
      </div>
    `;
  } else if (activeTab === "theoretical") {
    const theoreticalRows = params.theoreticalRows || [];
    reportTitle = "รายงานการใช้วัตถุดิบตามสูตร (Theoretical Usage Report)";
    reportSubTitle = "สรุปปริมาณการใช้วัตถุดิบตามสูตรอาหาร จากยอดขายจริงแยกตามสาขาและช่วงเวลา";
    isLandscape = true;

    tableHeadersHtml = `
      <tr>
        <th style="width: 35px; text-align: center;">#</th>
        <th style="width: 95px;">รหัสวัตถุดิบ</th>
        <th>ชื่อวัตถุดิบ</th>
        <th>หมวดหมู่</th>
        <th style="text-align: right; width: 130px;">ใช้ตามสูตร (หน่วยหลัก)</th>
        <th style="text-align: center; width: 85px;">หน่วยหลัก</th>
        <th style="text-align: right; width: 120px;">ปริมาณสูตรเดิม</th>
        <th style="text-align: center; width: 85px;">หน่วยสูตร</th>
        <th style="text-align: center; width: 90px;">จำนวนเมนู</th>
        <th style="text-align: center; width: 110px;">การแปลงหน่วย</th>
      </tr>
    `;

    tableRowsHtml = theoreticalRows
      .map((r, idx) => {
        const isConverted = r.isConverted;
        return `
        <tr style="${idx % 2 === 1 ? "background-color: #f8fafc;" : ""}">
          <td style="text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: 600; color: #334155;">${r.ingredientCode}</td>
          <td><strong>${r.ingredientName}</strong></td>
          <td>${r.categoryName}</td>
          <td style="text-align: right; font-weight: 700; color: #0f172a;">${(r.totalUsageConverted ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })} ${r.masterUnit}</td>
          <td style="text-align: center; color: #64748b;">${r.masterUnit}</td>
          <td style="text-align: right; color: #475569;">${(r.totalUsageRaw ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: center; color: #64748b;">${r.recipeUnit}</td>
          <td style="text-align: center; font-weight: 600;">${r.menuCount ?? 0} เมนู</td>
          <td style="text-align: center;">
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; ${isConverted ? "background-color: #e0f2fe; color: #0369a1;" : "background-color: #f1f5f9; color: #475569;"}">
              ${isConverted ? "แปลงหน่วยแล้ว" : "หน่วยตรงกัน"}
            </span>
          </td>
        </tr>
      `;
      })
      .join("");

    totalSummaryHtml = `
      <div class="summary-box">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div><strong>รายการวัตถุดิบทั้งหมด:</strong> ${theoreticalRows.length} รายการ</div>
          ${params.menuLabel ? `<div><strong>เมนูที่เลือก:</strong> ${params.menuLabel}</div>` : ""}
        </div>
      </div>
    `;
  } else if (activeTab === "movement") {
    const movementRows = params.movementRows || [];
    reportTitle = "รายงานความเคลื่อนไหวสต็อก (Inventory Movement Report)";
    reportSubTitle = "สรุปยอดยกมา รับเข้า เบิกใช้ ปรับปรุง และยอดคงเหลือตามช่วงเวลา";
    isLandscape = true;

    const totalClosingVal = movementRows.reduce((acc, r) => acc + (r.closingValue || 0), 0);

    tableHeadersHtml = `
      <tr>
        <th style="width: 35px; text-align: center;">#</th>
        <th style="width: 85px;">รหัสสินค้า</th>
        <th>ชื่อวัตถุดิบ</th>
        <th>หมวดหมู่</th>
        <th>ซัพพลายเออร์</th>
        <th style="text-align: right; width: 75px;">ยอดยกมา</th>
        <th style="text-align: right; width: 75px;">รับเข้า (+)</th>
        <th style="text-align: right; width: 75px;">เบิกใช้ (-)</th>
        <th style="text-align: right; width: 75px;">ปรับยอด (±)</th>
        <th style="text-align: right; width: 85px;">คงเหลือปลาย</th>
        <th style="text-align: right; width: 75px;">ราคา/หน่วย</th>
        <th style="text-align: right; width: 95px;">มูลค่ารวม (฿)</th>
      </tr>
    `;

    tableRowsHtml = movementRows
      .map(
        (r, idx) => `
        <tr style="${idx % 2 === 1 ? "background-color: #f8fafc;" : ""}">
          <td style="text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: 600; color: #334155;">${r.code}</td>
          <td><strong>${r.name}</strong> <span style="color: #64748b; font-size: 10.5px;">(${r.unit})</span></td>
          <td>${r.category}</td>
          <td>${r.supplier}</td>
          <td style="text-align: right; color: #64748b;">${(r.openingQty ?? 0).toLocaleString()}</td>
          <td style="text-align: right; color: #16a34a; font-weight: 600;">+${(r.receivedQty ?? 0).toLocaleString()}</td>
          <td style="text-align: right; color: #dc2626;">-${(r.consumedQty ?? 0).toLocaleString()}</td>
          <td style="text-align: right; color: ${(r.adjustmentQty ?? 0) >= 0 ? "#16a34a" : "#dc2626"};">${(r.adjustmentQty ?? 0) > 0 ? "+" : ""}${(r.adjustmentQty ?? 0).toLocaleString()}</td>
          <td style="text-align: right; font-weight: 700; color: #0f172a;">${(r.closingQty ?? 0).toLocaleString()} ${r.unit}</td>
          <td style="text-align: right; color: #64748b;">${formatCurrency(r.unitCost ?? 0)}</td>
          <td style="text-align: right; font-weight: 700; color: #0f172a;">${formatCurrency(r.closingValue ?? 0)}</td>
        </tr>
      `,
      )
      .join("");

    totalSummaryHtml = `
      <div class="summary-box">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div><strong>รายการวัตถุดิบทั้งหมด:</strong> ${movementRows.length} รายการ</div>
          <div><strong>มูลค่าสินค้าคงเหลือปลายงวดรวม:</strong> <span style="font-size: 14px; font-weight: bold; color: #0f172a;">${formatCurrency(totalClosingVal)}</span></div>
        </div>
      </div>
    `;
  } else if (activeTab === "price") {
    const priceRows = params.priceRows || [];
    reportTitle = "รายงานวิเคราะห์ราคาและแนวโน้มต้นทุน (Price Analysis Report)";
    reportSubTitle = "ติดตามความผันผวนของราคาจัดซื้อ ราคาเฉลี่ย และแนวโน้มต้นทุนวัตถุดิบ";
    isLandscape = true;

    tableHeadersHtml = `
      <tr>
        <th style="width: 35px; text-align: center;">#</th>
        <th style="width: 90px;">รหัสสินค้า</th>
        <th>ชื่อวัตถุดิบ</th>
        <th>หมวดหมู่</th>
        <th style="text-align: right; width: 95px;">ราคาเฉลี่ย</th>
        <th style="text-align: right; width: 90px;">ต่ำสุด</th>
        <th style="text-align: right; width: 90px;">สูงสุด</th>
        <th style="text-align: right; width: 95px;">ราคาล่าสุด</th>
        <th style="text-align: right; width: 85px;">ผลต่าง (%)</th>
        <th style="text-align: center; width: 95px;">ความผันผวน</th>
        <th style="text-align: center; width: 80px;">ซื้อ (ครั้ง)</th>
      </tr>
    `;

    tableRowsHtml = priceRows
      .map((r, idx) => {
        const isPos = (r.differencePct ?? 0) > 0;
        const isNeg = (r.differencePct ?? 0) < 0;
        const diffColor = isPos ? "#dc2626" : isNeg ? "#16a34a" : "#64748b";
        const volColor =
          r.volatility === "HIGH" ? "#dc2626" : r.volatility === "MEDIUM" ? "#d97706" : "#16a34a";
        const volBg =
          r.volatility === "HIGH" ? "#fee2e2" : r.volatility === "MEDIUM" ? "#fef3c7" : "#dcfce7";

        return `
        <tr style="${idx % 2 === 1 ? "background-color: #f8fafc;" : ""}">
          <td style="text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: 600; color: #334155;">${r.code}</td>
          <td><strong>${r.name}</strong> <span style="color: #64748b; font-size: 10.5px;">(${r.unit})</span></td>
          <td>${r.category}</td>
          <td style="text-align: right; font-weight: 600;">${formatCurrency(r.averagePrice ?? 0)}</td>
          <td style="text-align: right; color: #64748b;">${formatCurrency(r.lowestPrice ?? 0)}</td>
          <td style="text-align: right; color: #64748b;">${formatCurrency(r.highestPrice ?? 0)}</td>
          <td style="text-align: right; font-weight: 700; color: #0f172a;">${formatCurrency(r.latestPrice ?? 0)}</td>
          <td style="text-align: right; font-weight: 700; color: ${diffColor};">
            ${isPos ? "+" : ""}${(r.differencePct ?? 0).toFixed(1)}%
          </td>
          <td style="text-align: center;">
            <span style="display: inline-block; padding: 2px 7px; border-radius: 9999px; font-size: 10px; font-weight: 700; background-color: ${volBg}; color: ${volColor};">
              ${r.volatility}
            </span>
          </td>
          <td style="text-align: center; font-weight: 600;">${r.purchaseCount ?? 0}</td>
        </tr>
      `;
      })
      .join("");

    totalSummaryHtml = `
      <div class="summary-box">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div><strong>รายการที่วิเคราะห์ทั้งหมด:</strong> ${priceRows.length} รายการ</div>
          ${params.volatilityLabel ? `<div><strong>ความผันผวน:</strong> ${params.volatilityLabel}</div>` : ""}
        </div>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${reportTitle} - ${restaurantName}</title>
      <style>
        body {
          font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          font-size: 12px;
          color: #1e293b;
          margin: 0;
          padding: 20px;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @page {
          size: A4 ${isLandscape ? "landscape" : "portrait"};
          margin: 12mm 10mm;
        }
        .header {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 12px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .header h1 {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }
        .header h2 {
          margin: 4px 0 0 0;
          font-size: 14px;
          font-weight: 600;
          color: #334155;
        }
        .header p {
          margin: 2px 0 0 0;
          font-size: 11px;
          color: #64748b;
        }
        .meta-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 16px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 8px 16px;
          font-size: 11.5px;
        }
        .meta-box strong {
          color: #475569;
          margin-right: 4px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          font-size: 11.5px;
        }
        th {
          background-color: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #0f172a;
          padding: 7px 8px;
          font-weight: 700;
          text-align: left;
        }
        td {
          border: 1px solid #e2e8f0;
          padding: 6px 8px;
          vertical-align: middle;
        }
        tr {
          page-break-inside: avoid;
        }
        .summary-box {
          margin-top: 14px;
          padding: 10px 14px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 12px;
        }
        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 40px;
          page-break-inside: avoid;
        }
        .sig-block {
          width: 220px;
          text-align: center;
        }
        .sig-line {
          border-top: 1px dashed #94a3b8;
          margin-top: 45px;
          padding-top: 6px;
          font-size: 11px;
          color: #334155;
          font-weight: 600;
        }
        .sig-date {
          margin-top: 4px;
          font-size: 10px;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${restaurantName}</h1>
          <h2>${reportTitle}</h2>
          <p>${reportSubTitle}</p>
        </div>
        <div style="text-align: right; font-size: 10.5px; color: #64748b;">
          <div><strong>พิมพ์เมื่อ:</strong> ${generatedDateTime}</div>
          <div><strong>ผู้พิมพ์:</strong> ${currentUser?.name || "ผู้ใช้งานระบบ"}</div>
        </div>
      </div>

      <div class="meta-box">
        <div><strong>สาขา:</strong> ${branchLabel}</div>
        <div><strong>ช่วงเวลา:</strong> ${periodLabel}</div>
        ${supplierLabel ? `<div><strong>ซัพพลายเออร์:</strong> ${supplierLabel}</div>` : ""}
        ${categoryLabel ? `<div><strong>หมวดหมู่:</strong> ${categoryLabel}</div>` : ""}
      </div>

      <table>
        <thead>
          ${tableHeadersHtml}
        </thead>
        <tbody>
          ${tableRowsHtml || `<tr><td colspan="10" style="text-align: center; padding: 20px; color: #94a3b8;">ไม่มีข้อมูลสำหรับเงื่อนไขที่เลือก</td></tr>`}
        </tbody>
      </table>

      ${totalSummaryHtml}

      <div class="signatures">
        <div class="sig-block">
          <div class="sig-line">ผู้จัดทำรายงาน (Prepared By)</div>
          <div class="sig-date">วันที่: ........................................</div>
        </div>
        <div class="sig-block">
          <div class="sig-line">ผู้ตรวจสอบ / หัวหน้าครัว (Checked By)</div>
          <div class="sig-date">วันที่: ........................................</div>
        </div>
        <div class="sig-block">
          <div class="sig-line">ผู้อนุมัติ / ผู้จัดการสาขา (Approved By)</div>
          <div class="sig-date">วันที่: ........................................</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generates printable HTML for Usage Variance (BOM vs Actual Usage)
 */
export function generateUsageVariancePrintHtml(params: UsageVariancePrintParams): string {
  const { companyName, branchName, startDate, endDate, categoryName, items, summary, currentUser } =
    params;

  const generatedTime = getThaiPrintTimestamp();

  const totalTheoreticalCost = summary.totalTheoreticalCost ?? 0;
  const totalActualCost = summary.totalActualCost ?? 0;
  const netVarianceCost = summary.netVarianceCost ?? summary.totalDiffValue ?? 0;
  const netVariancePct = summary.netVariancePct ?? summary.overallDiffPct ?? 0;
  const abnormalItemsCount = summary.abnormalItemsCount ?? 0;

  const rowsHtml = items
    .map((r, idx) => {
      const beginningQty = Number(r.beginningQty ?? 0);
      const purchaseQty = Number(r.purchaseQty ?? 0);
      const endingActualQty = Number(r.endingActualQty ?? 0);
      const actualUsageQty = Number(r.actualUsageQty ?? 0);
      const theoreticalUsageQty = Number(r.theoreticalUsageQty ?? 0);
      const diffQty = Number(r.diffQty ?? 0);
      const diffPct = Number(r.diffPct ?? 0);
      const diffValue = Number(r.diffValue ?? 0);

      const isNegative = diffQty < 0;
      const isPositive = diffQty > 0;
      const diffColor = isNegative ? "#dc2626" : isPositive ? "#16a34a" : "#475569";
      const badgeBg = r.isAbnormal ? "#ffe4e6" : "#dcfce7";
      const badgeColor = r.isAbnormal ? "#be123c" : "#15803d";
      return `
      <tr style="${r.isAbnormal ? "background-color: #fff1f2;" : idx % 2 === 1 ? "background-color: #f8fafc;" : ""}">
        <td style="text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="font-family: monospace; font-weight: 600; color: #334155;">${r.ingredientCode}</td>
        <td>
          <strong>${r.ingredientName}</strong> <span style="color: #64748b; font-size: 10.5px;">(${r.unit})</span>
          ${r.currentReasonLabel ? `<div style="font-size: 10px; color: #b91c1c; margin-top: 2px;">• เหตุผล: ${r.currentReasonLabel}</div>` : ""}
        </td>
        <td>${r.categoryName}</td>
        <td style="text-align: right; color: #475569;">${beginningQty.toFixed(2)}</td>
        <td style="text-align: right; color: #475569;">${purchaseQty.toFixed(2)}</td>
        <td style="text-align: right; color: #475569;">${endingActualQty.toFixed(2)}</td>
        <td style="text-align: right; font-weight: 700; color: #0f172a;">${actualUsageQty.toFixed(2)}</td>
        <td style="text-align: right; font-weight: 700; color: #2563eb;">${theoreticalUsageQty.toFixed(2)}</td>
        <td style="text-align: right; font-weight: 700; color: ${diffColor};">
          ${isPositive ? `+${diffQty.toFixed(2)}` : diffQty.toFixed(2)}
        </td>
        <td style="text-align: right; font-weight: 600; color: ${diffColor};">
          ${isPositive ? `+${diffPct.toFixed(1)}%` : `${diffPct.toFixed(1)}%`}
        </td>
        <td style="text-align: right; font-weight: 700; color: ${diffColor};">
          ${formatCurrency(diffValue)}
        </td>
        <td style="text-align: center;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; background-color: ${badgeBg}; color: ${badgeColor};">
            ${r.isAbnormal ? "ผิดปกติ" : "ปกติ"}
          </span>
        </td>
      </tr>
    `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Usage Variance Report - ${companyName}</title>
      <style>
        body {
          font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          font-size: 11px;
          color: #1e293b;
          margin: 0;
          padding: 15px;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @page {
          size: A4 landscape;
          margin: 10mm 8mm;
        }
        .header {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 10px;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .header h1 {
          margin: 0;
          font-size: 17px;
          font-weight: 800;
          color: #0f172a;
        }
        .header h2 {
          margin: 3px 0 0 0;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 12px;
          font-size: 11px;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 12px;
        }
        .kpi-card {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 6px 10px;
        }
        .kpi-label {
          font-size: 10px;
          color: #64748b;
          font-weight: 600;
        }
        .kpi-val {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          margin-top: 2px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10.5px;
        }
        th {
          background-color: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #0f172a;
          padding: 5px 6px;
          font-weight: 700;
          text-align: left;
        }
        td {
          border: 1px solid #e2e8f0;
          padding: 5px 6px;
        }
        tr {
          page-break-inside: avoid;
        }
        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 30px;
          page-break-inside: avoid;
        }
        .sig-block {
          width: 200px;
          text-align: center;
        }
        .sig-line {
          border-top: 1px dashed #94a3b8;
          margin-top: 35px;
          padding-top: 4px;
          font-size: 10.5px;
          font-weight: 600;
        }
        .sig-date {
          margin-top: 3px;
          font-size: 9.5px;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${companyName}</h1>
          <h2>รายงานเปรียบเทียบการใช้วัตถุดิบจริง vs ใช้ตามสูตร (Usage Variance Report)</h2>
        </div>
        <div style="text-align: right; font-size: 10px; color: #64748b;">
          <div><strong>วันที่พิมพ์:</strong> ${generatedTime}</div>
          <div><strong>ผู้จัดทำ:</strong> ${currentUser?.name || "ผู้ใช้งานระบบ"}</div>
        </div>
      </div>

      <div class="meta-grid">
        <div><strong>สาขา:</strong> ${branchName}</div>
        <div><strong>ช่วงเวลา:</strong> ${startDate || "—"} ถึง ${endDate || "—"}</div>
        <div><strong>หมวดหมู่:</strong> ${categoryName}</div>
        <div><strong>จำนวนรายการ:</strong> ${items.length} รายการ (ผิดปกติ ${abnormalItemsCount})</div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">ต้นทุนตามสูตร (Theoretical)</div>
          <div class="kpi-val">${formatCurrency(totalTheoreticalCost)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">ต้นทุนใช้จริง (Actual Cost)</div>
          <div class="kpi-val">${formatCurrency(totalActualCost)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">มูลค่าผลต่าง (Variance ฿)</div>
          <div class="kpi-val" style="color: ${netVarianceCost < 0 ? "#dc2626" : netVarianceCost > 0 ? "#16a34a" : "#0f172a"};">
            ${formatCurrency(netVarianceCost)} (${netVariancePct.toFixed(1)}%)
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">รายการผิดปกติ / รอตรวจสอบ</div>
          <div class="kpi-val" style="color: #e11d48;">
            ${abnormalItemsCount} รายการ
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 25px; text-align: center;">#</th>
            <th style="width: 70px;">รหัส</th>
            <th>ชื่อวัตถุดิบ</th>
            <th>หมวดหมู่</th>
            <th style="text-align: right; width: 60px;">ต้นงวด</th>
            <th style="text-align: right; width: 60px;">รับเข้า</th>
            <th style="text-align: right; width: 60px;">ปลายนับ</th>
            <th style="text-align: right; width: 65px;">ใช้จริง</th>
            <th style="text-align: right; width: 65px;">ใช้ตามสูตร</th>
            <th style="text-align: right; width: 60px;">Diff</th>
            <th style="text-align: right; width: 55px;">Diff%</th>
            <th style="text-align: right; width: 75px;">มูลค่า (฿)</th>
            <th style="text-align: center; width: 55px;">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="13" style="text-align: center; padding: 15px; color: #94a3b8;">ไม่มีรายการข้อมูล</td></tr>`}
        </tbody>
      </table>

      <div class="signatures">
        <div class="sig-block">
          <div class="sig-line">ผู้จัดทำรายงาน</div>
          <div class="sig-date">วันที่: ........................................</div>
        </div>
        <div class="sig-block">
          <div class="sig-line">เชฟใหญ่ / ผู้จัดการครัว</div>
          <div class="sig-date">วันที่: ........................................</div>
        </div>
        <div class="sig-block">
          <div class="sig-line">ผู้จัดการสาขา / ฝ่ายบัญชี</div>
          <div class="sig-date">วันที่: ........................................</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Triggers printing of standard reports (Inventory, Purchase, Stock Count)
 */
export function printReportDocument(params: ReportPrintParams): boolean {
  const html = generateReportsPrintHtml(params);
  let title = "รายงาน";
  if (params.activeTab === "inventory") title = "รายงานยอดสต็อกคงเหลือ";
  else if (params.activeTab === "purchase") title = "รายงานการจัดซื้อและรับเข้า";
  else if (params.activeTab === "count") title = "รายงานผลต่างการตรวจนับสต็อก";
  else if (params.activeTab === "theoretical") title = "รายงานการใช้วัตถุดิบตามสูตร";
  else if (params.activeTab === "movement") title = "รายงานความเคลื่อนไหวสต็อก";
  else if (params.activeTab === "price") title = "รายงานวิเคราะห์ราคาและต้นทุนจัดซื้อ";

  return printHtmlDocument(html, title);
}

/**
 * Triggers printing of Usage Variance report
 */
export function printUsageVarianceDocument(params: UsageVariancePrintParams): boolean {
  const html = generateUsageVariancePrintHtml(params);
  return printHtmlDocument(html, `รายงาน_UsageVariance_${params.startDate}_to_${params.endDate}`);
}
