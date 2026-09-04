import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useStore, formatCurrency } from "@/lib/store";
import { supabase } from "@/lib/supabase";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatDate } from "@/lib/dateFormat";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Calendar,
  Clock,
  DollarSign,
  History,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Warehouse,
} from "lucide-react";
import type { InventoryLot } from "@/services/inventoryLots";
import type { StockTransaction } from "@/lib/types";

type ExpiryFilterTab = "all" | "expired" | "warning" | "good";

export function ExpiryLotsPage() {
  const {
    items,
    branches,
    suppliers,
    settings,
    selectedBranchId,
    runNotificationScheduler,
    transactions,
  } = useStore();

  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExpiryFilterTab>("all");
  const [branchFilter, setBranchFilter] = useState<string>(selectedBranchId || "all");
  const [selectedLot, setSelectedLot] = useState<InventoryLot | null>(null);
  const [lotMovements, setLotMovements] = useState<StockTransaction[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const warningDays = settings.expiryWarningDays ?? 7;

  // Load active inventory_lots from Supabase
  const loadLots = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("inventory_lots")
        .select("*")
        .eq("status", "active")
        .gt("qty_remaining", 0)
        .order("expiry_date", { ascending: true, nullsFirst: false })
        .order("received_date", { ascending: true });

      if (branchFilter !== "all") {
        query = query.eq("branch_id", branchFilter);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Failed to load inventory_lots:", error);
        toast.error("Failed to load inventory lots");
      } else if (data) {
        setLots(
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
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          })),
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLots();
  }, [branchFilter]);

  const handleRunScan = async () => {
    setRefreshing(true);
    try {
      const result = await runNotificationScheduler();
      toast.success(
        `Expiry scan complete! ${result.expirySummary.generatedCount} notifications evaluated (${result.expirySummary.expiredCount} expired, ${result.expirySummary.warningCount} warning).`,
      );
      await loadLots();
    } catch (err) {
      toast.error("Scan failed");
    } finally {
      setRefreshing(false);
    }
  };

  // Helper to calculate days remaining
  const getDaysRemaining = (expiryDate?: string | null): number | null => {
    if (!expiryDate) return null;
    const exp = new Date(expiryDate);
    exp.setHours(23, 59, 59, 999);
    const now = new Date();
    const diffTime = exp.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    let expiredCount = 0;
    let expiredLoss = 0;
    let warningCount = 0;
    let warningValue = 0;
    let goodCount = 0;
    let totalValue = 0;

    lots.forEach((lot) => {
      const days = getDaysRemaining(lot.expiryDate);
      const value = lot.qtyRemaining * lot.unitCost;
      totalValue += value;

      if (days !== null && days <= 0) {
        expiredCount++;
        expiredLoss += value;
      } else if (days !== null && days <= warningDays) {
        warningCount++;
        warningValue += value;
      } else {
        goodCount++;
      }
    });

    return {
      expiredCount,
      expiredLoss,
      warningCount,
      warningValue,
      goodCount,
      totalLots: lots.length,
      totalValue,
    };
  }, [lots, warningDays]);

  // Filtered lots for table
  const filteredLots = useMemo(() => {
    return lots.filter((lot) => {
      const days = getDaysRemaining(lot.expiryDate);

      // Status filter
      if (statusFilter === "expired" && (days === null || days > 0)) return false;
      if (statusFilter === "warning" && (days === null || days <= 0 || days > warningDays))
        return false;
      if (statusFilter === "good" && days !== null && days <= warningDays) return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const item = items.find((i) => i.id === lot.itemId);
        const supplier = suppliers.find((s) => s.id === lot.supplierId);
        const matchLot = lot.lotNumber.toLowerCase().includes(q);
        const matchItem =
          item?.name.toLowerCase().includes(q) ||
          item?.code.toLowerCase().includes(q) ||
          item?.barcode?.toLowerCase().includes(q);
        const matchSupplier = supplier?.name.toLowerCase().includes(q);
        if (!matchLot && !matchItem && !matchSupplier) return false;
      }

      return true;
    });
  }, [lots, statusFilter, search, items, suppliers, warningDays]);

  // View Lot Detail and fetch its movement history
  const handleOpenLotDetail = async (lot: InventoryLot) => {
    setSelectedLot(lot);
    setLoadingMovements(true);

    // Filter store transactions for this item and branch
    const itemTxns = transactions.filter((t) => {
      if (t.itemId !== lot.itemId) return false;
      if (lot.branchId && t.branchId && t.branchId !== lot.branchId) return false;
      return true;
    });

    setLotMovements(
      [...itemTxns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    );
    setLoadingMovements(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expiry & Lot Management"
        description="Monitor inventory lots, FEFO priority queues, expiration risks, and financial loss estimates."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleRunScan}
              disabled={refreshing}
              className="rounded-xl border-[#E5E7EB] bg-white text-[#444] hover:bg-[#F7F7F7]"
            >
              {refreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Run Expiry Scan
            </Button>
          </div>
        }
      />

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Actual Financial Loss (Expired) */}
        <Card className="p-4 rounded-2xl border border-red-200 bg-red-50/50 shadow-2xs">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-red-800 uppercase tracking-wider">
                Expired Loss (สูญเสีย)
              </p>
              <h3 className="text-2xl font-extrabold text-red-900 mt-1">
                {formatCurrency(metrics.expiredLoss, settings.currency)}
              </h3>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-red-700">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-red-700 font-medium">
            <Badge variant="destructive" className="rounded-md">
              {metrics.expiredCount} Lots Expired
            </Badge>
            <span>Action Required</span>
          </div>
        </Card>

        {/* Estimated Potential Loss (Near Expiry) */}
        <Card className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 shadow-2xs">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                Potential Loss (เสี่ยงหมดอายุ)
              </p>
              <h3 className="text-2xl font-extrabold text-amber-900 mt-1">
                {formatCurrency(metrics.warningValue, settings.currency)}
              </h3>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-800 font-medium">
            <Badge className="bg-amber-500 text-white hover:bg-amber-600 rounded-md">
              {metrics.warningCount} Lots ({warningDays}d warning)
            </Badge>
            <span>Priority Consumption</span>
          </div>
        </Card>

        {/* Healthy Lots */}
        <Card className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 shadow-2xs">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                Healthy Lots (สต๊อกปกติ)
              </p>
              <h3 className="text-2xl font-extrabold text-emerald-900 mt-1">
                {metrics.goodCount} Lots
              </h3>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-xs text-emerald-700 font-medium">
            Sufficient shelf life remaining
          </div>
        </Card>

        {/* Total Active Lots & Value */}
        <Card className="p-4 rounded-2xl border border-border bg-card shadow-2xs">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Lot Inventory
              </p>
              <h3 className="text-2xl font-extrabold text-foreground mt-1">
                {formatCurrency(metrics.totalValue, settings.currency)}
              </h3>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Boxes className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground font-medium">
            {metrics.totalLots} Active Lots in System
          </div>
        </Card>
      </div>

      {/* Filter Bar & Tabs */}
      <Card className="p-4 rounded-2xl border border-border bg-card shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as ExpiryFilterTab)}
            className="w-full sm:w-auto"
          >
            <TabsList className="bg-muted p-1 rounded-xl h-10 w-full sm:w-auto">
              <TabsTrigger value="all" className="rounded-lg text-xs font-semibold px-3">
                All Lots ({metrics.totalLots})
              </TabsTrigger>
              <TabsTrigger
                value="expired"
                className="rounded-lg text-xs font-semibold px-3 data-[state=active]:bg-red-600 data-[state=active]:text-white"
              >
                Expired ({metrics.expiredCount})
              </TabsTrigger>
              <TabsTrigger
                value="warning"
                className="rounded-lg text-xs font-semibold px-3 data-[state=active]:bg-amber-500 data-[state=active]:text-white"
              >
                Near Expiry ({metrics.warningCount})
              </TabsTrigger>
              <TabsTrigger value="good" className="rounded-lg text-xs font-semibold px-3">
                Good ({metrics.goodCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search & Branch Selector */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Lot #, Item, Barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>

            {branches.length > 0 && (
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="h-9 w-36 text-xs rounded-xl">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Inventory Lots Table */}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="p-3">FEFO Order</th>
                <th className="p-3">Lot Number</th>
                <th className="p-3">Item Name</th>
                <th className="p-3">Branch</th>
                <th className="p-3">Expiry Date</th>
                <th className="p-3 text-right">Remaining / Total</th>
                <th className="p-3 text-right">Unit Cost</th>
                <th className="p-3 text-right">Remaining Value</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-card">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading inventory lots...
                  </td>
                </tr>
              ) : filteredLots.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    No matching inventory lots found.
                  </td>
                </tr>
              ) : (
                filteredLots.map((lot, index) => {
                  const item = items.find((i) => i.id === lot.itemId);
                  const branch = branches.find((b) => b.id === lot.branchId);
                  const days = getDaysRemaining(lot.expiryDate);
                  const totalRemainingVal = lot.qtyRemaining * lot.unitCost;

                  return (
                    <tr key={lot.id} className="hover:bg-accent/40 transition-colors">
                      {/* FEFO Priority Badge */}
                      <td className="p-3 font-semibold">
                        <Badge
                          variant="outline"
                          className="rounded-md bg-muted text-[10px] border-border"
                        >
                          #{index + 1} FEFO
                        </Badge>
                      </td>

                      {/* Lot Number */}
                      <td className="p-3 font-mono font-bold text-foreground">{lot.lotNumber}</td>

                      {/* Item Info */}
                      <td className="p-3">
                        <div className="font-semibold text-foreground">
                          {item?.name || "Unknown Item"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Code: {item?.code || "N/A"} {item?.unit ? `(${item.unit})` : ""}
                        </div>
                      </td>

                      {/* Branch */}
                      <td className="p-3 font-medium text-muted-foreground">
                        {branch?.name || "All Branches"}
                      </td>

                      {/* Expiry Date & Days Left */}
                      <td className="p-3">
                        {lot.expiryDate ? (
                          <div>
                            <div className="font-medium text-foreground">
                              {formatDate(lot.expiryDate)}
                            </div>
                            {days !== null && days <= 0 ? (
                              <Badge className="bg-red-600 text-white text-[10px] px-1.5 py-0 mt-0.5 rounded-md">
                                Expired ({Math.abs(days)}d ago)
                              </Badge>
                            ) : days !== null && days <= warningDays ? (
                              <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0 mt-0.5 rounded-md">
                                {days} day(s) left
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-semibold">
                                {days} days left
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No Expiry Date</span>
                        )}
                      </td>

                      {/* Qty Remaining */}
                      <td className="p-3 text-right font-medium">
                        <span className="font-bold text-foreground">{lot.qtyRemaining}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          / {lot.qtyReceived} {item?.unit}
                        </span>
                      </td>

                      {/* Unit Cost */}
                      <td className="p-3 text-right text-muted-foreground">
                        {formatCurrency(lot.unitCost, settings.currency)}
                      </td>

                      {/* Total Value */}
                      <td className="p-3 text-right font-semibold text-foreground">
                        {formatCurrency(totalRemainingVal, settings.currency)}
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center">
                        {days !== null && days <= 0 ? (
                          <Badge variant="destructive" className="rounded-full text-[10px]">
                            EXPIRED
                          </Badge>
                        ) : days !== null && days <= warningDays ? (
                          <Badge className="bg-amber-500 text-white rounded-full text-[10px]">
                            WARNING
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-600 text-white rounded-full text-[10px]">
                            ACTIVE
                          </Badge>
                        )}
                      </td>

                      {/* Action */}
                      <td className="p-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenLotDetail(lot)}
                          className="h-7 px-2.5 text-[11px] rounded-lg border-[#E5E7EB] text-[#444] hover:bg-[#F7F7F7]"
                        >
                          <Info className="mr-1 h-3 w-3" />
                          Details
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Lot Detail & Movement History Dialog */}
      <Dialog open={!!selectedLot} onOpenChange={(open) => !open && setSelectedLot(null)}>
        <DialogContent className="max-w-2xl rounded-2xl p-6 bg-card text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Tag className="h-5 w-5 text-primary" />
              Lot Details: {selectedLot?.lotNumber}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Complete metadata, stock status, and movement history for this inventory lot.
            </DialogDescription>
          </DialogHeader>

          {selectedLot && (
            <div className="space-y-5 pt-2">
              {/* Lot Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/70 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    Item Name
                  </span>
                  <span className="font-bold text-foreground">
                    {items.find((i) => i.id === selectedLot.itemId)?.name || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    Supplier
                  </span>
                  <span className="font-semibold text-foreground">
                    {suppliers.find((s) => s.id === selectedLot.supplierId)?.name ||
                      "Internal / Beginning"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    Branch
                  </span>
                  <span className="font-semibold text-foreground">
                    {branches.find((b) => b.id === selectedLot.branchId)?.name || "All Branches"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    Received Date
                  </span>
                  <span className="font-medium text-foreground">
                    {formatDate(selectedLot.receivedDate)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    Expiry Date
                  </span>
                  <span className="font-bold text-red-600">
                    {selectedLot.expiryDate ? formatDate(selectedLot.expiryDate) : "None"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    Unit Cost
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(selectedLot.unitCost, settings.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    Qty Received
                  </span>
                  <span className="font-medium text-foreground">{selectedLot.qtyReceived}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    Qty Remaining
                  </span>
                  <span className="font-bold text-emerald-600">{selectedLot.qtyRemaining}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                    Remaining Value
                  </span>
                  <span className="font-bold text-foreground">
                    {formatCurrency(
                      selectedLot.qtyRemaining * selectedLot.unitCost,
                      settings.currency,
                    )}
                  </span>
                </div>
              </div>

              {/* Movement History Section */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-primary" />
                  Movement History (การเคลื่อนไหวสต๊อก)
                </h4>

                <div className="rounded-xl border border-border overflow-hidden max-h-52 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 text-muted-foreground font-semibold sticky top-0 border-b border-border">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5 text-right">Qty</th>
                        <th className="p-2.5">User</th>
                        <th className="p-2.5">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {loadingMovements ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                          </td>
                        </tr>
                      ) : lotMovements.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-muted-foreground">
                            No recorded movements found for this item.
                          </td>
                        </tr>
                      ) : (
                        lotMovements.map((m) => {
                          const positive = m.quantity > 0;
                          return (
                            <tr key={m.id} className="hover:bg-accent/30">
                              <td className="p-2.5 text-[11px]">{formatDate(m.date)}</td>
                              <td className="p-2.5">
                                <Badge variant="outline" className="capitalize text-[10px]">
                                  {m.type}
                                </Badge>
                              </td>
                              <td className="p-2.5 text-right font-bold tabular-nums">
                                <span className={positive ? "text-emerald-600" : "text-red-600"}>
                                  {positive ? "+" : ""}
                                  {m.quantity}
                                </span>
                              </td>
                              <td className="p-2.5 text-[11px] text-muted-foreground">
                                {m.employee || "System"}
                              </td>
                              <td className="p-2.5 text-[11px] text-muted-foreground truncate max-w-[120px]">
                                {m.remark || "-"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedLot(null)}
                  className="rounded-xl border-[#E5E7EB] text-[#444] hover:bg-[#F7F7F7]"
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
