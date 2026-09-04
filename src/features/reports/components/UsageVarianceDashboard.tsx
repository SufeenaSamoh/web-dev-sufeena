import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/store";
import type { VarianceExecutiveSummary } from "@/features/reports/types/usageVariance";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  PieChart as PieIcon,
  BarChart3,
  DollarSign,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from "recharts";

interface UsageVarianceDashboardProps {
  summary: VarianceExecutiveSummary;
  thresholdPct: number;
  thresholdValue: number;
}

const REASON_COLORS: Record<string, string> = {
  spoilage: "#ef4444", // red-500
  promo_free: "#3b82f6", // blue-500
  production_loss: "#f97316", // orange-500
  human_error: "#a855f7", // purple-500
  recipe_outdated: "#06b6d4", // cyan-500
  unrecorded_transfer: "#eab308", // yellow-500
  unknown_loss: "#64748b", // slate-500
  other: "#8b5cf6", // violet-500
};

export const UsageVarianceDashboard: React.FC<UsageVarianceDashboardProps> = ({
  summary,
  thresholdPct,
  thresholdValue,
}) => {
  const isLoss = (summary?.netVarianceCost ?? 0) > 0;
  const netVarianceCost = summary?.netVarianceCost ?? 0;
  const netVariancePct = summary?.netVariancePct ?? 0;
  const totalActualCost = summary?.totalActualCost ?? 0;
  const totalTheoreticalCost = summary?.totalTheoreticalCost ?? 0;
  const abnormalItemsCount = summary?.abnormalItemsCount ?? 0;
  const totalItemsCount = summary?.totalItemsCount ?? 0;
  const reviewedItemsCount = summary?.reviewedItemsCount ?? 0;
  const adjustedItemsCount = summary?.adjustedItemsCount ?? 0;
  const monthlyTrend = summary?.monthlyTrend ?? [];
  const topAbnormalIngredients = summary?.topAbnormalIngredients ?? [];

  // Format data for Recharts
  const pieData = (summary?.lossValueByReason ?? [])
    .filter((r) => (r.lossValue ?? 0) > 0)
    .map((r) => ({
      name: (r.reasonLabel || "").split(" (")[0] || r.reasonCode,
      value: r.lossValue ?? 0,
      code: r.reasonCode,
      count: r.count ?? 0,
    }));

  return (
    <div className="space-y-6">
      {/* 1. Executive KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Actual Usage Cost */}
        <Card className="p-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-card shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              มูลค่าใช้จริง (Actual)
            </span>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {formatCurrency(totalActualCost)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              คำนวณจาก ต้นงวด + รับเข้า − ปลายงวด
            </p>
          </div>
        </Card>

        {/* Theoretical Usage Cost */}
        <Card className="p-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-card shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              มูลค่าตามสูตร (Theoretical)
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
              {formatCurrency(totalTheoreticalCost)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">คำนวณจาก ยอดขาย × Recipe BOM</p>
          </div>
        </Card>

        {/* Net Variance Cost & % */}
        <Card
          className={`p-4 rounded-2xl border shadow-sm relative overflow-hidden ${
            isLoss
              ? "border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20"
              : "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              ผลต่างสุทธิ (Net Diff)
            </span>
            <div
              className={`p-2 rounded-xl ${
                isLoss
                  ? "bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400"
                  : "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {isLoss ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-black tracking-tight flex items-baseline gap-1.5 ${
                isLoss
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {isLoss ? "+" : ""}
              {formatCurrency(netVarianceCost)}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 font-bold ${
                  isLoss
                    ? "bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                    : "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                }`}
              >
                {netVariancePct > 0 ? "+" : ""}
                {netVariancePct.toFixed(1)}%
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                {isLoss ? "ใช้เกินสูตร (Loss)" : "ใช้น้อยกว่าสูตร (Surplus)"}
              </span>
            </div>
          </div>
        </Card>

        {/* Anomaly Count */}
        <Card className="p-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-card shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              รายการผิดปกติ (Anomalies)
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight flex items-baseline gap-1.5">
              {abnormalItemsCount}
              <span className="text-xs font-normal text-muted-foreground">
                / {totalItemsCount} รายการ
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              เกณฑ์: &gt; {thresholdPct}% หรือ &gt; ฿{thresholdValue}
            </p>
          </div>
        </Card>

        {/* Reviewed & Adjusted Progress */}
        <Card className="p-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-card shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              บันทึก / ปรับปรุงแล้ว
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight flex items-baseline gap-1.5">
              {adjustedItemsCount}
              <span className="text-xs font-normal text-muted-foreground">
                ปรับปรุง ({reviewedItemsCount} ตรวจสอบ)
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${
                    abnormalItemsCount > 0
                      ? Math.min(100, (reviewedItemsCount / abnormalItemsCount) * 100)
                      : 100
                  }%`,
                }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* 2. Charts Section: Trend Chart & Loss by Reason Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Comparison */}
        <Card className="p-5 rounded-2xl border-slate-200 dark:border-slate-800 bg-card shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                แนวโน้มการใช้จริง vs ใช้ตามสูตร และ % Variance รายเดือน
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                เปรียบเทียบมูลค่าต้นทุนที่ควรใช้ตามยอดขายกับมูลค่าที่ใช้จริง
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                  opacity={0.6}
                />
                <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(val) => `฿${((Number(val) || 0) / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val: unknown, name?: string | number) => [
                    typeof val === "number" ? formatCurrency(val) : String(val ?? ""),
                    name === "theoreticalCost"
                      ? "มูลค่าตามสูตร (Theoretical)"
                      : name === "actualCost"
                        ? "มูลค่าใช้จริง (Actual)"
                        : String(name ?? ""),
                  ]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar
                  dataKey="theoreticalCost"
                  name="มูลค่าตามสูตร (Theoretical)"
                  fill="#93c5fd"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="actualCost"
                  name="มูลค่าใช้จริง (Actual)"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Loss Value Breakdown by Reason */}
        <Card className="p-5 rounded-2xl border-slate-200 dark:border-slate-800 bg-card shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-amber-500" />
                สัดส่วนมูลค่า Loss แยกตามสาเหตุ
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                มูลค่าผลต่างที่บันทึกเหตุผลแล้ว
              </p>
            </div>
          </div>
          {pieData.length > 0 ? (
            <div className="space-y-4">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={65}
                      innerRadius={38}
                      paddingAngle={3}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.code} fill={REASON_COLORS[entry.code] || "#64748b"} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: unknown) => [
                        typeof val === "number"
                          ? formatCurrency(val)
                          : formatCurrency(Number(val ?? 0)),
                        "มูลค่า Loss",
                      ]}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 max-h-36 overflow-y-auto pr-1 text-xs">
                {pieData.map((p) => (
                  <div key={p.code} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: REASON_COLORS[p.code] || "#64748b" }}
                      />
                      <span className="truncate text-slate-700 dark:text-slate-300 max-w-[140px]">
                        {p.name}
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(p.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-muted-foreground text-xs text-center p-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2 opacity-80" />
              <span>ยังไม่มีมูลค่า Loss หรือผลต่างที่ต้องระบุเหตุผลในงวดนี้</span>
            </div>
          )}
        </Card>
      </div>

      {/* 3. Leaderboard: Top Abnormal / High Variance Ingredients */}
      {topAbnormalIngredients.length > 0 && (
        <Card className="p-5 rounded-2xl border-slate-200 dark:border-slate-800 bg-card shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Leaderboard: วัตถุดิบที่มีผลต่างสูงสุด (Top Variance Ingredients)
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                รายการวัตถุดิบที่ต้องเฝ้าระวังและตรวจสอบสาเหตุการสูญเสียหรือความคลาดเคลื่อน
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-muted-foreground font-semibold">
                  <th className="py-2 text-left w-10">#</th>
                  <th className="py-2 text-left">รหัส / ชื่อวัตถุดิบ</th>
                  <th className="py-2 text-left">หมวดหมู่</th>
                  <th className="py-2 text-right">ผลต่าง (จำนวน)</th>
                  <th className="py-2 text-right">ผลต่าง (%)</th>
                  <th className="py-2 text-right">มูลค่าผลต่าง (บาท)</th>
                  <th className="py-2 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {topAbnormalIngredients.map((item, idx) => {
                  const diffQty = Number(item.diffQty ?? 0);
                  const diffPct = Number(item.diffPct ?? 0);
                  const diffValue = Number(item.diffValue ?? 0);
                  const isHighLoss = diffValue > 0;
                  return (
                    <tr
                      key={item.ingredientId}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                    >
                      <td className="py-2.5 font-bold text-muted-foreground">{idx + 1}</td>
                      <td className="py-2.5">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {item.code}
                        </div>
                      </td>
                      <td className="py-2.5 text-muted-foreground">{item.category}</td>
                      <td className="py-2.5 text-right font-medium">
                        {diffQty > 0 ? "+" : ""}
                        {diffQty.toFixed(2)} {item.unit}
                      </td>
                      <td className="py-2.5 text-right font-bold">
                        <span
                          className={
                            diffPct > 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }
                        >
                          {diffPct > 0 ? "+" : ""}
                          {diffPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-bold">
                        <span
                          className={
                            isHighLoss
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }
                        >
                          {diffValue > 0 ? "+" : ""}
                          {formatCurrency(diffValue)}
                        </span>
                      </td>
                      <td className="py-2.5 text-center">
                        <Badge
                          variant="outline"
                          className={
                            isHighLoss
                              ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                          }
                        >
                          {isHighLoss ? "ใช้เกินสูตร" : "ประหยัดกว่าสูตร"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
