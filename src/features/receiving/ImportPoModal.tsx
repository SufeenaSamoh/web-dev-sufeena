import React, { useState, useEffect, useMemo } from "react";
import type { PurchaseOrder } from "../purchase/types";
import { subscribeDatabaseAOrders, INITIAL_BRANCHES_A } from "@/services/purchaseDbA";
import { useStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dateFormat";
import {
  FileText,
  Search,
  Building2,
  Calendar,
  Truck,
  CheckCircle2,
  Clock,
  Package,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Eye,
} from "lucide-react";

interface ImportPoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPo: (order: PurchaseOrder) => void;
  currentBranchId?: string;
}

/**
 * Check if a PurchaseOrder matches the specified target branch
 */
export function isOrderMatchingBranch(
  order: PurchaseOrder,
  targetBranchId?: string | null,
  branchesList?: { id: string; name: string }[],
): boolean {
  if (
    !targetBranchId ||
    targetBranchId === "all" ||
    targetBranchId.toLowerCase() === "all branches"
  ) {
    return true;
  }

  const tid = targetBranchId.trim().toLowerCase();
  const oId = (order.branchId || "").trim().toLowerCase();
  const oName = (order.branchName || "").trim().toLowerCase();

  // 1. Direct branch ID match
  if (oId && (oId === tid || oId === targetBranchId)) {
    return true;
  }

  // 2. Lookup branch object from store or INITIAL_BRANCHES_A
  const storeBranch = branchesList?.find(
    (b) => b.id.toLowerCase() === tid || b.id === targetBranchId,
  );
  const initialBranch = INITIAL_BRANCHES_A.find(
    (b) => b.id.toLowerCase() === tid || b.id === targetBranchId,
  );

  const targetName = (storeBranch?.name || initialBranch?.name || "").trim().toLowerCase();

  // Exact or contains name match
  if (targetName && oName) {
    if (oName === targetName) return true;
    if (oName.includes(targetName) || targetName.includes(oName)) return true;
  }

  // 3. Known branch keyword mapping (วัชรพล, พระราม33, บางแก้ว, บางนา, พอโตชิโน่)
  const branchKeywords = [
    { key: "วัชรพล", id: "branch-1", code: "br-01" },
    { key: "พระราม33", id: "branch-2", code: "br-02", alt: "พระราม 33" },
    { key: "บางแก้ว", id: "branch-3", code: "br-03" },
    { key: "บางนา", id: "branch-4", code: "br-04" },
    { key: "พอโตชิโน่", id: "branch-5", code: "br-05", alt: "portochino" },
  ];

  for (const b of branchKeywords) {
    const isTarget =
      tid === b.id ||
      tid === b.code ||
      targetName.includes(b.key) ||
      (b.alt && targetName.includes(b.alt)) ||
      tid.includes(b.key);

    if (isTarget) {
      const isOrder =
        oId === b.id ||
        oId === b.code ||
        oName.includes(b.key) ||
        (b.alt && oName.includes(b.alt)) ||
        order.id.toLowerCase().includes(`po-${b.code}`) ||
        order.id.toLowerCase().includes(b.id);

      return isOrder;
    }
  }

  return false;
}

