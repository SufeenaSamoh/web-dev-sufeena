import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/PageHeader";
import { useStore, formatCurrency } from "@/lib/store";
import { formatDate } from "@/lib/dateFormat";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  CookingPot,
  Download,
  History,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import type { Item, StockTransaction } from "@/lib/types";
import { isPackagingOrConsumable } from "@/lib/receiving-utils";
import { SearchableSupplierSelector } from "@/components/SearchableSupplierSelector";
import { subscribeDatabaseAProducts } from "@/services/purchaseDbA";
import type { PurchaseProduct } from "@/features/purchase/types";
import { SyncProcurementModal } from "./SyncProcurementModal";
import { getProcurementSyncCandidates } from "@/services/procurementSyncService";

const PAGE_SIZE = 20;

const empty: Omit<Item, "id"> = {
  code: "",
  name: "",
  categoryId: "",
  supplierId: "",
  unit: "kg",
  stockUnit: "kg",
  recipeUnit: "g",
  conversionFactor: 1000,
  itemType: "raw",
  minStock: 0,
  purchasePrice: 0,
  barcode: "",
  description: "",
  active: true,
  defaultShelfLife: 30,
  shelfLifeUnit: "Day",
};

const UNIT_MAP: Record<string, string> = {
  piece: "ชิ้น",
  pcs: "ชิ้น",
  pack: "แพ็ค",
  box: "กล่อง",
  bag: "ถุง",
  bottle: "ขวด",
  can: "กระป๋อง",
  jar: "โหล",
  carton: "ลัง",
  set: "ชุด",
  dozen: "โหล",
  gram: "กรัม",
  g: "กรัม",
  kilogram: "กิโลกรัม",
  kg: "กิโลกรัม",
  กก: "กิโลกรัม",
  "กก.": "กิโลกรัม",
  liter: "ลิตร",
  L: "ลิตร",
  l: "ลิตร",
  milliliter: "มิลลิลิตร",
  ml: "มิลลิลิตร",
  pound: "ปอนด์",
  lb: "ปอนด์",
  lbs: "ปอนด์",
  tray: "แผง",
  แผง: "แผง",
  ฟอง: "ฟอง",
};

export function formatUnit(unit?: string): string {
  if (!unit) return "";
  const key = unit.toLowerCase().trim();
  return UNIT_MAP[key] || unit;
}

const STOCK_UNITS = [
  "kg",
  "kilogram",
  "g",
  "gram",
  "liter",
  "L",
  "ml",
  "milliliter",
  "pack",
  "box",
  "bag",
  "bottle",
  "can",
  "jar",
  "carton",
  "set",
  "dozen",
  "piece",
  "pcs",
  "tray",
  "ชิ้น",
  "ถุง",
  "กล่อง",
  "ขวด",
  "ลัง",
  "แผง",
  "กระป๋อง",
  "โหล",
  "ชุด",
];

const RECIPE_UNITS = [
  "g",
  "gram",
  "ml",
  "milliliter",
  "kg",
  "kilogram",
  "liter",
  "L",
  "piece",
  "pcs",
  "pack",
  "box",
  "bag",
  "bottle",
  "can",
  "tray",
  "ชิ้น",
  "หยด",
  "ช้อนชา",
  "ช้อนโต๊ะ",
  "ถ้วย",
];

import {
  SearchableUnitSelector,
  SearchableUnitSelectorProps,
} from "@/components/SearchableUnitSelector";

export const UnitSelector = SearchableUnitSelector;
export type UnitSelectorProps = SearchableUnitSelectorProps;

type ImportRow = {
  data: Omit<Item, "id">;
  status: "new" | "duplicate" | "error";
  message?: string;
};

