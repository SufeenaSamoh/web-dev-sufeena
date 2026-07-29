import { useMemo, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Save, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function StockCountPage() {
  const { items, categories, branches, currentStock, addTransaction } = useStore();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});

  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          i.active &&
          (cat === "all" || i.categoryId === cat) &&
          (i.name.toLowerCase().includes(q.toLowerCase()) ||
            i.code.toLowerCase().includes(q.toLowerCase())),
      ),
    [items, cat, q],
  );

  const setActual = (id: string, actual: number) => setCounts((c) => ({ ...c, [id]: actual }));

  const save = () => {
    const entries = Object.entries(counts).filter(([id]) => items.some((i) => i.id === id));
    if (entries.length === 0) {
      toast.error("กรุณาระบุจำนวนอย่างน้อย 1 รายการ");
      return;
    }
    let adjusted = 0;
    entries.forEach(([id, actual]) => {
      const diff = actual - currentStock(id);
      if (diff !== 0) {
        addTransaction({
          itemId: id,
          type: "adjustment",
          quantity: diff,
          date: new Date(date).toISOString(),
          branchId: branches[0]?.id,
          remark: "ตรวจนับสต๊อก",
        });
        adjusted++;
      }
    });
    toast.success(`บันทึกการตรวจนับ · ปรับปรุง ${adjusted} รายการ`);
    setCounts({});
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="ตรวจนับสต๊อก (Stock Count)"
        description="เปรียบเทียบจำนวนจริงกับระบบและบันทึกการปรับปรุง"
        actions={
          <Button onClick={save} className="rounded-xl">
            <Save className="mr-1 h-4 w-4" />
            บันทึก (Save)
          </Button>
        }
      />

      <Card className="rounded-2xl border-border/70 p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <Label className="mb-1.5 block">วันที่ (Date)</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div>
            <Label className="mb-1.5 block">หมวดหมู่ (Category)</Label>
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
            <Label className="mb-1.5 block">ค้นหา (Search)</Label>
            <div className="flex h-11 items-center gap-2 rounded-xl border border-border bg-muted/50 px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="รหัส หรือ ชื่อวัตถุดิบ…"
                className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Mobile: card list */}
      <div className="space-y-2 md:hidden">
        {filtered.map((i) => {
          const sys = currentStock(i.id);
          const counted = counts[i.id];
          const diff = counted !== undefined ? counted - sys : null;
          return (
            <Card key={i.id} className="rounded-2xl border-border/70 p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{i.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {i.code} · {i.unit}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    ในระบบ
                  </div>
                  <div className="text-base font-bold tabular-nums">{sys}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="นับได้"
                  value={counted ?? ""}
                  onChange={(e) => setActual(i.id, Number(e.target.value))}
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
            </Card>
          );
        })}
      </div>

      {/* Desktop: table */}
      <Card className="hidden rounded-2xl border-border/70 p-4 shadow-sm md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">รหัส (Code)</TableHead>
                <TableHead>ชื่อ (Item)</TableHead>
                <TableHead className="text-right">คงเหลือ (Current)</TableHead>
                <TableHead className="w-40">นับได้ (Counted)</TableHead>
                <TableHead className="text-right">ผลต่าง (Diff)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => {
                const sys = currentStock(i.id);
                const counted = counts[i.id];
                const diff = counted !== undefined ? counted - sys : null;
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {i.code}
                    </TableCell>
                    <TableCell className="font-medium">
                      {i.name} <span className="text-xs text-muted-foreground">({i.unit})</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{sys}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={counted ?? ""}
                        onChange={(e) => setActual(i.id, Number(e.target.value))}
                        className="h-9 rounded-lg text-right"
                      />
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        diff === null
                          ? "text-muted-foreground"
                          : diff > 0
                            ? "text-emerald-600"
                            : diff < 0
                              ? "text-destructive"
                              : "text-muted-foreground",
                      )}
                    >
                      {diff === null ? "—" : diff > 0 ? `+${diff}` : diff}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
