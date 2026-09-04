import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useStore, formatCurrency } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  calculateExpiryDate,
  calculateFinalCost,
  generateLotCode,
  calculateItemVat,
  isPackagingOrConsumable,
  VAT_MODE_OPTIONS,
  VAT_MODE_LABELS,
  normalizeVatMode,
  type VatMode,
} from "@/lib/receiving-utils";
import {
  Plus,
  Trash2,
  Save,
  Sparkles,
  CheckCircle2,
  Search,
  ArrowRight,
  FileText,
  Truck,
  Building2,
  X,
  AlertTriangle,
  RotateCcw,
  CheckCheck,
  PackageCheck,
  Receipt,
  Calculator,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ImportPoModal } from "./ImportPoModal";
import { SearchableSupplierSelector } from "./SearchableSupplierSelector";
import type { PurchaseOrder } from "../purchase/types";
import { updateOrderStatusInDatabaseA } from "@/services/purchaseDbA";
import { formatDate } from "@/lib/dateFormat";

const LS_SUPPLIER_KEY = "smart_receiving_supplier_id";
const LS_EMPLOYEE_KEY = "smart_receiving_employee";

export interface ReceivingGridRow {
  rowId: string;
  itemId: string;
  code: string;
  name: string;
  unit: string;
  qty: string; // Received Quantity (editable)
  orderedQty?: number; // Ordered Quantity from PO (if imported)
  enteredCost: string;
  vatMode: VatMode;
  calculatedExpiry: string;
  expiryDate: string;
  originalCost: number;
  shelfLife: number;
  shelfLifeUnit: "Day" | "Month" | "Year";
  hasExpiry?: boolean;
  lotCode: string;
  poProductCode?: string;
}

