import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
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
  Menu as MenuIcon,
  LogOut,
  Loader2,
  User as UserIcon,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  History,
  ChefHat,
  FileSpreadsheet,
  Calculator,
  ShoppingBag,
  ShieldCheck,
  Flame,
  CookingPot,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/dateFormat";
import { hasPermission } from "@/lib/permissions";
import type { PermissionCode } from "@/lib/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type NavItem = {
  to: string;
  label: string;
  thai?: string;
  icon: typeof LayoutDashboard;
  permission?: PermissionCode;
};

type NavGroup = {
  label: string;
  items: readonly NavItem[];
};

const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "ภาพรวม (Overview)",
    items: [
      {
        to: "/",
        label: "แดชบอร์ด (Dashboard)",
        thai: "ภาพรวมสต็อก",
        icon: LayoutDashboard,
        permission: "dashboard:view",
      },
    ],
  },
  {
    label: "การดำเนินงาน (Operations)",
    items: [
      {
        to: "/purchase",
        label: "จัดซื้อวัตถุดิบ (Purchase)",
        thai: "สั่งซื้อ",
        icon: ShoppingBag,
        permission: "receiving:view",
      },
      {
        to: "/receiving",
        label: "รับสินค้า (Receiving)",
        thai: "ตรวจรับของเข้า",
        icon: ShoppingCart,
        permission: "receiving:view",
      },
      {
        to: "/production-batch",
        label: "บันทึกการผลิต (Production)",
        thai: "ผลิตซอส & ตัดสต็อก",
        icon: Flame,
        permission: "inventory:view",
      },
      {
        to: "/stock-count",
        label: "ตรวจนับสต็อก (Stock Count)",
        thai: "นับสต็อกจริง",
        icon: ClipboardCheck,
        permission: "stock_count:view",
      },
      {
        to: "/sales-import",
        label: "นำเข้ายอดขาย (Sales Import)",
        thai: "Import ยอดขาย POS",
        icon: FileSpreadsheet,
        permission: "stock_count:view",
      },
      {
        to: "/expiry-lots",
        label: "ล็อตวันหมดอายุ (Expiry Lots)",
        thai: "วันหมดอายุ & ของเสีย",
        icon: Clock,
        permission: "inventory:view",
      },
    ],
  },
  {
    label: "รายงานและการวิเคราะห์ (Analytics)",
    items: [
      {
        to: "/reports",
        label: "รายงาน (Reports)",
        thai: "รายงานภาพรวม & ผลต่าง",
        icon: BarChart3,
        permission: "reports:view",
      },
      {
        to: "/theoretical-usage",
        label: "การใช้ตามสูตร (Theoretical Usage)",
        thai: "คำนวณตามสูตร BOM",
        icon: Calculator,
        permission: "reports:view",
      },
      {
        to: "/price-analysis",
        label: "วิเคราะห์ราคา (Price Analysis)",
        thai: "แนวโน้มราคาต้นทุน",
        icon: TrendingUp,
        permission: "reports:view",
      },
      {
        to: "/inventory-movement",
        label: "การเคลื่อนไหวสต็อก (Movement)",
        thai: "ประวัติเข้า-ออกสต็อก",
        icon: History,
        permission: "reports:view",
      },
    ],
  },
  {
    label: "ข้อมูลหลัก (Master Data)",
    items: [
      {
        to: "/recipes",
        label: "สูตรอาหาร (Recipes / BOM)",
        thai: "ส่วนผสมและสูตร",
        icon: ChefHat,
        permission: "master_items:view",
      },
      {
        to: "/production-recipes",
        label: "สูตรผลิตสินค้า (Production BOM)",
        thai: "สูตรผลิตซอส/กึ่งสำเร็จรูป",
        icon: CookingPot,
        permission: "master_items:view",
      },
      {
        to: "/master-items",
        label: "วัตถุดิบ (Master Items)",
        thai: "รายการวัตถุดิบทั้งหมด",
        icon: Boxes,
        permission: "master_items:view",
      },
      {
        to: "/suppliers",
        label: "ซัพพลายเออร์ (Suppliers)",
        thai: "ผู้จำหน่าย",
        icon: Truck,
        permission: "suppliers:view",
      },
      {
        to: "/beginning-stock",
        label: "สต็อกเริ่มต้น (Beginning Stock)",
        thai: "ยอดยกมา",
        icon: PackageOpen,
        permission: "beginning_stock:view",
      },
      {
        to: "/procurement-master",
        label: "ข้อมูลจัดซื้อ (Procurement)",
        thai: "ผูกซัพพลายเออร์ & ราคา",
        icon: ShoppingBag,
        permission: "procurement_master:view",
      },
    ],
  },
  {
    label: "ระบบ (System)",
    items: [
      {
        to: "/users",
        label: "ผู้ใช้งาน (Users)",
        thai: "จัดการสิทธิ์ & บทบาท",
        icon: Users,
        permission: "user_management:manage",
      },
      {
        to: "/settings",
        label: "ตั้งค่าระบบ (Settings)",
        thai: "กำหนดค่าทั่วไป",
        icon: SettingsIcon,
        permission: "settings:manage",
      },
    ],
  },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const {
    items,
    settings,
    updateSettings,
    transactions,
    currentUser,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    listNotifications,
    resolveNotification,
    dismissNotification,
    runNotificationScheduler,
  } = useStore();
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [mounted, setMounted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dbNotifs, setDbNotifs] = useState<import("@/services/notifications").AppNotification[]>(
    [],
  );
  const [scanning, setScanning] = useState(false);

  useEffect(() => setMounted(true), []);

  const loadNotifs = async () => {
    try {
      const data = await listNotifications({ isResolved: false, isDismissed: false });
      // Keep only near-expiry and expired notifications
      const expiryOnly = data.filter((n) => n.type === "EXPIRED" || n.type === "EXPIRY_WARNING");
      setDbNotifs(expiryOnly);
    } catch (e) {
      console.warn(e);
    }
  };

  useEffect(() => {
    if (mounted) {
      loadNotifs();
    }
  }, [mounted]);

  const handleScan = async () => {
    setScanning(true);
    try {
      await runNotificationScheduler();
      await loadNotifs();
    } catch (e) {
      console.warn(e);
    } finally {
      setScanning(false);
    }
  };

  const handleResolveNotif = async (id: string) => {
    await resolveNotification(id);
    await loadNotifs();
  };

  const handleDismissNotif = async (id: string) => {
    await dismissNotification(id);
    await loadNotifs();
  };

  // Filter NAV_GROUPS based on current user permissions
  const filteredNavGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.permission) return true;
        return hasPermission(currentUser, item.permission);
      }),
    })).filter((group) => group.items.length > 0);
  }, [currentUser]);

  // Primary Top Nav Modules (Workflow: สั่งซื้อ -> รับสินค้า -> นับสต๊อก -> รายงาน)
  const primaryNavItems = useMemo(() => {
    const mainList = [
      {
        to: "/",
        label: "แดชบอร์ด (Dashboard)",
        icon: LayoutDashboard,
        permission: "dashboard:view" as PermissionCode,
      },
      {
        to: "/purchase",
        label: "จัดซื้อวัตถุดิบ (Purchase)",
        icon: ShoppingCart,
        permission: "receiving:view" as PermissionCode,
      },
      {
        to: "/receiving",
        label: "รับสินค้า (Receiving)",
        icon: PackageOpen,
        permission: "receiving:view" as PermissionCode,
      },
      {
        to: "/stock-count",
        label: "ตรวจนับสต็อก (Stock Count)",
        icon: ClipboardCheck,
        permission: "stock_count:view" as PermissionCode,
      },
      {
        to: "/reports",
        label: "รายงาน (Reports)",
        icon: BarChart3,
        permission: "reports:view" as PermissionCode,
      },
    ];
    return mainList.filter((item) => hasPermission(currentUser, item.permission));
  }, [currentUser]);

  // Guest -> /login.
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [authLoading, user, navigate]);

  const handleLogout = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    navigate({ to: "/login" });
  };

  const notifications = useMemo(() => {
    if (!mounted) return { expired: [], soon: [], total: 0 };
    const now = Date.now();
    const warningMs = (settings.expiryWarningDays || 7) * 86400000;

    const expired: Array<{ id: string; name: string; expiryDate: string; daysDiff: number }> = [];
    const soon: Array<{ id: string; name: string; expiryDate: string; daysDiff: number }> = [];

    // Check transactions with expiry dates (excluding low-stock)
    transactions.forEach((t) => {
      if (!t.expiryDate) return;
      const expTime = new Date(t.expiryDate).getTime();
      if (isNaN(expTime)) return;

      const diffDays = Math.ceil((expTime - now) / 86400000);
      const matchedItem = items.find((i) => i.id === t.itemId);
      const name = matchedItem?.name || t.employee || "วัตถุดิบ";

      if (diffDays <= 0) {
        expired.push({ id: t.id, name, expiryDate: t.expiryDate, daysDiff: diffDays });
      } else if (expTime - now <= warningMs) {
        soon.push({ id: t.id, name, expiryDate: t.expiryDate, daysDiff: diffDays });
      }
    });

    return { expired, soon, total: expired.length + soon.length };
  }, [items, transactions, settings.expiryWarningDays, mounted]);

  const toggleTheme = () => updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" });

  const isActive = (to: string) => pathname === to || (to !== "/" && pathname.startsWith(to));

  const handleNavClick = (to: string) => {
    setDrawerOpen(false);
  };

  if (authLoading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-3 sm:px-6 gap-2">
          {/* Left: Hamburger & Logo */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                  <MenuIcon className="h-5 w-5 text-foreground" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 flex flex-col h-full bg-card">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>

                {/* Drawer Header */}
                <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
                  {settings.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt={settings.companyName || "Hana"}
                      className="h-9 w-9 rounded-xl object-cover shadow-xs"
                    />
                  ) : (
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#a9752f] font-bold text-white shadow-xs">
                      {(settings.companyName || "H").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col leading-tight">
                    <span className="text-base font-bold tracking-tight text-foreground">
                      {settings.companyName || "Hana"}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Restaurant Inventory
                    </span>
                  </div>
                </div>

                {/* Drawer Nav Items */}
                <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
                  {filteredNavGroups.map((group) => (
                    <div key={group.label}>
                      <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-[#a9752f]">
                        {group.label}
                      </div>
                      <div className="space-y-0.5">
                        {group.items.map((n) => {
                          const active = isActive(n.to);
                          return (
                            <Link
                              key={n.to}
                              to={n.to}
                              onClick={() => handleNavClick(n.to)}
                              className={cn(
                                "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                                active
                                  ? "bg-[#a9752f]/15 text-[#a9752f] font-semibold shadow-xs"
                                  : "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
                              )}
                            >
                              <n.icon
                                className={cn(
                                  "h-4 w-4 shrink-0",
                                  active
                                    ? "text-[#a9752f]"
                                    : "text-muted-foreground group-hover:text-foreground",
                                )}
                              />
                              <span className="min-w-0 flex-1 truncate">{n.label}</span>
                              {n.thai && (
                                <span
                                  className={cn(
                                    "shrink-0 text-[10px] font-normal",
                                    active ? "text-[#a9752f]/90" : "text-muted-foreground/70",
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

                {/* Drawer Footer User Info */}
                {currentUser && (
                  <div className="border-t border-border/60 p-3 bg-muted/30">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-[#a9752f]/10 text-[#a9752f] font-bold text-xs">
                        <UserIcon className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col text-left leading-tight min-w-0 flex-1">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {currentUser.name || user.email}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-[#a9752f]">
                          {currentUser.role}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </SheetContent>
            </Sheet>

            {/* Logo Brand */}
            <Link to="/" className="flex items-center gap-2">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={settings.companyName || "Hana"}
                  className="h-7 w-7 rounded-lg object-cover"
                />
              ) : (
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#a9752f] font-black text-white text-xs">
                  {(settings.companyName || "H").charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-bold tracking-tight text-foreground hidden sm:inline-block">
                {settings.companyName || "HANA"}
              </span>
            </Link>
          </div>

          {/* Center: 4 Primary Top Nav Modules */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {primaryNavItems.map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors rounded-md relative",
                    active
                      ? "text-[#a9752f] font-semibold bg-[#a9752f]/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                  )}
                >
                  <item.icon
                    className={cn("h-4 w-4", active ? "text-[#a9752f]" : "text-muted-foreground")}
                  />
                  <span>{item.label}</span>
                  {active && (
                    <span className="absolute bottom-0 inset-x-2 h-0.5 bg-[#a9752f] rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right: Branch Selector, User, Notifications, Theme, Logout */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Global Branch Selector Dropdown */}
            {branches.length > 0 && (
              <div className="flex items-center gap-1">
                <Warehouse className="h-3.5 w-3.5 text-muted-foreground hidden lg:inline-block" />
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                  <SelectTrigger className="h-8 rounded-lg border-border/80 text-xs w-[120px] sm:w-[150px] bg-background/60">
                    <SelectValue placeholder="เลือกสาขา" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {(currentUser?.role === "owner" ||
                      currentUser?.role === "it" ||
                      currentUser?.role === "admin" ||
                      currentUser?.role === "purchase" ||
                      currentUser?.isAllBranches) && <SelectItem value="all">ทุกสาขา</SelectItem>}
                    {branches
                      .filter((b) => {
                        if (
                          currentUser?.role === "owner" ||
                          currentUser?.role === "it" ||
                          currentUser?.role === "admin" ||
                          currentUser?.role === "purchase" ||
                          currentUser?.isAllBranches
                        )
                          return true;
                        if (currentUser?.allowedBranchIds?.includes(b.id)) return true;
                        if (currentUser?.branchId === b.id) return true;
                        return false;
                      })
                      .map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* User Info Header Badge */}
            {currentUser && (
              <div className="hidden xl:flex items-center gap-2 border-l border-r border-border/60 px-2.5 py-1">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-[#a9752f]/10 text-[#a9752f] font-bold text-xs">
                  <UserIcon className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col text-left leading-none">
                  <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
                    {currentUser.name || user.email}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#a9752f] mt-0.5">
                    {currentUser.role}
                  </span>
                </div>
              </div>
            )}

            {/* Notification Badge & Panel */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-8 w-8 rounded-full"
                  title="การแจ้งเตือน"
                >
                  <Bell className="h-4 w-4" />
                  {mounted && (dbNotifs.length > 0 || notifications.total > 0) && (
                    <span className="absolute right-1 top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
                      {dbNotifs.length > 0 ? dbNotifs.length : notifications.total}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 sm:w-96 p-2 rounded-2xl shadow-xl">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span className="font-bold text-xs text-foreground">
                      แจ้งเตือนวันหมดอายุ (Expiry Alerts)
                    </span>
                    <Badge variant="secondary" className="text-[10px] rounded-full">
                      {dbNotifs.length > 0 ? dbNotifs.length : notifications.total}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleScan}
                    disabled={scanning}
                    className="h-7 text-[10px] px-2 rounded-lg hover:bg-accent"
                  >
                    {scanning ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    สแกนวันหมดอายุ
                  </Button>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-border/60 py-1">
                  {dbNotifs.length === 0 && notifications.total === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                      <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-2 opacity-80" />
                      เรียบร้อยดี — ไม่มีวัตถุดิบใกล้หมดอายุหรือหมดอายุ
                    </div>
                  ) : dbNotifs.length > 0 ? (
                    dbNotifs.map((n) => (
                      <div
                        key={n.id}
                        className="p-2.5 hover:bg-accent/40 rounded-xl transition-colors text-xs space-y-1"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            {n.type === "EXPIRED" ? (
                              <Badge
                                variant="destructive"
                                className="text-[9px] px-1.5 py-0 rounded-md"
                              >
                                หมดอายุแล้ว
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500 text-white text-[9px] px-1.5 py-0 rounded-md">
                                ใกล้หมดอายุ
                              </Badge>
                            )}
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {formatDateTime(n.createdAt)}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResolveNotif(n.id)}
                            className="h-6 text-[10px] px-1.5 rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          >
                            รับทราบ / ปิด
                          </Button>
                        </div>
                        <p className="text-xs text-foreground/90 font-medium leading-snug">
                          {n.message}
                        </p>
                      </div>
                    ))
                  ) : (
                    <>
                      {notifications.expired.map((it) => (
                        <div
                          key={"exp-" + it.id}
                          className="p-2.5 hover:bg-accent/40 rounded-xl text-xs flex items-center justify-between"
                        >
                          <div>
                            <Badge variant="destructive" className="text-[9px] mr-1.5">
                              หมดอายุแล้ว
                            </Badge>
                            <span className="font-semibold text-foreground">{it.name}</span>
                          </div>
                          <span className="text-[10px] text-destructive font-mono">
                            {it.expiryDate}
                          </span>
                        </div>
                      ))}
                      {notifications.soon.map((it) => (
                        <div
                          key={"soon-" + it.id}
                          className="p-2.5 hover:bg-accent/40 rounded-xl text-xs flex items-center justify-between"
                        >
                          <div>
                            <Badge className="bg-amber-500 text-white text-[9px] mr-1.5">
                              ใกล้หมดอายุ ({it.daysDiff} วัน)
                            </Badge>
                            <span className="font-semibold text-foreground">{it.name}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {it.expiryDate}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                <DropdownMenuSeparator className="my-1" />
                <div className="p-1">
                  <Link
                    to="/expiry-lots"
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-primary hover:underline rounded-xl"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    ดูรายการวันหมดอายุและบันทึกของเสียทั้งหมด
                  </Link>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title="สลับโหมดมืด/สว่าง"
              className="h-8 w-8 rounded-full"
            >
              {settings.theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            {/* Logout */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              disabled={signingOut}
              title="ออกจากระบบ"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile quick nav links bar for small screens */}
        <div className="flex md:hidden items-center justify-around border-t border-border/50 px-2 py-1 bg-muted/20">
          {primaryNavItems.map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors rounded-md",
                  active
                    ? "text-[#a9752f] font-semibold bg-[#a9752f]/10"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn("h-3.5 w-3.5", active ? "text-[#a9752f]" : "text-muted-foreground")}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Working Space — Full Width */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 sm:px-6 py-4">{children}</main>

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
  const matchPur = purchases
    .filter((p) => p.invoiceNumber.toLowerCase().includes(query))
    .slice(0, 3);
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
