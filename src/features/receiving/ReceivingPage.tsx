import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useStore, formatCurrency } from "@/lib/store";
import { filterByBranch } from "@/lib/branchFilter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SmartReceivingForm } from "./SmartReceivingForm";
import { SearchableSupplierSelector } from "@/components/SearchableSupplierSelector";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { printHtmlDocument } from "@/lib/printUtils";
import {
  CheckCircle2,
  PackageCheck,
  Search,
  Truck,
  ShoppingCart,
  History,
  Sparkles,
  Eye,
  Pencil,
  Lock,
  Unlock,
  AlertCircle,
  FileText,
  Clock,
  User as UserIcon,
  FileSpreadsheet,
  Download,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import type { Purchase, PurchaseItem, DocumentStatus } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/dateFormat";

export function ReceivingPage() {
  const {
    purchases,
    suppliers,
    items,
    settings,
    currentUser,
    selectedBranchId,
    updatePurchaseWithRevision,
    togglePurchaseLock,
  } = useStore();

  const [activeTab, setActiveTab] = useState<"receive" | "history">("history");
  const [q, setQ] = useState("");

  // Modal states
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [historyPurchase, setHistoryPurchase] = useState<Purchase | null>(null);
  const [lockingPurchase, setLockingPurchase] = useState<Purchase | null>(null);

  // Edit form state
  const [editSupplierId, setEditSupplierId] = useState("");
  const [editInvoiceNumber, setEditInvoiceNumber] = useState("");
  const [editPoNumber, setEditPoNumber] = useState("");
  const [editPurchaseDate, setEditPurchaseDate] = useState("");
  const [editStatus, setEditStatus] = useState<DocumentStatus>("Completed");
  const [editItems, setEditItems] = useState<PurchaseItem[]>([]);
  const [editReason, setEditReason] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Lock form state
  const [lockReason, setLockReason] = useState("");
  const [savingLock, setSavingLock] = useState(false);

  const branchPurchases = useMemo(() => {
    return filterByBranch(purchases, selectedBranchId);
  }, [purchases, selectedBranchId]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...branchPurchases]
      .sort((a, b) => +new Date(b.purchaseDate) - +new Date(a.purchaseDate))
      .filter((p) => {
        if (!term) return true;
        const sup = suppliers.find((s) => s.id === p.supplierId)?.name ?? "";
        const po = p.poNumber ?? "";
        const inv = p.invoiceNumber ?? "";
        const dateStr = formatDate(p.purchaseDate);
        const isoDate = p.purchaseDate ?? "";
        return (
          po.toLowerCase().includes(term) ||
          inv.toLowerCase().includes(term) ||
          sup.toLowerCase().includes(term) ||
          dateStr.toLowerCase().includes(term) ||
          isoDate.toLowerCase().includes(term)
        );
      });
  }, [branchPurchases, suppliers, q]);

  const handleExportCSV = () => {
    if (rows.length === 0) {
      toast.error("ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }
    const headers = [
      "เลขที่ใบสั่งซื้อ (PO)",
      "เลขที่ใบกำกับสินค้า",
      "วันที่รับสินค้า",
      "ซัพพลายเออร์",
      "พนักงานผู้รับ",
      "จำนวนรายการ",
      "จำนวนหน่วยรวม",
      "มูลค่ารวม",
      "สถานะ",
    ];
    const csvRows = rows.map((p) => {
      const supName = suppliers.find((s) => s.id === p.supplierId)?.name || "";
      const totalUnits = p.items.reduce((s, i) => s + i.quantity, 0);
      return [
        `"${p.poNumber || "-"}"`,
        `"${p.invoiceNumber || "-"}"`,
        `"${formatDate(p.purchaseDate)}"`,
        `"${supName}"`,
        `"${p.employee || "-"}"`,
        p.items.length,
        totalUnits,
        p.total,
        `"${p.status || "Completed"}"`,
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `รายการรับสินค้า_Receiving_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("ส่งออกไฟล์ CSV เรียบร้อยแล้ว");
  };

  const handleExportExcel = () => {
    if (rows.length === 0) {
      toast.error("ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }
    const headers = [
      "เลขที่ใบสั่งซื้อ (PO)",
      "เลขที่ใบกำกับสินค้า",
      "วันที่รับสินค้า",
      "ซัพพลายเออร์",
      "พนักงานผู้รับ",
      "จำนวนรายการ",
      "จำนวนหน่วยรวม",
      "มูลค่ารวม",
      "สถานะ",
    ];
    const excelRows = rows.map((p) => {
      const supName = suppliers.find((s) => s.id === p.supplierId)?.name || "";
      const totalUnits = p.items.reduce((s, i) => s + i.quantity, 0);
      return [
        p.poNumber || "-",
        p.invoiceNumber || "-",
        formatDate(p.purchaseDate),
        supName,
        p.employee || "-",
        p.items.length,
        totalUnits,
        p.total,
        p.status || "Completed",
      ].join("\t");
    });

    const content = "\uFEFF" + [headers.join("\t"), ...excelRows].join("\n");
    const blob = new Blob([content], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `รายการรับสินค้า_Receiving_${new Date().toISOString().slice(0, 10)}.xls`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("ส่งออกไฟล์ Excel เรียบร้อยแล้ว");
  };

  const handlePrintReceipt = (purchase: Purchase) => {
    const supName = suppliers.find((s) => s.id === purchase.supplierId)?.name || "—";

    const itemsHtml = purchase.items
      .map((it, idx) => {
        const itemObj = items.find((x) => x.id === it.itemId);
        return `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${idx + 1}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${itemObj?.code || "—"}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${itemObj?.name || it.itemId}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${it.quantity}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatCurrency(it.unitPrice, settings.currency)}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${it.vatType || "V"}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${it.expiryDate ? formatDate(it.expiryDate) : "—"}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(it.quantity * it.unitPrice, settings.currency)}</td>
          </tr>
        `;
      })
      .join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>ใบรับสินค้า / Receiving Document - ${purchase.invoiceNumber}</title>
        <style>
          body { font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #1e293b; margin: 20px; background: #fff; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h2 { margin: 0; font-size: 20px; color: #0f172a; }
          .header p { margin: 4px 0 0 0; color: #64748b; font-size: 12px; }
          .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
          .meta-item { font-size: 12px; }
          .meta-item strong { display: inline-block; width: 160px; color: #475569; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; font-weight: 600; text-align: left; }
          td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; }
          .total-box { margin-top: 15px; text-align: right; font-size: 15px; font-weight: bold; color: #0f172a; }
          .signatures { display: flex; justify-content: space-between; margin-top: 50px; text-align: center; }
          .sig-line { width: 200px; border-top: 1px solid #94a3b8; margin-top: 40px; padding-top: 5px; font-size: 12px; color: #475569; }
          @media print {
            body { margin: 10mm; }
            @page { size: A4 portrait; margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${settings.companyName || "Sushi Hana Thailand"}</h2>
          <h3 style="margin: 4px 0 0 0; font-size: 16px;">ใบรับสินค้า (Receiving Voucher)</h3>
          <p>เอกสารรับสินค้าเข้าคลังสินค้า</p>
        </div>
        <div class="meta-grid">
          <div class="meta-item"><strong>เลขที่ใบสั่งซื้อ (PO):</strong> <span style="font-family: monospace; font-weight: bold;">${purchase.poNumber || "—"}</span></div>
          <div class="meta-item"><strong>เลขที่ใบกำกับสินค้า:</strong> <span style="font-family: monospace; font-weight: bold;">${purchase.invoiceNumber}</span></div>
          <div class="meta-item"><strong>ซัพพลายเออร์ (Supplier):</strong> ${supName}</div>
          <div class="meta-item"><strong>วันที่รับสินค้า:</strong> ${formatDate(purchase.purchaseDate)}</div>
          <div class="meta-item"><strong>พนักงานผู้รับสินค้า:</strong> ${purchase.employee || "—"}</div>
          <div class="meta-item"><strong>สถานะเอกสาร:</strong> ${purchase.status || "Completed"} (Rev ${purchase.revision || 1})</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 40px;">#</th>
              <th>รหัสสินค้า</th>
              <th>ชื่อสินค้า</th>
              <th style="text-align: right;">จำนวน</th>
              <th style="text-align: right;">ราคา/หน่วย</th>
              <th style="text-align: center;">VAT</th>
              <th style="text-align: center;">วันหมดอายุ</th>
              <th style="text-align: right;">ราคารวม</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="total-box">
          ยอดรวมสุทธิ: ${formatCurrency(purchase.total, settings.currency)}
        </div>
        <div class="signatures">
          <div>
            <div class="sig-line">ผู้รับสินค้า (Received By)</div>
          </div>
          <div>
            <div class="sig-line">ผู้ตรวจสอบ (Checked By)</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printHtmlDocument(htmlContent, `ใบรับสินค้า_${purchase.invoiceNumber}`);
  };

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todays = purchases.filter((p) => new Date(p.purchaseDate) >= today);
    const value = purchases.reduce((s, p) => s + p.total, 0);
    const units = purchases.reduce((s, p) => s + p.items.reduce((x, it) => x + it.quantity, 0), 0);
    return { total: purchases.length, todays: todays.length, value, units };
  }, [purchases]);

  const kpi = [
    { label: "Total Receipts", value: stats.total, icon: PackageCheck, tone: "text-primary" },
    { label: "Today", value: stats.todays, icon: ShoppingCart, tone: "text-emerald-600" },
    { label: "Units Received", value: stats.units, icon: Truck, tone: "text-primary" },
    {
      label: "Total Value",
      value: formatCurrency(stats.value, settings.currency),
      icon: CheckCircle2,
      tone: "text-emerald-600",
    },
  ];

  const handleOpenEdit = (p: Purchase) => {
    setEditingPurchase(p);
    setEditSupplierId(p.supplierId);
    setEditInvoiceNumber(p.invoiceNumber);
    setEditPoNumber(p.poNumber || "");
    setEditPurchaseDate(p.purchaseDate);
    setEditStatus(p.status || "Completed");
    setEditItems(p.items.map((i) => ({ ...i })));
    setEditReason("");
  };

  const handleSaveEdit = async () => {
    if (!editingPurchase) return;
    setSavingEdit(true);

    const res = await updatePurchaseWithRevision({
      purchaseId: editingPurchase.id,
      updatedFields: {
        supplierId: editSupplierId,
        invoiceNumber: editInvoiceNumber,
        poNumber: editPoNumber,
        purchaseDate: editPurchaseDate,
        status: editStatus,
      },
      items: editItems,
      reason: editReason,
    });

    setSavingEdit(false);

    if (res.success) {
      toast.success(`อัปเดตเอกสาร ${editingPurchase.invoiceNumber} เรียบร้อยแล้ว`);
      setEditingPurchase(null);
    } else {
      toast.error(res.error || "ไม่สามารถอัปเดตเอกสารได้");
    }
  };

  const handleToggleLock = async () => {
    if (!lockingPurchase) return;
    setSavingLock(true);

    const isLocked = lockingPurchase.status === "Locked";
    const res = await togglePurchaseLock({
      purchaseId: lockingPurchase.id,
      lock: !isLocked,
      reason: lockReason,
    });

    setSavingLock(false);

    if (res.success) {
      toast.success(
        `Document ${lockingPurchase.invoiceNumber} ${isLocked ? "unlocked" : "locked"} successfully`,
      );
      setLockingPurchase(null);
      setLockReason("");
    } else {
      toast.error(res.error || "Failed to update lock status");
    }
  };

  const isOwnerAdminIT =
    currentUser?.role === "owner" || currentUser?.role === "it" || currentUser?.role === "admin";

  return (
    <div className="space-y-6">
      <PageHeader
        title="รับสินค้า (Receiving)"
        description="ตรวจรับสินค้าเข้าสต๊อก & จัดการเอกสาร (Stock In & Document Revision Management)"
        actions={
          <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-xl border border-border">
            <Button
              variant={activeTab === "receive" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("receive")}
              className="rounded-lg text-xs font-semibold gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              รับสินค้า (Receive)
            </Button>
            <Button
              variant={activeTab === "history" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("history")}
              className="rounded-lg text-xs font-semibold gap-1.5"
            >
              <History className="h-3.5 w-3.5" />
              ประวัติการรับสินค้า (History) ({purchases.length})
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpi.map((k) => (
          <Card
            key={k.label}
            className="rounded-2xl border-border/70 p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {k.label}
                </div>
                <div className="mt-1 truncate text-xl font-bold">{k.value}</div>
              </div>
              <div
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent ${k.tone}`}
              >
                <k.icon className="h-4 w-4" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {activeTab === "receive" ? (
        <SmartReceivingForm onSaved={() => setActiveTab("history")} />
      ) : (
        <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 md:max-w-md w-full sm:w-auto">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหา PO, เลขที่ใบกำกับสินค้า, Supplier, วันที่…"
                className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="h-9 rounded-xl text-xs gap-1.5"
                title="Export Excel"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                Export Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="h-9 rounded-xl text-xs gap-1.5"
                title="Export CSV"
              >
                <Download className="h-3.5 w-3.5 text-primary" />
                Export CSV
              </Button>
              <div className="text-xs text-muted-foreground flex items-center gap-2 ml-2">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span> สมบูรณ์
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-slate-500"></span> ล็อค
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขที่ใบสั่งซื้อ (PO Number)</TableHead>
                  <TableHead>เลขที่ใบกำกับสินค้า (Invoice No.)</TableHead>
                  <TableHead>วันที่รับสินค้า (Receiving Date)</TableHead>
                  <TableHead>ซัพพลายเออร์ (Supplier)</TableHead>
                  <TableHead className="text-right">จำนวนรายการ / หน่วย (Items / Units)</TableHead>
                  <TableHead className="text-right">มูลค่ารวม (Total Amount)</TableHead>
                  <TableHead>สถานะ & Rev (Status)</TableHead>
                  <TableHead className="text-right">จัดการ (Actions)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const sup = suppliers.find((s) => s.id === p.supplierId);
                  const units = p.items.reduce((s, i) => s + i.quantity, 0);
                  const status = p.status || "Completed";
                  const revNum = p.revision || 1;

                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {p.poNumber || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold">
                        {p.invoiceNumber}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDate(p.purchaseDate)}
                      </TableCell>
                      <TableCell className="font-medium text-xs">{sup?.name ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        <span className="font-bold">{p.items.length}</span> items ({units} pcs)
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-xs">
                        {formatCurrency(p.total, settings.currency)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold ${
                              status === "Locked"
                                ? "border-slate-400 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                                : status === "Draft"
                                  ? "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                                  : "border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            }`}
                          >
                            {status === "Locked" && <Lock className="h-3 w-3 mr-1 inline" />}
                            {status}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            Rev {revNum}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setViewingPurchase(p)}
                            title="View Receipt Detail"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => handleOpenEdit(p)}
                            title="Edit Document (Controlled)"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => setHistoryPurchase(p)}
                            title="Revision History"
                          >
                            <History className="h-3.5 w-3.5" />
                          </Button>

                          {isOwnerAdminIT && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${
                                status === "Locked"
                                  ? "text-amber-600 hover:text-amber-700"
                                  : "text-muted-foreground hover:text-slate-700"
                              }`}
                              onClick={() => {
                                setLockingPurchase(p);
                                setLockReason("");
                              }}
                              title={status === "Locked" ? "Unlock Document" : "Lock Document"}
                            >
                              {status === "Locked" ? (
                                <Unlock className="h-3.5 w-3.5" />
                              ) : (
                                <Lock className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center">
                      <div className="mx-auto max-w-sm">
                        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
                          <ShoppingCart className="h-5 w-5" />
                        </div>
                        <div className="mt-3 text-sm font-semibold">No receipts found</div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Record a receipt to see it appear here.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* VIEW RECEIPT DETAIL DIALOG */}
      <Dialog open={!!viewingPurchase} onOpenChange={() => setViewingPurchase(null)}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-6">
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <FileText className="h-5 w-5 text-primary" />
                รายละเอียดการรับสินค้า (Receiving Details): {viewingPurchase?.invoiceNumber}
              </DialogTitle>
              {viewingPurchase && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePrintReceipt(viewingPurchase)}
                  className="rounded-xl text-xs gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5 text-primary" />
                  พิมพ์เอกสาร (Print)
                </Button>
              )}
            </div>
            <DialogDescription className="text-xs">
              รายละเอียดข้อมูลเอกสารและรายการสินค้า (Document Details & Items)
            </DialogDescription>
          </DialogHeader>

          {viewingPurchase && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-muted/40 p-3 rounded-xl border border-border/60 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    เลขที่ใบสั่งซื้อ (PO No.)
                  </span>
                  <span className="font-semibold text-foreground font-mono">
                    {viewingPurchase.poNumber || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    เลขที่ใบกำกับสินค้า (Invoice No.)
                  </span>
                  <span className="font-semibold text-foreground font-mono">
                    {viewingPurchase.invoiceNumber || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    ซัพพลายเออร์ (Supplier)
                  </span>
                  <span className="font-semibold text-foreground">
                    {suppliers.find((s) => s.id === viewingPurchase.supplierId)?.name || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    วันที่รับสินค้า (Receiving Date)
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatDate(viewingPurchase.purchaseDate)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    ผู้รับสินค้า (Received By)
                  </span>
                  <span className="font-semibold text-foreground">
                    {viewingPurchase.createdBy || viewingPurchase.employee || "Staff"}
                  </span>
                </div>
              </div>

              <div className="border border-border/80 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs">Item</TableHead>
                      <TableHead className="text-right text-xs">Qty</TableHead>
                      <TableHead className="text-right text-xs">Unit Cost</TableHead>
                      <TableHead className="text-center text-xs">VAT</TableHead>
                      <TableHead className="text-xs">Expiry Date</TableHead>
                      <TableHead className="text-right text-xs">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingPurchase.items.map((it, idx) => {
                      const itemObj = items.find((x) => x.id === it.itemId);
                      return (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-medium">
                            {itemObj?.name || it.itemId}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold tabular-nums">
                            {it.quantity}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {formatCurrency(it.unitPrice, settings.currency)}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            <Badge variant="outline" className="text-[10px]">
                              {it.vatType || "V"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {it.expiryDate ? formatDate(it.expiryDate) : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold tabular-nums">
                            {formatCurrency(it.quantity * it.unitPrice, settings.currency)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-muted-foreground">
                  Remark: {viewingPurchase.remark || "—"}
                </span>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground mr-2">Grand Total:</span>
                  <span className="text-base font-bold text-primary">
                    {formatCurrency(viewingPurchase.total, settings.currency)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewingPurchase(null)}
              className="rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT RECEIPT DIALOG (CONTROLLED REVISION WORKFLOW) */}
      <Dialog open={!!editingPurchase} onOpenChange={() => setEditingPurchase(null)}>
        <DialogContent className="max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Receiving Document: {editingPurchase?.invoiceNumber}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Every edit will increment the revision number and create a detailed audit log entry.
            </DialogDescription>
          </DialogHeader>

          {editingPurchase && (
            <div className="space-y-4 py-2">
              {/* Top Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">ซัพพลายเออร์</Label>
                  <SearchableSupplierSelector
                    value={editSupplierId}
                    onChange={setEditSupplierId}
                    suppliers={suppliers}
                    size="sm"
                    className="h-9 rounded-xl text-xs"
                    placeholder="เลือกซัพพลายเออร์..."
                  />
                </div>

                <div>
                  <Label className="text-xs mb-1 block">เลขที่ใบกำกับสินค้า (Invoice No.)</Label>
                  <Input
                    value={editInvoiceNumber}
                    onChange={(e) => setEditInvoiceNumber(e.target.value)}
                    className="h-9 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs mb-1 block">เลขที่ใบสั่งซื้อ (PO No.)</Label>
                  <Input
                    value={editPoNumber}
                    onChange={(e) => setEditPoNumber(e.target.value)}
                    placeholder="e.g. PO-2026-001"
                    className="h-9 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs mb-1 block">วันที่รับสินค้า (Receiving Date)</Label>
                  <ThaiDatePicker
                    value={editPurchaseDate}
                    onChange={setEditPurchaseDate}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
              </div>

              {isOwnerAdminIT && (
                <div>
                  <Label className="text-xs mb-1 block">Document Status</Label>
                  <Select
                    value={editStatus}
                    onValueChange={(v) => setEditStatus(v as DocumentStatus)}
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Locked">Locked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Line Items Table */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Line Items
                </Label>
                <div className="border border-border/80 rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs">Item</TableHead>
                        <TableHead className="text-xs w-28 text-right">Qty</TableHead>
                        <TableHead className="text-xs w-32 text-right">Unit Cost</TableHead>
                        <TableHead className="text-xs w-24 text-center">VAT</TableHead>
                        <TableHead className="text-xs w-36">Expiry Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editItems.map((it, idx) => {
                        const itemObj = items.find((x) => x.id === it.itemId);
                        return (
                          <TableRow key={idx}>
                            <TableCell className="text-xs font-medium">
                              {itemObj?.name || it.itemId}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={it.quantity}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setEditItems((list) =>
                                    list.map((x, i) => (i === idx ? { ...x, quantity: val } : x)),
                                  );
                                }}
                                className="h-8 text-right text-xs rounded-lg font-bold"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={it.unitPrice}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setEditItems((list) =>
                                    list.map((x, i) => (i === idx ? { ...x, unitPrice: val } : x)),
                                  );
                                }}
                                className="h-8 text-right text-xs rounded-lg"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Select
                                value={it.vatType || "V"}
                                onValueChange={(val: "V" | "N") => {
                                  setEditItems((list) =>
                                    list.map((x, i) => (i === idx ? { ...x, vatType: val } : x)),
                                  );
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs rounded-lg">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="V">VAT (7%)</SelectItem>
                                  <SelectItem value="N">Non-VAT</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <ThaiDatePicker
                                value={it.expiryDate || ""}
                                onChange={(val) => {
                                  setEditItems((list) =>
                                    list.map((x, i) => (i === idx ? { ...x, expiryDate: val } : x)),
                                  );
                                }}
                                className="h-8 text-xs rounded-lg min-w-[130px]"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* MANDATORY REASON FOR EDIT */}
              <div className="space-y-1.5 bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl">
                <Label className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Reason for Edit (Mandatory / จำเป็น)
                </Label>
                <Textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="E.g., Supplier invoice error correction, physical count mismatch..."
                  className="text-xs bg-background rounded-xl border-amber-300 dark:border-amber-700"
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditingPurchase(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={savingEdit || !editReason.trim()}
              className="rounded-xl font-bold"
            >
              {savingEdit ? "Saving Revision..." : "Save Revision & Log Audit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REVISION HISTORY DRAWER / DIALOG */}
      <Dialog open={!!historyPurchase} onOpenChange={() => setHistoryPurchase(null)}>
        <DialogContent className="max-w-2xl rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <History className="h-5 w-5 text-primary" />
              Revision History: {historyPurchase?.invoiceNumber}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Complete audit trail of document revisions and field-level changes.
            </DialogDescription>
          </DialogHeader>

          {historyPurchase && (
            <div className="space-y-4 py-2">
              {!historyPurchase.revisions || historyPurchase.revisions.length === 0 ? (
                <div className="p-8 text-center bg-muted/30 rounded-xl border border-dashed border-border">
                  <Clock className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">
                    Initial Document Revision (Rev 1) — No subsequent edits recorded yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyPurchase.revisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="border border-border/80 rounded-xl p-3.5 bg-card space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-xs border-b border-border/40 pb-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-primary/10 text-primary font-bold">
                            Rev {rev.revisionNumber}
                          </Badge>
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            {rev.editedBy}{" "}
                            {rev.editedByRole ? `(${rev.editedByRole.toUpperCase()})` : ""}
                          </span>
                        </div>
                        <span className="text-muted-foreground text-[11px]">
                          {formatDateTime(rev.editedAt)}
                        </span>
                      </div>

                      <div className="text-xs space-y-1">
                        <span className="font-bold text-muted-foreground block text-[10px] uppercase">
                          Reason for Change:
                        </span>
                        <p className="italic text-foreground bg-muted/40 p-2 rounded-lg border border-border/40">
                          "{rev.reason}"
                        </p>
                      </div>

                      {rev.changes && rev.changes.length > 0 && (
                        <div className="text-xs space-y-1 pt-1">
                          <span className="font-bold text-muted-foreground block text-[10px] uppercase">
                            Field Changes:
                          </span>
                          <div className="space-y-1">
                            {rev.changes.map((c, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between bg-accent/40 px-2.5 py-1 rounded-md text-[11px]"
                              >
                                <span className="font-medium text-foreground">{c.field}</span>
                                <div className="font-mono text-muted-foreground">
                                  <span className="line-through text-red-500/80 mr-1.5">
                                    {String(c.oldValue)}
                                  </span>
                                  →
                                  <span className="text-emerald-600 font-bold ml-1.5">
                                    {String(c.newValue)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHistoryPurchase(null)}
              className="rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LOCK / UNLOCK TOGGLE DIALOG */}
      <Dialog open={!!lockingPurchase} onOpenChange={() => setLockingPurchase(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              {lockingPurchase?.status === "Locked" ? (
                <Unlock className="h-5 w-5 text-amber-600" />
              ) : (
                <Lock className="h-5 w-5 text-slate-700" />
              )}
              {lockingPurchase?.status === "Locked" ? "Unlock Document" : "Lock Document"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {lockingPurchase?.status === "Locked"
                ? "Unlocking enables editing for authorized users."
                : "Locking prevents Staff and Managers from editing this document."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label className="text-xs font-semibold">Reason for Action (Optional)</Label>
            <Input
              value={lockReason}
              onChange={(e) => setLockReason(e.target.value)}
              placeholder="E.g., Audit verification completed..."
              className="h-9 text-xs rounded-xl"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setLockingPurchase(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleToggleLock}
              disabled={savingLock}
              className="rounded-xl font-bold"
            >
              {savingLock
                ? "Updating..."
                : lockingPurchase?.status === "Locked"
                  ? "Unlock Document"
                  : "Lock Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
