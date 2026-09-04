import React, { useRef, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, Download, ExternalLink, Store, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatUnitThai } from "@/lib/unitConversion";
import type { Item, Category, Branch, StockCountDocument, User } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/dateFormat";
import {
  executeStockCountPrint,
  openStockCountPrintWindow,
  downloadStockCountPrintHtml,
  StockCountPrintRow,
  GenerateStockCountPrintParams,
} from "./printStockCount";

interface StockCountPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  // If printing from an existing document
  document?: StockCountDocument | null;
  // If printing from active count screen
  items: Item[];
  categories: Category[];
  branches: Branch[];
  currentBranchId?: string;
  countDate?: string;
  countedMap?: Record<string, number>;
  currentStockFn?: (itemId: string) => number;
  itemUsageMap?: Record<string, { rawQty: number; stockQty: number; recipeUnit: string }>;
  currentUser?: User | null;
  appName?: string;
}

export function StockCountPrintModal({
  isOpen,
  onClose,
  document,
  items,
  categories,
  branches,
  currentBranchId,
  countDate = new Date().toISOString().slice(0, 10),
  countedMap = {},
  currentStockFn,
  itemUsageMap = {},
  currentUser,
  appName = "Hana Inventory & Ordering System",
}: StockCountPrintModalProps) {
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    document?.branchId || currentBranchId || branches[0]?.id || "b1",
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [printMode, setPrintMode] = useState<"blank" | "system">("system"); // blank for physical counting, system for audit comparison

  const printAreaRef = useRef<HTMLDivElement | null>(null);

  const selectedBranch = useMemo(() => {
    return branches.find((b) => b.id === selectedBranchId) || branches[0];
  }, [branches, selectedBranchId]);

  const isHQ =
    !selectedBranch ||
    selectedBranch.id === "b1" ||
    selectedBranch.name.includes("สำนักงานใหญ่") ||
    selectedBranch.name.includes("HQ");

  // Category map for quick lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Build lines to print
  const printRows: StockCountPrintRow[] = useMemo(() => {
    if (document) {
      // Print from saved document
      return document.items
        .map((docItem, idx) => {
          const matchedItem = items.find((i) => i.id === docItem.itemId);
          if (!matchedItem) return null;
          if (selectedCategoryId !== "all" && matchedItem.categoryId !== selectedCategoryId)
            return null;

          const sysQty =
            docItem.systemQuantity ??
            docItem.systemQty ??
            (currentStockFn ? currentStockFn(matchedItem.id) : 0);
          const countedQty = docItem.countedQuantity ?? docItem.countedQty ?? 0;
          const variance = docItem.variance ?? countedQty - sysQty;
          const sUnit = matchedItem.stockUnit || matchedItem.unit || "หน่วย";

          return {
            no: idx + 1,
            code: matchedItem.code,
            name: matchedItem.name,
            category: categoryMap.get(matchedItem.categoryId) || "ทั่วไป",
            stockUnit: formatUnitThai(sUnit) || sUnit,
            systemQty: sysQty,
            countedQty: countedQty,
            variance: variance,
            remark: docItem.remark || "",
          };
        })
        .filter((r): r is StockCountPrintRow => r !== null);
    } else {
      // Print from live / draft count session
      return items
        .filter(
          (i) => i.active && (selectedCategoryId === "all" || i.categoryId === selectedCategoryId),
        )
        .map((i, idx) => {
          const sys = currentStockFn ? currentStockFn(i.id) : 0;
          const usage = itemUsageMap[i.id] || { rawQty: 0, stockQty: 0, recipeUnit: "" };
          const expectedRemaining = sys - usage.stockQty;
          const counted = countedMap[i.id];
          const hasCounted = counted !== undefined;
          const variance = hasCounted ? counted - expectedRemaining : 0;
          const sUnit = i.stockUnit || i.unit || "หน่วย";

          return {
            no: idx + 1,
            code: i.code,
            name: i.name,
            category: categoryMap.get(i.categoryId) || "ทั่วไป",
            stockUnit: formatUnitThai(sUnit) || sUnit,
            systemQty: sys,
            countedQty: hasCounted ? counted : null,
            variance: hasCounted ? variance : null,
            remark: "",
          };
        });
    }
  }, [document, items, selectedCategoryId, currentStockFn, itemUsageMap, countedMap, categoryMap]);

  const displayDate = document?.countDate || countDate;
  const docNumber = document?.documentNumber || `DRAFT-${displayDate.replace(/-/g, "")}`;
  const countedBy = document?.createdBy || currentUser?.name || "เจ้าหน้าที่ตรวจนับ";

  const getPrintParams = (): GenerateStockCountPrintParams => ({
    document,
    rows: printRows,
    branch: selectedBranch || null,
    categoryName:
      selectedCategoryId === "all"
        ? "ทั้งหมด (All Categories)"
        : categoryMap.get(selectedCategoryId) || "ทั่วไป",
    countDate: displayDate,
    countedBy,
    printMode,
    appName,
  });

  const handleTriggerPrint = () => {
    executeStockCountPrint(getPrintParams());
  };

  const handleOpenPrintWindow = () => {
    openStockCountPrintWindow(getPrintParams());
  };

  const handleDownloadHtml = () => {
    downloadStockCountPrintHtml(getPrintParams());
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <style>{`
        @media print {
          /* 1. ปลดล็อก container ไม่ให้บังคับความสูง */
          .stock-count-dialog-content {
            position: static !important;
            max-height: none !important;
            overflow: visible !important;
            transform: none !important;
            max-width: none !important;
            width: 100% !important;
          }
          .stock-count-scroll-area {
            overflow: visible !important;
            max-height: none !important;
          }

          /* 2. ซ่อนส่วนประกอบอื่นทั้งหมด ยกเว้นพื้นที่พิมพ์ */
          body * {
            visibility: hidden;
          }
          #stock-count-print-area,
          #stock-count-print-area * {
            visibility: visible;
          }
          #stock-count-print-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }

          /* 3. ตั้งค่าหน้า A4 และบังคับหัวตาราง/แถวตาราง */
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          thead {
            display: table-header-group !important; /* บังคับให้หัวตารางขึ้นซ้ำทุกหน้า */
          }
          tfoot {
            display: table-footer-group !important;
          }
          tr {
            break-inside: avoid !important; /* ป้องกันแถวตารางโดนตัดครึ่งหน้า */
            page-break-inside: avoid !important;
          }
        }
      `}</style>
      <DialogContent className="stock-count-dialog-content max-w-4xl max-h-[90vh] flex flex-col p-0 rounded-2xl overflow-hidden print:p-0 print:border-none print:shadow-none print:max-w-full">
        {/* Modal Controls Header - Hidden during print */}
        <div className="p-4 border-b border-border/80 bg-muted/30 flex items-center justify-between gap-3 shrink-0 print:hidden flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-extrabold text-foreground">
                พิมพ์ใบตรวจนับสต็อก (Print Stock Count Sheet)
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                เอกสารมาตรฐาน A4 สำหรับตรวจนับหน้างานหรือสรุปผลกระทบสต็อก
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadHtml}
              className="rounded-xl text-xs font-semibold gap-1.5 h-9"
              title="ดาวน์โหลดไฟล์เอกสาร HTML สำหรับพิมพ์หรือเปิดแบบออฟไลน์"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ดาวน์โหลดไฟล์</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenPrintWindow}
              className="rounded-xl text-xs font-semibold gap-1.5 h-9"
              title="เปิดหน้าพิมพ์ในแท็บใหม่"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">เปิดแท็บพิมพ์</span>
            </Button>
            <Button
              type="button"
              onClick={handleTriggerPrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-1.5 h-9 px-4 shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>สั่งพิมพ์ (Print A4)</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onClose}
              className="rounded-xl h-9 w-9"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Filter bar - Hidden during print */}
        <div className="px-4 py-2.5 bg-muted/10 border-b border-border/60 flex items-center gap-3 flex-wrap text-xs print:hidden">
          <div className="flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-semibold text-muted-foreground">สาขา/สังกัด:</span>
            <Select
              value={selectedBranchId}
              onValueChange={setSelectedBranchId}
              disabled={!!document}
            >
              <SelectTrigger className="h-8 rounded-lg text-xs w-48 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs">
                    {b.name} {b.code ? `(${b.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-semibold text-muted-foreground">หมวดหมู่:</span>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger className="h-8 rounded-lg text-xs w-40 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกหมวดหมู่ ({items.length})</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!document && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="font-semibold text-muted-foreground">รูปแบบ:</span>
              <div className="flex items-center gap-1 bg-background border border-border p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPrintMode("system")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    printMode === "system"
                      ? "bg-emerald-600 text-white font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  แสดงยอดระบบ
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMode("blank")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    printMode === "blank"
                      ? "bg-emerald-600 text-white font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  แบบฟอร์มเปล่า (สำหรับตรวจนับหน้างาน)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Printable Document Preview Area */}
        <div className="stock-count-scroll-area flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-900/40 print:p-0 print:bg-white print:overflow-visible">
          <div
            ref={printAreaRef}
            id="stock-count-print-area"
            className="max-w-[210mm] mx-auto bg-white text-black p-8 rounded-xl shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0 print:max-w-none print:text-black print:bg-white"
            style={{ minHeight: "297mm", fontFamily: "sans-serif" }}
          >
            {/* Print Header */}
            <div className="border-b-2 border-black pb-4 mb-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h1 className="text-xl font-bold text-black uppercase tracking-tight">
                    {appName}
                  </h1>
                  <h2 className="text-lg font-extrabold text-black mt-0.5">
                    ใบตรวจนับสต็อกวัตถุดิบและสินค้า (Stock Count Sheet)
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-black">
                    <span className="font-bold">สถานที่ / หน่วยงาน:</span>
                    <span className="px-2 py-0.5 rounded border border-black font-bold">
                      {isHQ
                        ? "สำนักงานใหญ่ (Headquarters / HQ)"
                        : `สาขา: ${selectedBranch?.name || "สาขา"} (${selectedBranch?.code || "BR"})`}
                    </span>
                  </div>
                </div>

                <div className="text-right text-xs space-y-1">
                  <div className="border border-black p-2 rounded text-left">
                    <div>
                      <strong className="text-black">เลขที่เอกสาร:</strong>{" "}
                      <span className="font-mono">{docNumber}</span>
                    </div>
                    <div>
                      <strong className="text-black">วันที่ตรวจนับ:</strong>{" "}
                      <span>{formatDate(displayDate)}</span>
                    </div>
                    <div>
                      <strong className="text-black">ผู้ตรวจนับ:</strong> <span>{countedBy}</span>
                    </div>
                    {document && (
                      <div>
                        <strong className="text-black">สถานะ:</strong>{" "}
                        <span>
                          {document.status || "Completed"} (Rev {document.revision || 1})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-between items-center text-[11px] text-black">
                <div>
                  <strong>หมวดหมู่วัตถุดิบ:</strong>{" "}
                  {selectedCategoryId === "all"
                    ? "ทั้งหมด (All Categories)"
                    : categoryMap.get(selectedCategoryId)}
                </div>
                <div>
                  <strong>จำนวนรายการทั้งหมด:</strong> {printRows.length} รายการ
                </div>
                <div>
                  <strong>หน่วยที่ใช้:</strong> หน่วยสต็อก (Stock Units)
                </div>
              </div>
            </div>

            {/* Print Table */}
            <table className="w-full text-left border-collapse text-xs mb-6">
              <thead>
                <tr className="border-t-2 border-b-2 border-black bg-slate-100 print:bg-slate-100 font-bold text-black">
                  <th className="py-2 px-2 border border-black w-10 text-center">ลำดับ</th>
                  <th className="py-2 px-2 border border-black w-24">รหัสวัตถุดิบ</th>
                  <th className="py-2 px-2 border border-black">รายการวัตถุดิบ / สินค้า</th>
                  <th className="py-2 px-2 border border-black w-28">หมวดหมู่</th>
                  <th className="py-2 px-2 border border-black w-20 text-center font-extrabold">
                    หน่วยสต็อก
                  </th>
                  <th className="py-2 px-2 border border-black w-24 text-right">
                    {printMode === "blank" && !document ? "ยอดในระบบ" : "จำนวนตามระบบ"}
                  </th>
                  <th className="py-2 px-2 border border-black w-28 text-center bg-slate-50 print:bg-slate-50 font-bold">
                    จำนวนที่นับจริง
                  </th>
                  <th className="py-2 px-2 border border-black w-20 text-right">ส่วนต่าง</th>
                  <th className="py-2 px-2 border border-black w-28">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {printRows.map((r, idx) => {
                  if (!r) return null;
                  const isBlankMode = printMode === "blank" && !document;

                  return (
                    <tr
                      key={idx}
                      className="border-b border-black text-black hover:bg-slate-50 break-inside-avoid"
                    >
                      <td className="py-2 px-2 border border-black text-center font-medium">
                        {r.no}
                      </td>
                      <td className="py-2 px-2 border border-black font-mono text-[11px]">
                        {r.code}
                      </td>
                      <td className="py-2 px-2 border border-black font-semibold text-black">
                        {r.name}
                      </td>
                      <td className="py-2 px-2 border border-black text-[11px] text-black">
                        {r.category}
                      </td>
                      <td className="py-2 px-2 border border-black text-center font-bold text-black">
                        {r.stockUnit}
                      </td>
                      <td className="py-2 px-2 border border-black text-right font-mono font-medium">
                        {isBlankMode
                          ? "—"
                          : r.systemQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                      </td>
                      <td className="py-2 px-2 border border-black text-center font-mono font-bold bg-slate-50 print:bg-slate-50">
                        {isBlankMode ? (
                          <div className="h-5 w-full border-b border-dotted border-black"></div>
                        ) : r.countedQty !== null && r.countedQty !== undefined ? (
                          r.countedQty.toLocaleString(undefined, { maximumFractionDigits: 3 })
                        ) : (
                          <div className="h-5 w-full border-b border-dotted border-black"></div>
                        )}
                      </td>
                      <td className="py-2 px-2 border border-black text-right font-mono font-bold">
                        {isBlankMode || r.variance === null ? (
                          "—"
                        ) : (
                          <span
                            className={
                              r.variance > 0
                                ? "text-black"
                                : r.variance < 0
                                  ? "text-black font-extrabold"
                                  : "text-black"
                            }
                          >
                            {r.variance > 0
                              ? `+${r.variance.toLocaleString(undefined, { maximumFractionDigits: 3 })}`
                              : r.variance.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 border border-black text-[10px] text-black">
                        {r.remark || (
                          <div className="h-4 w-full border-b border-dotted border-slate-300"></div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {printRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-8 text-center text-xs text-black border border-black"
                    >
                      ไม่พบรายการวัตถุดิบตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Signature and Approval Section */}
            <div className="mt-8 pt-4 border-t-2 border-black break-inside-avoid">
              <div className="grid grid-cols-3 gap-6 text-center text-xs text-black">
                {/* 1. Counted By */}
                <div className="space-y-6">
                  <div>
                    <p className="font-bold">ผู้ตรวจนับสินค้า (Counted By)</p>
                  </div>
                  <div className="pt-8">
                    <p className="border-b border-black border-dotted mx-4"></p>
                    <p className="mt-1.5 font-medium">
                      ({countedBy || "................................................"})
                    </p>
                    <p className="text-[11px] text-black mt-1">วันที่ ..... / ..... / ..........</p>
                  </div>
                </div>

                {/* 2. Verified By */}
                <div className="space-y-6">
                  <div>
                    <p className="font-bold">ผู้ตรวจสอบ / ผู้จัดการสาขา (Verified By)</p>
                  </div>
                  <div className="pt-8">
                    <p className="border-b border-black border-dotted mx-4"></p>
                    <p className="mt-1.5 font-medium">
                      (................................................)
                    </p>
                    <p className="text-[11px] text-black mt-1">วันที่ ..... / ..... / ..........</p>
                  </div>
                </div>

                {/* 3. Approved By */}
                <div className="space-y-6">
                  <div>
                    <p className="font-bold">ผู้อนุมัติการปรับปรุงสต็อก (Approved By)</p>
                  </div>
                  <div className="pt-8">
                    <p className="border-b border-black border-dotted mx-4"></p>
                    <p className="mt-1.5 font-medium">
                      (................................................)
                    </p>
                    <p className="text-[11px] text-black mt-1">วันที่ ..... / ..... / ..........</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 text-[10px] text-black text-center border-t border-black/40 pt-2 flex justify-between">
                <span>เอกสารนี้ออกโดยระบบบริหารจัดการคลังสินค้า {appName}</span>
                <span>พิมพ์เมื่อ: {formatDateTime(new Date())}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer - Hidden during print */}
        <div className="p-3 border-t border-border/80 bg-muted/20 flex items-center justify-between gap-2 shrink-0 print:hidden flex-wrap">
          <div className="text-xs text-muted-foreground">
            💡 กดปุ่ม <strong>"สั่งพิมพ์ (Print A4)"</strong> หรือใช้ปุ่ม{" "}
            <strong>"เปิดแท็บพิมพ์"</strong> / <strong>"ดาวน์โหลดไฟล์"</strong>{" "}
            เพื่อพิมพ์ได้ทุกเบราว์เซอร์
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadHtml}
              className="rounded-xl text-xs h-9"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              ดาวน์โหลด HTML
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenPrintWindow}
              className="rounded-xl text-xs h-9"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              เปิดแท็บพิมพ์
            </Button>
            <Button
              type="button"
              onClick={handleTriggerPrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-1.5 h-9 px-4 shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>สั่งพิมพ์ (Print A4)</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
