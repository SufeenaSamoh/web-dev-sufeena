import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PackageOpen,
  ClipboardCheck,
  ShoppingCart,
  Truck,
  BarChart3,
  Boxes,
  Users,
  Settings as SettingsIcon,
  Search,
  Bell,
  Moon,
  Sun,
  Warehouse,
  ArrowDownUp,
  Menu as MenuIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavGroup = {
  label: string;
  items: readonly {
    to: string;
    label: string;
    thai?: string;
    icon: typeof LayoutDashboard;
  }[];
};

const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", thai: "แดชบอร์ด", icon: LayoutDashboard }],
  },
  {
    label: "Inventory",
    items: [
      { to: "/master-items", label: "Items", thai: "วัตถุดิบ", icon: Boxes },
      { to: "/suppliers", label: "Suppliers", thai: "ซัพพลายเออร์", icon: Truck },
      { to: "/beginning-stock", label: "Beginning Stock", thai: "สต๊อกเริ่มต้น", icon: PackageOpen },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/purchase", label: "Purchase", thai: "สั่งซื้อ", icon: ShoppingCart },
      { to: "/receiving", label: "Receiving", thai: "รับสินค้า", icon: Warehouse },
      { to: "/stock-count", label: "Stock Count", thai: "ตรวจนับสต๊อก", icon: ClipboardCheck },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/reports", label: "Reports", thai: "รายงาน", icon: BarChart3 },
      { to: "/import-export", label: "Import / Export", thai: "นำเข้า/ส่งออก", icon: ArrowDownUp },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/users", label: "Users", thai: "ผู้ใช้งาน", icon: Users },
      { to: "/settings", label: "Settings", thai: "ตั้งค่า", icon: SettingsIcon },
    ],
  },
] as const;

