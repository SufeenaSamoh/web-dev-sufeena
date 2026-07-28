import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useStore, formatCurrency } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Download, Printer, FileText, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

const COLORS = ["#1565C0", "#42A5F5", "#66BB6A", "#FFB74D", "#EF5350", "#AB47BC"];

function exportCsv(name: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return toast.error("Nothing to export");
  const keys = Object.keys(rows[0]);
  const csv = [
    keys.join(","),
    ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
  toast.success("Exported CSV");
}

type Preset = "week" | "month" | "custom";

function presetRange(preset: Preset): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  if (preset === "week") start.setDate(end.getDate() - 6);
  else if (preset === "month") start.setDate(end.getDate() - 29);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function ReportsPage() {
  const { items, categories, transactions, suppliers, currentStock } = useStore();
  const [tab, setTab] = useState("period");
  const [preset, setPreset] = useState<Preset>("month");
  const initial = presetRange("month");
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const r = presetRange(p);
      setStart(r.start);
      setEnd(r.end);
    }
  };

  // Period-based inventory calculation:
  //   Usage = Beginning + Purchases − Ending
  const periodRows = useMemo(() => {
    const startTs = new Date(start + "T00:00:00").getTime();
    const endTs = new Date(end + "T23:59:59").getTime();
    return items.map((i) => {
      const price = i.purchasePrice ?? 0;
      let beginning = 0,
        purchases = 0,
        adjustments = 0,
        usageTxn = 0;
      for (const t of transactions) {
        if (t.itemId !== i.id) continue;
        const ts = new Date(t.date).getTime();
        if (ts < startTs) {
          beginning += t.quantity;
          continue;
        }
        if (ts > endTs) continue;
        if (t.type === "purchase" || t.type === "beginning") purchases += t.quantity;
        else if (t.type === "adjustment") adjustments += t.quantity;
        else if (t.type === "usage") usageTxn += t.quantity; // negative
      }
      const ending = beginning + purchases + adjustments + usageTxn;
      const usage = beginning + purchases - ending; // = -(adjustments + usageTxn)
      const difference = adjustments; // stock-count variance in period
      const cost = usage * price;
      return {
        code: i.code,
        name: i.name,
        unit: i.unit,
        beginning,
        purchases,
        ending,
        usage,
        difference,
        cost,
      };
    });
  }, [items, transactions, start, end]);

  const totals = useMemo(
    () =>
      periodRows.reduce(
        (acc, r) => ({
          beginning: acc.beginning + r.beginning,
          purchases: acc.purchases + r.purchases,
          ending: acc.ending + r.ending,
          usage: acc.usage + r.usage,
          cost: acc.cost + r.cost,
        }),
        { beginning: 0, purchases: 0, ending: 0, usage: 0, cost: 0 },
      ),
    [periodRows],
  );

  const inventoryRows = useMemo(
    () =>
      items.map((i) => ({
        code: i.code,
        name: i.name,
        category: categories.find((c) => c.id === i.categoryId)?.name ?? "",
        stock: currentStock(i.id),
        min: i.minStock,
        status: currentStock(i.id) <= i.minStock ? "Low" : "OK",
      })),
    [items, categories, currentStock],
  );

  const purchaseRows = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "purchase")
        .map((t) => ({
          date: new Date(t.date).toLocaleDateString(),
          item: items.find((i) => i.id === t.itemId)?.name ?? "",
          supplier: suppliers.find((s) => s.id === t.supplierId)?.name ?? "",
          qty: t.quantity,
          price: t.unitPrice ?? 0,
          total: (t.unitPrice ?? 0) * t.quantity,
        })),
    [transactions, items, suppliers],
  );

  const stockCountRows = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "adjustment")
        .map((t) => ({
          date: new Date(t.date).toLocaleDateString(),
          item: items.find((i) => i.id === t.itemId)?.name ?? "",
          diff: t.quantity,
          remark: t.remark ?? "",
        })),
    [transactions, items],
  );

  const byCategory = categories.map((c) => ({
    name: c.name,
    value: items.filter((i) => i.categoryId === c.id).reduce((s, i) => s + currentStock(i.id), 0),
  }));

  const topUsage = useMemo(
    () =>
      [...periodRows]
        .filter((r) => r.usage > 0)
        .sort((a, b) => b.usage - a.usage)
        .slice(0, 10)
        .map((r) => ({ name: r.name, usage: r.usage })),
    [periodRows],
  );

  const printPage = () => window.print();
  const exportPdf = () => {
    toast.success("Print dialog opened — save as PDF");
    window.print();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports · รายงาน"
        description="วิเคราะห์การใช้วัตถุดิบตามรอบตรวจนับ"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => exportCsv("period-report", periodRows)}
              className="rounded-xl"
            >
              <Download className="mr-1 h-4 w-4" />
              CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => exportCsv("period-report", periodRows)}
              className="rounded-xl"
            >
              <FileSpreadsheet className="mr-1 h-4 w-4" />
              Excel
            </Button>
            <Button variant="outline" onClick={exportPdf} className="rounded-xl">
              <FileText className="mr-1 h-4 w-4" />
              PDF
            </Button>
            <Button variant="outline" onClick={printPage} className="rounded-xl">
              <Printer className="mr-1 h-4 w-4" />
              Print
            </Button>
          </div>
        }
      />

      <Card className="rounded-2xl border-border/70 p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <Label className="mb-1.5 block text-sm">ช่วงเวลา (Period)</Label>
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              {(["week", "month", "custom"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => applyPreset(p)}
                  className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold ${preset === p ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  {p === "week" ? "7 วัน" : p === "month" ? "30 วัน" : "กำหนดเอง"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">เริ่ม (Start)</Label>
            <Input
              type="date"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setPreset("custom");
              }}
              className="h-11 rounded-xl"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">สิ้นสุด (End)</Label>
            <Input
              type="date"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setPreset("custom");
              }}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="flex items-end">
            <div className="w-full rounded-xl border border-border/70 bg-accent/40 p-3 text-center">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Usage Cost
              </div>
              <div className="text-lg font-bold tabular-nums">{formatCurrency(totals.cost)}</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-4">
        {[
          { label: "Beginning", value: totals.beginning },
          { label: "Purchases", value: totals.purchases },
          { label: "Ending Count", value: totals.ending },
          { label: "Calculated Usage", value: totals.usage },
        ].map((k) => (
          <Card key={k.label} className="rounded-2xl border-border/70 p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {k.label}
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{k.value.toLocaleString()}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold">Top 10 Usage (Period)</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={topUsage} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={100} />
                <Tooltip />
                <Bar dataKey="usage" fill="#1565C0" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold">Stock by Category</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={95}
                >
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex w-full flex-wrap justify-start rounded-xl bg-muted p-1">
            <TabsTrigger
              value="period"
              className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow"
            >
              Period Usage
            </TabsTrigger>
            <TabsTrigger
              value="inventory"
              className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow"
            >
              Inventory
            </TabsTrigger>
            <TabsTrigger
              value="purchase"
              className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow"
            >
              Purchase
            </TabsTrigger>
            <TabsTrigger
              value="count"
              className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow"
            >
              Stock Count
            </TabsTrigger>
          </TabsList>

          <TabsContent value="period" className="mt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Beginning</TableHead>
                    <TableHead className="text-right">Purchases</TableHead>
                    <TableHead className="text-right">Ending Count</TableHead>
                    <TableHead className="text-right">Usage</TableHead>
                    <TableHead className="text-right">Usage Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodRows.map((r) => (
                    <TableRow key={r.code}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {r.code}
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.name} <span className="text-xs text-muted-foreground">({r.unit})</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.beginning}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.purchases}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.ending}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {r.usage}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(r.cost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="mt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Min</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryRows.map((r) => (
                    <TableRow key={r.code}>
                      <TableCell className="font-mono text-xs">{r.code}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.category}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.stock}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.min}</TableCell>
                      <TableCell>
                        {r.status === "Low" ? (
                          <Badge variant="destructive">Low</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            OK
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="purchase" className="mt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseRows.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.item}</TableCell>
                      <TableCell>{r.supplier}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.qty}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(r.price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(r.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="count" className="mt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead>Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockCountRows.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.item}</TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${r.diff > 0 ? "text-emerald-600" : r.diff < 0 ? "text-destructive" : ""}`}
                      >
                        {r.diff > 0 ? `+${r.diff}` : r.diff}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.remark}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
