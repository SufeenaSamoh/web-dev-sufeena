import { useMemo, useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useStore } from "@/lib/store";
import { formatDateTime } from "@/lib/dateFormat";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  DialogDescription,
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
  Building2,
  Check,
  History,
  KeyRound,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users as UsersIcon,
  HelpCircle,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import type { User, UserRole, Permission, Role, PermissionAuditLog } from "@/lib/types";

const ROLE_BADGES: Record<string, string> = {
  owner: "bg-primary text-primary-foreground font-semibold",
  it: "bg-purple-600 text-white font-semibold",
  admin: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 font-semibold",
  manager: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-semibold",
  purchase:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 font-semibold",
  staff: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 font-semibold",
};

export function UsersPage() {
  const {
    users,
    branches,
    roles,
    permissions,
    rolePermissions,
    userPermissions,
    userBranches,
    permissionAuditLogs,
    deleteUser,
    saveUserWithRBAC,
    resetUserPassword,
  } = useStore();

  const [q, setQ] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Reset Password Modal State
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [resetMethod, setResetMethod] = useState<"temp_password" | "email_invite">("temp_password");
  const [resetTempPassword, setResetTempPassword] = useState("HanaTemp123!");
  const [resetting, setResetting] = useState(false);

  // Form State inside Editor
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("staff");
  const [formStatus, setFormStatus] = useState<"active" | "inactive">("active");
  const [formAuthMethod, setFormAuthMethod] = useState<"temp_password" | "email_invite">(
    "temp_password",
  );
  const [formTempPassword, setFormTempPassword] = useState("HanaTemp123!");
  const [isAllBranches, setIsAllBranches] = useState(true);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [permissionOverrides, setPermissionOverrides] = useState<Record<string, boolean>>({});
  const [permissionSearch, setPermissionSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Open modal for creating new user
  const handleOpenCreate = () => {
    setSelectedUser(null);
    setFormName("");
    setFormEmail("");
    setFormRole("staff");
    setFormStatus("active");
    setIsAllBranches(false);
    setSelectedBranchIds(branches.length > 0 ? [branches[0].id] : []);

    // Default role permissions for staff
    const defaultPerms = getRoleDefaultPermissions("staff");
    setPermissionOverrides(defaultPerms);
    setIsModalOpen(true);
  };

  // Open modal for editing existing user
  const handleOpenEdit = (user: User) => {
    setSelectedUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormStatus(user.status);

    const allBr =
      user.isAllBranches || user.role === "owner" || user.role === "it" || user.role === "admin";
    setIsAllBranches(allBr);

    const userBrIds =
      user.allowedBranchIds && user.allowedBranchIds.length > 0
        ? user.allowedBranchIds
        : user.branchId
          ? [user.branchId]
          : [];
    setSelectedBranchIds(userBrIds);

    // Calculate current permissions for user
    const userOverrides: Record<string, boolean> = {};
    const defaultPerms = getRoleDefaultPermissions(user.role);

    // Populate with defaults first
    permissions.forEach((p) => {
      userOverrides[p.code] = !!defaultPerms[p.code];
    });

    // Apply explicit user_permissions overrides
    userPermissions
      .filter((up) => up.userId === user.id)
      .forEach((up) => {
        const perm = permissions.find((p) => p.id === up.permissionId);
        if (perm) {
          userOverrides[perm.code] = up.isGranted;
        }
      });

    setPermissionOverrides(userOverrides);
    setIsModalOpen(true);
  };

  // Helper to get role default permissions map
  function getRoleDefaultPermissions(roleKey: UserRole): Record<string, boolean> {
    const result: Record<string, boolean> = {};

    if (roleKey === "owner" || roleKey === "it") {
      permissions.forEach((p) => {
        result[p.code] = true;
      });
      return result;
    }

    const roleObj = roles.find((r) => r.name.toLowerCase() === roleKey.toLowerCase());
    if (!roleObj) {
      if (roleKey === "admin") {
        permissions.forEach((p) => {
          result[p.code] = true;
        });
      }
      return result;
    }

    const grantedPermIds = new Set(
      rolePermissions.filter((rp) => rp.roleId === roleObj.id).map((rp) => rp.permissionId),
    );

    permissions.forEach((p) => {
      result[p.code] = grantedPermIds.has(p.id);
    });
    return result;
  }

  // Handle Role selection change in editor
  const handleRoleChange = (newRole: UserRole) => {
    setFormRole(newRole);
    if (newRole === "owner" || newRole === "it" || newRole === "admin" || newRole === "purchase") {
      setIsAllBranches(true);
    }
    // Load new role defaults as baseline matrix
    const defaults = getRoleDefaultPermissions(newRole);
    setPermissionOverrides(defaults);
    toast.info(`Loaded default permission template for ${newRole.toUpperCase()}`);
  };

  // Reset matrix to current role's defaults
  const handleResetToDefaults = () => {
    const defaults = getRoleDefaultPermissions(formRole);
    setPermissionOverrides(defaults);
    toast.success("Reset matrix to role template defaults");
  };

  // Save handler
  const handleSaveUser = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      toast.error("Please enter user name and email");
      return;
    }

    setSaving(true);
    try {
      await saveUserWithRBAC({
        id: selectedUser?.id,
        user: {
          name: formName.trim(),
          email: formEmail.trim(),
          role: formRole,
          status: formStatus,
        },
        isAllBranches,
        selectedBranchIds,
        permissionOverrides,
        tempPassword: selectedUser ? undefined : formTempPassword,
        authMethod: selectedUser ? undefined : formAuthMethod,
      });
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPasswordSubmit = async () => {
    if (!resetTargetUser) return;
    setResetting(true);
    try {
      await resetUserPassword(
        resetTargetUser.id,
        resetTargetUser.email,
        resetMethod,
        resetMethod === "temp_password" ? resetTempPassword || "HanaTemp123!" : undefined,
      );
      setResetTargetUser(null);
    } catch (err) {
      console.error(err);
    } finally {
      setResetting(false);
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    const newStatus = user.status === "active" ? "inactive" : "active";
    try {
      await saveUserWithRBAC({
        id: user.id,
        user: {
          name: user.name,
          email: user.email,
          role: user.role,
          status: newStatus,
        },
        isAllBranches: user.isAllBranches ?? (user.role === "owner" || user.role === "admin"),
        selectedBranchIds: user.allowedBranchIds || [],
        permissionOverrides: {},
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Filter users list by query
  const filteredUsers = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.role.toLowerCase().includes(query),
    );
  }, [users, q]);

  // Group permissions by category for the matrix
  const permissionsByCategory = useMemo(() => {
    const map: Record<string, Permission[]> = {};
    const search = permissionSearch.trim().toLowerCase();

    permissions.forEach((p) => {
      if (
        search &&
        !p.name.toLowerCase().includes(search) &&
        !p.code.toLowerCase().includes(search) &&
        !p.category.toLowerCase().includes(search)
      ) {
        return;
      }
      const cat = p.category || "General";
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    });

    return map;
  }, [permissions, permissionSearch]);

  // Map user ID to User object for Audit Logs
  const userMap = useMemo(() => {
    const m = new Map<string, User>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Permissions (RBAC)"
        description="Manage user access, role templates, branch authorization, and permission matrix."
      />

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start rounded-xl bg-muted p-1">
          <TabsTrigger
            value="users"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs text-xs font-medium"
          >
            <UsersIcon className="mr-1.5 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger
            value="matrix"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs text-xs font-medium"
          >
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            Role Templates
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs text-xs font-medium"
          >
            <History className="mr-1.5 h-4 w-4" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Users List */}
        <TabsContent value="users">
          <Card className="rounded-2xl border-border/70 p-4 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex h-9 w-full sm:w-72 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search user name, email, or role..."
                  className="h-7 border-0 bg-transparent text-xs shadow-none focus-visible:ring-0 p-0"
                />
              </div>

              <Button onClick={handleOpenCreate} className="rounded-xl text-xs h-9">
                <Plus className="mr-1.5 h-4 w-4" />
                Add User
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role Template</TableHead>
                    <TableHead>Branch Access</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => {
                    const isAll = u.isAllBranches || u.role === "owner" || u.role === "admin";
                    const branchNames = isAll
                      ? "All Branches"
                      : u.allowedBranchIds && u.allowedBranchIds.length > 0
                        ? branches
                            .filter((b) => u.allowedBranchIds?.includes(b.id))
                            .map((b) => b.name)
                            .join(", ") || "No Branch"
                        : branches.find((b) => b.id === u.branchId)?.name || "No Branch";

                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary font-bold text-xs uppercase">
                              {u.name.substring(0, 2)}
                            </div>
                            <div>
                              <div className="font-semibold text-xs text-foreground">{u.name}</div>
                              <div className="text-[11px] text-muted-foreground">{u.email}</div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            className={`capitalize text-[11px] px-2.5 py-0.5 rounded-md ${
                              ROLE_BADGES[u.role] || "bg-muted text-muted-foreground"
                            }`}
                          >
                            {u.role}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-foreground">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[200px]" title={branchNames}>
                              {branchNames}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(u)}
                            className="cursor-pointer focus:outline-none"
                            title="Click to toggle Active / Inactive"
                          >
                            {u.status === "active" ? (
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 hover:bg-emerald-200 text-[10px]">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                Inactive
                              </Badge>
                            )}
                          </button>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setResetTargetUser(u);
                                setResetMethod("temp_password");
                                setResetTempPassword("HanaTemp123!");
                              }}
                              className="h-8 w-8 rounded-lg text-amber-600 hover:bg-amber-500/10"
                              title="Reset Password"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(u)}
                              className="h-8 w-8 rounded-lg"
                              title="Edit User & Permissions"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTargetId(u.id)}
                              className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                              title="Delete User"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-xs text-muted-foreground"
                      >
                        No users found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 2: Role Templates Overview */}
        <TabsContent value="matrix">
          <Card className="rounded-2xl border-border/70 p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Role Default Templates</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Roles act as baseline templates. When assigning a role to a user, these default
                permissions are pre-populated into their permission matrix. You can modify any
                individual user&apos;s permissions independently without affecting other users.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {roles.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-border p-4 bg-card/60 space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm capitalize text-foreground">{r.name}</span>
                      <Badge
                        className={`text-[10px] capitalize ${ROLE_BADGES[r.name.toLowerCase()]}`}
                      >
                        Template
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      {r.description || "Standard role template for access control."}
                    </p>
                  </div>

                  <div className="border-t border-border/50 pt-2 text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>Default Granted:</span>
                    <span className="font-semibold text-foreground">
                      {rolePermissions.filter((rp) => rp.roleId === r.id).length} /{" "}
                      {permissions.length}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Tab 3: Audit Logs */}
        <TabsContent value="audit">
          <Card className="rounded-2xl border-border/70 p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Permission Audit Logs</h3>
                <p className="text-xs text-muted-foreground">
                  History of role changes, branch assignments, and permission overrides.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Target User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissionAuditLogs.map((log) => {
                    const targetUser = userMap.get(log.targetUserId);
                    const actorUser = log.actorId ? userMap.get(log.actorId) : null;

                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </TableCell>
                        <TableCell className="font-medium text-xs">
                          {targetUser ? targetUser.name : log.targetUserId}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-mono uppercase">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {actorUser ? actorUser.name : log.actorId ? "System Admin" : "System"}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-xs">
                          {JSON.stringify(log.details)}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {permissionAuditLogs.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-xs text-muted-foreground"
                      >
                        No audit log entries recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* RBAC User Edit / Create Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {selectedUser ? `Edit User — ${selectedUser.name}` : "Create New User"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure user credentials, role template, branch authorization, and permission
              overrides.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Section 1: General Info */}
            <div className="space-y-3 rounded-xl border border-border p-4 bg-muted/20">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <UsersIcon className="h-3.5 w-3.5 text-primary" />
                1. General Information
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Full Name</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Somchai Srisuk"
                    className="h-9 text-xs rounded-xl mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium">Email Address</Label>
                  <Input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. somchai@restaurant.com"
                    className="h-9 text-xs rounded-xl mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-medium text-foreground">User Account Status</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formStatus === "active" ? "Active" : "Inactive (Disabled)"}
                  </span>
                  <Switch
                    checked={formStatus === "active"}
                    onCheckedChange={(checked) => setFormStatus(checked ? "active" : "inactive")}
                  />
                </div>
              </div>

              {!selectedUser && (
                <div className="space-y-3 pt-2 border-t border-border/50">
                  <Label className="text-xs font-semibold text-foreground">
                    Initial Login Setup
                  </Label>
                  <RadioGroup
                    value={formAuthMethod}
                    onValueChange={(val) =>
                      setFormAuthMethod(val as "temp_password" | "email_invite")
                    }
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                  >
                    <div className="flex items-start space-x-2 rounded-xl border border-border p-2.5 bg-background">
                      <RadioGroupItem value="temp_password" id="auth-temp" className="mt-0.5" />
                      <div>
                        <Label htmlFor="auth-temp" className="text-xs font-bold cursor-pointer">
                          Set Temporary Password
                        </Label>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Forces password change on first login.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2 rounded-xl border border-border p-2.5 bg-background">
                      <RadioGroupItem value="email_invite" id="auth-invite" className="mt-0.5" />
                      <div>
                        <Label htmlFor="auth-invite" className="text-xs font-bold cursor-pointer">
                          Email Invitation Link
                        </Label>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Sends password setup email to user.
                        </p>
                      </div>
                    </div>
                  </RadioGroup>

                  {formAuthMethod === "temp_password" && (
                    <div className="pt-1">
                      <Label className="text-xs font-medium">Temporary Password</Label>
                      <Input
                        type="text"
                        value={formTempPassword}
                        onChange={(e) => setFormTempPassword(e.target.value)}
                        placeholder="e.g. HanaTemp123!"
                        className="h-9 text-xs rounded-xl mt-1 font-mono"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 2: Role Template Selection */}
            <div className="space-y-3 rounded-xl border border-border p-4 bg-muted/20">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <UserCog className="h-3.5 w-3.5 text-primary" />
                2. Role Template
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {(["owner", "it", "admin", "purchase", "manager", "staff"] as const).map((rKey) => {
                  const active = formRole === rKey;
                  return (
                    <button
                      key={rKey}
                      type="button"
                      onClick={() => handleRoleChange(rKey)}
                      className={`flex flex-col items-start justify-between rounded-xl border p-3 text-left transition-all ${
                        active
                          ? "border-primary bg-primary/10 shadow-xs"
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-xs font-bold uppercase text-foreground">{rKey}</span>
                        {active && <Check className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1">
                        {rKey === "owner"
                          ? "Full system control"
                          : rKey === "it"
                            ? "IT Admin & Full control"
                            : rKey === "admin"
                              ? "All modules & settings"
                              : rKey === "purchase"
                                ? "ฝ่ายจัดซื้อ (All branch POs)"
                                : rKey === "manager"
                                  ? "Daily store ops & reports"
                                  : "Basic stock operations"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                * Note: Selecting a role loads its baseline permissions. You can customize
                permissions individually below without losing the role label.
              </p>
            </div>

            {/* Section 3: Branch Authorization */}
            <div className="space-y-3 rounded-xl border border-border p-4 bg-muted/20">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                3. Branch Authorization
              </h4>

              <RadioGroup
                value={isAllBranches ? "all" : "specific"}
                onValueChange={(val) => setIsAllBranches(val === "all")}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="br-all" />
                  <Label htmlFor="br-all" className="text-xs font-medium cursor-pointer">
                    All Branches (Full authorization across current and future branches)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="specific" id="br-specific" />
                  <Label htmlFor="br-specific" className="text-xs font-medium cursor-pointer">
                    Selected Branches Only
                  </Label>
                </div>
              </RadioGroup>

              {!isAllBranches && (
                <div className="pt-2 pl-6 grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-border/50">
                  {branches.map((b) => {
                    const checked = selectedBranchIds.includes(b.id);
                    return (
                      <label
                        key={b.id}
                        className="flex items-center gap-2 text-xs font-medium cursor-pointer hover:text-primary"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            if (c) {
                              setSelectedBranchIds((prev) => [...prev, b.id]);
                            } else {
                              setSelectedBranchIds((prev) => prev.filter((id) => id !== b.id));
                            }
                          }}
                        />
                        <span>{b.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 4: Configurable Permission Matrix */}
            <div className="space-y-3 rounded-xl border border-border p-4 bg-muted/20">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-primary" />
                    4. Configurable Permission Matrix
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Customize granted permissions for this specific user.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetToDefaults}
                  className="rounded-lg text-xs h-8"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Reset to Role Defaults
                </Button>
              </div>

              {/* Permission search filter */}
              <div className="flex h-8 w-full sm:w-64 items-center gap-2 rounded-lg border border-border bg-background px-2.5">
                <Search className="h-3 w-3 text-muted-foreground" />
                <Input
                  value={permissionSearch}
                  onChange={(e) => setPermissionSearch(e.target.value)}
                  placeholder="Filter permission matrix..."
                  className="h-6 border-0 bg-transparent text-xs shadow-none focus-visible:ring-0 p-0"
                />
              </div>

              {/* Category-grouped matrix toggles */}
              <div className="space-y-4 pt-2">
                {Object.keys(permissionsByCategory).map((cat) => {
                  const catPerms = permissionsByCategory[cat];
                  const defaultRolePerms = getRoleDefaultPermissions(formRole);

                  return (
                    <div
                      key={cat}
                      className="space-y-2 rounded-lg border border-border/60 bg-card p-3"
                    >
                      <div className="text-xs font-semibold text-foreground uppercase tracking-wider border-b border-border/40 pb-1">
                        {cat}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                        {catPerms.map((p) => {
                          const isGranted = !!permissionOverrides[p.code];
                          const defaultGranted = !!defaultRolePerms[p.code];
                          const isOverride = isGranted !== defaultGranted;

                          return (
                            <div
                              key={p.id}
                              className={`flex items-center justify-between rounded-lg border p-2.5 transition-colors ${
                                isGranted
                                  ? "border-primary/30 bg-primary/5"
                                  : "border-border/60 bg-background"
                              }`}
                            >
                              <div className="space-y-0.5 min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium text-foreground truncate">
                                    {p.name}
                                  </span>
                                  {isOverride && (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] px-1 py-0 h-4 border-amber-500 text-amber-600 dark:text-amber-400"
                                    >
                                      Custom
                                    </Badge>
                                  )}
                                </div>
                                <div
                                  className="text-[10px] text-muted-foreground truncate"
                                  title={p.description}
                                >
                                  {p.description || p.code}
                                </div>
                              </div>

                              <Switch
                                checked={isGranted}
                                onCheckedChange={(val) => {
                                  setPermissionOverrides((prev) => ({
                                    ...prev,
                                    [p.code]: val,
                                  }));
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl text-xs"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveUser} className="rounded-xl text-xs" disabled={saving}>
              {saving ? "Saving..." : selectedUser ? "Save User Changes" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetTargetUser} onOpenChange={(open) => !open && setResetTargetUser(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-500" />
              Reset Password — {resetTargetUser?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Choose how you would like to reset credentials for {resetTargetUser?.email}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <RadioGroup
              value={resetMethod}
              onValueChange={(val) => setResetMethod(val as "temp_password" | "email_invite")}
              className="space-y-2"
            >
              <div className="flex items-start space-x-2 rounded-xl border border-border p-3 bg-muted/20">
                <RadioGroupItem value="temp_password" id="reset-temp" className="mt-0.5" />
                <div>
                  <Label htmlFor="reset-temp" className="text-xs font-bold cursor-pointer">
                    Set Temporary Password
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    User will be forced to update password upon their next login.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2 rounded-xl border border-border p-3 bg-muted/20">
                <RadioGroupItem value="email_invite" id="reset-invite" className="mt-0.5" />
                <div>
                  <Label htmlFor="reset-invite" className="text-xs font-bold cursor-pointer">
                    Send Reset Password Email
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Sends password recovery link to {resetTargetUser?.email}.
                  </p>
                </div>
              </div>
            </RadioGroup>

            {resetMethod === "temp_password" && (
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-semibold">Temporary Password</Label>
                <Input
                  type="text"
                  value={resetTempPassword}
                  onChange={(e) => setResetTempPassword(e.target.value)}
                  placeholder="e.g. HanaTemp123!"
                  className="h-9 text-xs rounded-xl font-mono"
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setResetTargetUser(null)}
              className="rounded-xl text-xs"
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetPasswordSubmit}
              className="rounded-xl text-xs bg-amber-600 text-white hover:bg-amber-700"
              disabled={resetting}
            >
              {resetting ? "Resetting..." : "Confirm Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Delete User Account?</AlertDialogTitle>
            <p className="text-xs text-muted-foreground">
              This action will delete the user account and remove their assigned branch and
              permission configurations.
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteTargetId) {
                  await deleteUser(deleteTargetId);
                  toast.success("User deleted");
                  setDeleteTargetId(null);
                }
              }}
              className="rounded-xl text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
