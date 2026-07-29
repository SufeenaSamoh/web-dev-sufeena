import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Row {
  itemId: string;
  quantity: number;
  remark: string;
}

export function BeginningStockPage() {
  const { items, categories, suppliers, branches, addTransaction } = useStore();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [cat, setCat] = useState("all");
  const [supplierId, setSupplierId] = useState<string>("none");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          (cat === "all" || i.categoryId === cat) && i.name.toLowerCase().includes(q.toLowerCase()),
      ),
    [items, cat, q],
  );

  const addRow = (itemId: string) => {
    if (rows.some((r) => r.itemId === itemId)) return;
    setRows((r) => [...r, { itemId, quantity: 1, remark: "" }]);
  };
  const update = (idx: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const remove = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx));

  const save = () => {
    if (rows.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    rows.forEach((r) =>
      addTransaction({
        itemId: r.itemId,
        type: "beginning",
        quantity: r.quantity,
        date: new Date(date).toISOString(),
        supplierId: supplierId === "none" ? undefined : supplierId,
        branchId: branches[0]?.id,
        remark: r.remark || "Initial stock",
      }),
    );
    toast.success(`Beginning stock saved · ${rows.length} items`);
    setRows([]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Beginning Stock"
        description="สต๊อกเริ่มต้น · Record opening balances before going live."
      />

      <Card className="rounded-2xl border-border/70 p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Supplier (optional)</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="rounded-2xl border-border/70 p-4 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search items…"
              className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
            {filtered.map((i) => (
              <button
                key={i.id}
                onClick={() => addRow(i.id)}
                className="flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-2 text-left text-sm hover:border-border hover:bg-accent/50"
              >
                <span>
                  <span className="font-medium">{i.name}</span>{" "}
                  <span className="text-xs text-muted-foreground">{i.code}</span>
                </span>
                <Plus className="h-4 w-4 text-primary" />
              </button>
            ))}
          </div>
        </Card>

        <Card className="rounded-2xl border-border/70 p-4 shadow-sm lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Items to add</h3>
            <Button onClick={save} className="rounded-xl" disabled={rows.length === 0}>
              <Save className="mr-1 h-4 w-4" />
              Save
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="w-24">Qty</TableHead>
                <TableHead>Remark</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, idx) => {
                const it = items.find((i) => i.id === r.itemId);
                return (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">
                      {it?.name} <span className="text-xs text-muted-foreground">({it?.unit})</span>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={r.quantity}
                        onChange={(e) => update(idx, { quantity: Number(e.target.value) })}
                        className="h-9 rounded-lg"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={r.remark}
                        onChange={(e) => update(idx, { remark: e.target.value })}
                        className="h-9 rounded-lg"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(idx)}
                        className="rounded-lg text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Click an item from the list to add it.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
