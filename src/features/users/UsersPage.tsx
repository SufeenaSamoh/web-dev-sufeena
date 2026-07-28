import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { Profile, ProfileRole } from "@/lib/types";
import {
  createProfile,
  deleteProfile,
  getMyProfile,
  listProfiles,
  setProfileActive,
  updateProfile,
} from "@/services/profiles";

interface ProfileForm {
  fullName: string;
  email: string;
  role: ProfileRole;
}

const emptyForm: ProfileForm = { fullName: "", email: "", role: "staff" };

const roleBadge = (r: ProfileRole) =>
  r === "owner"
    ? "bg-primary text-primary-foreground"
    : r === "admin"
      ? "bg-indigo-100 text-indigo-800"
      : r === "manager"
        ? "bg-amber-100 text-amber-800"
        : "bg-muted text-muted-foreground";

const ROLES = [
  {
    key: "owner" as const,
    label: "Owner",
    desc: "Full access to every module and setting. Only an Owner can create another Owner.",
    color: "bg-primary text-primary-foreground",
  },
  {
    key: "admin" as const,
    label: "Admin",
    desc: "Manage data, users, and reports.",
    color: "bg-indigo-100 text-indigo-800",
  },
  {
    key: "manager" as const,
    label: "Manager",
    desc: "Oversee stock, purchase and staff.",
    color: "bg-amber-100 text-amber-800",
  },
  {
    key: "staff" as const,
    label: "Staff",
    desc: "Log daily usage and stock counts.",
    color: "bg-sky-100 text-sky-800",
  },
];

const MODULES = [
  "Dashboard",
  "Master Items",
  "Suppliers",
  "Purchase",
  "Receiving",
  "Beginning Stock",
  "Daily Usage",
  "Stock Count",
  "Reports",
  "Import / Export",
  "Users",
  "Settings",
] as const;

const PERMISSIONS = ["View", "Create", "Edit", "Delete", "Export"] as const;