const FLAT_NAV = NAV_GROUPS.flatMap((g) => g.items);
const BOTTOM_NAV = [
  FLAT_NAV[0], // Dashboard
  FLAT_NAV.find((n) => n.to === "/master-items")!,
  FLAT_NAV.find((n) => n.to === "/stock-count")!,
  FLAT_NAV.find((n) => n.to === "/purchase")!,
  FLAT_NAV.find((n) => n.to === "/reports")!,
];

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { items, currentStock, settings, updateSettings, transactions } = useStore();
  const [q, setQ] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const notifications = useMemo(() => {
    if (!mounted) return { low: [], soon: [], total: 0 };
    const low = items.filter((i) => i.active && currentStock(i.id) <= i.minStock);
    const soon = transactions.filter(
      (t) =>
        t.expiryDate &&
        new Date(t.expiryDate).getTime() - Date.now() < 7 * 86400000 &&
        new Date(t.expiryDate).getTime() > Date.now()
    );
    return { low, soon, total: low.length + soon.length };
  }, [items, transactions, currentStock, mounted]);

  const toggleTheme = () =>
    updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" });

  const isActive = (to: string) =>
    pathname === to || (to !== "/" && pathname.startsWith(to));

  const SidebarInner = (
    <div className="flex h-full flex-col">
      <Link to="/" className="flex items-center gap-2.5 border-b border-border/60 px-5 py-4">
        {settings.logoUrl ? (
          <img
            src={settings.logoUrl}
            alt={settings.companyName}
            className="h-10 w-10 rounded-2xl object-cover shadow-md"
          />
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary font-black text-primary-foreground shadow-md">
            {(settings.companyName || "H").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold tracking-tight">{settings.companyName || "Hana"}</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Inventory Stock
          </span>
        </div>
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((n) => {
                const active = isActive(n.to);
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground/70 hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <n.icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "" : "text-muted-foreground group-hover:text-accent-foreground"
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{n.label}</span>
                    {n.thai && (
                      <span
                        className={cn(
                          "shrink-0 text-[11px] font-normal",
                          active ? "text-primary-foreground/80" : "text-muted-foreground/70"
                        )}
                      >
                        {n.thai}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen w-full">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border/60 bg-card/40 lg:block">
          {SidebarInner}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full lg:hidden">
                    <MenuIcon className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  {SidebarInner}
                </SheetContent>
              </Sheet>

              <div className="hidden max-w-md flex-1 items-center gap-2 rounded-2xl border border-border bg-muted/60 px-3 py-2 md:flex">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search items, suppliers, purchases…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>

              <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
                  {settings.theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative rounded-full">
                      <Bell className="h-4 w-4" />
                      {mounted && notifications.total > 0 && (
                        <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                          {notifications.total}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {notifications.total === 0 && (
                      <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                        All good — no alerts.
                      </div>
                    )}
                    {notifications.low.slice(0, 5).map((it) => (
                      <DropdownMenuItem key={"low-" + it.id} className="flex-col items-start">
                        <span className="text-xs font-semibold">Low stock</span>
                        <span className="text-xs text-muted-foreground">
                          {it.name} — {currentStock(it.id)} {it.unit}
                        </span>
                      </DropdownMenuItem>
                    ))}
                    {notifications.soon.slice(0, 5).map((t) => (
                      <DropdownMenuItem key={"exp-" + t.id} className="flex-col items-start">
                        <span className="text-xs font-semibold">Expiring soon</span>
                        <span className="text-xs text-muted-foreground">
                          {items.find((i) => i.id === t.itemId)?.name} —{" "}
                          {new Date(t.expiryDate!).toLocaleDateString()}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="border-t border-border/60 px-4 py-2 md:hidden">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/60 px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  className="h-6 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
            {children}
          </main>

          <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl lg:hidden">
            <div className="mx-auto flex max-w-md items-center justify-between px-2 py-1.5">
              {BOTTOM_NAV.map((n) => {
                const active = isActive(n.to);
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium transition-colors",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <n.icon className={cn("h-5 w-5", active && "scale-110 transition-transform")} />
                    <span className="leading-tight">{n.thai ?? n.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {q.trim() && <GlobalSearchResults q={q} onClose={() => setQ("")} />}
    </div>
  );
}

function GlobalSearchResults({ q, onClose }: { q: string; onClose: () => void }) {
  const { items, suppliers, purchases, transactions } = useStore();
  const query = q.toLowerCase();
  const matchItems = items
    .filter((i) => i.name.toLowerCase().includes(query) || i.code.toLowerCase().includes(query))
    .slice(0, 5);
  const matchSup = suppliers
    .filter((s) => s.name.toLowerCase().includes(query) || s.code.toLowerCase().includes(query))
    .slice(0, 5);
  const matchPur = purchases.filter((p) => p.invoiceNumber.toLowerCase().includes(query)).slice(0, 3);
  const matchUsage = transactions
    .filter((t) => t.type === "usage" && (t.remark ?? "").toLowerCase().includes(query))
    .slice(0, 3);

  return (
    <div className="fixed inset-x-0 top-16 z-30 mx-auto max-w-2xl px-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Search results
          </span>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>
        <div className="space-y-3 text-sm">
          {matchItems.length > 0 && (
            <Section title="Items">
              {matchItems.map((i) => (
                <div key={i.id} className="flex justify-between">
                  <span>{i.name}</span>
                  <Badge variant="secondary">{i.code}</Badge>
                </div>
              ))}
            </Section>
          )}
          {matchSup.length > 0 && (
            <Section title="Suppliers">
              {matchSup.map((s) => (
                <div key={s.id}>{s.name}</div>
              ))}
            </Section>
          )}
          {matchPur.length > 0 && (
            <Section title="Purchases">
              {matchPur.map((p) => (
                <div key={p.id}>#{p.invoiceNumber}</div>
              ))}
            </Section>
          )}
          {matchUsage.length > 0 && (
            <Section title="Usage">
              {matchUsage.map((t) => (
                <div key={t.id}>{t.remark}</div>
              ))}
            </Section>
          )}
          {matchItems.length + matchSup.length + matchPur.length + matchUsage.length === 0 && (
            <div className="py-4 text-center text-xs text-muted-foreground">No results.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}