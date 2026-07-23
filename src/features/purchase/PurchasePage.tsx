import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PageHeader } from "@/components/PageHeader";
import { useStore, formatCurrency } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Line { qty: string; price: string; expiry: string; remark: string; }

export function PurchasePage() {
  const { items, categories, suppliers, branches, addPurchase } = useStore();

  const [supplierId, setSupplierId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoice, setInvoice] = useState("");
  const [employee, setEmployee] = useState("");
  const [remark, setRemark] = useState("");

  const [cat, setCat] = useState("all");
  const [supFilter, setSupFilter] = useState("all");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Record<string, Line>>({});

  useEffect(() => { if (!supplierId && suppliers[0]) setSupplierId(suppliers[0].id); }, [suppliers, supplierId]);
  useEffect(() => { if (!branchId && branches[0]) setBranchId(branches[0].id); }, [branches, branchId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => {
      if (!i.active) return false;
      if (cat !== "all" && i.categoryId !== cat) return false;
      if (supFilter !== "all" && i.supplierId !== supFilter) return false;
      if (!term) return true;
      return i.name.toLowerCase().includes(term) ||
        i.code.toLowerCase().includes(term) ||
        (i.barcode ?? "").toLowerCase().includes(term);
    });
  }, [items, cat, supFilter, q]);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  const setField = (id: string, patch: Partial<Line>) => setLines((s) => {
    const prev = s[id] ?? { qty: "", price: "", expiry: "", remark: "" };
    return { ...s, [id]: { ...prev, ...patch } };
  });

  const onQtyKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const next = index + 1;
    if (next >= filtered.length) return;
    rowVirtualizer.scrollToIndex(next, { align: "center" });
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLInputElement>(`input[data-qty-index="${next}"]`);
      el?.focus(); el?.select();
    });
  }, [filtered.length, rowVirtualizer]);

  const activeLines = useMemo(() => Object.entries(lines)
    .map(([id, l]) => ({ id, qty: Number(l.qty), price: Number(l.price) || 0, expiry: l.expiry, remark: l.remark }))
    .filter((l) => items.some((i) => i.id === l.id) && !Number.isNaN(l.qty) && l.qty > 0)
  , [lines, items]);

  const total = useMemo(() => activeLines.reduce((s, l) => s + l.qty * l.price, 0), [activeLines]);

  const save = async () => {
    if (!supplierId) return toast.error("เลือกซัพพลายเออร์");
    if (!branchId) return toast.error("เลือกสาขา");
    if (!invoice.trim()) return toast.error("กรอกเลขที่ใบส่งของ (Invoice)");
    if (activeLines.length === 0) return toast.error("ระบุจำนวนอย่างน้อย 1 รายการ");
    await addPurchase({
      supplierId,
      branchId,
      purchaseDate: new Date(purchaseDate).toISOString(),
      invoiceNumber: invoice,
      employee,
      remark,
      items: activeLines.map((l) => ({
        itemId: l.id, quantity: l.qty, unitPrice: l.price,
        expiryDate: l.expiry || undefined, remark: l.remark || undefined,
      })),
      total,
    });
    toast.success(`บันทึกการรับสินค้า · ${activeLines.length} รายการ`);
    setInvoice(""); setRemark(""); setLines({});
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="รับสินค้า / Purchase"
        description="ค้นหาและระบุจำนวนที่รับได้ทันที · No dialog required"
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden text-right text-xs sm:block">
              <div className="text-muted-foreground">Total</div>
              <div className="text-base font-bold tabular-nums">{formatCurrency(total)}</div>
            </div>
            <Button onClick={save} className="rounded-xl"><Save className="mr-1 h-4 w-4" />บันทึก (Save)</Button>
          </div>
        }
      />

      <Card className="rounded-2xl border-border/70 p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label className="mb-1.5 block text-sm">ซัพพลายเออร์ (Supplier) <span className="text-destructive">*</span></Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className={cn("h-11 rounded-xl", !supplierId && "border-destructive/60")}><SelectValue placeholder="เลือก" /></SelectTrigger>
              <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">สาขา (Branch) <span className="text-destructive">*</span></Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className={cn("h-11 rounded-xl", !branchId && "border-destructive/60")}><SelectValue placeholder="เลือก" /></SelectTrigger>
              <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">วันที่ (Date)</Label>
            <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">เลขที่ใบส่งของ (Invoice) <span className="text-destructive">*</span></Label>
            <Input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="INV-2026-001" className="h-11 rounded-xl" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">พนักงาน (Employee)</Label>
            <Input value={employee} onChange={(e) => setEmployee(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">หมายเหตุ (Remark)</Label>
            <Input value={remark} onChange={(e) => setRemark(e.target.value)} className="h-11 rounded-xl" />
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border-border/70 p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label className="mb-1.5 block text-sm">หมวดหมู่ (Category)</Label>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด (All)</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">กรองซัพพลายเออร์ (Filter)</Label>
            <Select value={supFilter} onValueChange={setSupFilter}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด (All)</SelectItem>
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">ค้นหา (Search)</Label>
            <div className="flex h-11 items-center gap-2 rounded-xl border border-border bg-muted/50 px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="รหัส / ชื่อ / บาร์โค้ด"
                className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0" />
            </div>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border-border/70 p-0 shadow-sm">
        <div className="hidden grid-cols-[100px_1fr_90px_60px_100px_110px_140px_1fr_90px] items-center gap-2 border-b border-border/60 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
          <div>Code</div>
          <div>Item</div>
          <div className="text-right">Current</div>
          <div>Unit</div>
          <div className="text-right">Qty</div>
          <div className="text-right">Unit Price</div>
          <div>Expiry</div>
          <div>Remark</div>
          <div className="text-right">Subtotal</div>
        </div>

        <div ref={parentRef} className="h-[60vh] overflow-auto">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">ไม่พบวัตถุดิบตามเงื่อนไข</div>
          ) : (
            <div style={{ height: rowVirtualizer.getTotalSize(), width: "100%", position: "relative" }}>
              {rowVirtualizer.getVirtualItems().map((vRow) => {
                const i = filtered[vRow.index];
                const l = lines[i.id] ?? { qty: "", price: "", expiry: "", remark: "" };
                const qty = Number(l.qty) || 0;
                const price = Number(l.price) || 0;
                const sub = qty * price;
                return (
                  <div
                    key={i.id}
                    data-index={vRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vRow.start}px)` }}
                    className="border-b border-border/50 px-4 py-2.5 hover:bg-muted/30"
                  >
                    <div className="hidden grid-cols-[100px_1fr_90px_60px_100px_110px_140px_1fr_90px] items-center gap-2 md:grid">
                      <div className="font-mono text-xs text-muted-foreground">{i.code}</div>
                      <div className="min-w-0 truncate text-sm font-medium">{i.name}</div>
                      <div className="text-right text-sm tabular-nums">{(i as any).currentStock ?? 0}</div>
                      <div className="text-xs text-muted-foreground">{i.unit}</div>
                      <Input type="number" inputMode="decimal" data-qty-index={vRow.index}
                        value={l.qty} onChange={(e) => setField(i.id, { qty: e.target.value })}
                        onFocus={(e) => e.currentTarget.select()} onKeyDown={(e) => onQtyKeyDown(e, vRow.index)}
                        placeholder="0" className="h-10 rounded-lg text-right text-sm font-semibold" />
                      <Input type="number" inputMode="decimal" step="0.01"
                        value={l.price} onChange={(e) => setField(i.id, { price: e.target.value })}
                        placeholder={i.purchasePrice?.toString() ?? "0.00"} className="h-10 rounded-lg text-right text-sm" />
                      <Input type="date" value={l.expiry} onChange={(e) => setField(i.id, { expiry: e.target.value })}
                        className="h-10 rounded-lg text-xs" />
                      <Input value={l.remark} onChange={(e) => setField(i.id, { remark: e.target.value })}
                        placeholder="หมายเหตุ" className="h-10 rounded-lg text-sm" />
                      <div className="text-right text-sm font-semibold tabular-nums">{sub ? formatCurrency(sub) : "—"}</div>
                    </div>

                    <div className="md:hidden space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{i.name}</div>
                          <div className="text-[11px] text-muted-foreground">{i.code} · {i.unit}</div>
                        </div>
                        <div className="shrink-0 text-right text-sm font-semibold tabular-nums">{sub ? formatCurrency(sub) : ""}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input type="number" inputMode="decimal" data-qty-index={vRow.index}
                          value={l.qty} onChange={(e) => setField(i.id, { qty: e.target.value })}
                          onFocus={(e) => e.currentTarget.select()} onKeyDown={(e) => onQtyKeyDown(e, vRow.index)}
                          placeholder="จำนวน" className="h-11 rounded-xl text-center text-base font-semibold" />
                        <Input type="number" inputMode="decimal" step="0.01"
                          value={l.price} onChange={(e) => setField(i.id, { price: e.target.value })}
                          placeholder="ราคา/หน่วย" className="h-11 rounded-xl text-center text-sm" />
                        <Input type="date" value={l.expiry} onChange={(e) => setField(i.id, { expiry: e.target.value })}
                          className="h-11 rounded-xl text-xs" />
                        <Input value={l.remark} onChange={(e) => setField(i.id, { remark: e.target.value })}
                          placeholder="หมายเหตุ" className="h-11 rounded-xl text-sm" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          <div>แสดง {filtered.length} รายการ · {activeLines.length} รายการมีจำนวน</div>
          <div className="text-sm font-bold tabular-nums text-foreground">Total: {formatCurrency(total)}</div>
        </div>
      </Card>
    </div>
  );
}