export function MasterItemsPage() {
  const {
    items,
    categories,
    suppliers,
    transactions,
    currentStock,
    addItem,
    updateItem,
    deleteItem,
    settings,
  } = useStore();

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sup, setSup] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [historyItem, setHistoryItem] = useState<Item | null>(null);
  const [form, setForm] = useState<Omit<Item, "id">>(empty);

  // Dynamically collect unique stock units from preset defaults + existing items in DB
  const dynamicStockUnits = useMemo(() => {
    const map = new Map<string, string>();
    STOCK_UNITS.forEach((u) => map.set(u.toLowerCase().trim(), u));
    items.forEach((item) => {
      if (item.stockUnit?.trim()) {
        const trimmed = item.stockUnit.trim();
        map.set(trimmed.toLowerCase(), trimmed);
      }
      if (item.unit?.trim()) {
        const trimmed = item.unit.trim();
        map.set(trimmed.toLowerCase(), trimmed);
      }
    });
    return Array.from(map.values());
  }, [items]);

  // Dynamically collect unique recipe units from preset defaults + existing items in DB
  const dynamicRecipeUnits = useMemo(() => {
    const map = new Map<string, string>();
    RECIPE_UNITS.forEach((u) => map.set(u.toLowerCase().trim(), u));
    items.forEach((item) => {
      if (item.recipeUnit?.trim()) {
        const trimmed = item.recipeUnit.trim();
        map.set(trimmed.toLowerCase(), trimmed);
      }
      if (item.unit?.trim()) {
        const trimmed = item.unit.trim();
        map.set(trimmed.toLowerCase(), trimmed);
      }
    });
    return Array.from(map.values());
  }, [items]);

  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [syncOpen, setSyncOpen] = useState(false);
  const [procurementProducts, setProcurementProducts] = useState<PurchaseProduct[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Subscribe to live products from Database A (Procurement System)
  useEffect(() => {
    const unsub = subscribeDatabaseAProducts((prods) => {
      setProcurementProducts(prods);
    });
    return () => unsub();
  }, []);

  // Compute number of new procurement candidates
  const newProcurementCount = useMemo(() => {
    const candidates = getProcurementSyncCandidates(
      procurementProducts,
      items,
      categories,
      suppliers,
    );
    return candidates.filter((c) => c.status === "new").length;
  }, [procurementProducts, items, categories, suppliers]);

  const avgCost = (itemId: string) => {
    const purchases = transactions.filter(
      (t) => t.itemId === itemId && t.type === "purchase" && t.unitPrice != null,
    );
    if (!purchases.length) return 0;
    const totalQty = purchases.reduce((s, t) => s + t.quantity, 0);
    const totalVal = purchases.reduce((s, t) => s + t.quantity * (t.unitPrice ?? 0), 0);
    return totalQty > 0 ? totalVal / totalQty : 0;
  };

  const filtered = useMemo(() => {
    const query = q.toLowerCase();
    return items.filter((i) => {
      if (cat !== "all" && i.categoryId !== cat) return false;
      if (sup !== "all" && i.supplierId !== sup) return false;
      if (status === "active" && !i.active) return false;
      if (status === "inactive" && i.active) return false;
      if (!query) return true;
      const supName = suppliers.find((s) => s.id === i.supplierId)?.name ?? "";
      return (
        i.code.toLowerCase().includes(query) ||
        i.name.toLowerCase().includes(query) ||
        (i.barcode ?? "").toLowerCase().includes(query) ||
        supName.toLowerCase().includes(query)
      );
    });
  }, [items, q, cat, sup, status, suppliers]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const openCreate = () => {
    setForm({
      ...empty,
      categoryId: categories[0]?.id ?? "",
      supplierId: suppliers[0]?.id ?? "",
      unit: "kg",
      stockUnit: "kg",
      recipeUnit: "g",
      conversionFactor: 1000,
      itemType: "raw",
    });
    setCreating(true);
  };

  const openEdit = (i: Item) => {
    setEditing(i);
    const sUnit = i.stockUnit || i.unit || "kg";
    const rUnit = i.recipeUnit || i.unit || "g";
    const cFactor = i.conversionFactor && i.conversionFactor > 0 ? i.conversionFactor : 1;
    const iType = i.itemType || "raw";

    setForm({
      code: i.code,
      name: i.name,
      categoryId: i.categoryId,
      supplierId: i.supplierId ?? "",
      unit: sUnit,
      stockUnit: sUnit,
      recipeUnit: rUnit,
      conversionFactor: cFactor,
      itemType: iType,
      minStock: i.minStock,
      purchasePrice: i.purchasePrice ?? 0,
      barcode: i.barcode ?? "",
      description: i.description ?? "",
      active: i.active,
      defaultShelfLife: i.defaultShelfLife ?? i.shelfLifeDays ?? 30,
      shelfLifeUnit: i.shelfLifeUnit ?? "Day",
    });
  };

  const validate = (): string | null => {
    if (!form.code.trim()) return "กรุณาระบุรหัสวัตถุดิบ";
    if (!form.name.trim()) return "กรุณาระบุชื่อวัตถุดิบ";
    if (!form.categoryId) return "กรุณาเลือกหมวดหมู่";
    if (!form.supplierId) return "กรุณาเลือก Supplier";
    if (!form.stockUnit?.trim()) return "กรุณาระบุหน่วยสต็อก";
    if (!form.recipeUnit?.trim()) return "กรุณาระบุหน่วยสูตร";
    if (!form.conversionFactor || Number(form.conversionFactor) <= 0)
      return "อัตราแปลงหน่วยต้องมากกว่า 0";
    if (!form.itemType || !["raw", "prepared"].includes(form.itemType))
      return "กรุณาเลือกประเภทวัตถุดิบ (raw หรือ prepared)";

    const dup = items.find(
      (i) =>
        i.code.toLowerCase() === form.code.trim().toLowerCase() &&
        (!editing || i.id !== editing.id),
    );
    if (dup) return "รหัสวัตถุดิบซ้ำในระบบ";
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    const payload = {
      ...form,
      code: form.code.trim(),
      name: form.name.trim(),
      unit: form.stockUnit, // keep legacy unit aligned with stockUnit
    };

    if (editing) {
      const res = await updateItem(editing.id, payload);
      if (res && res.success === false) {
        return;
      }
      toast.success("Item updated successfully");
      setEditing(null);
      setCreating(false);
    } else {
      const res = await addItem(payload);
      if (res && res.success === false) {
        return;
      }
      toast.success("Item created successfully");
      setEditing(null);
      setCreating(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const res = await deleteItem(deleteId);
    if (res && res.success === false) {
      return;
    }
    toast.success("Item deleted successfully");
    setDeleteId(null);
  };

  const exportExcel = () => {
    const rows = filtered.map((i) => ({
      รหัสวัตถุดิบ: i.code,
      ชื่อวัตถุดิบ: i.name,
      หมวดหมู่: categories.find((c) => c.id === i.categoryId)?.name ?? "",
      Supplier: suppliers.find((s) => s.id === i.supplierId)?.name ?? "",
      ประเภทวัตถุดิบ: i.itemType === "prepared" ? "วัตถุดิบเตรียม (Prepared)" : "วัตถุดิบดิบ (Raw)",
      หน่วยสต็อก: formatUnit(i.stockUnit || i.unit),
      หน่วยสูตร: formatUnit(i.recipeUnit || i.unit),
      อัตราแปลงหน่วย: i.conversionFactor ?? 1,
      คำอธิบายอัตราแปลง: `1 ${formatUnit(i.stockUnit || i.unit)} = ${(i.conversionFactor ?? 1).toLocaleString()} ${formatUnit(i.recipeUnit || i.unit)}`,
      สต็อกคงเหลือ: currentStock(i.id),
      สต็อกขั้นต่ำ: i.minStock,
      "Purchase Price": i.purchasePrice ?? 0,
      "Average Cost": Number(avgCost(i.id).toFixed(2)),
      Barcode: i.barcode ?? "",
      Description: i.description ?? "",
      Status: i.active ? "Active" : "Inactive",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Items");
    XLSX.writeFile(wb, `master-items-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Exported to Excel");
  };

  const handleImportFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const pick = (row: Record<string, unknown>, keys: string[]) => {
        const map: Record<string, unknown> = {};
        for (const k of Object.keys(row)) map[norm(k)] = row[k];
        for (const k of keys) {
          const v = map[norm(k)];
          if (v !== undefined && v !== "") return v;
        }
        return "";
      };

      const existingCodes = new Set(items.map((i) => i.code.toLowerCase()));
      const seenInFile = new Set<string>();
      const parsed: ImportRow[] = raw.map((row) => {
        const code = String(pick(row, ["รหัสวัตถุดิบ", "Item Code", "code", "sku"]) || "").trim();
        const name = String(pick(row, ["ชื่อวัตถุดิบ", "Item Name", "name"]) || "").trim();
        const catName = String(pick(row, ["หมวดหมู่", "Category"]) || "").trim();
        const supName = String(pick(row, ["Supplier"]) || "").trim();
        const stockUnit = String(
          pick(row, ["หน่วยสต็อก", "Stock Unit", "stock_unit"]) ||
            pick(row, ["หน่วยนับ", "Unit"]) ||
            "kg",
        ).trim();
        const recipeUnit = String(
          pick(row, ["หน่วยสูตร", "Recipe Unit", "recipe_unit"]) || stockUnit,
        ).trim();
        const conversionFactor =
          Number(pick(row, ["อัตราแปลงหน่วย", "Conversion Factor", "conversion_factor"])) || 1;
        const itemTypeRaw = String(
          pick(row, ["ประเภทวัตถุดิบ", "Item Type", "item_type"]) || "raw",
        ).toLowerCase();
        const itemType =
          itemTypeRaw.includes("prepared") || itemTypeRaw.includes("เตรียม") ? "prepared" : "raw";

        const minStock = Number(pick(row, ["สต็อกขั้นต่ำ", "Minimum Stock", "min"])) || 0;
        const purchasePrice = Number(pick(row, ["Purchase Price", "price"])) || 0;
        const barcode = String(pick(row, ["Barcode"]) || "").trim();
        const description = String(pick(row, ["Description"]) || "").trim();
        const activeRaw = String(pick(row, ["Status", "Active"]) || "active").toLowerCase();
        const active = !["inactive", "false", "0", "no"].includes(activeRaw);

        const category = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
        const supplier = suppliers.find((s) => s.name.toLowerCase() === supName.toLowerCase());

        const data: Omit<Item, "id"> = {
          code,
          name,
          categoryId: category?.id ?? "",
          supplierId: supplier?.id ?? "",
          unit: stockUnit,
          stockUnit,
          recipeUnit,
          conversionFactor,
          itemType,
          minStock,
          purchasePrice,
          barcode,
          description,
          active,
        };

        if (!code) return { data, status: "error", message: "Missing รหัสวัตถุดิบ" };
        if (!name) return { data, status: "error", message: "Missing ชื่อวัตถุดิบ" };
        if (!category) return { data, status: "error", message: `Unknown category "${catName}"` };
        if (!supplier) return { data, status: "error", message: `Unknown supplier "${supName}"` };
        if (existingCodes.has(code.toLowerCase()) || seenInFile.has(code.toLowerCase())) {
          return { data, status: "duplicate", message: "รหัสวัตถุดิบ already exists" };
        }
        seenInFile.add(code.toLowerCase());
        return { data, status: "new" };
      });

      setImportRows(parsed);
      setImportOpen(true);
    } catch (e) {
      toast.error("Failed to read file");
      console.error(e);
    }
  };

  const confirmImport = async () => {
    const toAdd = importRows.filter((r) => r.status === "new");
    let addedCount = 0;
    let failedCount = 0;

    for (const r of toAdd) {
      const res = await addItem(r.data);
      if (res && res.success !== false) {
        addedCount++;
      } else {
        failedCount++;
      }
    }

    const skipped = importRows.filter((r) => r.status === "duplicate").length;
    const errors = importRows.filter((r) => r.status === "error").length + failedCount;
    toast.success(`Imported ${addedCount}, skipped ${skipped}, errors ${errors}`);
    setImportOpen(false);
    setImportRows([]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Item"
        description="Manage all inventory items and unit conversions"
        actions={
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              className="rounded-xl border-emerald-600/30 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100/80 hover:text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-700/40"
              onClick={() => setSyncOpen(true)}
            >
              <Sparkles className="mr-1.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Auto Sync จัดซื้อ (ผัก/สด)
              {newProcurementCount > 0 && (
                <Badge className="ml-1.5 bg-emerald-600 text-white hover:bg-emerald-600 text-[10px] px-1.5 py-0 h-4 min-w-4 rounded-full flex items-center justify-center font-bold">
                  +{newProcurementCount}
                </Badge>
              )}
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1 h-4 w-4" /> Import Excel
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={exportExcel}>
              <Download className="mr-1 h-4 w-4" /> Export Excel
            </Button>
            <Button onClick={openCreate} className="rounded-xl">
              <Plus className="mr-1 h-4 w-4" /> Add Item
            </Button>
          </div>
        }
      />

      <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
        <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-[1fr_180px_180px_160px]">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="ค้นหา by code, name, barcode, supplier…"
              className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
          <Select
            value={cat}
            onValueChange={(v) => {
              setCat(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SearchableSupplierSelector
            value={sup}
            onChange={(v) => {
              setSup(v);
              setPage(1);
            }}
            suppliers={suppliers}
            allowAll
            allValue="all"
            allLabel="ทั้งหมด (ทุกซัพพลายเออร์)"
            placeholder="กรองตามซัพพลายเออร์..."
            size="lg"
            className="h-11 rounded-xl"
          />
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รหัสวัตถุดิบ</TableHead>
                <TableHead>ชื่อวัตถุดิบ</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>หมวดหมู่</TableHead>
                <TableHead>หน่วยสต็อก</TableHead>
                <TableHead>อัตราแปลงหน่วย (สูตร)</TableHead>
                <TableHead className="text-right">สต็อกคงเหลือ</TableHead>
                <TableHead className="text-right">สต็อกขั้นต่ำ</TableHead>
                <TableHead className="text-right">Purchase</TableHead>
                <TableHead className="text-right">Avg Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((i) => {
                const stock = currentStock(i.id);
                const low = stock <= i.minStock;
                const sUnit = i.stockUnit || i.unit;
                const rUnit = i.recipeUnit || i.unit;
                const cFactor = i.conversionFactor ?? 1;

                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.code}</TableCell>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell>
                      {i.itemType === "prepared" ? (
                        <Link
                          to="/production-recipes"
                          search={{ search: i.code } as Record<string, unknown>}
                          title="คลิกเพื่อไปที่สูตรผลิตสินค้ากึ่งสำเร็จรูปนี้"
                        >
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 cursor-pointer transition-colors inline-flex items-center gap-1"
                          >
                            <CookingPot className="w-3 h-3" />
                            Prepared
                          </Badge>
                        </Link>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                        >
                          Raw
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {categories.find((c) => c.id === i.categoryId)?.name}
                    </TableCell>
                    <TableCell className="font-medium">{formatUnit(sUnit)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      1 {formatUnit(sUnit)} = {cFactor.toLocaleString()} {formatUnit(rUnit)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${low ? "text-destructive font-semibold" : ""}`}
                    >
                      {stock} {formatUnit(sUnit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {i.minStock} {formatUnit(sUnit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(i.purchasePrice ?? 0, settings.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(avgCost(i.id), settings.currency)}
                    </TableCell>
                    <TableCell>
                      {i.active ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {i.itemType === "prepared" && (
                        <Link
                          to="/production-recipes"
                          search={{ search: i.code } as Record<string, unknown>}
                          title="ดู/จัดการสูตรผลิตสินค้านี้"
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                          >
                            <CookingPot className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setHistoryItem(i)}
                        className="rounded-lg"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(i)}
                        className="rounded-lg"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(i.id)}
                        className="rounded-lg text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No items match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {(pageSafe - 1) * PAGE_SIZE + (paged.length ? 1 : 0)}–
            {(pageSafe - 1) * PAGE_SIZE + paged.length} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              disabled={pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="tabular-nums">
              Page {pageSafe} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "แก้ไขวัตถุดิบ (Edit Item)" : "เพิ่มวัตถุดิบใหม่ (New Item)"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>รหัสวัตถุดิบ *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g. RM-001"
                />
              </div>
              <div>
                <Label>Barcode</Label>
                <Input
                  value={form.barcode ?? ""}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  placeholder="e.g. 885000000000"
                />
              </div>
            </div>

            <div>
              <Label>ชื่อวัตถุดิบ *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Salmon Fillet, Egg, Cooking Oil"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>หมวดหมู่ *</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) => {
                    const catObj = categories.find((c) => c.id === v);
                    const isPkg =
                      isPackagingOrConsumable(catObj?.name) || isPackagingOrConsumable(form.name);
                    if (isPkg && (!form.defaultShelfLife || form.defaultShelfLife === 30)) {
                      setForm({
                        ...form,
                        categoryId: v,
                        defaultShelfLife: 1,
                        shelfLifeUnit: "Year",
                        hasExpiry: true,
                      });
                    } else {
                      setForm({ ...form, categoryId: v });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>ซัพพลายเออร์ (Supplier) *</Label>
                <SearchableSupplierSelector
                  value={form.supplierId ?? ""}
                  onChange={(v) => setForm({ ...form, supplierId: v })}
                  suppliers={suppliers}
                  placeholder="เลือกซัพพลายเออร์..."
                  searchPlaceholder="ค้นหาชื่อ, รหัส Supplier หรือเบอร์โทร..."
                  allowClear
                />
              </div>

              <div>
                <Label>ประเภทวัตถุดิบ *</Label>
                <Select
                  value={form.itemType ?? "raw"}
                  onValueChange={(v: "raw" | "prepared") => setForm({ ...form, itemType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw">วัตถุดิบดิบ (Raw)</SelectItem>
                    <SelectItem value="prepared">วัตถุดิบเตรียม (Prepared)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.itemType === "prepared" && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs">
                <div className="flex items-center gap-2">
                  <CookingPot className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    สินค้ากึ่งสำเร็จรูป (Prepared Item): สามารถกำหนดสูตรส่วนผสม (BOM)
                    ได้ที่เมนูสูตรผลิต
                  </span>
                </div>
                {form.code.trim() && (
                  <Link
                    to="/production-recipes"
                    search={{ search: form.code.trim() } as Record<string, unknown>}
                    className="font-medium underline hover:text-amber-700 dark:hover:text-amber-300 shrink-0"
                  >
                    ไปหน้าสูตรผลิต
                  </Link>
                )}
              </div>
            )}

            {/* Structured Unit Conversion Section */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-3">
              <div className="text-xs font-semibold text-primary uppercase tracking-wide">
                ตั้งค่าระบบหน่วยนับ & อัตราแปลงสูตร
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <UnitSelector
                  label="หน่วยสต็อก (Stock Unit) *"
                  value={form.stockUnit || form.unit || "kg"}
                  onChange={(v) => setForm({ ...form, stockUnit: v, unit: v })}
                  options={dynamicStockUnits}
                  helperText="หน่วยสำหรับสั่งซื้อ & สต็อกนับ"
                  placeholder="ระบุหน่วยสต็อก เช่น kg / ถุง / ลัง"
                />

                <UnitSelector
                  label="หน่วยสูตร (Recipe Unit) *"
                  value={form.recipeUnit || "g"}
                  onChange={(v) => setForm({ ...form, recipeUnit: v })}
                  options={dynamicRecipeUnits}
                  helperText="หน่วยที่ใช้อ้างอิงในสูตรอาหาร"
                  placeholder="ระบุหน่วยสูตร เช่น g / ml / ชิ้น"
                />
              </div>

              <div className="space-y-1.5">
                <Label>อัตราแปลงหน่วย (Conversion Factor) *</Label>
                <Input
                  type="number"
                  min="0.000001"
                  step="any"
                  value={form.conversionFactor ?? 1}
                  onChange={(e) => setForm({ ...form, conversionFactor: Number(e.target.value) })}
                  className="bg-background"
                />
                <div className="rounded-lg border border-border/80 bg-background p-2.5 text-xs text-foreground font-medium flex items-center gap-2 shadow-xs">
                  <span className="text-base">💡</span>
                  <div>
                    <strong>อัตราแปลง:</strong> 1{" "}
                    {formatUnit(form.stockUnit || form.unit || "หน่วยสต็อก")} ={" "}
                    <span className="text-primary font-bold">
                      {(form.conversionFactor ?? 1).toLocaleString()}
                    </span>{" "}
                    {formatUnit(form.recipeUnit || "หน่วยสูตร")}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>สต็อกขั้นต่ำ (Minimum Stock)</Label>
                <Input
                  type="number"
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Purchase Price (ราคาซื้อต่อหน่วยสต็อก)</Label>
                <Input
                  type="number"
                  value={form.purchasePrice ?? 0}
                  onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Expiry Date & Shelf Life Section */}
            <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="mb-0 text-xs font-bold text-foreground">
                    การจัดการวันหมดอายุ (Shelf Life Management)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    กำหนดอายุสินค้าสำหรับคำนวณวันหมดอายุอัตโนมัติเมื่อรับเข้าคลัง
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {form.hasExpiry !== false ? "มีวันหมดอายุ" : "ไม่มีวันหมดอายุ"}
                  </span>
                  <Switch
                    checked={form.hasExpiry !== false}
                    onCheckedChange={(v) => setForm({ ...form, hasExpiry: v })}
                  />
                </div>
              </div>

              {form.hasExpiry !== false && (
                <>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label className="text-xs">อายุสินค้าเริ่มต้น (Default Shelf Life)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.defaultShelfLife ?? 30}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            defaultShelfLife: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="h-9 text-xs bg-background font-bold"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">หน่วยอายุสินค้า (Shelf Life Unit)</Label>
                      <Select
                        value={form.shelfLifeUnit ?? "Day"}
                        onValueChange={(v: "Day" | "Month" | "Year") =>
                          setForm({ ...form, shelfLifeUnit: v })
                        }
                      >
                        <SelectTrigger className="h-9 text-xs bg-background font-semibold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Day" className="text-xs">
                            วัน (Day)
                          </SelectItem>
                          <SelectItem value="Month" className="text-xs">
                            เดือน (Month)
                          </SelectItem>
                          <SelectItem value="Year" className="text-xs">
                            ปี (Year)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(isPackagingOrConsumable(form.name) ||
                    isPackagingOrConsumable(
                      categories.find((c) => c.id === form.categoryId)?.name,
                    )) && (
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <span>💡</span>
                      <span>
                        สำหรับหมวดหมู่บรรจุภัณฑ์ / วัสดุสิ้นเปลือง แนะนำกำหนดอายุ{" "}
                        <strong>1 ปี (Year)</strong>
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              <Label>Description (คำอธิบายเพิ่มเติม)</Label>
              <Textarea
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <Label className="mb-0">Active Status</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive items are hidden from workflows.
                </p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => save()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History dialog */}
      <HistoryDialog
        item={historyItem}
        transactions={transactions}
        onClose={() => setHistoryItem(null)}
      />

      {/* Import preview */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden rounded-2xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Preview import</DialogTitle>
            <DialogDescription>
              Duplicate Item Codes are skipped. Fix rows with errors and re-import if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 text-xs">
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              {importRows.filter((r) => r.status === "new").length} new
            </Badge>
            <Badge variant="secondary">
              {importRows.filter((r) => r.status === "duplicate").length} duplicates
            </Badge>
            <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">
              {importRows.filter((r) => r.status === "error").length} errors
            </Badge>
          </div>
          <div className="max-h-[50vh] overflow-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>รหัสวัตถุดิบ</TableHead>
                  <TableHead>ชื่อวัตถุดิบ</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>หน่วยสต็อก / สูตร</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importRows.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      {r.status === "new" && (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          New
                        </Badge>
                      )}
                      {r.status === "duplicate" && <Badge variant="secondary">Skip</Badge>}
                      {r.status === "error" && (
                        <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">
                          Error
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.data.code}</TableCell>
                    <TableCell>{r.data.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {categories.find((c) => c.id === r.data.categoryId)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {suppliers.find((s) => s.id === r.data.supplierId)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      1 {formatUnit(r.data.stockUnit)} = {r.data.conversionFactor}{" "}
                      {formatUnit(r.data.recipeUnit)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.message ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
                {importRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No rows.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmImport} disabled={!importRows.some((r) => r.status === "new")}>
              Import {importRows.filter((r) => r.status === "new").length} items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto Sync from Procurement (Database A) Modal */}
      <SyncProcurementModal
        open={syncOpen}
        onOpenChange={setSyncOpen}
        existingItems={items}
        categories={categories}
        suppliers={suppliers}
        liveProcurementProducts={procurementProducts}
        onAddItem={addItem}
        onUpdateItem={updateItem}
      />
    </div>
  );
}

function HistoryDialog({
  item,
  transactions,
  onClose,
}: {
  item: Item | null;
  transactions: StockTransaction[];
  onClose: () => void;
}) {
  const rows = useMemo(() => {
    if (!item) return [];
    return transactions
      .filter((t) => t.itemId === item.id)
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [item, transactions]);

  const typeLabel = (t: StockTransaction["type"]) =>
    (
      ({
        beginning: "Beginning Stock",
        purchase: "Purchase",
        usage: "Usage",
        adjustment: "Adjustment",
      }) as const
    )[t] ?? t;

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-hidden rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Movement history {item ? `— ${item.name}` : ""}</DialogTitle>
          <DialogDescription>All stock transactions for this item, newest first.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-xs">{formatDate(t.date)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {typeLabel(t.type)}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-medium ${
                      t.quantity < 0 ? "text-destructive" : "text-emerald-600"
                    }`}
                  >
                    {t.quantity > 0 ? "+" : ""}
                    {t.quantity} {formatUnit(item?.stockUnit || item?.unit)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.refId ? `#${t.refId.slice(0, 6)}` : (t.remark ?? "—")}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.employee ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No movements yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
