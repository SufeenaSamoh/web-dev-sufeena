import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useStore, formatCurrency } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  filterByBranch,
  getItemStockForBranch,
  isAllBranches,
  isTodayLocal,
} from "@/lib/branchFilter";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ShoppingCart,
  Clock,
  TriangleAlert,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
} from "lucide-react";
import type { InventoryLot } from "@/services/inventoryLots";
import type { StockTransaction } from "@/lib/types";

export type PeriodType = "1M" | "3M" | "6M" | "1Y";
export type UsageMetricType = "quantity" | "cost";

export function Dashboard() {
  const { items, transactions, purchases, inventoryBalance, settings, selectedBranchId } =
    useStore();

  const [period, setPeriod] = useState<PeriodType>("1M");
  const [usageMetric, setUsageMetric] = useState<UsageMetricType>("quantity");
  const [activeLots, setActiveLots] = useState<InventoryLot[]>([]);

  const warningDays = settings.expiryWarningDays ?? 7;

  // 1. Fetch active inventory lots with centralized branch filtering
  useEffect(() => {
    async function loadExpiryLots() {
      try {
        let q = supabase
          .from("inventory_lots")
          .select("*")
          .eq("status", "active")
          .gt("qty_remaining", 0)
          .not("expiry_date", "is", null)
          .order("expiry_date", { ascending: true, nullsFirst: false });

        if (!isAllBranches(selectedBranchId)) {
          q = q.eq("branch_id", selectedBranchId);
        }

        const { data } = await q;
        if (data) {
          setActiveLots(
            data.map((r) => ({
              id: r.id,
              lotNumber: r.lot_number,
              branchId: r.branch_id,
              itemId: r.item_id,
              purchaseItemId: r.purchase_item_id,
              supplierId: r.supplier_id,
              receivedDate: r.received_date,
              expiryDate: r.expiry_date,
              unitCost: Number(r.unit_cost ?? 0),
              qtyReceived: Number(r.qty_received ?? 0),
              qtyRemaining: Number(r.qty_remaining ?? 0),
              status: r.status as InventoryLot["status"],
            })),
          );
        }
      } catch (err) {
        console.warn("Dashboard lot fetch error:", err);
      }
    }
    loadExpiryLots();
  }, [selectedBranchId]);

  // Centralized filtered datasets by branch
  const branchPurchases = useMemo(() => {
    return filterByBranch(purchases, selectedBranchId);
  }, [purchases, selectedBranchId]);

  const branchTransactions = useMemo(() => {
    return filterByBranch(transactions, selectedBranchId);
  }, [transactions, selectedBranchId]);

  // 2. Date Ranges based on period
  const dateRanges = useMemo(() => {
    const now = new Date();
    const currStart = new Date();
    const prevStart = new Date();
    const prevEnd = new Date();

    let daysInPeriod = 30;
    if (period === "1M") daysInPeriod = 30;
    else if (period === "3M") daysInPeriod = 90;
    else if (period === "6M") daysInPeriod = 180;
    else if (period === "1Y") daysInPeriod = 365;

    currStart.setDate(now.getDate() - daysInPeriod);
    prevEnd.setDate(currStart.getDate() - 1);
    prevStart.setDate(prevEnd.getDate() - daysInPeriod);

    return {
      now,
      currStart,
      prevStart,
      prevEnd,
      daysInPeriod,
    };
  }, [period]);

  // 3. KPI Cards Data
  const kpiData = useMemo(() => {
    // Today's Purchases (local date matching)
    const todayPurchasesList = branchPurchases.filter((p) => isTodayLocal(p.purchaseDate));
    const todayPurchaseValue = todayPurchasesList.reduce((sum, p) => sum + p.total, 0);
    const todayInvoiceCount = todayPurchasesList.length;

    // Near Expiry Lots
    const now = new Date();
    let nearExpiryLotCount = 0;
    let nearExpiryTotalValue = 0;

    activeLots.forEach((lot) => {
      if (!lot.expiryDate) return;
      const exp = new Date(lot.expiryDate);
      exp.setHours(23, 59, 59, 999);
      const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= warningDays) {
        nearExpiryLotCount++;
        nearExpiryTotalValue += lot.qtyRemaining * lot.unitCost;
      }
    });

    // Low Stock Items Count
    const lowStockCount = items.filter((i) => {
      if (!i.active) return false;
      const stock = getItemStockForBranch(i.id, inventoryBalance, items, selectedBranchId);
      return stock <= i.minStock;
    }).length;

    // Inventory Valuation
    let totalInventoryValue = 0;
    if (activeLots.length > 0) {
      totalInventoryValue = activeLots.reduce(
        (sum, lot) => sum + lot.qtyRemaining * lot.unitCost,
        0,
      );
    } else {
      totalInventoryValue = items.reduce((sum, i) => {
        if (!i.active) return sum;
        const stock = getItemStockForBranch(i.id, inventoryBalance, items, selectedBranchId);
        return sum + stock * (i.purchasePrice || 0);
      }, 0);
    }

    return {
      todayPurchaseValue,
      todayInvoiceCount,
      nearExpiryLotCount,
      nearExpiryTotalValue,
      lowStockCount,
      totalInventoryValue,
    };
  }, [branchPurchases, activeLots, items, inventoryBalance, selectedBranchId, warningDays]);

  // Temporary console verification for pipeline audit
  useEffect(() => {
    const branchLabel = isAllBranches(selectedBranchId) ? "all" : selectedBranchId;
    console.log(`[Dashboard Audit] Selected Branch: ${branchLabel}`);
    console.log(
      `[Dashboard Audit] Purchase Records: Before Filter = ${purchases.length}, After Filter = ${branchPurchases.length}`,
    );
    console.log(
      `[Dashboard Audit] Total Purchase Value: ${formatCurrency(
        branchPurchases.reduce((s, p) => s + p.total, 0),
        settings.currency,
      )}`,
    );
    console.log(
      `[Dashboard Audit] Transaction Records: Before Filter = ${transactions.length}, After Filter = ${branchTransactions.length}`,
    );
    console.log(
      `[Dashboard Audit] Today's Purchase: ${formatCurrency(kpiData.todayPurchaseValue, settings.currency)}`,
    );
    console.log(
      `[Dashboard Audit] Total Inventory Value: ${formatCurrency(kpiData.totalInventoryValue, settings.currency)}`,
    );
  }, [
    selectedBranchId,
    purchases.length,
    branchPurchases,
    transactions.length,
    branchTransactions,
    kpiData,
    settings.currency,
  ]);

  // 4. Usage Analysis Graph Data (Quantity vs Cost Toggle)
  const usageChartData = useMemo(() => {
    const usageTxns = branchTransactions.filter(
      (t) => t.type === "usage" && new Date(t.date) >= dateRanges.currStart,
    );

    const getItemCost = (t: StockTransaction) => {
      if (usageMetric === "quantity") {
        return Math.abs(t.quantity);
      }
      const itemObj = items.find((i) => i.id === t.itemId);
      const unitCost = t.unitPrice || itemObj?.purchasePrice || 0;
      return Math.abs(t.quantity) * unitCost;
    };

    if (period === "1M") {
      // 4 Weekly bars for 1 Month
      const weeks = [
        { label: "Week 1", startDay: 0, endDay: 7, usage: 0 },
        { label: "Week 2", startDay: 7, endDay: 14, usage: 0 },
        { label: "Week 3", startDay: 14, endDay: 21, usage: 0 },
        { label: "Week 4", startDay: 21, endDay: 30, usage: 0 },
      ];

      const nowTime = dateRanges.now.getTime();
      usageTxns.forEach((t) => {
        const tTime = new Date(t.date).getTime();
        const diffDays = Math.floor((nowTime - tTime) / (1000 * 60 * 60 * 24));
        const val = getItemCost(t);

        if (diffDays >= 0 && diffDays < 7) weeks[3].usage += val;
        else if (diffDays >= 7 && diffDays < 14) weeks[2].usage += val;
        else if (diffDays >= 14 && diffDays < 21) weeks[1].usage += val;
        else if (diffDays >= 21 && diffDays <= 31) weeks[0].usage += val;
      });

      return weeks.map((w) => ({
        period: w.label,
        usage: usageMetric === "quantity" ? Math.round(w.usage) : Number(w.usage.toFixed(2)),
      }));
    } else {
      // Monthly bars for 3M, 6M, 1Y
      const monthCount = period === "3M" ? 3 : period === "6M" ? 6 : 12;
      const monthsData: { label: string; year: number; month: number; usage: number }[] = [];

      for (let i = monthCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        monthsData.push({
          label: d.toLocaleDateString("en", { month: "short" }),
          year: d.getFullYear(),
          month: d.getMonth(),
          usage: 0,
        });
      }

      usageTxns.forEach((t) => {
        const d = new Date(t.date);
        const y = d.getFullYear();
        const m = d.getMonth();
        const val = getItemCost(t);

        const target = monthsData.find((md) => md.year === y && md.month === m);
        if (target) {
          target.usage += val;
        }
      });

      return monthsData.map((m) => ({
        period: m.label,
        usage: usageMetric === "quantity" ? Math.round(m.usage) : Number(m.usage.toFixed(2)),
      }));
    }
  }, [branchTransactions, period, usageMetric, dateRanges, items]);

  // 5. Top 10 Most Used Items
  const topUsedItems = useMemo(() => {
    const currMap = new Map<string, number>();
    const prevMap = new Map<string, number>();

    branchTransactions
      .filter((t) => t.type === "usage")
      .forEach((t) => {
        const d = new Date(t.date);
        const qty = Math.abs(t.quantity);

        if (d >= dateRanges.currStart && d <= dateRanges.now) {
          currMap.set(t.itemId, (currMap.get(t.itemId) ?? 0) + qty);
        } else if (d >= dateRanges.prevStart && d <= dateRanges.prevEnd) {
          prevMap.set(t.itemId, (prevMap.get(t.itemId) ?? 0) + qty);
        }
      });

    return [...currMap.entries()]
      .map(([id, currQty]) => {
        const prevQty = prevMap.get(id) ?? 0;
        let pctChange = 0;
        if (prevQty > 0) {
          pctChange = ((currQty - prevQty) / prevQty) * 100;
        } else if (currQty > 0) {
          pctChange = 100;
        }

        const itemObj = items.find((i) => i.id === id);

        return {
          id,
          name: itemObj?.name || "Unknown Item",
          unit: itemObj?.unit || "unit",
          currQty,
          prevQty,
          pctChange,
        };
      })
      .sort((a, b) => b.currQty - a.currQty)
      .slice(0, 10);
  }, [branchTransactions, dateRanges, items]);

  // 6. Purchase Trend Widget
  const purchaseTrend = useMemo(() => {
    let currentTotal = 0;
    let prevTotal = 0;

    branchPurchases.forEach((p) => {
      const d = new Date(p.purchaseDate);
      if (d >= dateRanges.currStart && d <= dateRanges.now) {
        currentTotal += p.total;
      } else if (d >= dateRanges.prevStart && d <= dateRanges.prevEnd) {
        prevTotal += p.total;
      }
    });

    let pctChange = 0;
    if (prevTotal > 0) {
      pctChange = ((currentTotal - prevTotal) / prevTotal) * 100;
    } else if (currentTotal > 0) {
      pctChange = 100;
    }

    return {
      currentTotal,
      prevTotal,
      pctChange,
    };
  }, [branchPurchases, dateRanges]);

  // 7. Top Cost Impact Widget
  const topCostImpact = useMemo(() => {
    const costMap = new Map<string, number>();
    let totalAllCost = 0;

    branchPurchases.forEach((p) => {
      const d = new Date(p.purchaseDate);
      if (d >= dateRanges.currStart && d <= dateRanges.now) {
        p.items.forEach((pi) => {
          const cost = pi.quantity * pi.unitPrice;
          costMap.set(pi.itemId, (costMap.get(pi.itemId) ?? 0) + cost);
          totalAllCost += cost;
        });
      }
    });

    // Fallback if no structured purchase items in range
    if (totalAllCost === 0) {
      branchPurchases.forEach((p) => {
        p.items.forEach((pi) => {
          const cost = pi.quantity * pi.unitPrice;
          costMap.set(pi.itemId, (costMap.get(pi.itemId) ?? 0) + cost);
          totalAllCost += cost;
        });
      });
    }

    return [...costMap.entries()]
      .map(([id, cost]) => {
        const itemObj = items.find((i) => i.id === id);
        const contribPct = totalAllCost > 0 ? (cost / totalAllCost) * 100 : 0;

        return {
          id,
          name: itemObj?.name || "Unknown Item",
          code: itemObj?.code || "",
          cost,
          contribPct,
        };
      })
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);
  }, [branchPurchases, dateRanges, items]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Dashboard"
        description="Real-time analytics for inventory valuation, purchasing trends, usage, and cost impact."
      />

      {/* 4 KPI CARDS ONLY */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Today's Purchase */}
        <Card className="p-4 rounded-2xl border border-border/70 bg-card shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Today's Purchase
              </span>
              <div className="text-2xl font-extrabold text-foreground mt-1">
                {formatCurrency(kpiData.todayPurchaseValue, settings.currency)}
              </div>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground font-medium">
            {kpiData.todayInvoiceCount} invoice{kpiData.todayInvoiceCount !== 1 ? "s" : ""} received
            today
          </div>
        </Card>

        {/* Card 2: Near Expiry */}
        <Link to="/expiry-lots">
          <Card className="p-4 rounded-2xl border border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs hover:shadow-md transition-shadow cursor-pointer h-full">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Near Expiry
                </span>
                <div className="text-2xl font-extrabold text-amber-900 dark:text-amber-200 mt-1">
                  {kpiData.nearExpiryLotCount} Lots
                </div>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-xs text-amber-800 dark:text-amber-300 font-medium flex items-center justify-between">
              <span>Val: {formatCurrency(kpiData.nearExpiryTotalValue, settings.currency)}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </Card>
        </Link>

        {/* Card 3: Low Stock */}
        <Link to="/master-items">
          <Card className="p-4 rounded-2xl border border-red-200/80 bg-red-50/40 dark:bg-red-950/20 shadow-xs hover:shadow-md transition-shadow cursor-pointer h-full">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-800 dark:text-red-300">
                  Low Stock
                </span>
                <div className="text-2xl font-extrabold text-red-900 dark:text-red-200 mt-1">
                  {kpiData.lowStockCount} Items
                </div>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-500/15 text-red-600">
                <TriangleAlert className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-xs text-red-800 dark:text-red-300 font-medium flex items-center justify-between">
              <span>Attention required</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </Card>
        </Link>

        {/* Card 4: Inventory Value */}
        <Card className="p-4 rounded-2xl border border-border/70 bg-card shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Inventory Value
              </span>
              <div className="text-2xl font-extrabold text-foreground mt-1">
                {formatCurrency(kpiData.totalInventoryValue, settings.currency)}
              </div>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground font-medium">
            On-hand asset valuation
          </div>
        </Card>
      </div>

      {/* MIDDLE SECTION: Usage Analysis & Top Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Usage Analysis Bar Chart */}
        <Card className="lg:col-span-2 p-5 rounded-2xl border border-border/70 bg-card shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <h3 className="text-base font-bold text-foreground">Usage Analysis</h3>
              <p className="text-xs text-muted-foreground">
                Aggregated consumption trends over time (
                {usageMetric === "quantity" ? "Quantity" : "Cost"})
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Quantity vs Cost Toggle */}
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border">
                <Button
                  variant={usageMetric === "quantity" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setUsageMetric("quantity")}
                  className={`h-7 px-3 text-xs rounded-lg ${
                    usageMetric === "quantity" ? "font-bold shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  Quantity
                </Button>
                <Button
                  variant={usageMetric === "cost" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setUsageMetric("cost")}
                  className={`h-7 px-3 text-xs rounded-lg ${
                    usageMetric === "cost" ? "font-bold shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  Cost
                </Button>
              </div>

              {/* Period Selector */}
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border">
                {(["1M", "3M", "6M", "1Y"] as PeriodType[]).map((p) => (
                  <Button
                    key={p}
                    variant={period === p ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setPeriod(p)}
                    className={`h-7 px-2.5 text-xs rounded-lg ${
                      period === p ? "font-bold shadow-xs" : "text-muted-foreground"
                    }`}
                  >
                    {p === "1M"
                      ? "1 Month"
                      : p === "3M"
                        ? "3 Months"
                        : p === "6M"
                          ? "6 Months"
                          : "1 Year"}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="h-72 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="period" stroke="currentColor" fontSize={11} />
                <YAxis
                  stroke="currentColor"
                  fontSize={11}
                  tickFormatter={(val) =>
                    usageMetric === "cost" ? formatCurrency(val, settings.currency) : `${val}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    fontSize: 12,
                  }}
                  formatter={(val: number | string) => [
                    usageMetric === "quantity"
                      ? `${val} units`
                      : formatCurrency(Number(val), settings.currency),
                    usageMetric === "quantity" ? "Usage Quantity" : "Usage Cost",
                  ]}
                />
                <Bar dataKey="usage" fill="#1565C0" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top 10 Most Used Items */}
        <Card className="p-5 rounded-2xl border border-border/70 bg-card shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="border-b border-border/60 pb-2.5">
              <h3 className="text-sm font-bold text-foreground">Top 10 Most Used Items</h3>
              <p className="text-xs text-muted-foreground">
                Sorted descending by quantity consumed
              </p>
            </div>

            <div className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1">
              {topUsedItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No usage records found for this period.
                </div>
              ) : (
                topUsedItems.map((item, index) => {
                  const isUp = item.pctChange > 0;
                  const isDown = item.pctChange < 0;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-accent/20 hover:bg-accent/40 transition-colors text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Badge
                          variant="secondary"
                          className="h-5 w-5 grid place-items-center p-0 rounded-md text-[10px] font-bold shrink-0"
                        >
                          {index + 1}
                        </Badge>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">{item.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {item.currQty} {item.unit}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right font-mono font-bold">
                        <span
                          className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md ${
                            isUp
                              ? "bg-red-500/10 text-red-600"
                              : isDown
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isUp ? (
                            <ArrowUpRight className="h-3 w-3 mr-0.5" />
                          ) : isDown ? (
                            <ArrowDownRight className="h-3 w-3 mr-0.5" />
                          ) : null}
                          {isUp ? "+" : ""}
                          {item.pctChange.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* BOTTOM SECTION: Purchase Trend & Top Cost Impact */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Purchase Trend Widget */}
        <Card className="p-5 rounded-2xl border border-border/70 bg-card shadow-xs space-y-4">
          <div className="border-b border-border/60 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Purchase Trend</h3>
                <p className="text-xs text-muted-foreground">
                  Period vs Previous Period comparison
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Current Period Purchase
              </div>
              <div className="text-xl font-extrabold text-foreground">
                {formatCurrency(purchaseTrend.currentTotal, settings.currency)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Previous Period Purchase
              </div>
              <div className="text-xl font-extrabold text-muted-foreground">
                {formatCurrency(purchaseTrend.prevTotal, settings.currency)}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-border flex items-center justify-between bg-card">
              <span className="text-xs font-semibold text-foreground">Period Difference</span>
              <Badge
                className={`text-xs px-2 py-0.5 rounded-lg font-bold ${
                  purchaseTrend.pctChange > 0
                    ? "bg-amber-500 text-white"
                    : purchaseTrend.pctChange < 0
                      ? "bg-emerald-600 text-white"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {purchaseTrend.pctChange > 0 ? "▲ +" : purchaseTrend.pctChange < 0 ? "▼ " : ""}
                {purchaseTrend.pctChange.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </Card>

        {/* Top Cost Impact Widget */}
        <Card className="lg:col-span-2 p-5 rounded-2xl border border-border/70 bg-card shadow-xs space-y-3">
          <div className="border-b border-border/60 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <DollarSign className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Top Cost Impact</h3>
                <p className="text-xs text-muted-foreground">
                  Highest financial contribution to purchasing budget
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {topCostImpact.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No purchase transactions recorded in this period.
              </div>
            ) : (
              topCostImpact.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-accent/20 hover:bg-accent/40 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 shrink-0">
                      #{idx + 1}
                    </Badge>
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate">{item.name}</div>
                      {item.code && (
                        <div className="text-[10px] text-muted-foreground font-mono">
                          Code: {item.code}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 text-right">
                    <div>
                      <div className="font-bold text-foreground">
                        {formatCurrency(item.cost, settings.currency)}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">Total Spend</div>
                    </div>

                    <div className="w-16 text-right">
                      <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {item.contribPct.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
