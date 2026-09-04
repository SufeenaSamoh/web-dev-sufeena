import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "@/lib/store";
import { formatDateTime } from "@/lib/dateFormat";
import { ProductionBatch, ProductionRecipe, Item } from "@/lib/types";
import { toast } from "sonner";
import { Link, useSearch } from "@tanstack/react-router";
import {
  Flame,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronRight,
  CookingPot,
  Scale,
  Calendar,
  Building2,
  User,
  History,
  FileSpreadsheet,
  ArrowRight,
  Package,
  Layers,
  Sparkles,
  RefreshCw,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as XLSX from "xlsx";
import { convertRecipeToStockUnit } from "@/lib/unitConversion";

export function ProductionBatchPage() {
  const {
    productionBatches,
    productionRecipes,
    items,
    branches,
    selectedBranchId,
    currentUser,
    recordProductionBatch,
    currentStock,
    refreshProductionData,
  } = useStore();

  // URL search param if directed from recipe page
  const searchParams = useSearch({ strict: false }) as { itemCode?: string };

  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [itemFilter, setItemFilter] = useState<string>("all");
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});

  // Production Form Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [formItemCode, setFormItemCode] = useState("");
  const [formBatchQty, setFormBatchQty] = useState("1");
  const [formBranchId, setFormBranchId] = useState("");
  const [formProducedAt, setFormProducedAt] = useState(
    new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:mm
  );
  const [formNote, setFormNote] = useState("");

  // Map items for fast lookup
  const itemMap = useMemo(() => {
    const map = new Map<string, Item>();
    items.forEach((it) => map.set(it.code.toUpperCase(), it));
    return map;
  }, [items]);

  // Active recipes list
  const activeRecipes = useMemo(() => {
    return productionRecipes.filter((r) => r.active);
  }, [productionRecipes]);

  // Sync initial itemCode from URL search
  useEffect(() => {
    if (searchParams?.itemCode) {
      setFormItemCode(searchParams.itemCode);
      setIsRecordModalOpen(true);
    }
  }, [searchParams]);

  // Initialize branch when opening modal
  const handleOpenRecordModal = (defaultCode?: string) => {
    const initialCode =
      defaultCode || (activeRecipes.length > 0 ? activeRecipes[0].producedItemCode : "");
    setFormItemCode(initialCode);

    const targetBranch =
      selectedBranchId && selectedBranchId !== "all" ? selectedBranchId : branches[0]?.id || "";
    setFormBranchId(targetBranch);

    const rec = activeRecipes.find(
      (r) => r.producedItemCode.toUpperCase() === initialCode.toUpperCase(),
    );
    setFormBatchQty(rec ? String(rec.yieldQuantity) : "1");
    setFormProducedAt(new Date().toISOString().slice(0, 16));
    setFormNote("");
    setIsRecordModalOpen(true);
  };

  // Selected Recipe for current form
  const selectedRecipe = useMemo(() => {
    if (!formItemCode) return null;
    return activeRecipes.find(
      (r) => r.producedItemCode.toUpperCase() === formItemCode.trim().toUpperCase(),
    );
  }, [formItemCode, activeRecipes]);

  // Real-time BOM Calculation preview for entered quantity
  const bomCalculationPreview = useMemo(() => {
    if (!selectedRecipe || selectedRecipe.yieldQuantity <= 0) return [];
    const qty = Number(formBatchQty) || 0;
    if (qty <= 0) return [];

    const scaleRatio = qty / selectedRecipe.yieldQuantity;

    return (selectedRecipe.ingredients || []).map((ing) => {
      const ingCode = (ing?.ingredientCode || "").toUpperCase();
      const ingItem = itemMap.get(ingCode);
      const neededRawQty = (ing?.quantity || 0) * scaleRatio;

      let neededStockQty = neededRawQty;
      if (ingItem && ingItem.recipeUnit && ingItem.stockUnit && ingItem.conversionFactor) {
        if (ing?.unit && ing.unit.toLowerCase() === ingItem.recipeUnit.toLowerCase()) {
          neededStockQty = convertRecipeToStockUnit(neededRawQty, ingItem);
        }
      }

      // Check branch stock
      const stock = ingItem ? currentStock(ingItem.id) : 0;
      const isSufficient = stock >= neededStockQty;

      return {
        ingredientCode: ingCode,
        ingredientName: ing?.ingredientName || ingItem?.name || ingCode,
        neededRawQty,
        neededStockQty,
        unit: ing?.unit || "",
        stockUnit: ingItem?.stockUnit || ingItem?.unit || ing?.unit || "",
        currentStock: stock,
        isSufficient,
      };
    });
  }, [selectedRecipe, formBatchQty, itemMap, currentStock]);

  // Has any stock warnings
  const hasInsufficientStock = useMemo(() => {
    return bomCalculationPreview.some((b) => !b.isSufficient);
  }, [bomCalculationPreview]);

  // Handle submit batch
  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formItemCode) {
      toast.error("กรุณาเลือกสินค้ากึ่งสำเร็จรูปที่ต้องการผลิต");
      return;
    }

    const qty = Number(formBatchQty);
    if (!qty || qty <= 0) {
      toast.error("ปริมาณการผลิตต้องมากกว่า 0");
      return;
    }

    const branch = branches.find((b) => b.id === formBranchId);
    const branchName = branch ? branch.name : "ครัวกลาง / สาขา";

    setIsSubmitting(true);
    try {
      const res = await recordProductionBatch({
        producedItemCode: formItemCode,
        batchQuantity: qty,
        producedAt: new Date(formProducedAt).toISOString(),
        branchId: formBranchId || undefined,
        branchName,
        note: formNote.trim(),
        createdBy: currentUser?.name || "Staff",
      });

      if (res.success) {
        const producedName = itemMap.get(formItemCode.toUpperCase())?.name || formItemCode;

        if (res.warnings && res.warnings.length > 0) {
          toast.warning(
            `บันทึกการผลิต ${producedName} (${qty} ${selectedRecipe?.yieldUnit || "หน่วย"}) สำเร็จ (มีวัตถุดิบบางตัวติดลบ)`,
          );
        } else {
          toast.success(
            `บันทึกการผลิตและตัดสต็อกวัตถุดิบ ${producedName} (${qty} ${selectedRecipe?.yieldUnit || "หน่วย"}) เรียบร้อยแล้ว`,
          );
        }
        setIsRecordModalOpen(false);
      } else {
        toast.error(res.error || "เกิดข้อผิดพลาดในการบันทึกการผลิต");
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Batch History
  const filteredBatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return productionBatches.filter((b) => {
      const matchesSearch =
        !q ||
        b.producedItemCode.toLowerCase().includes(q) ||
        (b.producedItemName && b.producedItemName.toLowerCase().includes(q)) ||
        (b.branchName && b.branchName.toLowerCase().includes(q)) ||
        (b.note && b.note.toLowerCase().includes(q)) ||
        (b.createdBy && b.createdBy.toLowerCase().includes(q));

      const matchesBranch = branchFilter === "all" || b.branchId === branchFilter;

      const matchesItem =
        itemFilter === "all" || b.producedItemCode.toUpperCase() === itemFilter.toUpperCase();

      return matchesSearch && matchesBranch && matchesItem;
    });
  }, [productionBatches, searchQuery, branchFilter, itemFilter]);

  // Export history to Excel
  const handleExportExcel = () => {
    if (filteredBatches.length === 0) {
      toast.warning("ไม่มีข้อมูลการผลิตให้ส่งออก");
      return;
    }

    const rows = filteredBatches.map((b) => ({
      วันที่ผลิต: formatDateTime(b.producedAt),
      สาขา: b.branchName || "-",
      รหัสสินค้าที่ผลิต: b.producedItemCode,
      ชื่อสินค้าที่ผลิต: b.producedItemName || "-",
      จำนวนที่ผลิตได้: b.batchQuantity,
      หน่วย: b.yieldUnit,
      ผู้บันทึก: b.createdBy,
      หมายเหตุ: b.note || "",
      จำนวนวัตถุดิบที่ตัดใช้: b.consumptions?.length || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Production_Batches");
    XLSX.writeFile(wb, `Production_Batches_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("ส่งออกข้อมูลประวัติการผลิตสำเร็จ");
  };

  const toggleExpand = (id: string) => {
    setExpandedBatches((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              บันทึกการผลิตสินค้า (Production Batches)
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            บันทึกการปรุงและผลิตซอส/สินค้ากึ่งสำเร็จรูป ระบบจะคำนวณสัดส่วนและตัดสต็อกวัตถุดิบตั้งต้น
            (Raw Items) พร้อมเพิ่มสต็อกสินค้าสำเร็จรูป (Prepared Items) ทันที
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshProductionData()}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            รีเฟรช
          </Button>

          <Link to="/production-recipes">
            <Button variant="outline" size="sm" className="flex items-center gap-1.5">
              <CookingPot className="h-4 w-4 text-primary" />
              จัดการสูตรผลิต (BOM Recipes)
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            ส่งออก Excel
          </Button>

          <Button
            onClick={() => handleOpenRecordModal()}
            size="sm"
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
          >
            <Flame className="h-4 w-4" />
            บันทึกการผลิตใหม่
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">บันทึกการผลิตทั้งหมด</span>
            <History className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold">{productionBatches.length}</p>
          <span className="text-xs text-muted-foreground">รอบการผลิตที่บันทึกไว้ในระบบ</span>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              สูตรผลิตที่พร้อมใช้งาน
            </span>
            <CookingPot className="h-5 w-5 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600">{activeRecipes.length}</p>
          <span className="text-xs text-muted-foreground">สูตรที่กำหนดไว้ใน Production BOM</span>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">การผลิตล่าสุด</span>
            <Clock className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-2 text-sm font-bold text-foreground">
            {productionBatches.length > 0
              ? formatDateTime(productionBatches[0].producedAt)
              : "ยังไม่มีข้อมูล"}
          </p>
          <span className="text-xs text-muted-foreground">
            {productionBatches.length > 0
              ? `${productionBatches[0].producedItemName || productionBatches[0].producedItemCode} (${productionBatches[0].batchQuantity} ${productionBatches[0].yieldUnit})`
              : "-"}
          </span>
        </div>
      </div>

      {/* Quick Produce Banner if active recipes exist */}
      {activeRecipes.length > 0 && (
        <div className="rounded-2xl border bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-500/20 p-2.5 text-amber-600 dark:text-amber-400">
                <Flame className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm sm:text-base">
                  ผลิตด่วนตามสูตรมาตรฐาน (Quick Production)
                </h3>
                <p className="text-xs text-muted-foreground">
                  คลิกที่รายการสินค้ากึ่งสำเร็จรูปด้านล่างเพื่อเริ่มบันทึกการผลิตทันที
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeRecipes.slice(0, 4).map((r) => {
                const it = itemMap.get(r.producedItemCode.toUpperCase());
                return (
                  <Button
                    key={r.id}
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenRecordModal(r.producedItemCode)}
                    className="h-8 text-xs bg-background/80 hover:bg-amber-500/10 hover:border-amber-500/50"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5 text-amber-500" />
                    {it ? it.name : r.producedItemCode}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border bg-card p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ค้นหาชื่อสินค้า, รหัส, สาขา, หรือผู้บันทึก..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Branch Filter */}
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">ทุกสาขา / ครัวกลาง</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Item Filter */}
          <select
            value={itemFilter}
            onChange={(e) => setItemFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">สินค้าที่ผลิตทั้งหมด</option>
            {activeRecipes.map((r) => {
              const it = itemMap.get(r.producedItemCode.toUpperCase());
              return (
                <option key={r.id} value={r.producedItemCode}>
                  {it ? it.name : r.producedItemCode}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Production Batches History Table */}
      {filteredBatches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card p-12 text-center">
          <Flame className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <h3 className="text-lg font-semibold text-foreground">ไม่พบประวัติการผลิต</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            {searchQuery || branchFilter !== "all" || itemFilter !== "all"
              ? "ไม่พบข้อมูลที่ตรงกับตัวกรอง ลองเปลี่ยนคำค้นหา"
              : "ยังไม่มีการบันทึกการผลิต คลิกปุ่มด้านล่างเพื่อเริ่มบันทึกรอบแรก"}
          </p>
          <Button onClick={() => handleOpenRecordModal()} className="mt-4" size="sm">
            <Flame className="mr-1.5 h-4 w-4" />
            บันทึกการผลิตใหม่
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBatches.map((batch) => {
            const isExpanded = expandedBatches[batch.id] || false;
            const pItem = itemMap.get(batch.producedItemCode.toUpperCase());

            return (
              <div
                key={batch.id}
                className="overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:border-amber-500/30"
              >
                {/* Batch Header Summary */}
                <div
                  onClick={() => toggleExpand(batch.id)}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 cursor-pointer hover:bg-muted/30 gap-3"
                >
                  <div className="flex items-center gap-3">
                    <button
                      className="rounded-md p-1 hover:bg-muted text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(batch.id);
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </button>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-base">
                          {batch.producedItemName || pItem?.name || batch.producedItemCode}
                        </span>
                        <Badge variant="outline" className="font-mono text-xs">
                          {batch.producedItemCode}
                        </Badge>
                        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs">
                          +{batch.batchQuantity} {batch.yieldUnit}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDateTime(batch.producedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {batch.branchName || "ครัวกลาง / สาขา"}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {batch.createdBy}
                        </span>
                        {batch.note && <span>• {batch.note}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
                      ตัดใช้วัตถุดิบ {batch.consumptions?.length || 0} รายการ
                    </span>
                  </div>
                </div>

                {/* Batch Consumptions Breakdown */}
                {isExpanded && batch.consumptions && batch.consumptions.length > 0 && (
                  <div className="border-t bg-muted/10 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        รายละเอียดวัตถุดิบที่ถูกตัดออกจากสต็อกในรอบการผลิตนี้
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-lg border bg-background">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/40 font-medium text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">ลำดับ</th>
                            <th className="px-3 py-2">รหัสวัตถุดิบ</th>
                            <th className="px-3 py-2">ชื่อวัตถุดิบ</th>
                            <th className="px-3 py-2 text-right">จำนวนที่ตัดสต็อก (Consumed)</th>
                            <th className="px-3 py-2">หน่วย</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {batch.consumptions.map((cons, cIdx) => {
                            const cItem = itemMap.get(cons.ingredientCode.toUpperCase());
                            return (
                              <tr key={cons.id || cIdx} className="hover:bg-muted/20">
                                <td className="px-3 py-2 text-muted-foreground">{cIdx + 1}</td>
                                <td className="px-3 py-2 font-mono font-medium">
                                  {cons.ingredientCode}
                                </td>
                                <td className="px-3 py-2 font-medium text-foreground">
                                  {cons.ingredientName || cItem?.name || "-"}
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-rose-600 dark:text-rose-400">
                                  -
                                  {cons.quantityConsumed.toLocaleString(undefined, {
                                    maximumFractionDigits: 4,
                                  })}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">{cons.unit}</td>
                              </tr>
                            );
                          })}
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

      {/* Record Production Batch Modal */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-background p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-amber-500/20 p-2 text-amber-600">
                  <Flame className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    บันทึกการผลิตสินค้า (Record Production Batch)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    ตัดสต็อกวัตถุดิบและเพิ่มสต็อกสินค้ากึ่งสำเร็จรูปตามสูตร BOM
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRecordModalOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitBatch} className="mt-4 space-y-4">
              {/* Branch & Produced Item */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    สาขาที่ทำการผลิต <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formBranchId}
                    onChange={(e) => setFormBranchId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    สินค้าที่ต้องการผลิต (Prepared Item) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formItemCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      setFormItemCode(code);
                      const rec = activeRecipes.find(
                        (r) => r.producedItemCode.toUpperCase() === code.toUpperCase(),
                      );
                      if (rec) {
                        setFormBatchQty(String(rec.yieldQuantity));
                      }
                    }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">-- เลือกสินค้าที่ต้องการผลิต --</option>
                    {activeRecipes.map((r) => {
                      const it = itemMap.get(r.producedItemCode.toUpperCase());
                      return (
                        <option key={r.id} value={r.producedItemCode}>
                          {it ? it.name : r.producedItemCode} (สูตร: {r.yieldQuantity} {r.yieldUnit}
                          )
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Quantity & Date */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    จำนวนที่ผลิตได้ในรอบนี้ (Batch Quantity){" "}
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="any"
                      min="0.0001"
                      value={formBatchQty}
                      onChange={(e) => setFormBatchQty(e.target.value)}
                      placeholder="ระบุจำนวนที่ผลิต"
                      className="font-bold text-base"
                      required
                    />
                    <span className="text-sm font-medium text-muted-foreground min-w-[50px]">
                      {selectedRecipe?.yieldUnit || "หน่วย"}
                    </span>
                  </div>
                  {selectedRecipe && (
                    <span className="text-[11px] text-muted-foreground">
                      (1 สูตรมาตรฐาน = {selectedRecipe.yieldQuantity} {selectedRecipe.yieldUnit})
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    วันที่และเวลาที่ผลิต <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="datetime-local"
                    value={formProducedAt}
                    onChange={(e) => setFormProducedAt(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">หมายเหตุการผลิต</label>
                <Input
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="เช่น ผลิตสต็อกเสริมสำหรับวันหยุด, ล็อตประจำสัปดาห์"
                />
              </div>

              {/* BOM Real-time Calculation Breakdown Preview */}
              {selectedRecipe && bomCalculationPreview.length > 0 && (
                <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
                      <Scale className="h-4 w-4 text-amber-500" />
                      <span>รายการวัตถุดิบที่จะถูกตัดสต็อกจริง (BOM Calculation)</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      สเกล: {(Number(formBatchQty) / selectedRecipe.yieldQuantity).toFixed(2)}x
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-lg border bg-background">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/40 font-medium text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">วัตถุดิบ</th>
                          <th className="px-3 py-2 text-right">ปริมาณที่ต้องใช้</th>
                          <th className="px-3 py-2 text-right">สต็อกปัจจุบัน</th>
                          <th className="px-3 py-2 text-center">สถานะสต็อก</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {bomCalculationPreview.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            <td className="px-3 py-2">
                              <div className="font-medium text-foreground">
                                {item.ingredientName}
                              </div>
                              <div className="font-mono text-[10px] text-muted-foreground">
                                {item.ingredientCode}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-rose-600 dark:text-rose-400">
                              -
                              {item.neededStockQty.toLocaleString(undefined, {
                                maximumFractionDigits: 4,
                              })}{" "}
                              {item.stockUnit}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                              {item.currentStock.toLocaleString(undefined, {
                                maximumFractionDigits: 2,
                              })}{" "}
                              {item.stockUnit}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {item.isSufficient ? (
                                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0.5">
                                  เพียงพอ
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0.5">
                                  ไม่เพียงพอ
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {hasInsufficientStock && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        มีวัตถุดิบบางรายการที่มีในสต็อกน้อยกว่าปริมาณที่ต้องใช้
                        ระบบจะทำการตัดสต็อกตามจริง (อาจทำให้สต็อกวัตถุดิบติดลบ)
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRecordModalOpen(false)}
                  disabled={isSubmitting}
                  size="sm"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !selectedRecipe}
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
                >
                  <Flame className="h-4 w-4" />
                  {isSubmitting ? "กำลังบันทึกและตัดสต็อก..." : "ยืนยันการผลิตและตัดสต็อก"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