export function SmartReceivingForm({ onSaved }: { onSaved?: () => void }) {
  const {
    items,
    suppliers,
    branches,
    categories,
    purchases,
    addPurchase,
    addItem,
    settings,
    selectedBranchId,
    setSelectedBranchId,
    currentUser,
  } = useStore();

  // LocalStorage Auto-Save / Restore for Supplier, Employee
  const [supplierId, setSupplierId] = useState<string>("");
  const [employee, setEmployee] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSupplierId(localStorage.getItem(LS_SUPPLIER_KEY) || "");
      setEmployee(localStorage.getItem(LS_EMPLOYEE_KEY) || "");
    }
  }, []);

  // Date, Invoice, PO Number
  const [receivingDate, setReceivingDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [invoice, setInvoice] = useState("");
  const [poNumber, setPoNumber] = useState("");

  // Imported PO State
  const [importedPo, setImportedPo] = useState<PurchaseOrder | null>(null);
  const [isImportPoModalOpen, setIsImportPoModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [gridRows, setGridRows] = useState<ReceivingGridRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Focus Refs
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const qtyInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const costInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const vatSelectRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const expiryInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Auto-fill fallback for Supplier if localStorage was empty
  useEffect(() => {
    if (!supplierId && suppliers.length > 0) {
      setSupplierId(suppliers[0].id);
      localStorage.setItem(LS_SUPPLIER_KEY, suppliers[0].id);
    }
  }, [suppliers, supplierId]);

  // Sync state changes to LocalStorage
  const handleSupplierChange = (id: string) => {
    setSupplierId(id);
    localStorage.setItem(LS_SUPPLIER_KEY, id);
  };

  const handleEmployeeChange = (val: string) => {
    setEmployee(val);
    localStorage.setItem(LS_EMPLOYEE_KEY, val);
  };

  // Pre-calculate latest purchase price map for O(1) performance
  const latestPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    const sorted = [...purchases].sort(
      (a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime(),
    );
    for (const p of sorted) {
      for (const it of p.items) {
        if (!map.has(it.itemId) && it.unitPrice != null && it.unitPrice > 0) {
          map.set(it.itemId, it.unitPrice);
        }
      }
    }
    return map;
  }, [purchases]);

  // Smart Search: Filter simultaneously by Code, Barcode, Item Name
  const availableItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return items.filter((i) => i.active).slice(0, 50);

    return items.filter((i) => {
      if (!i.active) return false;
      const matchName = i.name.toLowerCase().includes(q);
      const matchCode = i.code.toLowerCase().includes(q);
      const matchBarcode = (i.barcode ?? "").toLowerCase().includes(q);
      return matchName || matchCode || matchBarcode;
    });
  }, [items, searchQuery]);

  // Focus Qty Input helper
  const focusQtyInput = useCallback((rowId: string) => {
    setTimeout(() => {
      const el = qtyInputRefs.current[rowId];
      if (el) {
        el.focus();
        el.select();
      }
    }, 30);
  }, []);

  // Helper to determine shelf life & unit (e.g. 1 Year for Packaging/Consumables)
  const resolveItemShelfLife = useCallback(
    (item: {
      name?: string;
      categoryId?: string;
      defaultShelfLife?: number;
      shelfLifeDays?: number;
      shelfLifeUnit?: "Day" | "Month" | "Year";
      hasExpiry?: boolean;
    }) => {
      const catObj = categories.find((c) => c.id === item.categoryId);
      const isPkg = isPackagingOrConsumable(item.name) || isPackagingOrConsumable(catObj?.name);

      const hasExpiry = item.hasExpiry !== false;
      const shelfLife = item.defaultShelfLife ?? item.shelfLifeDays ?? (isPkg ? 1 : 30);
      const shelfLifeUnit: "Day" | "Month" | "Year" =
        item.shelfLifeUnit ?? (isPkg ? "Year" : "Day");

      return { hasExpiry, shelfLife, shelfLifeUnit };
    },
    [categories],
  );

  // Handle PO Selection and Auto-Populate
  const handleSelectPo = useCallback(
    async (order: PurchaseOrder) => {
      setImportedPo(order);
      setPoNumber(order.id);

      // Pre-fill invoice number if empty
      if (!invoice) {
        setInvoice(`INV-${order.id.replace(/^PO-/, "")}`);
      }

      // Pre-fill employee if empty
      if (!employee) {
        const empName = order.createdBy || currentUser?.name || "ผู้จัดการสาขา";
        setEmployee(empName);
        localStorage.setItem(LS_EMPLOYEE_KEY, empName);
      }

      // Match Supplier in Database B
      const matchedSup = suppliers.find(
        (s) =>
          s.id === order.supplierId ||
          s.name.toLowerCase().includes(order.supplierName.toLowerCase()) ||
          order.supplierName.toLowerCase().includes(s.name.toLowerCase()),
      );
      if (matchedSup) {
        setSupplierId(matchedSup.id);
        localStorage.setItem(LS_SUPPLIER_KEY, matchedSup.id);
      }

      // Match Branch in Database B
      const matchedBranch = branches.find(
        (b) =>
          b.id === order.branchId ||
          b.name.toLowerCase().includes(order.branchName.toLowerCase()) ||
          order.branchName.toLowerCase().includes(b.name.toLowerCase()),
      );
      if (matchedBranch && setSelectedBranchId) {
        setSelectedBranchId(matchedBranch.id);
      }

      // Populate grid rows from PO items
      const newRows: ReceivingGridRow[] = [];

      for (let i = 0; i < order.items.length; i++) {
        const poItem = order.items[i];

        // Match with Database B items
        const matchedItem = items.find(
          (dbItem) =>
            dbItem.code.toLowerCase() === poItem.productCode.toLowerCase() ||
            dbItem.name.toLowerCase() === poItem.productName.toLowerCase() ||
            dbItem.name.toLowerCase().includes(poItem.productName.toLowerCase()),
        );

        // If not found in Database B, create a virtual or fallback item reference
        const targetItemId = matchedItem?.id || `TEMP-${poItem.productCode}`;
        const unit = matchedItem?.unit || poItem.unit || "กก.";

        const { hasExpiry, shelfLife, shelfLifeUnit } = resolveItemShelfLife(
          matchedItem || { name: poItem.productName, defaultShelfLife: 30, shelfLifeUnit: "Day" },
        );

        const autoExpiry = hasExpiry
          ? calculateExpiryDate(receivingDate, shelfLife, shelfLifeUnit)
          : "";
        const lotCode = generateLotCode(poItem.productCode || "RAW", receivingDate);
        const unitPrice = poItem.unitPrice || matchedItem?.purchasePrice || 0;

        newRows.push({
          rowId: `po-${order.id}-${i}-${Date.now()}`,
          itemId: targetItemId,
          code: poItem.productCode,
          name: poItem.productName,
          unit: unit,
          qty: String(poItem.quantity), // Default Received Qty = Ordered Qty
          orderedQty: poItem.quantity, // Preserve Ordered Qty
          enteredCost: unitPrice > 0 ? unitPrice.toFixed(2) : "0.00",
          vatMode: "INCLUDED",
          calculatedExpiry: autoExpiry,
          expiryDate: autoExpiry,
          originalCost: unitPrice,
          shelfLife,
          shelfLifeUnit,
          hasExpiry,
          lotCode,
          poProductCode: poItem.productCode,
        });
      }

      setGridRows(newRows);
      toast.success(
        `นำเข้าข้อมูลจากใบสั่งซื้อ ${order.id} เรียบร้อยแล้ว (${order.items.length} รายการ)`,
        {
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
        },
      );
    },
    [
      invoice,
      employee,
      currentUser,
      suppliers,
      branches,
      setSelectedBranchId,
      items,
      receivingDate,
      resolveItemShelfLife,
    ],
  );

  // Quick Action: Auto-Fill All to 100% of Ordered Qty
  const handleReceiveAllFull = () => {
    setGridRows((prev) =>
      prev.map((r) => ({
        ...r,
        qty: r.orderedQty !== undefined ? String(r.orderedQty) : r.qty,
      })),
    );
    toast.info("ปรับจำนวนรับจริงเป็น 100% ตามใบสั่งซื้อทุกรายการแล้ว");
  };

  // Quick Action: Reset All Received Qty to 0
  const handleResetAllToZero = () => {
    setGridRows((prev) =>
      prev.map((r) => ({
        ...r,
        qty: "0",
      })),
    );
    toast.info("ปรับจำนวนรับจริงเป็น 0 ทุกรายการ");
  };

  // Clear Linked PO
  const handleClearPo = () => {
    setImportedPo(null);
    setPoNumber("");
    toast.info("ยกเลิกการเชื่อมโยงใบสั่งซื้อ");
  };

  // Add Item or Handle Duplicate Item
  const handleAddItem = useCallback(
    (itemToSelectId?: string) => {
      if (!itemToSelectId && availableItems.length === 0) return;
      const targetId =
        itemToSelectId || availableItems[highlightedIndex]?.id || availableItems[0]?.id;
      if (!targetId) return;

      const item = items.find((i) => i.id === targetId);
      if (!item) return;

      // Duplicate Check
      const existingIndex = gridRows.findIndex((r) => r.itemId === targetId);

      if (existingIndex !== -1) {
        // DUPLICATE ITEM: Increase Qty by 1
        const existingRow = gridRows[existingIndex];
        const newQty = (Number(existingRow.qty) || 0) + 1;

        setGridRows((prev) =>
          prev.map((r, idx) => (idx === existingIndex ? { ...r, qty: String(newQty) } : r)),
        );

        toast.info(`เพิ่มจำนวน ${item.name} เป็น ${newQty} ${existingRow.unit}`, {
          duration: 1500,
        });
        focusQtyInput(existingRow.rowId);
      } else {
        // NEW ITEM
        const defaultCost =
          latestPriceMap.get(item.id) ??
          (item.purchasePrice && item.purchasePrice > 0 ? item.purchasePrice : 0);

        const { hasExpiry, shelfLife, shelfLifeUnit } = resolveItemShelfLife(item);
        const autoExpiry = hasExpiry
          ? calculateExpiryDate(receivingDate, shelfLife, shelfLifeUnit)
          : "";
        const lotCode = generateLotCode(item.code, receivingDate);

        const newRow: ReceivingGridRow = {
          rowId: `${item.id}-${Date.now()}`,
          itemId: item.id,
          code: item.code,
          name: item.name,
          unit: item.stockUnit || item.unit,
          qty: "1",
          enteredCost: defaultCost > 0 ? defaultCost.toFixed(2) : "0.00",
          vatMode: "INCLUDED",
          calculatedExpiry: autoExpiry,
          expiryDate: autoExpiry,
          originalCost: defaultCost,
          shelfLife,
          shelfLifeUnit,
          hasExpiry,
          lotCode,
        };

        setGridRows((prev) => [...prev, newRow]);
        focusQtyInput(newRow.rowId);
      }

      setSearchQuery("");
      setIsSearchOpen(false);
    },
    [
      availableItems,
      highlightedIndex,
      items,
      gridRows,
      latestPriceMap,
      receivingDate,
      focusQtyInput,
      resolveItemShelfLife,
    ],
  );

  // Keyboard navigation inside search dropdown
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsSearchOpen(true);
      setHighlightedIndex((prev) => (prev >= availableItems.length - 1 ? 0 : prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsSearchOpen(true);
      setHighlightedIndex((prev) => (prev <= 0 ? availableItems.length - 1 : prev - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (availableItems.length > 0) {
        handleAddItem(availableItems[highlightedIndex]?.id || availableItems[0]?.id);
      }
    } else if (e.key === "Escape") {
      setIsSearchOpen(false);
    }
  };

  // Recalculate auto expiry if receiving date changes
  useEffect(() => {
    setGridRows((prev) =>
      prev.map((row) => {
        if (!row.hasExpiry && row.hasExpiry !== undefined) return row;
        const newCalculated = calculateExpiryDate(receivingDate, row.shelfLife, row.shelfLifeUnit);
        const wasAuto = row.expiryDate === row.calculatedExpiry;
        return {
          ...row,
          calculatedExpiry: newCalculated,
          expiryDate: wasAuto ? newCalculated : row.expiryDate,
        };
      }),
    );
  }, [receivingDate]);

  const updateRow = useCallback((rowId: string, patch: Partial<ReceivingGridRow>) => {
    setGridRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }, []);

  const removeRow = useCallback((rowId: string) => {
    setGridRows((prev) => prev.filter((r) => r.rowId !== rowId));
  }, []);

  // Filter out zero/negative rows for calculation & saving
  const activeValidRows = useMemo(() => {
    return gridRows.filter((r) => {
      const q = Number(r.qty);
      return !isNaN(q) && q > 0;
    });
  }, [gridRows]);

  // Live VAT & Financial Summary
  const summary = useMemo(() => {
    const totalItemsCount = activeValidRows.length;
    let totalQty = 0;
    const totalOrderedQty = gridRows.reduce((sum, r) => sum + (r.orderedQty || 0), 0);
    let preVatTotal = 0;
    let totalVat = 0;
    let grandTotal = 0;

    for (const r of activeValidRows) {
      const q = Number(r.qty) || 0;
      const c = Number(r.enteredCost) || 0;
      totalQty += q;
      const vatRes = calculateItemVat(c, q, r.vatMode);
      preVatTotal += vatRes.netTotal;
      totalVat += vatRes.vatTotal;
      grandTotal += vatRes.grossTotal;
    }

    return {
      totalItemsCount,
      totalQty,
      totalOrderedQty,
      preVatTotal: Number(preVatTotal.toFixed(2)),
      totalVat: Number(totalVat.toFixed(2)),
      grandTotal: Number(grandTotal.toFixed(2)),
    };
  }, [activeValidRows, gridRows]);

  // Validation
  const validate = (): string | null => {
    if (!supplierId) return "กรุณาเลือกซัพพลายเออร์ (Supplier)";
    if (!selectedBranchId) return "กรุณาเลือกสาขาที่รับสินค้า";
    if (!invoice.trim()) return "กรุณากรอกเลขที่ใบกำกับสินค้า (Invoice Number)";

    if (activeValidRows.length === 0) {
      return "กรุณาระบุจำนวนรับจริง (Received Qty) มากกว่า 0 อย่างน้อย 1 รายการ";
    }

    for (const r of activeValidRows) {
      const c = Number(r.enteredCost);
      if (isNaN(c) || c < 0) {
        return `ราคาต่อหน่วยของ ${r.name} ไม่ถูกต้อง`;
      }
      if (!r.vatMode) {
        return `กรุณาเลือกประเภทภาษี (VAT) ของ ${r.name}`;
      }
    }
    return null;
  };

  // Save / Confirm Receipt into Database B and update Database A PO status
  const handleSave = async () => {
    const errorMsg = validate();
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Check if any items need to be created in Database B first
      const itemsToSave = [];

      for (const r of activeValidRows) {
        let finalItemId = r.itemId;

        // If item doesn't exist in DB B items list, create or link it
        const exists = items.some((it) => it.id === finalItemId);
        if (!exists) {
          const createRes = await addItem({
            code: r.code || `RAW-${Date.now().toString().slice(-4)}`,
            name: r.name,
            unit: r.unit || "กก.",
            purchasePrice: Number(r.enteredCost) || 0,
            active: true,
            categoryId: "cat-raw",
            supplierId: supplierId || undefined,
            defaultShelfLife: r.shelfLife || 30,
            shelfLifeUnit: r.shelfLifeUnit || "Day",
          });
          if (createRes.success && createRes.item) {
            finalItemId = createRes.item.id;
          }
        }

        const enteredCost = Number(r.enteredCost) || 0;
        const finalCost = calculateFinalCost(enteredCost, r.vatMode);
        const isPriceEdited = Math.abs(enteredCost - r.originalCost) > 0.001;
        const isExpiryEdited = r.expiryDate !== r.calculatedExpiry;

        itemsToSave.push({
          itemId: finalItemId,
          quantity: Number(r.qty),
          unitPrice: finalCost,
          vatType: r.vatMode,
          vatMode: r.vatMode,
          expiryDate: r.expiryDate || undefined,
          originalExpiryDate: r.calculatedExpiry,
          isExpiryEdited,
          isPriceEdited,
          remark: `VAT: ${VAT_MODE_LABELS[r.vatMode] || r.vatMode}${r.lotCode ? ` | Lot: ${r.lotCode}` : ""}${
            r.orderedQty !== undefined ? ` | Ordered: ${r.orderedQty} ${r.unit}` : ""
          }`,
        });
      }

      // 2. Save receiving record to Database B (Main Inventory DB)
      await addPurchase({
        supplierId,
        branchId: selectedBranchId,
        purchaseDate: new Date(receivingDate).toISOString(),
        invoiceNumber: invoice.trim(),
        poNumber: poNumber.trim() || undefined,
        employee: employee.trim() || currentUser?.name || "Staff",
        remark: importedPo
          ? `ตรวจรับจากใบสั่งซื้อ PO: ${importedPo.id} (${importedPo.supplierName})`
          : "รับสินค้าเข้าคลัง",
        items: itemsToSave,
        total: summary.grandTotal,
      });

      // 3. Update Database A Purchase Order status to "received" for audit & traceability
      if (importedPo) {
        await updateOrderStatusInDatabaseA(
          importedPo.id,
          "received",
          receivingDate,
          employee.trim() || currentUser?.name || "เจ้าหน้าที่คลัง",
        );
      }

      toast.success(
        importedPo
          ? `✓ บันทึกรับสินค้าเข้าคลังหลัก (DB B) และอัปเดตสถานะใบสั่งซื้อ ${importedPo.id} (DB A) เป็น "ตรวจรับแล้ว" เรียบร้อย!`
          : `✓ บันทึกใบรับสินค้า ${invoice.trim()} เข้าคลังหลักเรียบร้อยแล้ว`,
        {
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
          duration: 4000,
        },
      );

      // Reset form
      setInvoice("");
      setPoNumber("");
      setImportedPo(null);
      setGridRows([]);

      // Refocus search box
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);

      if (onSaved) onSaved();
    } catch (err: unknown) {
      console.error("Error saving receipt:", err);
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกรับสินค้า";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Header */}
      <Card className="rounded-2xl border-border/70 p-4 shadow-xs bg-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 mb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-extrabold text-foreground">
              แบบฟอร์มตรวจรับสินค้าเข้าคลัง (Goods Receipt Form)
            </h3>
          </div>

          {/* Import from PO Trigger Button */}
          <Button
            type="button"
            onClick={() => setIsImportPoModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold gap-1.5 h-9 px-4 shadow-xs"
          >
            <FileText className="w-4 h-4" />
            <span>นำเข้าจากใบสั่งซื้อ (Import from PO)</span>
          </Button>
        </div>

        {/* PO Link Status Card */}
        {importedPo && (
          <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                    เชื่อมโยงกับใบสั่งซื้อ (Database A):
                  </span>
                  <Badge variant="outline" className="font-mono text-xs font-bold bg-background">
                    {importedPo.id}
                  </Badge>
                </div>
                <div className="text-[11px] text-emerald-800 dark:text-emerald-300">
                  ซัพพลายเออร์: <strong>{importedPo.supplierName}</strong> | สาขา:{" "}
                  <strong>{importedPo.branchName}</strong> | วันที่สั่ง:{" "}
                  {formatDate(importedPo.orderDate)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReceiveAllFull}
                className="h-8 rounded-lg text-xs font-bold gap-1 bg-background"
                title="ปรับจำนวนรับจริงให้ตรงตามสั่ง 100%"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>รับครบ 100%</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetAllToZero}
                className="h-8 rounded-lg text-xs font-medium gap-1 bg-background text-muted-foreground"
                title="ปรับจำนวนรับจริงเป็น 0 ทุกรายการ"
              >
                <RotateCcw className="w-3 h-3" />
                <span>รีเซ็ตเป็น 0</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClearPo}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                title="ยกเลิกการเชื่อมโยง PO"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Input Controls Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Searchable Supplier Selector */}
          <div>
            <Label className="mb-1 block text-xs font-medium text-muted-foreground">
              ซัพพลายเออร์ (Supplier) <span className="text-destructive">*</span>
            </Label>
            <SearchableSupplierSelector
              suppliers={suppliers}
              value={supplierId}
              onChange={handleSupplierChange}
              placeholder="ค้นหาชื่อ หรือรหัส Supplier..."
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-muted-foreground">
              วันที่รับสินค้า (Receiving Date)
            </Label>
            <ThaiDatePicker
              value={receivingDate}
              onChange={setReceivingDate}
              className="h-10 rounded-xl text-sm"
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-muted-foreground">
              เลขที่ใบกำกับสินค้า (Invoice No.) <span className="text-destructive">*</span>
            </Label>
            <Input
              value={invoice}
              onChange={(e) => setInvoice(e.target.value)}
              placeholder="INV-2026-001"
              className="h-10 rounded-xl text-sm font-mono"
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-muted-foreground">
              เลขที่ใบสั่งซื้อ (PO Number)
            </Label>
            <div className="relative">
              <Input
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="PO-BR-01-..."
                className="h-10 rounded-xl text-sm font-mono pr-8"
              />
              {importedPo && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute right-2.5 top-1/2 -translate-y-1/2" />
              )}
            </div>
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-muted-foreground">
              พนักงานผู้รับสินค้า (Received By)
            </Label>
            <Input
              value={employee}
              onChange={(e) => handleEmployeeChange(e.target.value)}
              placeholder="ชื่อพนักงาน"
              className="h-10 rounded-xl text-sm"
            />
          </div>
        </div>
      </Card>

      {/* Smart Search Bar */}
      <Card className="relative rounded-2xl border-border/70 p-3 shadow-xs bg-card/70">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary shrink-0" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
                setHighlightedIndex(0);
              }}
              onFocus={() => setIsSearchOpen(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="ค้นหารหัสสินค้า, บาร์โค้ด หรือชื่อวัตถุดิบ... (กด Enter เพื่อเลือกรายการบนสุด)"
              className="h-11 rounded-xl pl-10 pr-4 font-medium text-sm bg-background shadow-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>

          <Button
            type="button"
            onClick={() => handleAddItem()}
            disabled={availableItems.length === 0}
            className="h-11 rounded-xl px-5 shrink-0 font-medium cursor-pointer"
          >
            <Plus className="mr-1 h-4 w-4" /> เพิ่มสินค้า
          </Button>
        </div>

        {/* Autocomplete Dropdown List */}
        {isSearchOpen && availableItems.length > 0 && (
          <div className="absolute left-3 right-3 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
            {availableItems.map((it, idx) => {
              const { shelfLife, shelfLifeUnit, hasExpiry } = resolveItemShelfLife(it);
              const lastPrice = latestPriceMap.get(it.id) ?? it.purchasePrice ?? 0;
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={it.id}
                  onClick={() => handleAddItem(it.id)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={cn(
                    "flex items-center justify-between gap-4 px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm",
                    isHighlighted
                      ? "bg-accent text-accent-foreground font-semibold"
                      : "hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="font-mono text-xs shrink-0 py-0.5 px-1.5">
                      {it.code}
                    </Badge>
                    {it.barcode && (
                      <span className="font-mono text-xs text-muted-foreground shrink-0">
                        [{it.barcode}]
                      </span>
                    )}
                    <span className="truncate">{it.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">({it.unit})</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    {hasExpiry ? (
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                        อายุ: {shelfLife}{" "}
                        {shelfLifeUnit === "Year"
                          ? "ปี"
                          : shelfLifeUnit === "Month"
                            ? "เดือน"
                            : "วัน"}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 px-1.5 h-4 text-muted-foreground"
                      >
                        ไม่มีวันหมดอายุ
                      </Badge>
                    )}
                    <span className="font-mono font-medium">
                      {lastPrice > 0 ? formatCurrency(lastPrice, settings.currency) : "—"}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Receiving Items Table with Ordered Qty vs Received Qty & Financial Calculation */}
      <Card className="rounded-2xl border-border/70 p-0 shadow-xs overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[90px] text-xs font-semibold uppercase text-muted-foreground py-2.5">
                  รหัส (Code)
                </TableHead>
                <TableHead className="min-w-[160px] text-xs font-semibold uppercase text-muted-foreground py-2.5">
                  รายการวัตถุดิบ (Item Name)
                </TableHead>
                {/* Column: Ordered Qty */}
                <TableHead className="w-[100px] text-right text-xs font-semibold uppercase text-muted-foreground py-2.5">
                  จำนวนสั่ง (PO Qty)
                </TableHead>
                {/* Column: Received Qty */}
                <TableHead className="w-[120px] text-right text-xs font-semibold uppercase text-muted-foreground py-2.5">
                  จำนวนรับจริง (Received Qty) <span className="text-destructive">*</span>
                </TableHead>
                {/* Column: Delivery Status Indicator */}
                <TableHead className="w-[110px] text-center text-xs font-semibold uppercase text-muted-foreground py-2.5">
                  สถานะการรับ (Status)
                </TableHead>
                <TableHead className="w-[100px] text-right text-xs font-semibold uppercase text-muted-foreground py-2.5">
                  ราคา/หน่วย (Unit Price)
                </TableHead>
                <TableHead className="w-[120px] text-xs font-semibold uppercase text-muted-foreground py-2.5">
                  ประเภท VAT (VAT Type)
                </TableHead>
                <TableHead className="w-[100px] text-right text-xs font-semibold uppercase text-muted-foreground py-2.5">
                  มูลค่าก่อน VAT (Subtotal)
                </TableHead>
                <TableHead className="w-[85px] text-right text-xs font-semibold uppercase text-muted-foreground py-2.5">
                  VAT (7%)
                </TableHead>
                <TableHead className="w-[110px] text-right text-xs font-semibold uppercase text-muted-foreground py-2.5">
                  มูลค่ารวม (Total)
                </TableHead>
                <TableHead className="w-[130px] text-xs font-semibold uppercase text-muted-foreground py-2.5">
                  วันหมดอายุ (Expiry Date)
                </TableHead>
                <TableHead className="w-[45px] py-2.5"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gridRows.map((row) => {
                const enteredCost = Number(row.enteredCost) || 0;
                const rowQty = Number(row.qty) || 0;
                const vatBreakdown = calculateItemVat(enteredCost, rowQty, row.vatMode);
                const isExpiryModified = row.expiryDate !== row.calculatedExpiry;
                const isPriceModified = Math.abs(enteredCost - row.originalCost) > 0.001;

                // Status discrepancy computation
                const hasOrderedQty = row.orderedQty !== undefined;
                const isComplete = hasOrderedQty && rowQty === row.orderedQty;
                const isShortage = hasOrderedQty && rowQty > 0 && rowQty < row.orderedQty!;
                const isZero = hasOrderedQty && rowQty === 0;
                const isOver = hasOrderedQty && rowQty > row.orderedQty!;

                return (
                  <TableRow key={row.rowId} className="hover:bg-muted/20">
                    {/* Code */}
                    <TableCell className="font-mono text-xs py-2 text-muted-foreground">
                      {row.code}
                    </TableCell>

                    {/* Item */}
                    <TableCell className="py-2">
                      <div className="font-semibold text-sm leading-tight">{row.name}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                        <Badge variant="secondary" className="px-1 py-0 text-[10px] h-4">
                          {row.unit}
                        </Badge>
                        {row.hasExpiry !== false && (
                          <span>
                            อายุ: {row.shelfLife}{" "}
                            {row.shelfLifeUnit === "Year"
                              ? "ปี"
                              : row.shelfLifeUnit === "Month"
                                ? "เดือน"
                                : "วัน"}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Ordered Qty (from PO) */}
                    <TableCell className="py-2 text-right">
                      {hasOrderedQty ? (
                        <div className="font-mono text-xs font-bold text-muted-foreground">
                          {row.orderedQty} {row.unit}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50 text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Received Qty (Editable input) */}
                    <TableCell className="py-2 text-right">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        ref={(el) => (qtyInputRefs.current[row.rowId] = el)}
                        value={row.qty}
                        onChange={(e) => updateRow(row.rowId, { qty: e.target.value })}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            costInputRefs.current[row.rowId]?.focus();
                            costInputRefs.current[row.rowId]?.select();
                          }
                        }}
                        placeholder="0"
                        className={cn(
                          "h-9 w-20 text-right font-black text-sm rounded-xl ml-auto",
                          isComplete &&
                            "border-emerald-500/50 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
                          isShortage &&
                            "border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300",
                          isZero && "border-red-400 bg-red-500/5 text-red-600",
                          isOver && "border-blue-500 bg-blue-500/5 text-blue-700",
                        )}
                      />
                    </TableCell>

                    {/* Delivery Status Indicator */}
                    <TableCell className="py-2 text-center">
                      {hasOrderedQty ? (
                        <>
                          {isComplete && (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-0 text-[10px] font-bold py-0.5">
                              ✓ ครบตามสั่ง
                            </Badge>
                          )}
                          {isShortage && (
                            <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border-0 text-[10px] font-bold py-0.5">
                              ขาด {row.orderedQty! - rowQty} {row.unit}
                            </Badge>
                          )}
                          {isZero && (
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-0 text-[10px] font-bold py-0.5">
                              ไม่ได้รับ (0)
                            </Badge>
                          )}
                          {isOver && (
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-0 text-[10px] font-bold py-0.5">
                              เกิน +{rowQty - row.orderedQty!}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">รายการนอก PO</span>
                      )}
                    </TableCell>

                    {/* Cost (TAB/ENTER -> VAT) */}
                    <TableCell className="py-2 text-right">
                      <div className="relative inline-block">
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          ref={(el) => (costInputRefs.current[row.rowId] = el)}
                          value={row.enteredCost}
                          onChange={(e) => updateRow(row.rowId, { enteredCost: e.target.value })}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              vatSelectRefs.current[row.rowId]?.focus();
                            }
                          }}
                          placeholder="0.00"
                          className={cn(
                            "h-9 w-20 text-right text-xs rounded-xl ml-auto font-medium",
                            isPriceModified && "border-amber-500 bg-amber-500/5",
                          )}
                        />
                      </div>
                    </TableCell>

                    {/* VAT Dropdown: V (รวม Vat), V (แยก Vat), N (ไม่มี Vat) */}
                    <TableCell className="py-2">
                      <Select
                        value={row.vatMode}
                        onValueChange={(val: VatMode) => updateRow(row.rowId, { vatMode: val })}
                      >
                        <SelectTrigger
                          ref={(el) => (vatSelectRefs.current[row.rowId] = el)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              expiryInputRefs.current[row.rowId]?.focus();
                            }
                          }}
                          className="h-9 w-28 text-xs font-bold rounded-xl px-2"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VAT_MODE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                              <span className="font-semibold">{opt.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* มูลค่าก่อน VAT */}
                    <TableCell className="py-2 text-right text-xs font-mono font-medium text-muted-foreground">
                      {formatCurrency(vatBreakdown.netTotal, settings.currency)}
                    </TableCell>

                    {/* VAT Amount */}
                    <TableCell className="py-2 text-right text-xs font-mono text-muted-foreground">
                      {vatBreakdown.vatTotal > 0
                        ? formatCurrency(vatBreakdown.vatTotal, settings.currency)
                        : "—"}
                    </TableCell>

                    {/* มูลค่ารวม (Grand Total for line) */}
                    <TableCell className="py-2 text-right font-black text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(vatBreakdown.grossTotal, settings.currency)}
                    </TableCell>

                    {/* Expiry (TAB/ENTER -> Search Box) */}
                    <TableCell className="py-2">
                      <div className="space-y-0.5">
                        <ThaiDatePicker
                          value={row.expiryDate}
                          onChange={(val) => updateRow(row.rowId, { expiryDate: val })}
                          className={cn(
                            "h-9 text-xs rounded-xl min-w-[130px]",
                            isExpiryModified && "border-amber-500 bg-amber-500/5",
                          )}
                        />
                      </div>
                    </TableCell>

                    {/* Remove Action */}
                    <TableCell className="py-2 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(row.rowId)}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}

              {gridRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="py-14 text-center">
                    <div className="mx-auto max-w-sm text-center space-y-2">
                      <Sparkles className="mx-auto h-9 w-9 text-muted-foreground/50 mb-1" />
                      <div className="text-sm font-extrabold text-foreground">
                        ยังไม่มีรายการวัตถุดิบในตารางรับสินค้า (No items in receiving table)
                      </div>
                      <p className="text-xs text-muted-foreground">
                        กดปุ่ม{" "}
                        <strong className="text-emerald-600">
                          "นำเข้าจากใบสั่งซื้อ (Import from PO)"
                        </strong>{" "}
                        หรือพิมพ์ค้นหาชื่อวัตถุดิบ/รหัสสินค้าด้านบนเพื่อเริ่มตรวจรับ
                      </p>
                      <Button
                        type="button"
                        onClick={() => setIsImportPoModalOpen(true)}
                        variant="outline"
                        className="mt-2 text-xs rounded-xl font-bold gap-1.5 border-emerald-600/40 text-emerald-700 dark:text-emerald-300"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>เปิดหน้าต่างเลือกใบสั่งซื้อ (Select PO)</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Live Receiving Summary & Confirmation Bar */}
        <div className="flex flex-wrap items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-3 gap-3">
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <div>
              รายการที่รับ (Items):{" "}
              <span className="font-bold text-foreground text-sm">{summary.totalItemsCount}</span> /{" "}
              {gridRows.length} รายการ
            </div>
            <div>
              จำนวนหน่วยรวม (Units):{" "}
              <span className="font-bold text-foreground text-sm">{summary.totalQty}</span>
              {summary.totalOrderedQty > 0 && (
                <span className="text-[11px] text-muted-foreground ml-1">
                  (จากที่สั่ง {summary.totalOrderedQty})
                </span>
              )}
            </div>
            <div className="border-l border-border/70 pl-3">
              มูลค่าก่อน VAT (Subtotal):{" "}
              <span className="font-semibold text-foreground font-mono">
                {formatCurrency(summary.preVatTotal, settings.currency)}
              </span>
            </div>
            <div>
              VAT (7%):{" "}
              <span className="font-semibold text-foreground font-mono">
                {formatCurrency(summary.totalVat, settings.currency)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[11px] text-muted-foreground block font-medium">
                ยอดรวมสุทธิ (Grand Total)
              </span>
              <span className="text-lg font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(summary.grandTotal, settings.currency)}
              </span>
            </div>

            <Button
              type="button"
              onClick={handleSave}
              disabled={activeValidRows.length === 0 || isSubmitting}
              className="h-11 rounded-xl px-6 font-extrabold shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white gap-2 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>
                {isSubmitting
                  ? "กำลังบันทึก..."
                  : importedPo
                    ? "ยืนยันรับสินค้า (Confirm Receipt & Update PO)"
                    : "บันทึกการรับสินค้า (Confirm Receipt)"}
              </span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Import from PO Search Modal */}
      <ImportPoModal
        isOpen={isImportPoModalOpen}
        onClose={() => setIsImportPoModalOpen(false)}
        onSelectPo={handleSelectPo}
        currentBranchId={selectedBranchId}
      />
    </div>
  );
}
