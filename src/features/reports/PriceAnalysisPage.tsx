import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useStore, formatCurrency } from "@/lib/store";
import { formatDate } from "@/lib/dateFormat";
import { filterByBranch } from "@/lib/branchFilter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  TrendingUp,
  DollarSign,
  History,
  Filter,
  Printer,
  FileSpreadsheet,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { Item } from "@/lib/types";
import { printReportDocument } from "./printReports";

export type PriceVolatility = "LOW" | "MEDIUM" | "HIGH";

export interface ItemPriceAnalysis {
  item: Item;
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
  latestPrice: number;
  differencePct: number;
  volatility: PriceVolatility;
  coefficientOfVariationPct: number;
  purchaseCount: number;
}

export interface ItemPurchaseRecord {
  id: string;
  supplierName: string;
  purchaseDate: string;
  invoiceNumber: string;
  unitCost: number;
  quantity: number;
  branchName: string;
}

export interface PriceAnalysisPageProps {
  hideTitleHeader?: boolean;
}

export function PriceAnalysisPage({ hideTitleHeader = false }: PriceAnalysisPageProps) {
  const {
    items,
    categories,
    purchases,
    transactions,
    suppliers,
    branches,
    settings,
    currentUser,
    selectedBranchId,
  } = useStore();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedVolatility, setSelectedVolatility] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  // Derive price analysis for each active item based on purchases/transactions
  const analysisData = useMemo<ItemPriceAnalysis[]>(() => {
    // Filter purchases and transactions by selected branch
    const branchPurchases = filterByBranch(purchases, selectedBranchId);
    const branchTxns = filterByBranch(transactions, selectedBranchId);

    return items
      .filter((item) => item.active)
      .map((item) => {
        // Collect all price points for this item from purchases & transactions
        const records: { date: string; price: number; qty: number }[] = [];

        // From structured purchases
        branchPurchases.forEach((p) => {
          p.items.forEach((pi) => {
            if (pi.itemId === item.id && pi.unitPrice > 0) {
              records.push({
                date: p.purchaseDate,
                price: pi.unitPrice,
                qty: pi.quantity,
              });
            }
          });
        });

        // Fallback from transactions if purchases list is empty
        if (records.length === 0) {
          branchTxns
            .filter(
              (t) =>
                t.itemId === item.id && t.type === "purchase" && t.unitPrice && t.unitPrice > 0,
            )
            .forEach((t) => {
              records.push({
                date: t.date.slice(0, 10),
                price: t.unitPrice!,
                qty: t.quantity,
              });
            });
        }

        // Sort by date ascending
        records.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (records.length === 0) {
          // If no purchase records exist, fallback to item.purchasePrice
          const basePrice = item.purchasePrice || 0;
          return {
            item,
            averagePrice: basePrice,
            lowestPrice: basePrice,
            highestPrice: basePrice,
            latestPrice: basePrice,
            differencePct: 0,
            volatility: "LOW" as PriceVolatility,
            coefficientOfVariationPct: 0,
            purchaseCount: 0,
          };
        }

        const prices = records.map((r) => r.price);
        const count = prices.length;
        const lowestPrice = Math.min(...prices);
        const highestPrice = Math.max(...prices);
        const latestPrice = records[records.length - 1].price;
        const sumPrices = prices.reduce((a, b) => a + b, 0);
        const averagePrice = sumPrices / count;

        const differencePct =
          averagePrice > 0 ? ((latestPrice - averagePrice) / averagePrice) * 100 : 0;

        // Calculate sample standard deviation for volatility
        let stdDev = 0;
        if (count > 1) {
          const variance =
            prices.reduce((acc, p) => acc + Math.pow(p - averagePrice, 2), 0) / (count - 1);
          stdDev = Math.sqrt(variance);
        }

        const coefficientOfVariationPct = averagePrice > 0 ? (stdDev / averagePrice) * 100 : 0;

        let volatility: PriceVolatility = "LOW";
        if (count > 1) {
          if (coefficientOfVariationPct > 15) {
            volatility = "HIGH";
          } else if (coefficientOfVariationPct >= 5) {
            volatility = "MEDIUM";
          }
        }

        return {
          item,
          averagePrice,
          lowestPrice,
          highestPrice,
          latestPrice,
          differencePct,
          volatility,
          coefficientOfVariationPct,
          purchaseCount: count,
        };
      });
  }, [items, purchases, transactions, selectedBranchId]);

  // Filter items by search, category, volatility
  const filteredData = useMemo(() => {
    return analysisData.filter((row) => {
      if (selectedCategory !== "all" && row.item.categoryId !== selectedCategory) {
        return false;
      }
      if (selectedVolatility !== "all" && row.volatility !== selectedVolatility) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const nameMatch = row.item.name.toLowerCase().includes(q);
        const codeMatch = row.item.code.toLowerCase().includes(q);
        if (!nameMatch && !codeMatch) return false;
      }
      return true;
    });
  }, [analysisData, selectedCategory, selectedVolatility, search]);

  // Selected item purchase drill-down history records
  const selectedItemHistory = useMemo<ItemPurchaseRecord[]>(() => {
    if (!selectedItem) return [];

    const branchPurchases = filterByBranch(purchases, selectedBranchId);

    const list: ItemPurchaseRecord[] = [];

    branchPurchases.forEach((p) => {
      const supplier = suppliers.find((s) => s.id === p.supplierId);
      const branch = branches.find((b) => b.id === p.branchId);

      p.items.forEach((pi, idx) => {
        if (pi.itemId === selectedItem.id) {
          list.push({
            id: `${p.id}-${idx}`,
            supplierName: supplier?.name || "Unknown Supplier",
            purchaseDate: p.purchaseDate,
            invoiceNumber: p.invoiceNumber || p.id.slice(0, 8),
            unitCost: pi.unitPrice,
            quantity: pi.quantity,
            branchName: branch?.name || "Main Branch",
          });
        }
      });
    });

    // Fallback to stock transactions if no structured purchase objects
    if (list.length === 0) {
      const branchTxns = filterByBranch(transactions, selectedBranchId);

      branchTxns
        .filter((t) => t.itemId === selectedItem.id && t.type === "purchase" && t.unitPrice)
        .forEach((t) => {
          const supplier = suppliers.find((s) => s.id === t.supplierId);
          const branch = branches.find((b) => b.id === t.branchId);
          list.push({
            id: t.id,
            supplierName: supplier?.name || "Supplier",
            purchaseDate: t.date.slice(0, 10),
            invoiceNumber: t.refId || "N/A",
            unitCost: t.unitPrice!,
            quantity: t.quantity,
            branchName: branch?.name || "Main Branch",
          });
        });
    }

    return list.sort(
      (a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime(),
    );
  }, [selectedItem, purchases, transactions, suppliers, branches, selectedBranchId]);

  // Chart data for drill down
  const chartData = useMemo(() => {
    return [...selectedItemHistory]
      .sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime())
      .map((rec) => ({
        date: rec.purchaseDate,
        unitCost: rec.unitCost,
        supplier: rec.supplierName,
      }));
  }, [selectedItemHistory]);

  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      toast.error("ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }

    const rows = filteredData.map((r, idx) => ({
      ลำดับ: idx + 1,
      รหัสสินค้า: r.item.code,
      ชื่อวัตถุดิบ: r.item.name,
      หมวดหมู่: categoryMap.get(r.item.categoryId) || "Uncategorized",
      หน่วย: r.item.unit,
      "ราคาเฉลี่ย (฿)": r.averagePrice,
      "ราคาต่ำสุด (฿)": r.lowestPrice,
      "ราคาสูงสุด (฿)": r.highestPrice,
      "ราคาล่าสุด (฿)": r.latestPrice,
      "ผลต่าง (%)": Number(r.differencePct.toFixed(1)),
      ระดับความผันผวน: r.volatility,
      "จำนวนครั้งที่ซื้อ (ครั้ง)": r.purchaseCount,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Price Analysis");
    XLSX.writeFile(wb, `Price_Analysis_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("ส่งออกรายงานการวิเคราะห์ราคาเรียบร้อยแล้ว");
  };

  const handlePrint = () => {
    if (filteredData.length === 0) {
      toast.error("ไม่มีข้อมูลสำหรับพิมพ์");
      return;
    }

    const branchName =
      selectedBranchId && selectedBranchId !== "all"
        ? branches.find((b) => b.id === selectedBranchId)?.name || selectedBranchId
        : "ทุกสาขา";

    const categoryLabel =
      selectedCategory !== "all"
        ? categories.find((c) => c.id === selectedCategory)?.name || selectedCategory
        : undefined;

    const volatilityLabel = selectedVolatility !== "all" ? selectedVolatility : undefined;

    printReportDocument({
      activeTab: "price",
      restaurantName: settings.companyName || "Sushi Hana Thailand",
      branchLabel: branchName,
      periodLabel: "ข้อมูลประวัติการจัดซื้อทั้งหมด",
      categoryLabel,
      volatilityLabel,
      currentUser,
      canViewFinancial: true,
      priceRows: filteredData.map((r) => ({
        code: r.item.code,
        name: r.item.name,
        category: categoryMap.get(r.item.categoryId) || "Uncategorized",
        unit: r.item.unit,
        averagePrice: r.averagePrice,
        lowestPrice: r.lowestPrice,
        highestPrice: r.highestPrice,
        latestPrice: r.latestPrice,
        differencePct: r.differencePct,
        volatility: r.volatility,
        purchaseCount: r.purchaseCount,
      })),
    });
  };

  return (
    <div className="space-y-6">
      {!hideTitleHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <PageHeader
            title="รายงานวิเคราะห์ราคา (Price Analysis Report)"
            description="ติดตามความผันผวนของราคาจัดซื้อ ความมั่นคงของต้นทุน และสถิติราคาวัตถุดิบ"
          />
          <div className="flex items-center gap-2 print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-9 gap-1.5 rounded-xl text-xs"
            >
              <Printer className="h-4 w-4" />
              พิมพ์รายงาน
            </Button>
            <Button
              size="sm"
              onClick={handleExportExcel}
              className="h-9 gap-1.5 rounded-xl text-xs bg-stone-900 hover:bg-stone-800 text-white dark:bg-amber-950 dark:hover:bg-amber-900"
            >
              <FileSpreadsheet className="h-4 w-4" />
              ส่งออก Excel
            </Button>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <Card className="p-4 rounded-2xl border border-border bg-card shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อหรือรหัสวัตถุดิบ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-9 w-36 text-xs rounded-xl">
                <SelectValue placeholder="หมวดหมู่" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedVolatility} onValueChange={setSelectedVolatility}>
              <SelectTrigger className="h-9 w-36 text-xs rounded-xl">
                <SelectValue placeholder="ความผันผวน" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกระดับ</SelectItem>
                <SelectItem value="HIGH">ผันผวนสูง (High)</SelectItem>
                <SelectItem value="MEDIUM">ผันผวนปานกลาง (Med)</SelectItem>
                <SelectItem value="LOW">ผันผวนต่ำ (Low)</SelectItem>
              </SelectContent>
            </Select>

            {hideTitleHeader && (
              <div className="flex items-center gap-1.5 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="h-9 gap-1.5 rounded-xl text-xs"
                >
                  <Printer className="h-3.5 w-3.5" />
                  พิมพ์
                </Button>
                <Button
                  size="sm"
                  onClick={handleExportExcel}
                  className="h-9 gap-1.5 rounded-xl text-xs bg-stone-900 hover:bg-stone-800 text-white dark:bg-amber-950 dark:hover:bg-amber-900"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Excel
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table className="text-xs">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold">Item</TableHead>
                <TableHead className="text-right font-semibold">Average Price</TableHead>
                <TableHead className="text-right font-semibold">Lowest Price</TableHead>
                <TableHead className="text-right font-semibold">Highest Price</TableHead>
                <TableHead className="text-right font-semibold">Latest Price</TableHead>
                <TableHead className="text-right font-semibold">Difference %</TableHead>
                <TableHead className="text-center font-semibold">Volatility</TableHead>
                <TableHead className="text-right font-semibold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No items found matching the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((row) => {
                  const isPos = row.differencePct > 0;
                  const isNeg = row.differencePct < 0;

                  return (
                    <TableRow key={row.item.id} className="hover:bg-accent/40 transition-colors">
                      <TableCell className="font-medium">
                        <div className="font-bold text-foreground">{row.item.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Code: {row.item.code} {row.item.unit ? `(${row.item.unit})` : ""}
                        </div>
                      </TableCell>

                      <TableCell className="text-right font-medium">
                        {formatCurrency(row.averagePrice, settings.currency)}
                      </TableCell>

                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(row.lowestPrice, settings.currency)}
                      </TableCell>

                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(row.highestPrice, settings.currency)}
                      </TableCell>

                      <TableCell className="text-right font-bold text-foreground">
                        {formatCurrency(row.latestPrice, settings.currency)}
                      </TableCell>

                      <TableCell className="text-right font-bold tabular-nums">
                        <span
                          className={
                            isPos
                              ? "text-red-600"
                              : isNeg
                                ? "text-emerald-600"
                                : "text-muted-foreground"
                          }
                        >
                          {isPos ? "▲ +" : isNeg ? "▼ " : ""}
                          {row.differencePct.toFixed(1)}%
                        </span>
                      </TableCell>

                      <TableCell className="text-center">
                        {row.volatility === "HIGH" ? (
                          <Badge variant="destructive" className="text-[10px] rounded-full">
                            HIGH ({row.coefficientOfVariationPct.toFixed(0)}%)
                          </Badge>
                        ) : row.volatility === "MEDIUM" ? (
                          <Badge className="bg-amber-500 text-white text-[10px] rounded-full">
                            MEDIUM ({row.coefficientOfVariationPct.toFixed(0)}%)
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200 rounded-full"
                          >
                            LOW ({row.coefficientOfVariationPct.toFixed(0)}%)
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedItem(row.item)}
                          className="h-7 px-2.5 text-[11px] rounded-lg border-border"
                        >
                          <History className="mr-1 h-3 w-3" />
                          Price History
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Drill Down Dialog: Price History & Line Chart */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-3xl rounded-2xl p-6 bg-card text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <TrendingUp className="h-5 w-5 text-primary" />
              Price History: {selectedItem?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Supplier purchase invoice history and price trend line chart over time.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-6 pt-2">
              {/* Purchase History Table */}
              <div className="rounded-xl border border-border overflow-hidden max-h-56 overflow-y-auto">
                <Table className="text-xs">
                  <TableHeader className="bg-muted/50 sticky top-0 border-b border-border">
                    <TableRow>
                      <TableHead className="font-semibold">Supplier</TableHead>
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Invoice / Ref</TableHead>
                      <TableHead className="font-semibold">Branch</TableHead>
                      <TableHead className="text-right font-semibold">Quantity</TableHead>
                      <TableHead className="text-right font-semibold">Unit Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedItemHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                          No historical purchase invoices found for this item.
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedItemHistory.map((rec) => (
                        <TableRow key={rec.id} className="hover:bg-accent/30">
                          <TableCell className="font-medium text-foreground">
                            {rec.supplierName}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(rec.purchaseDate)}
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {rec.invoiceNumber}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{rec.branchName}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {rec.quantity} {selectedItem.unit}
                          </TableCell>
                          <TableCell className="text-right font-bold text-foreground">
                            {formatCurrency(rec.unitCost, settings.currency)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Line Chart */}
              {chartData.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-primary" />
                    Purchase Price Trend Over Time
                  </h4>
                  <div className="h-56 p-2 rounded-xl bg-muted/20 border border-border">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="date" stroke="currentColor" fontSize={11} />
                        <YAxis stroke="currentColor" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            fontSize: 12,
                          }}
                          formatter={(value: number | string) => [
                            formatCurrency(Number(value), settings.currency),
                            "Unit Cost",
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="unitCost"
                          stroke="#1565C0"
                          strokeWidth={2.5}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setSelectedItem(null)}
                  className="rounded-xl border-border"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
