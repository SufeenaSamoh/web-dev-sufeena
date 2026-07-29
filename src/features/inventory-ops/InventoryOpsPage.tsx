import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PageHeader } from "@/components/PageHeader";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function InventoryOpsPage() {
  const { items, categories, suppliers, branches, currentStock, addTransaction } = useStore();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayStr);
  const [branchId, setBranchId] = useState<string>("");
  const [cat, setCat] = useState("all");
  const [sup, setSup] = useState("all");
  const [q, setQ] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const branchName = branches.find((b) => b.id === branchId)?.name ?? "";

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => {
      if (!i.active) return false;
      if (cat !== "all" && i.categoryId !== cat) return false;
      if (sup !== "all" && i.supplierId !== sup) return false;
      if (!term) return true;
      return (
        i.name.toLowerCase().includes(term) ||
        i.code.toLowerCase().includes(term) ||
        (i.barcode ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, cat, sup, q]);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  const onQtyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const next = index + 1;
      if (next >= filtered.length) return;
      rowVirtualizer.scrollToIndex(next, { align: "center" });
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLInputElement>(`input[data-qty-index="${next}"]`);
        el?.focus();
        el?.select();
      });
    },
    [filtered.length, rowVirtualizer],
  );

  const setValue = (id: string, v: string) => setValues((s) => ({ ...s, [id]: v }));
  const setRemark = (id: string, v: string) => setRemarks((s) => ({ ...s, [id]: v }));

  useEffect(() => {
    if (!branchId && branches[0]) setBranchId(branches[0].id);
  }, [branches, branchId]);

  const save = async () => {
    if (!branchId) {
      toast.error("กรุณาเลือกสาขา (Please select a branch)");
      return;
    }
    const entries = Object.entries(values)
      .map(([id, v]) => [id, Number(v)] as const)
      .filter(([id, n]) => items.some((i) => i.id === id) && !Number.isNaN(n));
    if (entries.length === 0) {
      toast.error("กรุณาระบุจำนวนอย่างน้อย 1 รายการ");
      return;
    }
    let saved = 0;
    for (const [id, n] of entries) {
      const diff = n - currentStock(id);
      if (diff === 0) continue;
      const userRemark = (remarks[id] ?? "").trim();
      await addTransaction({
        itemId: id,
        type: "adjustment",
        quantity: diff,
        date: new Date(date).toISOString(),
        branchId,
        remark: `ตรวจนับ · ${branchName}${userRemark ? ` · ${userRemark}` : ""}`,
      });
      saved++;
    }
    toast.success(`บันทึกการตรวจนับ · ปรับปรุง ${saved} รายการ`);
    setValues({});
    setRemarks({});
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="ตรวจนับสต๊อก (Stock Count)"
        description="บันทึกจำนวนที่นับได้จริงตามรอบตรวจนับ"
        actions={
          <Button onClick={save} className="rounded-xl">
            <Save className="mr-1 h-4 w-4" />
            บันทึก (Save)
          </Button>
        }
      />

      <Card className="rounded-2xl border-border/70 p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label className="mb-1.5 block text-sm">
              วันที่นับ (Count Date) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">
              สาขา (Branch) <span className="text-destructive">*</span>
            </Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger
                className={cn("h-11 rounded-xl", !branchId && "border-destructive/60")}
              >
                <SelectValue placeholder="เลือกสาขา" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">หมวดหมู่ (Category)</Label>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด (All)</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">ซัพพลายเออร์ (Supplier)</Label>
            <Select value={sup} onValueChange={setSup}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด (All)</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">ค้นหา (Search)</Label>
            <div className="flex h-11 items-center gap-2 rounded-xl border border-border bg-muted/50 px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="รหัส / ชื่อ / บาร์โค้ด"
                className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border-border/70 p-0 shadow-sm">
        <div className="hidden grid-cols-[110px_1fr_100px_70px_130px_1fr] items-center gap-3 border-b border-border/60 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
          <div>Code</div>
          <div>Item Name</div>
          <div className="text-right">Current</div>
          <div>Unit</div>
          <div className="text-right">Count Qty</div>
          <div>Remark</div>
        </div>

        <div ref={parentRef} className="h-[65vh] overflow-auto">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              ไม่พบวัตถุดิบตามเงื่อนไข
            </div>
          ) : (
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((vRow) => {
                const i = filtered[vRow.index];
                const sys = currentStock(i.id);
                const raw = values[i.id] ?? "";
                const num = raw === "" ? null : Number(raw);
                const diff = num !== null && !Number.isNaN(num) ? num - sys : null;
                return (
                  <div
                    key={i.id}
                    data-index={vRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${vRow.start}px)`,
                    }}
                    className="border-b border-border/50 px-4 py-2.5 hover:bg-muted/30"
                  >
                    <div className="hidden grid-cols-[110px_1fr_100px_70px_130px_1fr] items-center gap-3 md:grid">
                      <div className="font-mono text-xs text-muted-foreground">{i.code}</div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{i.name}</div>
                        {i.barcode && (
                          <div className="truncate text-[11px] text-muted-foreground">
                            {i.barcode}
                          </div>
                        )}
                      </div>
                      <div className="text-right text-sm font-semibold tabular-nums">{sys}</div>
                      <div className="text-xs text-muted-foreground">{i.unit}</div>
                      <div className="flex items-center justify-end gap-2">
                        <Input
                          type="number"
                          inputMode="decimal"
                          data-qty-index={vRow.index}
                          value={raw}
                          onChange={(e) => setValue(i.id, e.target.value)}
                          onFocus={(e) => e.currentTarget.select()}
                          onKeyDown={(e) => onQtyKeyDown(e, vRow.index)}
                          placeholder="นับได้"
                          className="h-10 w-24 rounded-lg text-right text-sm font-semibold"
                        />
                        <div
                          className={cn(
                            "min-w-[44px] rounded-md px-2 py-1 text-center text-xs font-bold tabular-nums",
                            diff === null
                              ? "bg-muted text-muted-foreground"
                              : diff > 0
                                ? "bg-emerald-500/10 text-emerald-600"
                                : diff < 0
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-muted text-muted-foreground",
                          )}
                        >
                          {diff === null ? "—" : diff > 0 ? `+${diff}` : diff}
                        </div>
                      </div>
                      <Input
                        value={remarks[i.id] ?? ""}
                        onChange={(e) => setRemark(i.id, e.target.value)}
                        placeholder="หมายเหตุ"
                        className="h-10 rounded-lg text-sm"
                      />
                    </div>

                    {/* Mobile */}
                    <div className="md:hidden">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{i.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {i.code} · {i.unit}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[10px] uppercase text-muted-foreground">คงเหลือ</div>
                          <div className="text-sm font-bold tabular-nums">{sys}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Input
                          type="number"
                          inputMode="decimal"
                          data-qty-index={vRow.index}
                          value={raw}
                          onChange={(e) => setValue(i.id, e.target.value)}
                          onFocus={(e) => e.currentTarget.select()}
                          onKeyDown={(e) => onQtyKeyDown(e, vRow.index)}
                          placeholder="นับได้"
                          className="h-11 flex-1 rounded-xl text-center text-base font-semibold"
                        />
                        <div
                          className={cn(
                            "grid h-11 min-w-16 place-items-center rounded-xl px-3 text-sm font-bold tabular-nums",
                            diff === null
                              ? "bg-muted text-muted-foreground"
                              : diff > 0
                                ? "bg-emerald-500/10 text-emerald-600"
                                : diff < 0
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-muted text-muted-foreground",
                          )}
                        >
                          {diff === null ? "—" : diff > 0 ? `+${diff}` : diff}
                        </div>
                      </div>
                      <Input
                        value={remarks[i.id] ?? ""}
                        onChange={(e) => setRemark(i.id, e.target.value)}
                        placeholder="หมายเหตุ (Remark)"
                        className="mt-2 h-10 rounded-xl text-sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          <div>แสดง {filtered.length} รายการ · กรอกจำนวนแล้วกด Enter เพื่อไปช่องถัดไป</div>
        </div>
      </Card>
    </div>
  );
}
