import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useStore, formatCurrency } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  PackageCheck,
  Plus,
  Search,
  Truck,
  Warehouse,
} from "lucide-react";

export function ReceivingPage() {
  const { purchases, suppliers, items, settings } = useStore();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    return [...purchases]
      .sort((a, b) => +new Date(b.purchaseDate) - +new Date(a.purchaseDate))
      .filter((p) => {
        const sup = suppliers.find((s) => s.id === p.supplierId)?.name ?? "";
        return (p.invoiceNumber + " " + sup).toLowerCase().includes(q.toLowerCase());
      });
  }, [purchases, suppliers, q]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todays = purchases.filter((p) => new Date(p.purchaseDate) >= today);
    const value = purchases.reduce((s, p) => s + p.total, 0);
    const units = purchases.reduce(
      (s, p) => s + p.items.reduce((x, it) => x + it.quantity, 0),
      0,
    );
    return { total: purchases.length, todays: todays.length, value, units };
  }, [purchases]);

  const kpi = [
    { label: "Total Receipts", value: stats.total, icon: PackageCheck, tone: "text-primary" },
    { label: "Today", value: stats.todays, icon: Warehouse, tone: "text-emerald-600" },
    { label: "Units Received", value: stats.units, icon: Truck, tone: "text-primary" },
    {
      label: "Total Value",
      value: formatCurrency(stats.value, settings.currency),
      icon: CheckCircle2,
      tone: "text-emerald-600",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receiving"
        description="รับสินค้า · Confirm and track incoming stock from suppliers."
        actions={
          <Button asChild className="rounded-xl">
            <Link to="/purchase">
              <Plus className="mr-1 h-4 w-4" />
              New Purchase
            </Link>
          </Button>
        }
      />

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

      <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 md:max-w-md">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search invoice or supplier…"
            className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const sup = suppliers.find((s) => s.id === p.supplierId);
                const units = p.items.reduce((s, i) => s + i.quantity, 0);
                const preview = p.items
                  .slice(0, 2)
                  .map((i) => items.find((x) => x.id === i.itemId)?.name)
                  .filter(Boolean)
                  .join(", ");
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.invoiceNumber}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(p.purchaseDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium">{sup?.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div className="font-semibold">{units}</div>
                      <div className="text-[11px] text-muted-foreground">{preview}</div>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(p.total, settings.currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.employee}</TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                        Received
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
                    <div className="mx-auto max-w-sm">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
                        <Warehouse className="h-5 w-5" />
                      </div>
                      <div className="mt-3 text-sm font-semibold">No receipts yet</div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Record a purchase to see it appear here.
                      </p>
                      <Button asChild className="mt-4 rounded-xl">
                        <Link to="/purchase">
                          <Plus className="mr-1 h-4 w-4" />
                          Create Purchase
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}