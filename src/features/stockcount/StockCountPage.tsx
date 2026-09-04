import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
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
  Save,
  Search,
  History,
  ClipboardList,
  Eye,
  Pencil,
  Lock,
  Unlock,
  AlertCircle,
  Clock,
  User as UserIcon,
  FileText,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { convertUsageToMasterUnit, formatUnitThai } from "@/lib/unitConversion";
import type { StockCountDocument, StockCountItem, DocumentStatus } from "@/lib/types";
import { StockCountPrintModal } from "./StockCountPrintModal";
import { formatDate, formatDateTime } from "@/lib/dateFormat";

export function StockCountPage() {
  const {
    items,
    categories,
    branches,
    recipes,
    salesRecords,
    currentStock,
    addTransaction,
    stockCounts,
    currentUser,
    selectedBranchId,
    addStockCountDocument,
    updateStockCountWithRevision,
    toggleStockCountLock,
  } = useStore();

  const [activeTab, setActiveTab] = useState<"count" | "history">("count");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});

  // History Filter
  const [historyQuery, setHistoryQuery] = useState("");

  const activeBranchId = useMemo(() => {
    return (
      (selectedBranchId && selectedBranchId !== "all" ? selectedBranchId : null) ||
      currentUser?.branchId ||
      (currentUser?.allowedBranchIds && currentUser.allowedBranchIds[0]) ||
      branches[0]?.id ||
      "b1"
    );
  }, [selectedBranchId, currentUser?.branchId, currentUser?.allowedBranchIds, branches]);

  // Modal states
  const [viewingDoc, setViewingDoc] = useState<StockCountDocument | null>(null);
  const [editingDoc, setEditingDoc] = useState<StockCountDocument | null>(null);
  const [historyDoc, setHistoryDoc] = useState<StockCountDocument | null>(null);
  const [lockingDoc, setLockingDoc] = useState<StockCountDocument | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printDoc, setPrintDoc] = useState<StockCountDocument | null>(null);

  // Edit form states
  const [editDate, setEditDate] = useState("");
  const [editRemark, setEditRemark] = useState("");
  const [editStatus, setEditStatus] = useState<DocumentStatus>("Completed");
  const [editItems, setEditItems] = useState<StockCountItem[]>([]);
  const [editReason, setEditReason] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Lock form state
  const [lockReason, setLockReason] = useState("");
  const [savingLock, setSavingLock] = useState(false);

  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          i.active &&
          (cat === "all" || i.categoryId === cat) &&
          (i.name.toLowerCase().includes(q.toLowerCase()) ||
            i.code.toLowerCase().includes(q.toLowerCase())),
      ),
    [items, cat, q],
  );

  const itemUsageMap = useMemo(() => {
    const map: Record<string, { rawQty: number; stockQty: number; recipeUnit: string }> = {};

    (salesRecords || []).forEach((s) => {
      if (!s?.menuCode) return;
      const recs = (recipes || []).filter(
        (r) => r?.menuCode && r.menuCode.trim().toLowerCase() === s.menuCode.trim().toLowerCase(),
      );
      recs.forEach((r) => {
        (r?.ingredients || []).forEach((ing) => {
          if (!ing?.ingredientCode) return;
          const matchedItem = (items || []).find(
            (i) =>
              i?.code &&
              (i.code.trim().toLowerCase() === ing.ingredientCode.trim().toLowerCase() ||
                (i.name &&
                  i.name.trim().toLowerCase() === ing.ingredientCode.trim().toLowerCase())),
          );
          if (matchedItem) {
            const rawUsage = (s.quantitySold || 0) * (ing.quantity || 0);
            const conv = convertUsageToMasterUnit(
              rawUsage,
              ing.unit,
              matchedItem.stockUnit || matchedItem.unit,
              matchedItem,
            );
            if (!map[matchedItem.id]) {
              map[matchedItem.id] = {
                rawQty: 0,
                stockQty: 0,
                recipeUnit: conv.recipeUnit,
              };
            }
            map[matchedItem.id].rawQty += rawUsage;
            map[matchedItem.id].stockQty += conv.convertedQty;
          }
        });
      });
    });

    return map;
  }, [salesRecords, recipes, items]);

  const setActual = (id: string, actual: number) => setCounts((c) => ({ ...c, [id]: actual }));

  const saveCount = async () => {
    const entries = Object.entries(counts).filter(([id]) => items.some((i) => i.id === id));
    if (entries.length === 0) {
      toast.error("กรุณาระบุจำนวนอย่างน้อย 1 รายการ");
      return;
    }

    const docItems: StockCountItem[] = entries.map(([id, actual]) => {
      const sys = currentStock(id);
      const usage = itemUsageMap[id] || { rawQty: 0, stockQty: 0, recipeUnit: "" };
      const expectedRemaining = sys - usage.stockQty;
      return {
        itemId: id,
        systemQuantity: sys,
        countedQuantity: actual,
        variance: actual - expectedRemaining,
      };
    });

    const creatorName = currentUser?.name || currentUser?.email || "Staff";

    // Create Stock Count document
    const createdDoc = await addStockCountDocument({
      countDate: date,
      branchId: activeBranchId,
      status: "Completed",
      items: docItems,
      remark: "ตรวจนับสต๊อกประจำวัน",
      createdBy: creatorName,
    });

    // Apply stock adjustments
    let adjusted = 0;
    docItems.forEach((it) => {
      if (it.variance !== 0) {
        addTransaction({
          itemId: it.itemId,
          type: "adjustment",
          quantity: it.variance,
          date: new Date(date).toISOString(),
          branchId: activeBranchId,
          remark: `Stock Count ${createdDoc.documentNumber}`,
        });
        adjusted++;
      }
    });

    toast.success(`บันทึกการตรวจนับ ${createdDoc.documentNumber} · ปรับปรุง ${adjusted} รายการ`);
    setCounts({});
    setActiveTab("history");
  };

  const handleOpenEdit = (doc: StockCountDocument) => {
    setEditingDoc(doc);
    setEditDate(doc.countDate);
    setEditRemark(doc.remark || "");
    setEditStatus(doc.status || "Completed");
    setEditItems(doc.items.map((i) => ({ ...i })));
    setEditReason("");
  };

  const handleSaveEdit = async () => {
    if (!editingDoc) return;
    setSavingEdit(true);

    const res = await updateStockCountWithRevision({
      documentId: editingDoc.id,
      updatedFields: {
        countDate: editDate,
        status: editStatus,
        remark: editRemark,
      },
      items: editItems,
      reason: editReason,
    });

    setSavingEdit(false);

    if (res.success) {
      toast.success(`Stock Count ${editingDoc.documentNumber} updated successfully`);
      setEditingDoc(null);
    } else {
      toast.error(res.error || "Failed to update stock count document");
    }
  };

  const handleToggleLock = async () => {
    if (!lockingDoc) return;
    setSavingLock(true);

    const isLocked = lockingDoc.status === "Locked";
    const res = await toggleStockCountLock({
      documentId: lockingDoc.id,
      lock: !isLocked,
      reason: lockReason,
    });

    setSavingLock(false);

    if (res.success) {
      toast.success(
        `Document ${lockingDoc.documentNumber} ${isLocked ? "unlocked" : "locked"} successfully`,
      );
      setLockingDoc(null);
      setLockReason("");
    } else {
      toast.error(res.error || "Failed to update lock status");
    }
  };

  const filteredHistory = useMemo(() => {
    return [...(stockCounts || [])]
      .sort((a, b) => +new Date(b.countDate || 0) - +new Date(a.countDate || 0))
      .filter((doc) => {
        const txt = ((doc.documentNumber || "") + " " + (doc.createdBy || "")).toLowerCase();
        return txt.includes((historyQuery || "").toLowerCase());
      });
  }, [stockCounts, historyQuery]);

  const isOwnerAdminIT =
    currentUser?.role === "owner" || currentUser?.role === "it" || currentUser?.role === "admin";

  return (
    <div className="space-y-6">
      <PageHeader
        title="ตรวจนับสต๊อก (Stock Count)"
        description="เปรียบเทียบจำนวนจริงกับระบบ และพิมพ์เอกสารตรวจนับสต็อก (Print Stock Sheet)"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPrintDoc(null);
                setIsPrintModalOpen(true);
              }}
              className="rounded-xl text-xs font-bold gap-1.5 border-emerald-600/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-emerald-600" />
              <span>พิมพ์ใบตรวจนับ (Print Sheet)</span>
            </Button>

            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
              <Button
                variant={activeTab === "count" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("count")}
                className="rounded-lg text-xs font-semibold gap-1.5"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                ตรวจนับใหม่ (New Count)
              </Button>
              <Button
                variant={activeTab === "history" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("history")}
                className="rounded-lg text-xs font-semibold gap-1.5"
              >
                <History className="h-3.5 w-3.5" />
                ประวัติการตรวจนับ ({(stockCounts || []).length})
              </Button>
            </div>
          </div>
        }
      />

      {activeTab === "count" ? (
        <div className="space-y-6">
          <Card className="rounded-2xl border-border/70 p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4 items-end">
              <div>
                <Label className="mb-1.5 block text-xs font-semibold">วันที่ (Date)</Label>
                <ThaiDatePicker
                  value={date}
                  onChange={setDate}
                  className="h-10 rounded-xl text-xs"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-semibold">หมวดหมู่ (Category)</Label>
                <Select value={cat} onValueChange={setCat}>
                  <SelectTrigger className="h-10 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด (All)</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-semibold">ค้นหา (Search)</Label>
                <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-muted/50 px-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="รหัส หรือ ชื่อวัตถุดิบ…"
                    className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0 text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPrintDoc(null);
                    setIsPrintModalOpen(true);
                  }}
                  className="h-10 rounded-xl font-bold gap-1.5 border-emerald-600/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                  title="พิมพ์แบบฟอร์มเปล่าหรือพิมพ์เปรียบเทียบสต็อก"
                >
                  <Printer className="h-4 w-4 text-emerald-600" />
                  <span className="hidden sm:inline">พิมพ์</span>
                </Button>
                <Button onClick={saveCount} className="h-10 flex-1 rounded-xl font-bold gap-1.5">
                  <Save className="h-4 w-4" />
                  บันทึกการตรวจนับ
                </Button>
              </div>
            </div>
          </Card>

          {/* Desktop Table */}
          <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28 text-xs">รหัส (Code)</TableHead>
                    <TableHead className="text-xs">ชื่อวัตถุดิบ (Item)</TableHead>
                    <TableHead className="text-xs">หน่วยสต็อก</TableHead>
                    <TableHead className="text-right text-xs">สต็อกระบบ (System)</TableHead>
                    <TableHead className="text-right text-xs">ใช้ตามสูตร (Theoretical)</TableHead>
                    <TableHead className="text-right text-xs">คาดว่าจะเหลือ (Expected)</TableHead>
                    <TableHead className="w-36 text-right text-xs">นับจริง (Counted)</TableHead>
                    <TableHead className="text-right text-xs">ผลต่าง (Variance)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((i) => {
                    const sys = currentStock(i.id);
                    const usage = itemUsageMap[i.id] || {
                      rawQty: 0,
                      stockQty: 0,
                      recipeUnit: i.recipeUnit || i.unit || "",
                    };
                    const theoreticalStockUsage = usage.stockQty;
                    const expectedRemaining = sys - theoreticalStockUsage;
                    const counted = counts[i.id];
                    const diff = counted !== undefined ? counted - expectedRemaining : null;
                    const sUnit = i.stockUnit || i.unit || "";
                    const masterUnitFormatted = formatUnitThai(sUnit) || sUnit;

                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {i.code}
                        </TableCell>
                        <TableCell className="font-medium text-xs">{i.name}</TableCell>
                        <TableCell className="text-xs font-semibold text-muted-foreground">
                          {masterUnitFormatted}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs font-semibold">
                          {sys.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs font-semibold text-amber-700 dark:text-amber-400">
                          <div>
                            {theoreticalStockUsage.toLocaleString(undefined, {
                              maximumFractionDigits: 3,
                            })}{" "}
                            <span className="text-[10px] text-muted-foreground font-normal">
                              {masterUnitFormatted}
                            </span>
                          </div>
                          {usage.rawQty > 0 && (
                            <div className="text-[10px] font-normal text-muted-foreground">
                              (
                              {usage.rawQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                              {usage.recipeUnit})
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs font-bold text-slate-800 dark:text-slate-200">
                          {expectedRemaining.toLocaleString(undefined, {
                            maximumFractionDigits: 3,
                          })}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={counted ?? ""}
                            onChange={(e) => setActual(i.id, Number(e.target.value))}
                            className="h-8 rounded-lg text-right text-xs font-bold w-28 ml-auto"
                          />
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-bold tabular-nums text-xs",
                            diff === null
                              ? "text-muted-foreground"
                              : diff > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : diff < 0
                                  ? "text-destructive"
                                  : "text-muted-foreground",
                          )}
                        >
                          {diff === null
                            ? "—"
                            : diff > 0
                              ? `+${diff.toLocaleString(undefined, { maximumFractionDigits: 3 })}`
                              : diff.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      ) : (
        /* HISTORY TAB */
        <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 md:max-w-md w-full sm:w-auto">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Search document # or user..."
                className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0 text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Doc #</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Counted By</TableHead>
                  <TableHead className="text-right text-xs">Items Counted</TableHead>
                  <TableHead className="text-right text-xs">Total Adjustments</TableHead>
                  <TableHead className="text-xs">Status & Rev</TableHead>
                  <TableHead className="text-right text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.map((doc) => {
                  const status = doc.status || "Completed";
                  const revNum = doc.revision || 1;
                  const totalAdjusted = (doc.items || []).filter((i) => i.variance !== 0).length;

                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {doc.documentNumber}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDate(doc.countDate)}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{doc.createdBy}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-semibold">
                        {doc.items.length} items
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-bold text-amber-600">
                        {totalAdjusted} items
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
                            className="h-7 w-7 text-muted-foreground hover:text-emerald-600"
                            onClick={() => {
                              setPrintDoc(doc);
                              setIsPrintModalOpen(true);
                            }}
                            title="พิมพ์เอกสารตรวจนับ (Print Sheet)"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setViewingDoc(doc)}
                            title="View Document Detail"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => handleOpenEdit(doc)}
                            title="Edit Document (Controlled)"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => setHistoryDoc(doc)}
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
                                setLockingDoc(doc);
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

                {filteredHistory.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-12 text-center text-xs text-muted-foreground"
                    >
                      No stock count documents found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* VIEW STOCK COUNT DETAIL DIALOG */}
      <Dialog open={!!viewingDoc} onOpenChange={() => setViewingDoc(null)}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FileText className="h-5 w-5 text-primary" />
              Stock Count Detail: {viewingDoc?.documentNumber}
            </DialogTitle>
            <DialogDescription className="text-xs">
              System vs Counted vs Variance Breakdown
            </DialogDescription>
          </DialogHeader>

          {viewingDoc && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-xl border border-border/60 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    Count Date
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatDate(viewingDoc.countDate)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    Created By
                  </span>
                  <span className="font-semibold text-foreground">{viewingDoc.createdBy}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    Status
                  </span>
                  <span className="font-semibold text-foreground">
                    {viewingDoc.status || "Completed"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    Revision
                  </span>
                  <span className="font-semibold text-foreground">
                    Rev {viewingDoc.revision || 1}
                  </span>
                </div>
              </div>

              <div className="border border-border/80 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs">Item</TableHead>
                      <TableHead className="text-right text-xs">System</TableHead>
                      <TableHead className="text-right text-xs">Counted</TableHead>
                      <TableHead className="text-right text-xs">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingDoc.items.map((it, idx) => {
                      const itemObj = items.find((x) => x.id === it.itemId);
                      return (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-medium">
                            {itemObj?.name || it.itemId}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {it.systemQuantity}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold tabular-nums">
                            {it.countedQuantity}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right text-xs font-bold tabular-nums",
                              it.variance > 0
                                ? "text-emerald-600"
                                : it.variance < 0
                                  ? "text-destructive"
                                  : "text-muted-foreground",
                            )}
                          >
                            {it.variance > 0 ? `+${it.variance}` : it.variance}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
            <Button
              type="button"
              onClick={() => {
                setPrintDoc(viewingDoc);
                setIsPrintModalOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-1.5 h-9 px-4 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์เอกสารนี้ (Print A4)</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setViewingDoc(null)}
              className="rounded-xl text-xs h-9"
            >
              ปิดหน้าต่าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT STOCK COUNT DIALOG (CONTROLLED REVISION) */}
      <Dialog open={!!editingDoc} onOpenChange={() => setEditingDoc(null)}>
        <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Stock Count Document: {editingDoc?.documentNumber}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Every edit will update inventory variance, increment revision, and log audit trail.
            </DialogDescription>
          </DialogHeader>

          {editingDoc && (
            <div className="space-y-4 py-2">
              {editingDoc.status === "Locked" && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <Lock className="h-4 w-4 text-red-600 dark:text-red-400" />
                  This document is locked.
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Count Date</Label>
                  <ThaiDatePicker
                    value={editDate}
                    onChange={setEditDate}
                    className="h-9 rounded-xl text-xs"
                    disabled={editingDoc.status === "Locked" && !isOwnerAdminIT}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Remark</Label>
                  <Input
                    value={editRemark}
                    onChange={(e) => setEditRemark(e.target.value)}
                    placeholder="Document remark"
                    className="h-9 rounded-xl text-xs"
                    disabled={editingDoc.status === "Locked" && !isOwnerAdminIT}
                  />
                </div>
                {isOwnerAdminIT && (
                  <div>
                    <Label className="text-xs mb-1 block">Document Status</Label>
                    <Select
                      value={editStatus}
                      onValueChange={(v) => setEditStatus(v as DocumentStatus)}
                    >
                      <SelectTrigger className="h-9 rounded-xl text-xs">
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
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Counted Quantities
                </Label>
                <div className="border border-border/80 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs">Item</TableHead>
                        <TableHead className="text-right text-xs">System</TableHead>
                        <TableHead className="text-right text-xs w-32">Counted</TableHead>
                        <TableHead className="text-right text-xs">New Diff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editItems.map((it, idx) => {
                        const itemObj = items.find((x) => x.id === it.itemId);
                        const newVariance = it.countedQuantity - it.systemQuantity;
                        return (
                          <TableRow key={idx}>
                            <TableCell className="text-xs font-medium">
                              {itemObj?.name || it.itemId}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {it.systemQuantity}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={it.countedQuantity}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setEditItems((list) =>
                                    list.map((x, i) =>
                                      i === idx
                                        ? {
                                            ...x,
                                            countedQuantity: val,
                                            variance: val - x.systemQuantity,
                                          }
                                        : x,
                                    ),
                                  );
                                }}
                                className="h-8 text-right text-xs rounded-lg font-bold"
                              />
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right text-xs font-bold tabular-nums",
                                newVariance > 0
                                  ? "text-emerald-600"
                                  : newVariance < 0
                                    ? "text-destructive"
                                    : "text-muted-foreground",
                              )}
                            >
                              {newVariance > 0 ? `+${newVariance}` : newVariance}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* MANDATORY REASON */}
              <div className="space-y-1.5 bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl">
                <Label className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Reason for Edit (Mandatory / จำเป็น)
                </Label>
                <Textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="E.g., Recount after recount discrepancy, mistyped figure..."
                  className="text-xs bg-background rounded-xl border-amber-300 dark:border-amber-700"
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingDoc(null)} className="rounded-xl">
              Cancel
            </Button>
            {editingDoc?.status === "Locked" && editStatus === "Locked" ? null : (
              <Button
                onClick={handleSaveEdit}
                disabled={savingEdit || !editReason.trim()}
                className="rounded-xl font-bold"
              >
                {savingEdit ? "Saving Revision..." : "Save Revision & Log Audit"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REVISION HISTORY DRAWER */}
      <Dialog open={!!historyDoc} onOpenChange={() => setHistoryDoc(null)}>
        <DialogContent className="max-w-2xl rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <History className="h-5 w-5 text-primary" />
              Revision History: {historyDoc?.documentNumber}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Complete audit trail of document revisions and field-level changes.
            </DialogDescription>
          </DialogHeader>

          {historyDoc && (
            <div className="space-y-4 py-2">
              {!historyDoc.revisions || historyDoc.revisions.length === 0 ? (
                <div className="p-8 text-center bg-muted/30 rounded-xl border border-dashed border-border">
                  <Clock className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">
                    Initial Document Revision (Rev 1) — No subsequent edits recorded yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyDoc.revisions.map((rev) => (
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
            <Button variant="outline" onClick={() => setHistoryDoc(null)} className="rounded-xl">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LOCK / UNLOCK TOGGLE DIALOG */}
      <Dialog open={!!lockingDoc} onOpenChange={() => setLockingDoc(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              {lockingDoc?.status === "Locked" ? (
                <Unlock className="h-5 w-5 text-amber-600" />
              ) : (
                <Lock className="h-5 w-5 text-slate-700" />
              )}
              {lockingDoc?.status === "Locked" ? "Unlock Document" : "Lock Document"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {lockingDoc?.status === "Locked"
                ? "Unlocking enables editing for authorized users."
                : "Locking prevents Staff and Managers from editing this stock count document."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label className="text-xs font-semibold">Reason for Action (Optional)</Label>
            <Input
              value={lockReason}
              onChange={(e) => setLockReason(e.target.value)}
              placeholder="E.g., Monthly audit completed..."
              className="h-9 text-xs rounded-xl"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLockingDoc(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleToggleLock}
              disabled={savingLock}
              className="rounded-xl font-bold"
            >
              {savingLock
                ? "Updating..."
                : lockingDoc?.status === "Locked"
                  ? "Unlock Document"
                  : "Lock Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STOCK COUNT PRINT MODAL */}
      <StockCountPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setPrintDoc(null);
        }}
        document={printDoc}
        items={items}
        categories={categories}
        branches={branches}
        currentBranchId={activeBranchId}
        countDate={date}
        countedMap={counts}
        currentStockFn={currentStock}
        itemUsageMap={itemUsageMap}
        currentUser={currentUser}
      />
    </div>
  );
}
