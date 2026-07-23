import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useStore, formatCurrency } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, DollarSign, Pencil, Plus, Search, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import type { Supplier } from "@/lib/types";

const empty: Omit<Supplier, "id"> = { code: "", name: "", contactPerson: "", phone: "", email: "", address: "", active: true, remark: "" };

export function SuppliersPage() {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier, transactions, settings } = useStore();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Supplier, "id">>(empty);

  const filtered = useMemo(() =>
    suppliers.filter((s) => (s.name + s.code + s.contactPerson).toLowerCase().includes(q.toLowerCase()))
  , [suppliers, q]);

  const summaryBySupplier = useMemo(() => {
    const map = new Map<string, { orders: number; value: number }>();
    transactions.filter((t) => t.type === "purchase" && t.supplierId).forEach((t) => {
      const cur = map.get(t.supplierId!) ?? { orders: 0, value: 0 };
      cur.orders += 1;
      cur.value += (t.unitPrice ?? 0) * t.quantity;
      map.set(t.supplierId!, cur);
    });
    return map;
  }, [transactions]);

  const stats = useMemo(() => {
    const active = suppliers.filter((s) => s.active).length;
    const value = [...summaryBySupplier.values()].reduce((s, v) => s + v.value, 0);
    const orders = [...summaryBySupplier.values()].reduce((s, v) => s + v.orders, 0);
    return { total: suppliers.length, active, value, orders };
  }, [suppliers, summaryBySupplier]);

  const openCreate = () => { setForm({ ...empty, code: `SUP-${String(suppliers.length + 1).padStart(3, "0")}` }); setCreating(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setForm(s); };
  const save = () => {
    if (!form.name || !form.code) { toast.error("Code and name required"); return; }
    if (editing) { updateSupplier(editing.id, form); toast.success("Supplier updated"); }
    else { addSupplier(form); toast.success("Supplier added"); }
    setEditing(null); setCreating(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Suppliers" description="ผู้จำหน่าย · Manage vendors and delivery partners." actions={
        <Button onClick={openCreate} className="rounded-xl"><Plus className="mr-1 h-4 w-4" />Add Supplier</Button>
      } />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total Suppliers", value: stats.total, icon: Truck, tone: "text-primary" },
          { label: "Active", value: stats.active, icon: CheckCircle2, tone: "text-emerald-600" },
          { label: "Orders", value: stats.orders, icon: Plus, tone: "text-primary" },
          { label: "Purchase Value", value: formatCurrency(stats.value, settings.currency), icon: DollarSign, tone: "text-emerald-600" },
        ].map((k) => (
          <Card key={k.label} className="rounded-2xl border-border/70 p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{k.label}</div>
                <div className="mt-1 truncate text-xl font-bold">{k.value}</div>
              </div>
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent ${k.tone}`}><k.icon className="h-4 w-4" /></div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 md:max-w-md">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search suppliers…" className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0" />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead><TableHead>Email</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.code}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.contactPerson}</TableCell>
                  <TableCell className="text-muted-foreground">{s.phone}</TableCell>
                  <TableCell className="text-muted-foreground">{s.email}</TableCell>
                  <TableCell className="text-right tabular-nums">{summaryBySupplier.get(s.id)?.orders ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(summaryBySupplier.get(s.id)?.value ?? 0, settings.currency)}</TableCell>
                  <TableCell>{s.active ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)} className="rounded-lg"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)} className="rounded-lg text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">No suppliers found.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={creating || !!editing} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit supplier" : "New supplier"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Contact person</Label><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="col-span-2"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="col-span-2"><Label>Remark</Label><Textarea value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></div>
            <div className="col-span-2 flex items-center justify-between rounded-xl border border-border p-3">
              <Label className="mb-0">Active</Label>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader><AlertDialogTitle>Delete supplier?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { deleteSupplier(deleteId); toast.success("Supplier deleted"); setDeleteId(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}