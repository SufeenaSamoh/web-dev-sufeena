import { useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useStore, formatCurrency } from "@/lib/store";
import { Card } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  DollarSign,
  PackageOpen,
  ShoppingCart,
  TriangleAlert,
  Utensils,
  PackageX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CHART_COLORS = ["#1565C0", "#42A5F5", "#66BB6A", "#FFB74D", "#EF5350", "#AB47BC"];

export function Dashboard() {
  const { items, transactions, categories, settings, currentStock } = useStore();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const stats = useMemo(() => {
    const totalItems = items.filter((i) => i.active).length;
    const lowStock = items.filter((i) => i.active && currentStock(i.id) <= i.minStock).length;
    const outOfStock = items.filter((i) => i.active && currentStock(i.id) <= 0).length;
    const expiringSoon = transactions.filter(
      (t) =>
        t.expiryDate &&
        new Date(t.expiryDate).getTime() - Date.now() < 7 * 86400000 &&
        new Date(t.expiryDate).getTime() > Date.now()
    ).length;
    const todaysUsage = transactions
      .filter((t) => t.type === "usage" && new Date(t.date) >= todayStart)
      .reduce((sum, t) => sum + Math.abs(t.quantity), 0);
    const purchaseToday = transactions
      .filter((t) => t.type === "purchase" && new Date(t.date) >= todayStart)
      .reduce((sum, t) => sum + (t.unitPrice ?? 0) * t.quantity, 0);
    // Inventory value = sum(current stock * latest purchase unit price)
    const inventoryValue = items.reduce((sum, i) => {
      const stock = currentStock(i.id);
      const latestPur = [...transactions]
        .filter((t) => t.itemId === i.id && t.type === "purchase" && t.unitPrice)
        .sort((a, b) => +new Date(b.date) - +new Date(a.date))[0];
      return sum + stock * (latestPur?.unitPrice ?? 0);
    }, 0);
    return { totalItems, lowStock, outOfStock, expiringSoon, todaysUsage, purchaseToday, inventoryValue };
  }, [items, transactions, currentStock, todayStart]);

  const dailyUsage = useMemo(() => {
    const days = 7;
    return Array.from({ length: days }).map((_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - idx));
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const total = transactions
        .filter((t) => t.type === "usage" && new Date(t.date) >= d && new Date(t.date) < next)
        .reduce((s, t) => s + Math.abs(t.quantity), 0);
      return { day: d.toLocaleDateString("en", { weekday: "short" }), usage: total };
    });
  }, [transactions]);

  const monthlyPurchase = useMemo(() => {
    const months = 6;
    return Array.from({ length: months }).map((_, idx) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (months - 1 - idx));
      const y = d.getFullYear();
      const m = d.getMonth();
      const total = transactions
        .filter(
          (t) =>
            t.type === "purchase" &&
            new Date(t.date).getFullYear() === y &&
            new Date(t.date).getMonth() === m
        )
        .reduce((s, t) => s + (t.unitPrice ?? 0) * t.quantity, 0);
      return { month: d.toLocaleDateString("en", { month: "short" }), value: Math.round(total) };
    });
  }, [transactions]);

  const topUsed = useMemo(() => {
    const map = new Map<string, number>();
    transactions
      .filter((t) => t.type === "usage")
      .forEach((t) => map.set(t.itemId, (map.get(t.itemId) ?? 0) + Math.abs(t.quantity)));
    return [...map.entries()]
      .map(([id, qty]) => ({ name: items.find((i) => i.id === id)?.name ?? id, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [transactions, items]);

  const byCategory = useMemo(() => {
    return categories.map((c) => ({
      name: c.name,
      value: items
        .filter((i) => i.categoryId === c.id)
        .reduce((s, i) => s + currentStock(i.id), 0),
    }));
  }, [categories, items, currentStock]);

  const recent = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => +new Date(b.date) - +new Date(a.date))
        .slice(0, 8),
    [transactions]
  );

  const kpis = [
    { label: "Inventory Value", value: formatCurrency(stats.inventoryValue, settings.currency), icon: DollarSign, trend: "on-hand", tone: "text-emerald-600" },
    { label: "Purchase Today", value: formatCurrency(stats.purchaseToday, settings.currency), icon: ShoppingCart, trend: "value", tone: "text-primary" },
    { label: "Today's Usage", value: stats.todaysUsage, icon: Utensils, trend: "units", tone: "text-primary" },
    { label: "Total Items", value: stats.totalItems, icon: Boxes, trend: "active", tone: "text-primary" },
    { label: "Low Stock", value: stats.lowStock, icon: TriangleAlert, trend: stats.lowStock > 0 ? "Attention" : "OK", tone: "text-amber-600" },
    { label: "Out of Stock", value: stats.outOfStock, icon: PackageX, trend: stats.outOfStock > 0 ? "Critical" : "OK", tone: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Live overview of stock, purchases and usage across your kitchen."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Card
            key={k.label}
            className="group relative overflow-hidden rounded-2xl border-border/70 bg-card p-4 shadow-[0_1px_2px_rgba(20,25,40,.04),0_8px_24px_rgba(20,25,40,.05)] transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {k.label}
                </div>
                <div className="mt-1 truncate text-2xl font-bold">{k.value}</div>
              </div>
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent ${k.tone}`}>
                <k.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-[11px] text-muted-foreground">{k.trend}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border-border/70 p-4 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Daily Usage</h3>
              <p className="text-xs text-muted-foreground">Last 7 days · units consumed</p>
            </div>
            <Badge variant="secondary">Live</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" stroke="currentColor" fontSize={12} />
                <YAxis stroke="currentColor" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                <Bar dataKey="usage" fill="#1565C0" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Stock by Category</h3>
            <p className="text-xs text-muted-foreground">Distribution</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-2xl border-border/70 p-4 shadow-sm lg:col-span-2">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Monthly Purchase</h3>
            <p className="text-xs text-muted-foreground">Purchase value over 6 months</p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyPurchase}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" stroke="currentColor" fontSize={12} />
                <YAxis stroke="currentColor" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                <Line type="monotone" dataKey="value" stroke="#1565C0" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Top Used Items</h3>
            <p className="text-xs text-muted-foreground">All-time consumption</p>
          </div>
          <div className="space-y-2">
            {topUsed.map((t, i) => (
              <div key={t.name} className="flex items-center gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-xs font-bold text-accent-foreground">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.name}</div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, (t.qty / (topUsed[0]?.qty || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-semibold tabular-nums">{t.qty}</span>
              </div>
            ))}
            {topUsed.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">No usage yet.</div>
            )}
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent Activity</h3>
          <Badge variant="secondary">{recent.length}</Badge>
        </div>
        <div className="divide-y divide-border/70">
          {recent.map((t) => {
            const item = items.find((i) => i.id === t.itemId);
            const positive = t.quantity > 0;
            return (
              <div key={t.id} className="flex items-center gap-3 py-3">
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                    positive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{item?.name ?? "Unknown"}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.type.charAt(0).toUpperCase() + t.type.slice(1)} · {new Date(t.date).toLocaleString()}
                  </div>
                </div>
                <div className={`text-sm font-bold tabular-nums ${positive ? "text-emerald-600" : "text-red-600"}`}>
                  {positive ? "+" : ""}
                  {t.quantity} {item?.unit}
                </div>
              </div>
            );
          })}
          {recent.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">No activity yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}