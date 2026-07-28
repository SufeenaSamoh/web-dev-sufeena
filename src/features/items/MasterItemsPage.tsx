import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/PageHeader";
import { useStore, formatCurrency } from "@/lib/store";
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
import {
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import type { Item, StockTransaction } from "@/lib/types";

const PAGE_SIZE = 20;

const empty: Omit<Item, "id"> = {
  code: "",
  name: "",
  categoryId: "",
  supplierId: "",
  unit: "kg",
  minStock: 0,
  purchasePrice: 0,
  barcode: "",
  description: "",
  active: true,
  hasExpiry: false,
  shelfLifeDays: undefined,
  expiryWarningDays: undefined,
};

const UNITS = ["kg", "g", "L", "ml", "pcs", "pack", "bottle", "tray", "box"];

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

  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

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
    });
    setCreating(true);
  };
  const openEdit = (i: Item) => {
    setEditing(i);
    setForm({
      code: i.code,
      name: i.name,
      categoryId: i.categoryId,
      supplierId: i.supplierId ?? "",
      unit: i.unit,
      minStock: i.minStock,
      purchasePrice: i.purchasePrice ?? 0,
      barcode: i.barcode ?? "",
      description: i.description ?? "",
      active: i.active,
      hasExpiry: i.hasExpiry,
      shelfLifeDays: i.shelfLifeDays,
      expiryWarningDays: i.expiryWarningDays,
    });
  };

  const validate = (): string | null => {
    if (!form.code.trim()) return "Item Code is required";
    if (!form.name.trim()) return "Item Name is required";
    if (!form.categoryId) return "Category is required";
    if (!form.supplierId) return "Supplier is required";
    if (!form.unit) return "Unit is required";
    if (form.hasExpiry && (!form.shelfLifeDays || form.shelfLifeDays <= 0)) {
      return "Shelf life (days) is required when expiry tracking is on";
    }
    const dup = items.find(
      (i) =>
        i.code.toLowerCase() === form.code.trim().toLowerCase() &&
        (!editing || i.id !== editing.id),
    );
    if (dup) return "Item Code must be unique";
    return null;
  };

  const save = async (initialStock?: number) => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    const payload: Omit<Item, "id"> = {
      ...form,
      code: form.code.trim(),
      name: form.name.trim(),
      shelfLifeDays: form.hasExpiry ? form.shelfLifeDays : undefined,
      expiryWarningDays: form.hasExpiry ? form.expiryWarningDays : undefined,
    };
    if (editing) {
      await updateItem(editing.id, payload);
      toast.success("Item updated");
    } else {
      await addItem(payload);
      if (initialStock && initialStock > 0) {
        // handled below via effect? simplest: no-op; using addItem returns void.
      }
      toast.success("Item created");
    }
    setEditing(null);
    setCreating(false);
  };

  // Soft delete: items are referenced by purchase/receiving/stock-count
  // history, so we never hard-delete a row from the Master Items screen --
  // we deactivate it instead. Inactive items are excluded from workflows
  // but remain visible here (Status filter) and keep their history intact.
  const confirmDelete = async () => {
    if (!deleteId) return;
    await updateItem(deleteId, { active: false });
    toast.success("Item deactivated");
    setDeleteId(null);
  };

  const exportExcel = () => {
    const rows = filtered.map((i) => ({
      "Item Code": i.code,
      "Item Name": i.name,
      Category: categories.find((c) => c.id === i.categoryId)?.name ?? "",
      Supplier: suppliers.find((s) => s.id === i.supplierId)?.name ?? "",
      Unit: i.unit,
      "Current Stock": currentStock(i.id),
      "Minimum Stock": i.minStock,
      "Purchase Price": i.purchasePrice ?? 0,
      "Average Cost": Number(avgCost(i.id).toFixed(2)),
      Barcode: i.barcode ?? "",
      Description: i.description ?? "",
      "Track Expiry": i.hasExpiry ? "Yes" : "No",
      "Shelf Life (days)": i.shelfLifeDays ?? "",
      "Expiry Warning (days)": i.expiryWarningDays ?? "",
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
        const code = String(pick(row, ["Item Code", "code", "sku"]) || "").trim();
        const name = String(pick(row, ["Item Name", "name"]) || "").trim();
        const catName = String(pick(row, ["Category"]) || "").trim();
        const supName = String(pick(row, ["Supplier"]) || "").trim();
        const unit = String(pick(row, ["Unit"]) || "kg").trim();
        const minStock = Number(pick(row, ["Minimum Stock", "min"])) || 0;
        const purchasePrice = Number(pick(row, ["Purchase Price", "price"])) || 0;
        const barcode = String(pick(row, ["Barcode"]) || "").trim();
        const description = String(pick(row, ["Description"]) || "").trim();
        const activeRaw = String(pick(row, ["Status", "Active"]) || "active").toLowerCase();
        const active = !["inactive", "false", "0", "no"].includes(activeRaw);
        const hasExpiryRaw = String(pick(row, ["Track Expiry", "Has Expiry"]) || "").toLowerCase();
        const hasExpiry = ["true", "1", "yes"].includes(hasExpiryRaw);
        const shelfLifeRaw = pick(row, ["Shelf Life (days)", "Shelf Life", "shelf_life_days"]);
        const shelfLifeDays = shelfLifeRaw === "" ? undefined : Number(shelfLifeRaw) || undefined;
        const warningRaw = pick(row, ["Expiry Warning (days)", "expiry_warning_days"]);
        const expiryWarningDays = warningRaw === "" ? undefined : Number(warningRaw) || undefined;

        const category = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
        const supplier = suppliers.find((s) => s.name.toLowerCase() === supName.toLowerCase());

        const data: Omit<Item, "id"> = {
          code,
          name,
          categoryId: category?.id ?? "",
          supplierId: supplier?.id ?? "",
          unit,
          minStock,
          purchasePrice,
          barcode,
          description,
          active,
          hasExpiry,
          shelfLifeDays: hasExpiry ? shelfLifeDays : undefined,
          expiryWarningDays: hasExpiry ? expiryWarningDays : undefined,
        };

        if (!code) return { data, status: "error", message: "Missing Item Code" };
        if (!name) return { data, status: "error", message: "Missing Item Name" };
        if (!category) return { data, status: "error", message: `Unknown category "${catName}"` };
        if (!supplier) return { data, status: "error", message: `Unknown supplier "${supName}"` };
        if (existingCodes.has(code.toLowerCase()) || seenInFile.has(code.toLowerCase())) {
          return { data, status: "duplicate", message: "Item Code already exists" };
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

  const confirmImport = () => {
    const toAdd = importRows.filter((r) => r.status === "new");
    toAdd.forEach((r) => addItem(r.data));
    const skipped = importRows.filter((r) => r.status === "duplicate").length;
    const errors = importRows.filter((r) => r.status === "error").length;
    toast.success(`Imported ${toAdd.length}, skipped ${skipped}, errors ${errors}`);
    setImportOpen(false);
    setImportRows([]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Item"
        description="Manage all inventory items"
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
              placeholder="Search by code, name, barcode, supplier…"
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
          <Select
            value={sup}
            onValueChange={(v) => {
              setSup(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Min</TableHead>
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
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.code}</TableCell>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {categories.find((c) => c.id === i.categoryId)?.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {suppliers.find((s) => s.id === i.supplierId)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{i.unit}</TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${low ? "text-destructive font-semibold" : ""}`}
                    >
                      {stock}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {i.minStock}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(i.purchasePrice ?? 0, settings.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(avgCost(i.id), settings.currency)}
                    </TableCell>
                    <TableCell>
                      {i.active ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
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
                    colSpan={11}
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
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit item" : "New item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Item Code *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div>
                <Label>Barcode</Label>
                <Input
                  value={form.barcode ?? ""}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Item Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category *</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) => setForm({ ...form, categoryId: v })}
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
                <Label>Supplier *</Label>
                <Select
                  value={form.supplierId ?? ""}
                  onValueChange={(v) => setForm({ ...form, supplierId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Unit *</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Minimum Stock</Label>
                <Input
                  type="number"
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Purchase Price</Label>
                <Input
                  type="number"
                  value={form.purchasePrice ?? 0}
                  onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="mb-0">Track Expiry</Label>
                  <p className="text-xs text-muted-foreground">
                    Calculates a batch expiry date from shelf life on receive.
                  </p>
                </div>
                <Switch
                  checked={form.hasExpiry}
                  onCheckedChange={(v) => setForm({ ...form, hasExpiry: v })}
                />
              </div>
              {form.hasExpiry && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <Label>Shelf Life (days) *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.shelfLifeDays ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          shelfLifeDays: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Expiry Warning (days before)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.expiryWarningDays ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          expiryWarningDays:
                            e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                      placeholder="Uses system default"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <Label className="mb-0">Active</Label>
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

      {/* Delete confirm (soft delete: sets active = false) */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              This deactivates the item (Status → Inactive) instead of permanently deleting it, so
              its purchase, receiving and stock-count history stays intact. You can reactivate it
              anytime from Edit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
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
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Supplier</TableHead>
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
                      {r.message ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
                {importRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
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
                  <TableCell className="text-xs">{new Date(t.date).toLocaleDateString()}</TableCell>
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
                    {t.quantity} {item?.unit}
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
