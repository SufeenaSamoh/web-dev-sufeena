import { useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Bell, Building2, Download, Languages, Palette, RotateCcw, SlidersHorizontal, Upload, X } from "lucide-react";

export function SettingsPage() {
  const store = useStore();
  const { settings, updateSettings, reset } = store;
  const [form, setForm] = useState(settings);
  const fileRef = useRef<HTMLInputElement>(null);
  const [notifs, setNotifs] = useState({
    lowStock: true,
    expiring: true,
    dailyDigest: false,
    purchaseAlert: true,
  });
  const [language, setLanguage] = useState<"en" | "th">("en");

  const save = async () => {
    await updateSettings(form);
    toast.success("Settings saved");
  };

  const onLogoPick = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      setForm((f) => ({ ...f, logoUrl: url }));
      updateSettings({ logoUrl: url });
      toast.success("Logo updated");
    };
    reader.readAsDataURL(file);
  };
  const backup = () => {
    const snapshot = {
      items: store.items,
      categories: store.categories,
      suppliers: store.suppliers,
      users: store.users,
      branches: store.branches,
      transactions: store.transactions,
      purchases: store.purchases,
      settings: store.settings,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "hana-backup.json"; a.click();
    toast.success("Backup downloaded");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Restaurant, preferences and data." actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={backup} className="rounded-xl"><Download className="mr-1 h-4 w-4" />Backup</Button>
          <Button variant="outline" onClick={() => { reset(); toast.success("Reset to defaults"); }} className="rounded-xl"><RotateCcw className="mr-1 h-4 w-4" />Reset</Button>
          <Button onClick={save} className="rounded-xl">Save Changes</Button>
        </div>
      } />

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start rounded-xl bg-muted p-1">
          <TabsTrigger value="profile" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow"><Building2 className="mr-1.5 h-4 w-4" />Company Branding</TabsTrigger>
          <TabsTrigger value="prefs" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow"><SlidersHorizontal className="mr-1.5 h-4 w-4" />Preferences</TabsTrigger>
          <TabsTrigger value="notifs" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow"><Bell className="mr-1.5 h-4 w-4" />Notifications</TabsTrigger>
          <TabsTrigger value="theme" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow"><Palette className="mr-1.5 h-4 w-4" />Theme & Language</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="rounded-2xl border-border/70 p-5 shadow-sm">
          <h3 className="mb-1 text-sm font-semibold">Company Branding</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            These details appear across the sidebar, login page, dashboard, reports and printed documents.
          </p>
          <div className="space-y-4">
            <div>
              <Label>Company Logo</Label>
              <div className="mt-2 flex items-center gap-4">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo" className="h-16 w-16 rounded-2xl border border-border object-cover shadow-sm" />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary text-xl font-black text-primary-foreground shadow-sm">
                    {(form.companyName || "H").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onLogoPick(f);
                      e.target.value = "";
                    }}
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => fileRef.current?.click()}>
                      <Upload className="mr-1 h-4 w-4" /> Upload Logo
                    </Button>
                    {form.logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-xl text-destructive"
                        onClick={() => { setForm((f) => ({ ...f, logoUrl: "" })); updateSettings({ logoUrl: "" }); }}
                      >
                        <X className="mr-1 h-4 w-4" /> Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">PNG or JPG, up to 2 MB. Square works best.</p>
                </div>
              </div>
            </div>
            <div><Label>Company Name</Label><Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Telephone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+66 2 000 0000" className="h-11 rounded-xl" /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contact@company.com" className="h-11 rounded-xl" /></div>
            </div>
            <div><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="rounded-xl" /></div>
          </div>
          </Card>
        </TabsContent>

        <TabsContent value="prefs">
          <Card className="rounded-2xl border-border/70 p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold">Preferences</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Timezone</Label><Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="h-11 rounded-xl" /></div>
              <div>
                <Label>Currency</Label>
                <Input value="Thai Baht (฿ THB)" disabled readOnly className="h-11 rounded-xl bg-muted/40" />
                <p className="mt-1 text-[11px] text-muted-foreground">Fixed system-wide.</p>
              </div>
            </div>
            <div><Label>Low Stock Threshold (fallback)</Label><Input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })} className="h-11 rounded-xl" /></div>
          </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifs">
          <Card className="rounded-2xl border-border/70 p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold">Notifications</h3>
            <div className="space-y-3">
              {[
                { key: "lowStock", label: "Low stock alerts", desc: "Ping when an item drops below its minimum." },
                { key: "expiring", label: "Expiry warnings", desc: "Warn 7 days before batch expiry." },
                { key: "dailyDigest", label: "Daily digest email", desc: "Summary of today's movement each evening." },
                { key: "purchaseAlert", label: "Purchase confirmations", desc: "Confirm every receipt from suppliers." },
              ].map((n) => (
                <div key={n.key} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <Label className="mb-0">{n.label}</Label>
                    <p className="text-xs text-muted-foreground">{n.desc}</p>
                  </div>
                  <Switch
                    checked={(notifs as Record<string, boolean>)[n.key]}
                    onCheckedChange={(v) => setNotifs((s) => ({ ...s, [n.key]: v }))}
                  />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="theme">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-2xl border-border/70 p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold">Appearance</h3>
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <Label className="mb-0">Dark Mode</Label>
                  <p className="text-xs text-muted-foreground">Applies immediately.</p>
                </div>
                <Switch
                  checked={form.theme === "dark"}
                  onCheckedChange={(v) => {
                    const next = v ? ("dark" as const) : ("light" as const);
                    setForm({ ...form, theme: next });
                    updateSettings({ theme: next });
                  }}
                />
              </div>
            </Card>
            <Card className="rounded-2xl border-border/70 p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold"><Languages className="mr-1 inline h-4 w-4" />Language</h3>
              <Select value={language} onValueChange={(v: "en" | "th") => setLanguage(v)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="th">ไทย (Thai)</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-3 text-xs text-muted-foreground">
                Dashboard and reports remain in English. Operational pages follow this language.
              </p>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}