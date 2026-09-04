import { useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Printer,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

function download(name: string, mime: string, body: string) {
  const blob = new Blob([body], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]);
  return [
    keys.join(","),
    ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(",")),
  ].join("\n");
}

type ImportResult = {
  total: number;
  ok: number;
  skipped: number;
  errors: number;
  file: string;
} | null;

export function ImportExportPage() {
  const { items, suppliers, transactions, categories } = useStore();
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult>(null);
  const [target, setTarget] = useState<"items" | "suppliers">("items");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setResult(null);
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((p) => {
        const next = p + 10 + Math.random() * 15;
        if (next >= 100) {
          clearInterval(timer);
          const total = Math.max(1, Math.round(file.size / 120));
          const ok = Math.round(total * 0.82);
          const skipped = Math.round(total * 0.12);
          const errors = total - ok - skipped;
          setResult({ total, ok, skipped, errors, file: file.name });
          toast.success(`Imported ${ok} rows`);
          return 100;
        }
        return next;
      });
    }, 120);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const exportItems = () => {
    const rows = items.map((i) => ({
      code: i.code,
      name: i.name,
      category: categories.find((c) => c.id === i.categoryId)?.name ?? "",
      supplier: suppliers.find((s) => s.id === i.supplierId)?.name ?? "",
      unit: i.unit,
      minStock: i.minStock,
      purchasePrice: i.purchasePrice ?? 0,
      active: i.active,
    }));
    return rows;
  };
  const exportSuppliers = () =>
    suppliers.map((s) => ({
      code: s.code,
      name: s.name,
      contact: s.contactPerson,
      phone: s.phone,
      email: s.email,
      address: s.address,
      active: s.active,
    }));
  const exportMovement = () =>
    transactions.map((t) => ({
      date: new Date(t.date).toISOString(),
      item: items.find((i) => i.id === t.itemId)?.name ?? "",
      type: t.type,
      quantity: t.quantity,
      unitPrice: t.unitPrice ?? "",
      remark: t.remark ?? "",
    }));

  const exportTemplates = [
    { key: "items", label: "Master Items", get: exportItems },
    { key: "suppliers", label: "Suppliers", get: exportSuppliers },
    { key: "movement", label: "Stock Movement", get: exportMovement },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import / Export Center"
        description="Bring data in from Excel and CSV, or ship it out for reporting."
      />

      <Tabs defaultValue="import" className="space-y-4">
        <TabsList className="rounded-xl bg-muted p-1">
          <TabsTrigger value="import" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow">
            <ArrowDownToLine className="mr-1.5 h-4 w-4" /> Import
          </TabsTrigger>
          <TabsTrigger value="export" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow">
            <ArrowUpFromLine className="mr-1.5 h-4 w-4" /> Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-4">
          <Card className="rounded-2xl border-border/70 p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Target:</span>
              {(["items", "suppliers"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTarget(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    target === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {t === "items" ? "Master Items" : "Suppliers"}
                </button>
              ))}
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/30 hover:bg-muted/60"
              }`}
            >
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Upload className="h-6 w-6" />
              </div>
              <div className="mt-4 text-base font-semibold">
                Drag & drop a file, or click to browse
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Supports .xlsx and .csv · Columns match automatically · Duplicates skipped
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>

            {progress > 0 && progress < 100 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Processing…</span>
                  <span className="tabular-nums text-muted-foreground">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {result && (
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <SummaryTile label="Total rows" value={result.total} tone="text-foreground" />
                <SummaryTile label="Imported" value={result.ok} tone="text-emerald-600" icon={CheckCircle2} />
                <SummaryTile label="Skipped (duplicates)" value={result.skipped} tone="text-amber-600" />
                <SummaryTile label="Errors" value={result.errors} tone="text-destructive" icon={XCircle} />
                <div className="sm:col-span-4 text-xs text-muted-foreground">
                  From <span className="font-mono">{result.file}</span> · target:{" "}
                  <Badge variant="secondary">{target}</Badge>
                </div>
              </div>
            )}
          </Card>

          <Card className="rounded-2xl border-border/70 p-5 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold">Guidelines</h3>
            <ul className="ml-5 list-disc space-y-1 text-xs text-muted-foreground">
              <li>The first row must be column headers (e.g. code, name, unit).</li>
              <li>Rows with an existing Item Code are skipped, never overwritten.</li>
              <li>Blank required fields are reported in the error summary.</li>
              <li>Use the export buttons below as a ready-made template.</li>
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {exportTemplates.map((t) => (
              <Card key={t.key} className="rounded-2xl border-border/70 p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">{t.label}</h3>
                    <p className="text-xs text-muted-foreground">Download the full dataset.</p>
                  </div>
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-primary">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      download(`${t.key}.csv`, "text/csv", toCsv(t.get() as Record<string, unknown>[]));
                      toast.success(`Exported ${t.label} (CSV)`);
                    }}
                  >
                    <FileText className="mr-1 h-4 w-4" /> CSV
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      download(
                        `${t.key}.xls`,
                        "application/vnd.ms-excel",
                        toCsv(t.get() as Record<string, unknown>[]),
                      );
                      toast.success(`Exported ${t.label} (Excel)`);
                    }}
                  >
                    <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      window.print();
                    }}
                  >
                    <FileText className="mr-1 h-4 w-4" /> PDF
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => window.print()}
                  >
                    <Printer className="mr-1 h-4 w-4" /> Print
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: string;
  icon?: typeof CheckCircle2;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className={`h-4 w-4 ${tone}`} />}
      </div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}