import React, { useState, useRef, useMemo } from "react";
import { useStore } from "@/lib/store";
import { formatDate } from "@/lib/dateFormat";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { SalesRecord } from "@/lib/types";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  Upload,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Search,
  Calendar,
  Building2,
  TrendingUp,
  RefreshCw,
  X,
} from "lucide-react";

export function SalesImportPage() {
  const {
    salesRecords,
    recipes,
    branches,
    bulkImportSalesRecords,
    deleteSalesRecord,
    clearAllSalesRecords,
    selectedBranchId,
  } = useStore();

  const [activeTab, setActiveTab] = useState<"import" | "history">("import");

  // History Filters
  const [historySearch, setHistorySearch] = useState("");
  const [historyBranchId, setHistoryBranchId] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFileName, setImportFileName] = useState("");
  const [parsedSalesRows, setParsedSalesRows] = useState<
    Array<{
      rowNum: number;
      date: string;
      menuCode: string;
      menuName: string;
      quantitySold: number;
      branchId?: string;
      branchName: string;
      errors: string[];
      warnings: string[];
      isValid: boolean;
    }>
  >([]);

  // Generate Sample Sales Excel Template
  const handleDownloadSalesTemplate = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const sampleBranch = branches[0]?.name || "สาขาหลัก";

    const templateData = [
      {
        Date: todayStr,
        "Menu Code": "M001",
        "Menu Name": "Salmon Don (ข้าวหน้าปลาแซลมอน)",
        "Quantity Sold": 25,
        Branch: sampleBranch,
      },
      {
        Date: todayStr,
        "Menu Code": "M002",
        "Menu Name": "Sashimi Set (ชุดซาชิมิ)",
        "Quantity Sold": 15,
        Branch: sampleBranch,
      },
      {
        Date: todayStr,
        "Menu Code": "M003",
        "Menu Name": "Salmon Roll (แซลมอนโรล)",
        "Quantity Sold": 30,
        Branch: sampleBranch,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales_Import");
    XLSX.writeFile(workbook, "Hana_Weekly_Sales_Template.xlsx");
    toast.success("ดาวน์โหลดแม่แบบ Excel รายงานยอดขายเรียบร้อยแล้ว");
  };

  // Parse Uploaded Sales File
  const handleSalesFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
        });

        if (!rawJson || rawJson.length === 0) {
          toast.error("ไม่พบข้อมูลในไฟล์ที่เลือก");
          return;
        }

        const seenKeys = new Set<string>();

        const parsed = rawJson.map((row, idx) => {
          const rowNum = idx + 2; // header on line 1
          let rawDate = String(row["Date"] || row["วันที่"] || "").trim();
          const menuCode = String(row["Menu Code"] || row["Code"] || row["รหัสเมนู"] || "").trim();
          let menuName = String(row["Menu Name"] || row["Name"] || row["ชื่อเมนู"] || "").trim();
          const rawQty =
            row["Quantity Sold"] ?? row["Qty Sold"] ?? row["จำนวนขาย"] ?? row["Quantity"];
          const branchName = String(row["Branch"] || row["สาขา"] || "").trim();

          const quantitySold = parseFloat(rawQty);

          const errors: string[] = [];
          const warnings: string[] = [];

          // Date Normalization
          if (!rawDate) {
            rawDate = new Date().toISOString().slice(0, 10);
            warnings.push("ไม่ระบุวันที่ ระบบใช้วันที่ปัจจุบันแทน");
          } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
            // Valid ISO date
          } else {
            // Attempt parse date
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              rawDate = d.toISOString().slice(0, 10);
            } else {
              errors.push(`รูปแบบวันที่ไม่ถูกต้อง (${rawDate}) ต้องเป็น YYYY-MM-DD`);
            }
          }

          if (!menuCode) errors.push("กรอกข้อมูลรหัสเมนู (Menu Code) ไม่ครบ");

          if (isNaN(quantitySold) || quantitySold < 0) {
            errors.push("จำนวนขาย (Quantity Sold) ต้องเป็นตัวเลขมากกว่าหรือเท่ากับ 0");
          }

          // Check if Menu Code exists in Recipe Master
          const matchingRecipe = recipes.find(
            (r) => r.menuCode.toLowerCase().trim() === menuCode.toLowerCase().trim(),
          );

          if (!matchingRecipe) {
            warnings.push(
              `ไม่พบรหัสเมนู "${menuCode}" ในระบบสูตรอาหาร (จะไม่สามารถคำนวณวัตถุดิบได้)`,
            );
          } else if (!menuName) {
            menuName = matchingRecipe.menuName;
          }

          // Match branch ID
          const matchedBranch = branches.find(
            (b) => b.name.toLowerCase().trim() === branchName.toLowerCase().trim(),
          );
          const branchId = matchedBranch ? matchedBranch.id : selectedBranchId;

          // Duplicate key check
          const dupKey = `${rawDate}_${branchName}_${menuCode.toLowerCase()}`;
          if (seenKeys.has(dupKey)) {
            errors.push("พบข้อมูลยอดขายซ้ำ (Date + Branch + Menu Code) ในไฟล์นี้");
          } else if (menuCode) {
            seenKeys.add(dupKey);
          }

          return {
            rowNum,
            date: rawDate,
            menuCode,
            menuName: menuName || matchingRecipe?.menuName || "—",
            quantitySold: isNaN(quantitySold) ? 0 : quantitySold,
            branchId,
            branchName: branchName || matchedBranch?.name || "สาขาหลัก",
            errors,
            warnings,
            isValid: errors.length === 0,
          };
        });

        setParsedSalesRows(parsed);
      } catch (err) {
        console.error("Sales import error:", err);
        toast.error("ไม่สามารถอ่านไฟล์ Excel ได้ กรุณาตรวจสอบรูปแบบไฟล์");
      }
    };

    reader.readAsBinaryString(file);
  };

  const validSalesRows = parsedSalesRows.filter((r) => r.isValid);

  const handleExecuteSalesImport = async () => {
    if (validSalesRows.length === 0) {
      toast.error("ไม่มีรายการยอดขายที่ถูกต้องสำหรับนำเข้า");
      return;
    }

    const payload: Omit<SalesRecord, "id">[] = validSalesRows.map((r) => ({
      date: r.date,
      menuCode: r.menuCode,
      menuName: r.menuName,
      quantitySold: r.quantitySold,
      branchId: r.branchId,
      branchName: r.branchName,
    }));

    const result = await bulkImportSalesRecords(payload);
    if (result.success) {
      toast.success(`นำเข้ารายงานยอดขายสำเร็จจำนวน ${result.importedCount} รายการ`);
      setParsedSalesRows([]);
      setImportFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setActiveTab("history");
    } else {
      toast.error(result.error || "เกิดข้อผิดพลาดในการนำเข้ายอดขาย");
    }
  };

  // Filter Sales History
  const filteredSalesHistory = useMemo(() => {
    return salesRecords.filter((rec) => {
      const matchesSearch =
        !historySearch.trim() ||
        rec.menuCode.toLowerCase().includes(historySearch.toLowerCase()) ||
        rec.menuName.toLowerCase().includes(historySearch.toLowerCase());

      const matchesBranch = historyBranchId === "all" || rec.branchId === historyBranchId;

      const matchesStart = !startDate || rec.date >= startDate;
      const matchesEnd = !endDate || rec.date <= endDate;

      return matchesSearch && matchesBranch && matchesStart && matchesEnd;
    });
  }, [salesRecords, historySearch, historyBranchId, startDate, endDate]);

  const totalQtySold = useMemo(() => {
    return filteredSalesHistory.reduce((acc, curr) => acc + curr.quantitySold, 0);
  }, [filteredSalesHistory]);

  const handleDeleteHistoryRow = async (id: string) => {
    if (window.confirm("คุณต้องการลบรายการยอดขายนี้หรือไม่?")) {
      await deleteSalesRecord(id);
      toast.success("ลบรายการยอดขายเรียบร้อยแล้ว");
    }
  };

  const handleClearAllHistory = async () => {
    if (
      window.confirm(
        "คุณแน่ใจหรือว่าต้องการล้างประวัติยอดขายทั้งหมด? การดำเนินการนี้ไม่สามารถย้อนกลับได้",
      )
    ) {
      await clearAllSalesRecords();
      toast.success("ล้างประวัติยอดขายทั้งหมดเรียบร้อยแล้ว");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Import ยอดขาย (Weekly Sales Import)
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                นำเข้ารายงานยอดขายประจำสัปดาห์/ประจำวัน เพื่อใช้คำนวณการใชวัตถุดิบตามสูตรอาหาร
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadSalesTemplate}
            className="px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            ดาวน์โหลดแม่แบบ Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("import")}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "import"
              ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
          }`}
        >
          <Upload className="w-4 h-4" />
          นำเข้ายอดขาย (Sales Import)
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "history"
              ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          ประวัติยอดขายที่นำเข้า ({salesRecords.length} รายการ)
        </button>
      </div>

      {/* TAB 1: IMPORT FLOW */}
      {activeTab === "import" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  อัปโหลดรายงานยอดขาย (.xlsx, .csv)
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  ระบบจะตรวจสอบวัน, รหัสเมนู, และจำนวนขาย พร้อมจับคู่วัตถุดิบตามสูตรอาหาร
                </p>
              </div>
              <button
                onClick={handleDownloadSalesTemplate}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-950/50 rounded-lg transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                ดาวน์โหลดแม่แบบ Excel (Weekly Sales)
              </button>
            </div>

            {/* Dropzone */}
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleSalesFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="w-10 h-10 mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                ลากและวางไฟล์รายงานยอดขายที่นี่ หรือคลิกเพื่อเลือกไฟล์
              </p>
              <p className="text-xs text-slate-400 mt-1">
                คอลัมน์ที่รองรับ: Date, Menu Code, Menu Name, Quantity Sold, Branch
              </p>
              {importFileName && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 rounded-md text-xs font-medium">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  ไฟล์ที่เลือก: {importFileName}
                </div>
              )}
            </div>
          </div>

          {/* Import Preview Results */}
          {parsedSalesRows.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-500">ยอดขายทั้งหมดในไฟล์</span>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {parsedSalesRows.length} รายการ
                  </p>
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">
                    ข้อมูลถูกต้อง (Valid)
                  </span>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                    {validSalesRows.length} รายการ
                  </p>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800">
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    คำเตือนสูตรอาหาร
                  </span>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                    {parsedSalesRows.filter((r) => r.warnings.length > 0).length} รายการ
                  </p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-800">
                  <span className="text-xs text-blue-600 dark:text-blue-400">รวมจำนวนขาย</span>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                    {validSalesRows.reduce((a, b) => a + b.quantitySold, 0).toLocaleString()}{" "}
                    จาน/ชุด
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-between gap-4 pt-2">
                <p className="text-xs text-slate-500">
                  * ข้อมูลที่นำเข้าจะนำไปรวมกับประวัติยอดขายประจำวันเพื่อคำนวณการใช้วัตถุดิบตามสูตร
                </p>
                <button
                  onClick={handleExecuteSalesImport}
                  disabled={validSalesRows.length === 0}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 rounded-lg transition-colors shadow-xs"
                >
                  นำเข้ายอดขายที่ถูกต้อง ({validSalesRows.length} รายการ)
                </button>
              </div>

              {/* Preview Table */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-3 py-2.5">แถว</th>
                      <th className="px-3 py-2.5">สถานะ</th>
                      <th className="px-3 py-2.5">วันที่</th>
                      <th className="px-3 py-2.5">สาขา</th>
                      <th className="px-3 py-2.5">รหัสเมนู</th>
                      <th className="px-3 py-2.5">ชื่อเมนู</th>
                      <th className="px-3 py-2.5 text-right">จำนวนขาย</th>
                      <th className="px-3 py-2.5">หมายเหตุ / คำเตือน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {parsedSalesRows.map((row) => (
                      <tr
                        key={row.rowNum}
                        className={
                          !row.isValid
                            ? "bg-rose-50/50 dark:bg-rose-950/20"
                            : row.warnings.length > 0
                              ? "bg-amber-50/30 dark:bg-amber-950/20"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }
                      >
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{row.rowNum}</td>
                        <td className="px-3 py-2">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 rounded-md">
                              <CheckCircle2 className="w-3 h-3" /> ผ่าน
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 rounded-md">
                              <AlertTriangle className="w-3 h-3" /> ไม่ผ่าน
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{formatDate(row.date)}</td>
                        <td className="px-3 py-2 font-medium">{row.branchName}</td>
                        <td className="px-3 py-2 font-mono text-xs font-bold">
                          {row.menuCode || "—"}
                        </td>
                        <td className="px-3 py-2 font-medium">{row.menuName}</td>
                        <td className="px-3 py-2 text-right font-bold text-blue-600 dark:text-blue-400">
                          {row.quantitySold.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {row.errors.length > 0 ? (
                            <p className="text-rose-600 font-medium">• {row.errors.join(", ")}</p>
                          ) : row.warnings.length > 0 ? (
                            <p className="text-amber-600 dark:text-amber-400 font-medium">
                              ⚠ {row.warnings.join(", ")}
                            </p>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SALES HISTORY VIEW */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหารหัสเมนู หรือ ชื่อเมนู..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>

            {/* Branch */}
            <div>
              <select
                value={historyBranchId}
                onChange={(e) => setHistoryBranchId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
              >
                <option value="all">สาขา ทั้งหมด</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <ThaiDatePicker
                value={startDate}
                onChange={setStartDate}
                className="w-full text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>

            {/* End Date */}
            <div>
              <ThaiDatePicker
                value={endDate}
                onChange={setEndDate}
                className="w-full text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-xs text-slate-500">รายการทั้งหมด</span>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {filteredSalesHistory.length} รายการ
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500">รวมจำนวนขาย</span>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {totalQtySold.toLocaleString()} จาน/ชุด
                </p>
              </div>
            </div>

            {salesRecords.length > 0 && (
              <button
                onClick={handleClearAllHistory}
                className="px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-400 rounded-lg transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                ล้างประวัติยอดขายทั้งหมด
              </button>
            )}
          </div>

          {/* Sales Records Table */}
          {filteredSalesHistory.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
              <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
                ไม่พบประวัติยอดขาย
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                ยังไม่มีข้อมูลยอดขายในระบบ คุณสามารถนำเข้าข้อมูลยอดขายจากไฟล์ Excel/CSV ได้
              </p>
              <button
                onClick={() => setActiveTab("import")}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                นำเข้ายอดขาย
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-100/80 dark:bg-slate-800/50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">วันที่</th>
                      <th className="px-4 py-3">สาขา</th>
                      <th className="px-4 py-3">รหัสเมนู (Menu Code)</th>
                      <th className="px-4 py-3">ชื่อเมนู (Menu Name)</th>
                      <th className="px-4 py-3 text-right">จำนวนขาย (Quantity Sold)</th>
                      <th className="px-4 py-3 text-center">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredSalesHistory.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                          {formatDate(rec.date)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {rec.branchName || "สาขาหลัก"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                          {rec.menuCode}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                          {rec.menuName}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                          {rec.quantitySold.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteHistoryRow(rec.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                            title="ลบรายการนี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