export function ImportPoModal({
  isOpen,
  onClose,
  onSelectPo,
  currentBranchId,
}: ImportPoModalProps) {
  const { selectedBranchId: storeBranchId, branches } = useStore();
  const effectiveBranchId = currentBranchId || storeBranchId;

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "received">("active");
  const [selectedPreviewPo, setSelectedPreviewPo] = useState<PurchaseOrder | null>(null);

  // Subscribe to real-time POs from Database A
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    const unsub = subscribeDatabaseAOrders(
      (data) => {
        setOrders(data);
        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
      },
    );

    return () => unsub();
  }, [isOpen]);

  // Current branch display name
  const branchDisplayName = useMemo(() => {
    if (
      !effectiveBranchId ||
      effectiveBranchId === "all" ||
      effectiveBranchId.toLowerCase() === "all branches"
    ) {
      return "ทุกสาขา";
    }
    const bInStore = branches.find((b) => b.id === effectiveBranchId);
    if (bInStore) return bInStore.name;
    const bInA = INITIAL_BRANCHES_A.find((b) => b.id === effectiveBranchId);
    if (bInA) return bInA.name;
    return effectiveBranchId;
  }, [effectiveBranchId, branches]);

  // Filter orders strictly for the active/selected branch
  const branchOrders = useMemo(() => {
    if (
      !effectiveBranchId ||
      effectiveBranchId === "all" ||
      effectiveBranchId.toLowerCase() === "all branches"
    ) {
      return orders;
    }
    return orders.filter((order) => isOrderMatchingBranch(order, effectiveBranchId, branches));
  }, [orders, effectiveBranchId, branches]);

  // Counts calculated specifically for this branch
  const activeCount = useMemo(
    () => branchOrders.filter((o) => o.status !== "received").length,
    [branchOrders],
  );
  const totalCount = branchOrders.length;
  const receivedCount = useMemo(
    () => branchOrders.filter((o) => o.status === "received").length,
    [branchOrders],
  );

  // Filtered POs by status tab and search query
  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return branchOrders.filter((order) => {
      // Status filter
      if (statusFilter === "active" && order.status === "received") {
        return false;
      }
      if (statusFilter === "received" && order.status !== "received") {
        return false;
      }

      // Search query
      if (!q) return true;
      const matchId = order.id.toLowerCase().includes(q);
      const matchSup = order.supplierName.toLowerCase().includes(q);
      const matchBranch = order.branchName.toLowerCase().includes(q);
      const matchDate = (order.orderDate || "").toLowerCase().includes(q);
      const matchCreator = (order.createdBy || "").toLowerCase().includes(q);
      const matchItem = order.items.some(
        (it) =>
          it.productName.toLowerCase().includes(q) || it.productCode.toLowerCase().includes(q),
      );

      return matchId || matchSup || matchBranch || matchDate || matchCreator || matchItem;
    });
  }, [branchOrders, statusFilter, searchQuery]);

  const getStatusBadge = (status: PurchaseOrder["status"]) => {
    switch (status) {
      case "received":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-0 text-[10px] font-bold">
            <CheckCircle2 className="w-3 h-3 mr-1" /> ตรวจรับแล้ว
          </Badge>
        );
      case "submitted":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-0 text-[10px] font-bold">
            <Clock className="w-3 h-3 mr-1" /> รอตรวจรับ (Submitted)
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-0 text-[10px] font-bold">
            <Sparkles className="w-3 h-3 mr-1" /> อนุมัติแล้ว
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="destructive" className="text-[10px] font-bold">
            ยกเลิก
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-bold">
            แบบร่าง (Draft)
          </Badge>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl rounded-3xl p-6 max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="pb-2 border-b border-border/70">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2 flex-wrap">
                  <span>นำเข้าข้อมูลจากใบสั่งซื้อ (Import from PO)</span>
                  <Badge
                    variant="secondary"
                    className="gap-1 px-2.5 py-0.5 text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                  >
                    <Building2 className="w-3 h-3" />
                    <span>สาขา: {branchDisplayName}</span>
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  เลือกใบสั่งซื้อของ{" "}
                  <strong className="text-foreground">{branchDisplayName}</strong> จาก Database A
                  เพื่อดึงรายการวัตถุดิบและจำนวนสั่งซื้อเข้าสู่แบบฟอร์มตรวจรับอัตโนมัติ
                </DialogDescription>
              </div>
            </div>

            <Badge
              variant="outline"
              className="gap-1.5 px-3 py-1 font-mono text-xs hidden sm:flex shrink-0"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Database A (Real-time)
            </Badge>
          </div>
        </DialogHeader>

        {/* Filter and Search Bar */}
        <div className="pt-3 pb-2 space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Status tabs */}
            <div className="flex items-center p-1 bg-muted/60 rounded-xl border border-border text-xs font-semibold w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === "active"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>รอตรวจรับ (Active)</span>
                <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px]">
                  {activeCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ทั้งหมด ({totalCount})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("received")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === "received"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ตรวจรับแล้ว ({receivedCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาเลขที่ PO, ซัพพลายเออร์, วัตถุดิบ..."
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* PO List Grid / Table */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[300px]">
          {isLoading ? (
            <div className="py-20 text-center text-muted-foreground space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-emerald-600" />
              <p className="text-xs font-bold">กำลังโหลดรายการใบสั่งซื้อจาก Database A...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-border/80 rounded-2xl p-6">
              <Package className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm font-bold text-foreground">
                {branchOrders.length === 0
                  ? `ไม่พบใบสั่งซื้อสำหรับ "${branchDisplayName}"`
                  : "ไม่พบใบสั่งซื้อตามเงื่อนไขที่ค้นหา"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {branchOrders.length === 0
                  ? "ยังไม่มีรายการใบสั่งซื้อของสาขานี้ในระบบ Database A คุณสามารถสร้างใบสั่งซื้อใหม่ได้ที่หน้า 'จัดซื้อวัตถุดิบ'"
                  : statusFilter === "active"
                    ? "ไม่มีใบสั่งซื้อที่ค้างรอตรวจรับ คุณสามารถเลือกแท็บ 'ทั้งหมด' หรือเปลี่ยนคำค้นหา"
                    : "ลองค้นหาด้วยคำค้นอื่น หรือเปลี่ยนตัวกรองสถานะ"}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredOrders.map((order) => {
                const totalUnits = order.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
                const isSelected = selectedPreviewPo?.id === order.id;

                return (
                  <div
                    key={order.id}
                    className={`rounded-2xl border transition-all p-4 ${
                      order.status === "received"
                        ? "bg-muted/30 border-border/60 opacity-80"
                        : "bg-card hover:bg-muted/20 border-border/80 hover:border-emerald-500/50 shadow-xs"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-black text-foreground bg-muted px-2 py-0.5 rounded-lg border border-border">
                            {order.id}
                          </span>
                          {getStatusBadge(order.status)}
                          <span className="text-xs font-bold text-foreground">
                            {order.supplierName}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                            {order.branchName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            สั่ง: {formatDate(order.orderDate)}
                          </span>
                          {order.expectedReceivedDate && (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                              <Clock className="w-3.5 h-3.5" />
                              กำหนดส่ง: {formatDate(order.expectedReceivedDate)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            ผู้สั่ง: {order.createdBy || "-"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/50">
                        <div className="text-left md:text-right">
                          <div className="text-xs text-muted-foreground">
                            {order.items.length} รายการ ({totalUnits} หน่วย)
                          </div>
                          <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                            ฿{(order.totalAmount || 0).toLocaleString()}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedPreviewPo(isSelected ? null : order)}
                            className="rounded-xl text-xs h-9 px-3 gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isSelected ? "ซ่อน" : "ดูรายการ"}</span>
                          </Button>

                          <Button
                            type="button"
                            onClick={() => {
                              onSelectPo(order);
                              onClose();
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold h-9 px-4 gap-1.5 shadow-xs cursor-pointer"
                          >
                            <span>นำเข้าข้อมูล (Import)</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Preview Section */}
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-border/60 bg-muted/40 p-3 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center justify-between font-bold text-muted-foreground">
                          <span>รายการวัตถุดิบในใบสั่งซื้อ ({order.items.length} รายการ):</span>
                          {order.notes && (
                            <span className="text-[11px] font-normal italic">
                              หมายเหตุ: {order.notes}
                            </span>
                          )}
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-border/60 text-muted-foreground font-semibold">
                                <th className="py-1 px-2">รหัส</th>
                                <th className="py-1 px-2">ชื่อวัตถุดิบ</th>
                                <th className="py-1 px-2 text-right">จำนวนที่สั่ง</th>
                                <th className="py-1 px-2 text-right">ราคา/หน่วย</th>
                                <th className="py-1 px-2 text-right">ราคารวม</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              {order.items.map((it, idx) => (
                                <tr key={idx} className="hover:bg-muted/50">
                                  <td className="py-1.5 px-2 font-mono text-[11px]">
                                    {it.productCode}
                                  </td>
                                  <td className="py-1.5 px-2 font-semibold">{it.productName}</td>
                                  <td className="py-1.5 px-2 text-right font-black text-foreground">
                                    {it.quantity} {it.unit}
                                  </td>
                                  <td className="py-1.5 px-2 text-right text-muted-foreground">
                                    ฿{it.unitPrice.toLocaleString()}
                                  </td>
                                  <td className="py-1.5 px-2 text-right font-bold text-emerald-600">
                                    ฿{(it.quantity * it.unitPrice).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
