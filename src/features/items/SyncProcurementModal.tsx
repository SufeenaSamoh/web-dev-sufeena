import React, { useState, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Package,
  Layers,
  Check,
  Building2,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import type { Item, Category, Supplier } from "@/lib/types";
import type { PurchaseProduct } from "@/features/purchase/types";
import {
  getProcurementSyncCandidates,
  type SyncCandidateItem,
} from "@/services/procurementSyncService";
import { formatCurrency } from "@/lib/store";

interface SyncProcurementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingItems: Item[];
  categories: Category[];
  suppliers: Supplier[];
  liveProcurementProducts?: PurchaseProduct[];
  onAddItem: (item: Omit<Item, "id">) => Promise<{ success: boolean; error?: string; item?: Item }>;
  onUpdateItem: (
    id: string,
    patch: Partial<Item>,
  ) => Promise<{ success: boolean; error?: string; item?: Item }>;
  onSyncCompleted?: () => void;
}

export const SyncProcurementModal: React.FC<SyncProcurementModalProps> = ({
  open,
  onOpenChange,
  existingItems,
  categories,
  suppliers,
  liveProcurementProducts = [],
  onAddItem,
  onUpdateItem,
  onSyncCompleted,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "new" | "exists">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [updatePricesForExisting, setUpdatePricesForExisting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  // Generate candidates
  const candidates = useMemo(() => {
    return getProcurementSyncCandidates(
      liveProcurementProducts,
      existingItems,
      categories,
      suppliers,
    );
  }, [liveProcurementProducts, existingItems, categories, suppliers]);

  const stats = useMemo(() => {
    const total = candidates.length;
    const newItems = candidates.filter((c) => c.status === "new").length;
    const exists = candidates.filter((c) => c.status === "exists").length;
    return { total, newItems, exists };
  }, [candidates]);

  // Categories list
  const categoryList = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => {
      if (c.categoryName) set.add(c.categoryName);
    });
    return Array.from(set).sort();
  }, [candidates]);

  // Filtered view
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // Filter by status
      if (activeFilter === "new" && c.status !== "new") return false;
      if (activeFilter === "exists" && c.status !== "exists") return false;

      // Filter by category
      if (selectedCategory !== "all" && c.categoryName !== selectedCategory) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchCode = c.code.toLowerCase().includes(q);
        const matchName = c.name.toLowerCase().includes(q);
        const matchSup = c.supplierName.toLowerCase().includes(q);
        const matchCat = c.categoryName.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchSup && !matchCat) return false;
      }

      return true;
    });
  }, [candidates, activeFilter, selectedCategory, searchQuery]);

  const handleStartSync = async () => {
    const itemsToCreate = candidates.filter((c) => c.status === "new");
    const itemsToUpdate = updatePricesForExisting
      ? candidates.filter((c) => c.status === "exists" && c.existingItem)
      : [];

    const totalOps = itemsToCreate.length + itemsToUpdate.length;
    if (totalOps === 0) {
      toast.info("ไม่มีรายการใหม่ที่ต้อง Sync เข้าสู่ Master Items");
      return;
    }

    try {
      setIsSyncing(true);
      setProgress({ current: 0, total: totalOps });

      let createdCount = 0;
      let updatedCount = 0;
      let failCount = 0;
      let currentProgress = 0;

      // 1. Create New Items
      for (const item of itemsToCreate) {
        try {
          const payload: Omit<Item, "id"> = {
            code: item.code,
            name: item.name,
            categoryId: item.categoryId || "",
            supplierId: item.supplierId || "",
            unit: item.stockUnit,
            stockUnit: item.stockUnit,
            recipeUnit: item.recipeUnit,
            conversionFactor: item.conversionFactor,
            itemType: "raw",
            minStock: item.minStock,
            purchasePrice: item.purchasePrice,
            description: item.description,
            active: true,
          };

          const res = await onAddItem(payload);
          if (res.success) {
            createdCount++;
          } else {
            console.warn(`[Sync] Failed to create ${item.code}:`, res.error);
            failCount++;
          }
        } catch (e) {
          console.error(`[Sync] Error adding ${item.code}:`, e);
          failCount++;
        }
        currentProgress++;
        setProgress({ current: currentProgress, total: totalOps });
      }

      // 2. Update existing items if selected
      if (updatePricesForExisting) {
        for (const item of itemsToUpdate) {
          if (!item.existingItem) continue;
          try {
            const res = await onUpdateItem(item.existingItem.id, {
              purchasePrice: item.purchasePrice,
              stockUnit: item.existingItem.stockUnit || item.stockUnit,
              recipeUnit: item.existingItem.recipeUnit || item.recipeUnit,
              conversionFactor: item.existingItem.conversionFactor ?? item.conversionFactor,
            });
            if (res.success) {
              updatedCount++;
            }
          } catch (e) {
            console.error(`[Sync] Error updating ${item.code}:`, e);
          }
          currentProgress++;
          setProgress({ current: currentProgress, total: totalOps });
        }
      }

      toast.success(
        `Sync สำเร็จ! เพิ่มวัตถุดิบใหม่ ${createdCount} รายการ${
          updatedCount > 0 ? `, อัปเดตราคา ${updatedCount} รายการ` : ""
        }${failCount > 0 ? ` (ข้าม/ผิดพลาด ${failCount} รายการ)` : ""}`,
      );

      onSyncCompleted?.();
      onOpenChange(false);
    } catch (err) {
      console.error("Auto sync failed:", err);
      toast.error("เกิดข้อผิดพลาดในการ Sync วัตถุดิบ");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !isSyncing && onOpenChange(v)}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 rounded-2xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                Auto Sync วัตถุดิบจัดซื้อ (ผัก/สด) เข้า Master Items
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                ดึงรหัสวัตถุดิบและราคาจากระบบจัดซื้อ (ชินเซ็น, WFOOD, เซ็นทรัล ฯลฯ) มาสร้างเป็น
                Master Items สำหรับตัดสต็อกและสูตรอาหาร
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Statistics Cards */}
        <div className="grid grid-cols-3 gap-3 my-2">
          <Card
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              activeFilter === "all"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:bg-muted/40"
            }`}
            onClick={() => setActiveFilter("all")}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground font-medium">
                รายการในระบบจัดซื้อทั้งหมด
              </div>
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              รวมทุกหมวดหมู่และซัพพลายเออร์
            </div>
          </Card>

          <Card
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              activeFilter === "new"
                ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-sm"
                : "border-border hover:bg-muted/40"
            }`}
            onClick={() => setActiveFilter("new")}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                รายการใหม่ (พร้อม Sync)
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] px-1.5 py-0">
                New
              </Badge>
            </div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
              {stats.newItems}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">ยังไม่มีใน Master Items</div>
          </Card>

          <Card
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              activeFilter === "exists"
                ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 shadow-sm"
                : "border-border hover:bg-muted/40"
            }`}
            onClick={() => setActiveFilter("exists")}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs text-blue-700 dark:text-blue-400 font-medium">
                มีในระบบแล้ว (Already in DB)
              </div>
              <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">
              {stats.exists}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">ตรงกับรหัสที่มีอยู่แล้ว</div>
          </Card>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-2 py-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาตามรหัสวัตถุดิบ (เช่น 2B220159), ชื่อผัก, ซัพพลายเออร์..."
              className="pl-9 h-9 rounded-xl text-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-[400px]">
            <Button
              variant={selectedCategory === "all" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs rounded-lg px-2.5"
              onClick={() => setSelectedCategory("all")}
            >
              ทุกหมวด
            </Button>
            {categoryList.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "secondary" : "ghost"}
                size="sm"
                className="h-8 text-xs rounded-lg px-2.5 whitespace-nowrap"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Table Preview */}
        <div className="flex-1 overflow-y-auto border border-border/80 rounded-xl min-h-[260px] max-h-[360px]">
          <Table>
            <TableHeader className="bg-muted/60 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-[120px]">รหัสวัตถุดิบ</TableHead>
                <TableHead>ชื่อวัตถุดิบ</TableHead>
                <TableHead className="w-[100px]">หมวดหมู่</TableHead>
                <TableHead className="w-[140px]">หน่วย (สต็อก → สูตร)</TableHead>
                <TableHead className="text-right w-[110px]">ราคาซื้อล่าสุด</TableHead>
                <TableHead className="w-[130px]">ซัพพลายเออร์</TableHead>
                <TableHead className="text-center w-[100px]">สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCandidates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                    ไม่พบรายการวัตถุดิบตามเงื่อนไขค้นหา
                  </TableCell>
                </TableRow>
              ) : (
                filteredCandidates.map((item) => (
                  <TableRow key={item.code} className="text-xs hover:bg-muted/40">
                    <TableCell className="font-mono font-medium text-foreground">
                      {item.code}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{item.name}</div>
                      {item.sourceSuppliers.length > 1 && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          เทียบราคา {item.sourceSuppliers.length} เจ้า:{" "}
                          {item.sourceSuppliers
                            .map((s) => `${s.supplierName.split(" ")[0]} ฿${s.price}`)
                            .join(", ")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 rounded-md font-normal"
                      >
                        {item.categoryName}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        1 {item.stockUnit} = {item.conversionFactor.toLocaleString()}{" "}
                        {item.recipeUnit}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-700 dark:text-emerald-400">
                      {item.purchasePrice > 0 ? `฿${formatCurrency(item.purchasePrice)}` : "-"}
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground text-[11px] truncate max-w-[130px]"
                      title={item.supplierName}
                    >
                      {item.supplierName}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.status === "new" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-[10px] px-2 py-0.5 rounded-full font-medium">
                          + พร้อมเพิ่ม
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-muted-foreground text-[10px] px-2 py-0.5 rounded-full font-normal"
                        >
                          มีในระบบแล้ว
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Sync Options & Progress */}
        <div className="space-y-3 pt-2">
          {stats.exists > 0 && (
            <div className="flex items-center space-x-2 bg-muted/40 p-2.5 rounded-xl border border-border/60">
              <Checkbox
                id="updatePrices"
                checked={updatePricesForExisting}
                onCheckedChange={(checked) => setUpdatePricesForExisting(Boolean(checked))}
                disabled={isSyncing}
              />
              <Label
                htmlFor="updatePrices"
                className="text-xs text-foreground cursor-pointer flex-1"
              >
                อัปเดตราคาซื้อล่าสุด (Purchase Price) และอัตราแปลงหน่วย ให้กับ{" "}
                <span className="font-semibold text-primary">{stats.exists} รายการ</span>{" "}
                ที่มีอยู่ใน Master Items แล้วด้วย
              </Label>
            </div>
          )}

          {isSyncing && (
            <div className="space-y-1.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  กำลังบันทึกข้อมูลเข้าฐานข้อมูล Master Items...
                </span>
                <span>
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-emerald-200/50 dark:bg-emerald-950/60 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-2 transition-all duration-200 rounded-full"
                  style={{
                    width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 flex sm:justify-between items-center gap-2">
          <div className="text-xs text-muted-foreground">
            {stats.newItems > 0 ? (
              <span>
                พร้อมเพิ่มวัตถุดิบใหม่{" "}
                <strong className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  {stats.newItems} รายการ
                </strong>{" "}
                เข้าสู่ Master Items
              </span>
            ) : (
              <span>ข้อมูลวัตถุดิบทั้งหมดมีอยู่ใน Master Items ครบถ้วนแล้ว</span>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-xl h-10"
              onClick={() => onOpenChange(false)}
              disabled={isSyncing}
            >
              ยกเลิก
            </Button>
            <Button
              className="rounded-xl h-10 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              onClick={handleStartSync}
              disabled={isSyncing || (stats.newItems === 0 && !updatePricesForExisting)}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> กำลัง Sync...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-4 w-4" /> เริ่ม Auto Sync ({stats.newItems} รายการ)
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