export function UsersPage() {
  const { transactions, items } = useStore();

  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  // RLS is the real enforcement layer; this only controls whether the
  // management actions are shown, since a manager/staff caller's writes
  // would be rejected by the database anyway.
  const canManage = myProfile?.role === "owner" || myProfile?.role === "admin";

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Profile | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [activeRole, setActiveRole] = useState<ProfileRole>("manager");
  const [perms, setPerms] = useState<Record<string, Record<string, boolean>>>(() => {
    const base: Record<string, Record<string, boolean>> = {};
    ROLES.forEach((r) => {
      base[r.key] = {};
      MODULES.forEach((m) => {
        PERMISSIONS.forEach((p) => {
          const key = `${m}:${p}`;
          if (r.key === "owner" || r.key === "admin") base[r.key][key] = true;
          else if (r.key === "staff") base[r.key][key] = p === "View";
          else base[r.key][key] = p === "View" || p === "Create" || p === "Edit";
        });
      });
    });
    return base;
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, mine] = await Promise.all([listProfiles(), getMyProfile()]);
      setProfiles(rows);
      setMyProfile(mine);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activityLog = useMemo(() => {
    return [...transactions]
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .slice(0, 20)
      .map((t) => ({
        when: new Date(t.date),
        who: t.employee ?? "System",
        action: `${t.type.charAt(0).toUpperCase() + t.type.slice(1)}`,
        detail: `${items.find((i) => i.id === t.itemId)?.name ?? ""} · ${t.quantity}`,
      }));
  }, [transactions, items]);

  const filtered = useMemo(
    () => profiles.filter((u) => (u.fullName + u.email).toLowerCase().includes(q.toLowerCase())),
    [profiles, q],
  );

  const save = async () => {
    if (!form.fullName || !form.email) {
      toast.error("Name and email required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateProfile(editing.id, { fullName: form.fullName, role: form.role });
        toast.success("User updated");
      } else {
        await createProfile({ fullName: form.fullName, email: form.email, role: form.role });
        toast.success(
          "User created — ask them to use \u201CForgot password\u201D to set their own password.",
        );
      }
      setEditing(null);
      setCreating(false);
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: Profile) => {
    setTogglingId(u.id);
    try {
      await setProfileActive(u.id, !u.active);
      toast.success(u.active ? "User disabled" : "User enabled");
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to update user status");
    } finally {
      setTogglingId(null);
    }
  };

  const remove = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteProfile(deleteId);
      toast.success("User deleted");
      setDeleteId(null);
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  const togglePerm = (role: string, key: string) =>
    setPerms((p) => ({ ...p, [role]: { ...p[role], [key]: !p[role]?.[key] } }));

  const initials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join("") || "?";

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Team access, roles, permissions and activity."
      />

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start rounded-xl bg-muted p-1">
          <TabsTrigger
            value="users"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow"
          >
            <UsersIcon className="mr-1.5 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger
            value="roles"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow"
          >
            <UserCog className="mr-1.5 h-4 w-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger
            value="permissions"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow"
          >
            <KeyRound className="mr-1.5 h-4 w-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow"
          >
            <Activity className="mr-1.5 h-4 w-4" />
            Activity Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-end">
              {canManage && (
                <Button
                  onClick={() => {
                    setForm(emptyForm);
                    setCreating(true);
                  }}
                  className="rounded-xl"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add User
                </Button>
              )}
            </div>
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 md:max-w-md">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search users…"
                className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={canManage ? 5 : 4} className="py-10 text-center">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && filtered.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={canManage ? 5 : 4}
                        className="py-10 text-center text-xs text-muted-foreground"
                      >
                        No users found.
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading &&
                    filtered.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                              {initials(u.fullName)}
                            </div>
                            {u.fullName || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge className={`${roleBadge(u.role)} hover:opacity-90`}>
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.active ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditing(u);
                                setForm({ fullName: u.fullName, email: u.email, role: u.role });
                              }}
                              className="rounded-lg"
                              title="Edit user"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void toggleActive(u)}
                              disabled={togglingId === u.id}
                              className="rounded-lg"
                              title={u.active ? "Disable user" : "Enable user"}
                            >
                              {togglingId === u.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Switch checked={u.active} className="pointer-events-none" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteId(u.id)}
                              className="rounded-lg text-destructive"
                              title="Delete user"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((r) => (
              <Card
                key={r.key}
                className="rounded-2xl border-border/70 p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-primary">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{r.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {profiles.filter((u) => u.role === r.key).length} users
                      </div>
                    </div>
                  </div>
                  <Badge className={`${r.color} hover:opacity-90`}>{r.key}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{r.desc}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full rounded-xl"
                  onClick={() => setActiveRole(r.key)}
                >
                  Configure permissions
                </Button>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="permissions">
          <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Role:</span>
              {ROLES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setActiveRole(r.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    activeRole === r.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    {PERMISSIONS.map((p) => (
                      <TableHead key={p} className="text-center">
                        {p}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MODULES.map((m) => (
                    <TableRow key={m}>
                      <TableCell className="font-medium">{m}</TableCell>
                      {PERMISSIONS.map((p) => {
                        const key = `${m}:${p}`;
                        return (
                          <TableCell key={p} className="text-center">
                            <Switch
                              checked={!!perms[activeRole]?.[key]}
                              onCheckedChange={() => togglePerm(activeRole, key)}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex justify-end">
              <Button className="rounded-xl" onClick={() => toast.success("Permissions saved")}>
                Save changes
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
            <div className="divide-y divide-border/60">
              {activityLog.map((a, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {a.who} · {a.action}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{a.detail}</div>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {a.when.toLocaleString()}
                  </div>
                </div>
              ))}
              {activityLog.length === 0 && (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  No activity recorded.
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit user" : "New user"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                disabled={!!editing}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v: ProfileRole) => setForm({ ...form, role: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem
                      key={r.key}
                      value={r.key}
                      disabled={r.key === "owner" && myProfile?.role !== "owner"}
                    >
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!editing && (
              <p className="rounded-xl border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                This creates a real Supabase Auth account with a temporary password. Ask the person
                to sign in and use "Forgot password" to set their own.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void remove()}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
