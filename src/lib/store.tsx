/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing Supabase row mappers below
   read untyped `.select("*")` rows; typing every table row is a larger refactor outside the
   scope of this change. */
import { createClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";

const SUPABASE_URL = "https://fgdfvvydtnkzdnvqqsng.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_XgS4AhGWMdjf6RUDFhbJVg_7XSc3xNG";

function createSecondaryAuthClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  consumeInventory as consumeInventoryService,
  getAvailableLots as getAvailableLotsService,
  type ConsumeInventoryOptions,
  type ConsumeInventoryResult,
  type InventoryLot,
} from "@/services/inventoryLots";
import {
  dismissNotification as dismissNotificationService,
  generateExpiryNotifications as generateExpiryNotificationsService,
  listNotifications as listNotificationsService,
  resolveNotification as resolveNotificationService,
  type AppNotification,
  type ExpiryNotificationSummary,
  type ListNotificationsFilter,
} from "@/services/notifications";
import {
  runNotificationScheduler as runNotificationSchedulerService,
  type SchedulerResult,
} from "@/services/notificationScheduler";
import { useAuth } from "./auth";
import { calculateEffectivePermissions } from "./permissions";
import type {
  Branch,
  Category,
  InventoryBalance,
  Item,
  Permission,
  PermissionAuditLog,
  ProductionBatch,
  ProductionRecipe,
  ProductionRecipeIngredient,
  Purchase,
  RecipeItem,
  Role,
  RolePermission,
  SalesRecord,
  Settings,
  StockTransaction,
  Supplier,
  User,
  UserBranch,
  UserPermission,
  UserRole,
} from "./types";
import {
  fetchProductionRecipesFromDB,
  saveProductionRecipeToDB,
  deleteProductionRecipeFromDB,
  toggleProductionRecipeStatusInDB,
  fetchProductionBatchesFromDB,
  executeProductionBatch,
  loadCachedProductionRecipes,
  loadCachedProductionBatches,
} from "@/services/productionService";

const SETTINGS_KEY = "hana-settings-v1";

const defaultSettings: Settings = {
  companyName: "Hana Inventory Stock",
  logoUrl: "",
  address: "1-2-3 Ginza, Chuo, Tokyo",
  phone: "",
  email: "",
  timezone: "Asia/Tokyo",
  currency: "THB",
  lowStockThreshold: 5,
  expiryWarningDays: 7,
  variancePercentThreshold: 5,
  varianceValueThreshold: 100,
  theme: "light",
};

export interface SaveUserWithRBACParams {
  id?: string;
  user: {
    name: string;
    email: string;
    role: UserRole;
    status: "active" | "inactive";
  };
  isAllBranches: boolean;
  selectedBranchIds: string[];
  permissionOverrides: Record<string, boolean>; // permissionCode -> isGranted
  tempPassword?: string;
  authMethod?: "temp_password" | "email_invite";
}

interface AppData {
  items: Item[];
  categories: Category[];
  suppliers: Supplier[];
  users: User[];
  branches: Branch[];
  transactions: StockTransaction[];
  purchases: Purchase[];
  stockCounts: StockCountDocument[];
  documentAuditLogs: DocumentAuditLog[];
  /** public.inventory_balance — the real per-branch stock source of truth (see 001_core_columns_and_balance.sql). */
  inventoryBalance: InventoryBalance[];
  settings: Settings;
  roles: Role[];
  permissions: Permission[];
  rolePermissions: RolePermission[];
  userPermissions: UserPermission[];
  userBranches: UserBranch[];
  permissionAuditLogs: PermissionAuditLog[];
  recipes: RecipeItem[];
  salesRecords: SalesRecord[];
  productionRecipes: ProductionRecipe[];
  productionBatches: ProductionBatch[];
}

const defaultData: AppData = {
  items: [],
  categories: [],
  suppliers: [],
  users: [],
  branches: [],
  transactions: [],
  purchases: [],
  stockCounts: [],
  documentAuditLogs: [],
  inventoryBalance: [],
  settings: defaultSettings,
  roles: [],
  permissions: [],
  rolePermissions: [],
  userPermissions: [],
  userBranches: [],
  permissionAuditLogs: [],
  recipes: [],
  salesRecords: [],
  productionRecipes: [],
  productionBatches: [],
};

interface StoreCtx extends AppData {
  loading: boolean;
  currentUser: User | null;
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  currentStock: (itemId: string) => number;
  addTransaction: (t: Omit<StockTransaction, "id">) => Promise<void>;
  updateTransaction: (id: string, patch: Partial<StockTransaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addItem: (i: Omit<Item, "id">) => Promise<{ success: boolean; error?: string; item?: Item }>;
  updateItem: (
    id: string,
    p: Partial<Item>,
  ) => Promise<{ success: boolean; error?: string; item?: Item }>;
  deleteItem: (id: string) => Promise<{ success: boolean; error?: string }>;
  addSupplier: (s: Omit<Supplier, "id">) => Promise<void>;
  updateSupplier: (id: string, p: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  addPurchase: (p: Omit<Purchase, "id">) => Promise<void>;
  updatePurchaseWithRevision: (params: {
    purchaseId: string;
    updatedFields: {
      supplierId?: string;
      invoiceNumber?: string;
      purchaseDate?: string;
      employee?: string;
      remark?: string;
      status?: DocumentStatus;
    };
    items: PurchaseItem[];
    reason: string;
  }) => Promise<{ success: boolean; error?: string }>;
  togglePurchaseLock: (params: {
    purchaseId: string;
    lock: boolean;
    reason?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  addStockCountDocument: (
    doc: Omit<StockCountDocument, "id" | "documentNumber" | "revision">,
  ) => Promise<StockCountDocument | null>;
  updateStockCountWithRevision: (params: {
    documentId: string;
    updatedFields: {
      countDate?: string;
      remark?: string;
      status?: DocumentStatus;
    };
    items: StockCountItem[];
    reason: string;
  }) => Promise<{ success: boolean; error?: string }>;
  toggleStockCountLock: (params: {
    documentId: string;
    lock: boolean;
    reason?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  addUser: (u: Omit<User, "id">) => Promise<void>;
  updateUser: (id: string, p: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  saveUserWithRBAC: (params: SaveUserWithRBACParams) => Promise<void>;
  resetUserPassword: (
    userId: string,
    email: string,
    method: "temp_password" | "email_invite",
    tempPassword?: string,
  ) => Promise<void>;
  addRecipeItem: (item: Omit<RecipeItem, "id">) => Promise<{ success: boolean; error?: string }>;
  updateRecipeItem: (
    id: string,
    patch: Partial<RecipeItem>,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteRecipeItem: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteRecipeByMenuCode: (
    menuCode: string,
    reason?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  setRecipeMenuStatus: (
    menuCode: string,
    active: boolean,
    reason?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  softDeleteRecipeByMenuCode: (
    menuCode: string,
    reason: string,
  ) => Promise<{ success: boolean; error?: string }>;
  restoreRecipeMenu: (menuCode: string) => Promise<{ success: boolean; error?: string }>;
  hardDeleteRecipeByMenuCode: (menuCode: string) => Promise<{ success: boolean; error?: string }>;
  bulkImportRecipes: (
    items: Omit<RecipeItem, "id">[],
  ) => Promise<{ success: boolean; importedCount: number; error?: string }>;
  addSalesRecord: (
    record: Omit<SalesRecord, "id">,
  ) => Promise<{ success: boolean; error?: string }>;
  bulkImportSalesRecords: (
    records: Omit<SalesRecord, "id">[],
  ) => Promise<{ success: boolean; importedCount: number; error?: string }>;
  deleteSalesRecord: (id: string) => Promise<{ success: boolean; error?: string }>;
  clearAllSalesRecords: () => Promise<{ success: boolean }>;
  addProductionRecipe: (
    recipe:
      | Omit<ProductionRecipe, "id">
      | (Partial<ProductionRecipe> & {
          producedItemCode: string;
          yieldQuantity: number;
          yieldUnit: string;
          ingredients: Omit<ProductionRecipeIngredient, "id">[];
        }),
  ) => Promise<{ success: boolean; data?: ProductionRecipe; error?: string }>;
  updateProductionRecipe: (
    id: string,
    patch: Partial<ProductionRecipe> & {
      producedItemCode?: string;
      yieldQuantity?: number;
      yieldUnit?: string;
      ingredients?: Omit<ProductionRecipeIngredient, "id">[];
    },
  ) => Promise<{ success: boolean; data?: ProductionRecipe; error?: string }>;
  deleteProductionRecipe: (id: string) => Promise<{ success: boolean; error?: string }>;
  toggleProductionRecipeStatus: (
    id: string,
    active: boolean,
  ) => Promise<{ success: boolean; error?: string }>;
  recordProductionBatch: (params: {
    producedItemCode: string;
    batchQuantity: number;
    producedAt?: string;
    branchId?: string;
    branchName?: string;
    note?: string;
    createdBy?: string;
  }) => Promise<{ success: boolean; batch?: ProductionBatch; warnings: string[]; error?: string }>;
  refreshProductionData: () => Promise<void>;
  loadAll: () => Promise<void>;
  updateSettings: (p: Partial<Settings>) => Promise<void>;
  reset: () => Promise<void>;
  /** FEFO: lots for an item, earliest expiry first. See src/services/inventoryLots.ts. */
  getAvailableLots: (itemId: string, branchId?: string) => Promise<InventoryLot[]>;
  /** FEFO: deduct qty from the earliest-expiring lots first. See src/services/inventoryLots.ts. */
  consumeInventory: (
    itemId: string,
    quantity: number,
    options?: ConsumeInventoryOptions,
  ) => Promise<ConsumeInventoryResult>;
  /** Expiry Notification Engine. See src/services/notifications.ts. */
  generateExpiryNotifications: () => Promise<ExpiryNotificationSummary>;
  listNotifications: (filter?: ListNotificationsFilter) => Promise<AppNotification[]>;
  resolveNotification: (id: string) => Promise<AppNotification>;
  dismissNotification: (id: string) => Promise<AppNotification>;
  /** Notification Scheduler. See src/services/notificationScheduler.ts. */
  runNotificationScheduler: () => Promise<SchedulerResult>;
}

// Helper to automatically strip unmapped columns if remote DB schema cache hasn't updated
async function executeItemMutationWithSchemaFallback<T>(
  action: (payload: Record<string, unknown>) => Promise<{ data: T | null; error: any }>,
  initialPayload: Record<string, unknown>,
): Promise<{ data: T | null; error: any }> {
  const payload = { ...initialPayload };
  let attempts = 0;

  while (attempts < 10) {
    attempts++;
    const { data, error } = await action(payload);
    if (!error) {
      return { data, error: null };
    }

    // Check if error is PGRST204 / missing column error from PostgREST schema cache
    const isPgrst204 =
      error.code === "PGRST204" ||
      (typeof error.message === "string" && error.message.includes("Could not find the"));

    if (isPgrst204) {
      const match =
        typeof error.message === "string"
          ? error.message.match(/Could not find the '([^']+)' column/)
          : null;
      if (match && match[1] && match[1] in payload) {
        console.warn(
          `[Items Schema Fallback] Column '${match[1]}' not in DB schema cache. Stripping and retrying...`,
        );
        delete payload[match[1]];
        continue;
      }

      // Fallback: strip known optional schema extension columns one by one
      const extensionCols = [
        "conversion_factor",
        "recipe_unit",
        "stock_unit",
        "item_type",
        "barcode",
        "description",
      ];
      let removedAny = false;
      for (const col of extensionCols) {
        if (col in payload) {
          console.warn(
            `[Items Schema Fallback] Stripping '${col}' to resolve schema mismatch and retrying...`,
          );
          delete payload[col];
          removedAny = true;
          break;
        }
      }
      if (removedAny) continue;
    }

    return { data, error };
  }

  return {
    data: null,
    error: { message: "Exceeded max retries stripping unmapped schema columns" },
  };
}

const Ctx = createContext<StoreCtx | null>(null);

// ---------- row <-> model mappers ----------

const rowToItem = (r: any): Item => {
  const legacyUnit = r.unit ?? "kg";
  const stockUnit = r.stock_unit || legacyUnit;
  const recipeUnit = r.recipe_unit || legacyUnit;
  const conversionFactor = Number(r.conversion_factor) > 0 ? Number(r.conversion_factor) : 1;
  const itemType = (r.item_type === "prepared" ? "prepared" : "raw") as "raw" | "prepared";

  return {
    id: r.id,
    code: r.code ?? "",
    name: r.name ?? "",
    categoryId: r.category_id ?? "",
    supplierId: r.supplier_id ?? undefined,
    unit: legacyUnit,
    stockUnit,
    recipeUnit,
    conversionFactor,
    itemType,
    minStock: Number(r.minimum_stock ?? 0),
    purchasePrice: Number(r.purchase_price ?? 0),
    barcode: r.barcode ?? "",
    description: r.description ?? "",
    active: r.active ?? true,
    hasExpiry: r.has_expiry ?? false,
    defaultShelfLife: Number(r.shelf_life_days ?? 30),
    shelfLifeDays: Number(r.shelf_life_days ?? 30),
    shelfLifeUnit: "Day",
    expiryWarningDays: r.expiry_warning_days ?? undefined,
    // keep the raw current_stock alongside for currentStock()
    ...(r.current_stock !== undefined ? { currentStock: Number(r.current_stock) } : {}),
  } as Item & { currentStock?: number };
};

const itemToRow = (i: Partial<Item>) => {
  const row: Record<string, unknown> = {};
  if (i.code !== undefined) row.code = i.code;
  if (i.name !== undefined) row.name = i.name;
  if (i.categoryId !== undefined) row.category_id = i.categoryId || null;
  if (i.supplierId !== undefined) row.supplier_id = i.supplierId || null;
  if (i.stockUnit !== undefined) {
    row.stock_unit = i.stockUnit;
    row.unit = i.stockUnit; // Sync unit with stockUnit for backward compatibility
  } else if (i.unit !== undefined) {
    row.unit = i.unit;
  }
  if (i.recipeUnit !== undefined) row.recipe_unit = i.recipeUnit;
  if (i.conversionFactor !== undefined) row.conversion_factor = i.conversionFactor;
  if (i.itemType !== undefined) row.item_type = i.itemType;
  if (i.purchasePrice !== undefined) row.purchase_price = i.purchasePrice;
  if (i.minStock !== undefined) row.minimum_stock = i.minStock;
  if (i.active !== undefined) row.active = i.active;
  if (i.hasExpiry !== undefined) row.has_expiry = i.hasExpiry;

  let days = i.shelfLifeDays ?? i.defaultShelfLife;
  if (days !== undefined) {
    if (i.shelfLifeUnit === "Month") days = days * 30;
    else if (i.shelfLifeUnit === "Year") days = days * 365;
    row.shelf_life_days = days;
  }

  if (i.expiryWarningDays !== undefined) row.expiry_warning_days = i.expiryWarningDays || null;
  return row;
};

const rowToSupplier = (r: any): Supplier => ({
  id: r.id,
  code: r.code ?? "",
  name: r.name ?? "",
  contactPerson: r.contact_person ?? "",
  phone: r.phone ?? "",
  email: r.email ?? "",
  address: r.address ?? "",
  active: r.active ?? true,
  remark: r.remark ?? "",
});

const supplierToRow = (s: Partial<Supplier>) => {
  const row: Record<string, unknown> = {};
  if (s.code !== undefined) row.code = s.code;
  if (s.name !== undefined) row.name = s.name;
  if (s.contactPerson !== undefined) row.contact_person = s.contactPerson;
  if (s.phone !== undefined) row.phone = s.phone;
  if (s.email !== undefined) row.email = s.email;
  if (s.address !== undefined) row.address = s.address;
  if (s.active !== undefined) row.active = s.active;
  if (s.remark !== undefined) row.remark = s.remark;
  return row;
};

const rowToUser = (r: any): User => ({
  id: r.id,
  name: r.name ?? "",
  email: r.email ?? "",
  role: (r.role ?? "employee") as User["role"],
  branchId: r.branch_id ?? "",
  status: (r.status ?? "active") as User["status"],
});

const userToRow = (u: Partial<User>) => {
  const row: Record<string, unknown> = {};
  if (u.name !== undefined) row.name = u.name;
  if (u.email !== undefined) row.email = u.email;
  if (u.role !== undefined) row.role = u.role;
  if (u.branchId !== undefined) row.branch_id = u.branchId || null;
  if (u.status !== undefined) row.status = u.status;
  return row;
};

const rowToTxn = (r: any): StockTransaction => ({
  id: r.id,
  itemId: r.item_id,
  type: r.type,
  quantity: Number(r.quantity),
  unitPrice: r.unit_price !== null && r.unit_price !== undefined ? Number(r.unit_price) : undefined,
  date: r.date,
  supplierId: r.supplier_id ?? undefined,
  branchId: r.branch_id ?? undefined,
  refId: r.ref_id ?? undefined,
  remark: r.remark ?? undefined,
  expiryDate: r.expiry_date ?? undefined,
  employee: r.employee ?? undefined,
});

const txnToRow = (t: Partial<StockTransaction>) => {
  const row: Record<string, unknown> = {};
  if (t.itemId !== undefined) row.item_id = t.itemId;
  if (t.type !== undefined) row.type = t.type;
  if (t.quantity !== undefined) row.quantity = t.quantity;
  if (t.unitPrice !== undefined) row.unit_price = t.unitPrice;
  if (t.date !== undefined) row.date = t.date;
  if (t.supplierId !== undefined) row.supplier_id = t.supplierId || null;
  if (t.branchId !== undefined) row.branch_id = t.branchId || null;
  if (t.refId !== undefined) row.ref_id = t.refId || null;
  if (t.remark !== undefined) row.remark = t.remark;
  if (t.expiryDate !== undefined) row.expiry_date = t.expiryDate;
  if (t.employee !== undefined) row.employee = t.employee;
  return row;
};

// ---------- provider ----------

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth();
  const [data, setData] = useState<AppData>(defaultData);
  const [loading, setLoading] = useState(true);

  // Sync settings from localStorage after mount to prevent SSR/hydration mismatch
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(SETTINGS_KEY) : null;
      if (raw) {
        const settings = { ...defaultSettings, ...JSON.parse(raw) };
        setData((d) => ({ ...d, settings }));
      }
    } catch {
      // Ignore malformed cached settings and fall back to defaults.
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        items,
        categories,
        suppliers,
        branches,
        users,
        txns,
        purchases,
        purchaseItems,
        inventoryBalance,
        rolesRes,
        permissionsRes,
        rolePermsRes,
        userPermsRes,
        userBranchesRes,
        auditLogsRes,
      ] = await Promise.all([
        supabase.from("items").select("*").order("code"),
        supabase.from("categories").select("*").order("name"),
        supabase.from("suppliers").select("*").order("name"),
        supabase.from("branches").select("*").order("name"),
        supabase.from("users").select("*").order("name"),
        supabase.from("transactions").select("*").order("date", { ascending: false }),
        supabase.from("purchases").select("*").order("purchase_date", { ascending: false }),
        supabase.from("purchase_items").select("*"),
        supabase.from("inventory_balance").select("*"),
        supabase.from("roles").select("*"),
        supabase.from("permissions").select("*").order("category"),
        supabase.from("role_permissions").select("*"),
        supabase.from("user_permissions").select("*"),
        supabase.from("user_branches").select("*"),
        supabase
          .from("permission_audit_logs")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      const err = [
        items,
        categories,
        suppliers,
        branches,
        users,
        txns,
        purchases,
        purchaseItems,
        inventoryBalance,
      ].find((r) => r.error);
      if (err?.error) {
        console.warn("Supabase fetch warning:", err.error);
      }

      const purchasesById = new Map<string, any[]>();
      (purchaseItems.data ?? []).forEach((pi: any) => {
        const list = purchasesById.get(pi.purchase_id) ?? [];
        list.push({
          itemId: pi.item_id,
          quantity: Number(pi.quantity),
          unitPrice: Number(pi.unit_price ?? 0),
          expiryDate: pi.expiry_date ?? undefined,
          remark: pi.remark ?? undefined,
        });
        purchasesById.set(pi.purchase_id, list);
      });

      const fetchedRoles: Role[] = (rolesRes.data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description ?? undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      const fetchedPermissions: Permission[] = (permissionsRes.data ?? []).map((p: any) => ({
        id: p.id,
        code: p.code,
        category: p.category,
        name: p.name,
        description: p.description ?? undefined,
        createdAt: p.created_at,
      }));

      const fetchedRolePermissions: RolePermission[] = (rolePermsRes.data ?? []).map((rp: any) => ({
        roleId: rp.role_id,
        permissionId: rp.permission_id,
        createdAt: rp.created_at,
      }));

      const fetchedUserPermissions: UserPermission[] = (userPermsRes.data ?? []).map((up: any) => ({
        id: up.id,
        userId: up.user_id,
        permissionId: up.permission_id,
        isGranted: up.is_granted,
        grantedBy: up.granted_by ?? undefined,
        createdAt: up.created_at,
      }));

      const fetchedUserBranches: UserBranch[] = (userBranchesRes.data ?? []).map((ub: any) => ({
        userId: ub.user_id,
        branchId: ub.branch_id,
        createdAt: ub.created_at,
      }));

      const fetchedAuditLogs: PermissionAuditLog[] = (auditLogsRes?.data ?? []).map((a: any) => ({
        id: a.id,
        targetUserId: a.target_user_id,
        actorId: a.actor_id ?? undefined,
        action: a.action,
        permissionCode: a.permission_code ?? undefined,
        details: a.details ?? {},
        createdAt: a.created_at,
      }));

      const userBranchesByUserId = new Map<string, string[]>();
      fetchedUserBranches.forEach((ub) => {
        const list = userBranchesByUserId.get(ub.userId) ?? [];
        list.push(ub.branchId);
        userBranchesByUserId.set(ub.userId, list);
      });

      const parsedUsers: User[] = (users.data ?? []).map((r: any) => {
        const u = rowToUser(r);
        const assignedBranchIds =
          userBranchesByUserId.get(u.id) || (u.branchId ? [u.branchId] : []);
        const isAllBranches =
          u.role === "owner" || u.role === "it" || u.role === "admin" || u.role === "purchase";
        const permissionCodes = calculateEffectivePermissions(
          u.role,
          fetchedRolePermissions,
          fetchedPermissions,
          fetchedUserPermissions,
          u.id,
        );

        return {
          ...u,
          allowedBranchIds: assignedBranchIds,
          isAllBranches,
          permissionCodes,
        };
      });

      setData((d) => ({
        ...d,
        items: (items.data ?? []).map(rowToItem),
        categories: (categories.data ?? []).map((r: any) => ({ id: r.id, name: r.name })),
        suppliers: (suppliers.data ?? []).map(rowToSupplier),
        branches: (branches.data ?? []).map((r: any) => ({ id: r.id, name: r.name })),
        users: parsedUsers,
        transactions: (txns.data ?? []).map(rowToTxn),
        purchases: (purchases.data ?? []).map((r: any) => {
          const rawRemark = r.remark ?? "";
          const poMatch = rawRemark.match(/^\[PO:\s*([^\]]*?)\]/);
          const poNumber = poMatch ? poMatch[1].trim() : "";
          const cleanRemark = poMatch ? rawRemark.replace(/^\[PO:\s*[^\]]*?\]\s*/, "") : rawRemark;
          return {
            id: r.id,
            supplierId: r.supplier_id ?? "",
            purchaseDate: r.purchase_date,
            invoiceNumber: r.invoice_number ?? "",
            poNumber,
            employee: r.employee ?? "",
            remark: cleanRemark,
            total: Number(r.total ?? 0),
            branchId: r.branch_id ?? "",
            items: purchasesById.get(r.id) ?? [],
          };
        }),
        inventoryBalance: (inventoryBalance.data ?? []).map((r: any) => ({
          branchId: r.branch_id,
          itemId: r.item_id,
          quantity: Number(r.quantity ?? 0),
          updatedAt: r.updated_at,
        })),
        roles: fetchedRoles,
        permissions: fetchedPermissions,
        rolePermissions: fetchedRolePermissions,
        userPermissions: fetchedUserPermissions,
        userBranches: fetchedUserBranches,
        permissionAuditLogs: fetchedAuditLogs,
      }));

      // Load recipes & sales records from Supabase with localStorage fallback
      let fetchedRecipes: RecipeItem[] = [];
      let recipesLoadedFromSupabase = false;
      try {
        const { data: recData, error: recErr } = await supabase
          .from("recipes")
          .select("*")
          .order("menu_code");
        if (!recErr && recData) {
          recipesLoadedFromSupabase = true;
          fetchedRecipes = recData.map((r: any) => ({
            id: r.id,
            menuCode: r.menu_code,
            menuName: r.menu_name,
            ingredientCode: r.ingredient_code,
            ingredientName: r.ingredient_name,
            quantity: Number(r.quantity),
            unit: r.unit,
            subRecipeCode: r.sub_recipe_code || undefined,
            active: r.active ?? true,
            isDeleted: r.is_deleted ?? false,
            status: r.status || (r.is_deleted ? "deleted" : r.active ? "active" : "inactive"),
            reason: r.reason || "",
            actionTimestamp: r.action_timestamp || r.updated_at || r.created_at,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          }));
        }
      } catch {
        // Ignore table missing
      }

      if (!recipesLoadedFromSupabase && typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("hana-recipes-v1");
          if (raw) fetchedRecipes = JSON.parse(raw);
        } catch {
          // Ignore parse errors
        }
      }

      let fetchedSales: SalesRecord[] = [];
      let salesLoadedFromSupabase = false;
      try {
        const { data: salesData, error: salesErr } = await supabase
          .from("sales_records")
          .select("*")
          .order("date", { ascending: false });
        if (!salesErr && salesData) {
          salesLoadedFromSupabase = true;
          fetchedSales = salesData.map((s: any) => ({
            id: s.id,
            date: s.date,
            menuCode: s.menu_code,
            menuName: s.menu_name,
            quantitySold: Number(s.quantity_sold),
            branchId: s.branch_id || undefined,
            branchName: s.branch_name || undefined,
            createdAt: s.created_at,
          }));
        }
      } catch {
        // Ignore table missing
      }

      if (!salesLoadedFromSupabase && typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("hana-sales-v1");
          if (raw) fetchedSales = JSON.parse(raw);
        } catch {
          // Ignore parse errors
        }
      }

      // Load production recipes and batches
      let fetchedProdRecipes: ProductionRecipe[] = [];
      let fetchedProdBatches: ProductionBatch[] = [];
      try {
        const [pRecipes, pBatches] = await Promise.all([
          fetchProductionRecipesFromDB(),
          fetchProductionBatchesFromDB(),
        ]);
        fetchedProdRecipes = pRecipes;
        fetchedProdBatches = pBatches;
      } catch (pErr) {
        console.warn("Production data load warning:", pErr);
        fetchedProdRecipes = loadCachedProductionRecipes();
        fetchedProdBatches = loadCachedProductionBatches();
      }

      setData((d) => ({
        ...d,
        recipes: fetchedRecipes,
        salesRecords: fetchedSales,
        productionRecipes: fetchedProdRecipes,
        productionBatches: fetchedProdBatches,
      }));

      // Load company branding settings from Supabase (falls back silently)
      try {
        const { data: cs } = await supabase
          .from("company_settings")
          .select("*")
          .eq("id", "singleton")
          .maybeSingle();
        if (cs) {
          setData((d) => ({
            ...d,
            settings: {
              ...d.settings,
              companyName: cs.company_name ?? d.settings.companyName,
              logoUrl: cs.logo_url ?? d.settings.logoUrl,
              address: cs.address ?? d.settings.address,
              phone: cs.phone ?? d.settings.phone,
              email: cs.email ?? d.settings.email,
            },
          }));
        }
      } catch (e) {
        console.warn("company_settings not available", e);
      }
    } catch (err) {
      console.warn("loadAll error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Persist settings locally + theme
  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
    } catch {
      // Ignore write failures (e.g. private browsing / storage quota).
    }
    if (typeof document !== "undefined") {
      if (data.settings.theme === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    }
  }, [data.settings]);

  const currentStock = useCallback(
    (itemId: string) => {
      const it = data.items.find((x) => x.id === itemId) as
        (Item & { currentStock?: number }) | undefined;
      return it?.currentStock ?? 0;
    },
    [data.items],
  );

  const bumpItemStock = useCallback(
    (itemId: string, delta: number) =>
      setData((d) => ({
        ...d,
        items: d.items.map((it) =>
          it.id === itemId
            ? ({ ...it, currentStock: ((it as any).currentStock ?? 0) + delta } as Item)
            : it,
        ),
      })),
    [],
  );

  const persistStock = async (itemId: string, delta: number) => {
    // Read current, then update (no atomic RPC available client-side).
    const { data: row } = await supabase
      .from("items")
      .select("current_stock")
      .eq("id", itemId)
      .maybeSingle();
    const next = Number(row?.current_stock ?? 0) + delta;
    await supabase.from("items").update({ current_stock: next }).eq("id", itemId);
  };

  const currentUser = useMemo(() => {
    if (!data.users || data.users.length === 0) return null;
    if (authUser?.email) {
      const matched = data.users.find(
        (u) => u.id === authUser.id || u.email.toLowerCase() === authUser.email?.toLowerCase(),
      );
      if (matched) {
        const mustChangePassword = !!authUser.user_metadata?.must_change_password;
        return { ...matched, mustChangePassword };
      }
    }
    return null;
  }, [authUser, data.users]);

  const [selectedBranchId, setSelectedBranchIdState] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hana_selected_branch_id");
      if (saved) {
        setSelectedBranchIdState(saved);
      }
    }
  }, []);

  const setSelectedBranchId = useCallback((id: string) => {
    setSelectedBranchIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("hana_selected_branch_id", id);
    }
  }, []);

  useEffect(() => {
    if (data.branches.length > 0) {
      const isAllAllowed =
        currentUser?.role === "owner" ||
        currentUser?.role === "it" ||
        currentUser?.role === "admin" ||
        currentUser?.role === "purchase" ||
        currentUser?.isAllBranches;

      if (selectedBranchId === "all" && !isAllAllowed) {
        const fallback =
          currentUser?.allowedBranchIds?.[0] || currentUser?.branchId || data.branches[0].id;
        setSelectedBranchId(fallback);
        return;
      }

      if (
        selectedBranchId !== "all" &&
        !isAllAllowed &&
        currentUser?.allowedBranchIds &&
        currentUser.allowedBranchIds.length > 0 &&
        !currentUser.allowedBranchIds.includes(selectedBranchId)
      ) {
        setSelectedBranchId(currentUser.allowedBranchIds[0]);
        return;
      }

      if (
        !selectedBranchId ||
        (!data.branches.some((b) => b.id === selectedBranchId) && selectedBranchId !== "all")
      ) {
        const defaultId =
          currentUser?.branchId && data.branches.some((b) => b.id === currentUser.branchId)
            ? currentUser.branchId
            : data.branches[0].id;
        setSelectedBranchId(defaultId);
      }
    }
  }, [data.branches, currentUser, selectedBranchId, setSelectedBranchId]);

  const api = useMemo<StoreCtx>(
    () => ({
      ...data,
      loading,
      currentUser,
      selectedBranchId,
      setSelectedBranchId,
      currentStock,

      addTransaction: async (t) => {
        const { data: row, error } = await supabase
          .from("transactions")
          .insert(txnToRow(t))
          .select()
          .single();
        if (error || !row) {
          console.error(error);
          toast.error("Failed to save transaction");
          return;
        }
        setData((d) => ({ ...d, transactions: [rowToTxn(row), ...d.transactions] }));
        await persistStock(t.itemId, t.quantity);
        bumpItemStock(t.itemId, t.quantity);
      },
      updateTransaction: async (id, patch) => {
        const prev = data.transactions.find((x) => x.id === id);
        const { error } = await supabase.from("transactions").update(txnToRow(patch)).eq("id", id);
        if (error) {
          console.error(error);
          toast.error("Failed to update transaction");
          return;
        }
        setData((d) => ({
          ...d,
          transactions: d.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }));
        if (prev && patch.quantity !== undefined && patch.quantity !== prev.quantity) {
          const delta = patch.quantity - prev.quantity;
          await persistStock(prev.itemId, delta);
          bumpItemStock(prev.itemId, delta);
        }
      },
      deleteTransaction: async (id) => {
        const prev = data.transactions.find((x) => x.id === id);
        const { error } = await supabase.from("transactions").delete().eq("id", id);
        if (error) {
          console.error(error);
          toast.error("Failed to delete transaction");
          return;
        }
        setData((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }));
        if (prev) {
          await persistStock(prev.itemId, -prev.quantity);
          bumpItemStock(prev.itemId, -prev.quantity);
        }
      },

      addItem: async (i) => {
        try {
          const rowPayload = {
            ...itemToRow(i),
            current_stock: 0,
          };

          const isUuid = (val: unknown) =>
            typeof val === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

          if (!isUuid(rowPayload.category_id)) {
            rowPayload.category_id = null;
          }
          if (!isUuid(rowPayload.supplier_id)) {
            rowPayload.supplier_id = null;
          }

          console.log(
            "[addItem] 1. Executing INSERT on public.items table with payload:",
            rowPayload,
          );

          const { data: row, error } = await executeItemMutationWithSchemaFallback(
            (payload) => supabase.from("items").insert(payload).select().single(),
            rowPayload,
          );

          console.log("[addItem] 2. Log Supabase response - data:", row);
          console.log("[addItem] 2. Log Supabase response - error:", error);

          if (error) {
            console.error("[addItem] 3. Database error during INSERT:", error);
            const msg = error.message || error.details || "Database error when creating item";
            toast.error(`Create item failed: ${msg}`);
            return { success: false, error: msg };
          }

          if (!row || !row.id) {
            const msg = "Insert query returned empty data or missing ID";
            console.error("[addItem]", msg);
            toast.error(`Create item failed: ${msg}`);
            return { success: false, error: msg };
          }

          // 9. Immediately fetch the inserted row using its id to verify database persistence
          console.log("[addItem] 9. Immediately fetching inserted row with ID:", row.id);
          const { data: fetchedRow, error: fetchErr } = await supabase
            .from("items")
            .select("*")
            .eq("id", row.id)
            .single();

          console.log("[addItem] 9. Re-fetch query response - data:", fetchedRow);
          console.log("[addItem] 9. Re-fetch query response - error:", fetchErr);

          if (fetchErr || !fetchedRow) {
            const msg =
              fetchErr?.message || "Item was inserted but could not be queried back from database";
            console.error("[addItem] 9. Re-fetch verification failed:", fetchErr);
            toast.error(`Verification failed: ${msg}`);
            return { success: false, error: msg };
          }

          // 10. Only update local state when INSERT succeeded & verified, retaining UI input fields in memory
          const newItemFromDb = rowToItem(fetchedRow);
          const newItem: Item = {
            ...newItemFromDb,
            ...(i.stockUnit !== undefined ? { stockUnit: i.stockUnit } : {}),
            ...(i.recipeUnit !== undefined ? { recipeUnit: i.recipeUnit } : {}),
            ...(i.conversionFactor !== undefined ? { conversionFactor: i.conversionFactor } : {}),
            ...(i.itemType !== undefined ? { itemType: i.itemType } : {}),
            ...(i.barcode !== undefined ? { barcode: i.barcode } : {}),
            ...(i.description !== undefined ? { description: i.description } : {}),
          };
          setData((d) => ({ ...d, items: [...d.items, newItem] }));
          return { success: true, item: newItem };
        } catch (err: any) {
          console.error("[addItem] Unexpected error:", err);
          const msg = err?.message || "An unexpected error occurred during item creation";
          toast.error(msg);
          return { success: false, error: msg };
        }
      },

      updateItem: async (id, p) => {
        try {
          const rowPayload = itemToRow(p);
          const isUuid = (val: unknown) =>
            typeof val === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

          if (!isUuid(rowPayload.category_id)) {
            rowPayload.category_id = null;
          }
          if (!isUuid(rowPayload.supplier_id)) {
            rowPayload.supplier_id = null;
          }

          console.log(
            "[updateItem] Executing UPDATE query on public.items for ID:",
            id,
            "payload:",
            rowPayload,
          );
          const { error } = await executeItemMutationWithSchemaFallback(
            (payload) => supabase.from("items").update(payload).eq("id", id),
            rowPayload,
          );
          console.log("[updateItem] Supabase UPDATE response error:", error);

          if (error) {
            console.error("[updateItem] Database error during UPDATE:", error);
            const msg = error.message || "Failed to update item";
            toast.error(msg);
            return { success: false, error: msg };
          }

          // Fetch updated row back
          const { data: fetchedRow, error: fetchErr } = await supabase
            .from("items")
            .select("*")
            .eq("id", id)
            .single();

          if (fetchErr || !fetchedRow) {
            const msg = fetchErr?.message || "Updated item could not be re-queried";
            toast.error(msg);
            return { success: false, error: msg };
          }

          const updatedFromDb = rowToItem(fetchedRow);
          const updated: Item = {
            ...updatedFromDb,
            ...(p.stockUnit !== undefined ? { stockUnit: p.stockUnit } : {}),
            ...(p.recipeUnit !== undefined ? { recipeUnit: p.recipeUnit } : {}),
            ...(p.conversionFactor !== undefined ? { conversionFactor: p.conversionFactor } : {}),
            ...(p.itemType !== undefined ? { itemType: p.itemType } : {}),
            ...(p.barcode !== undefined ? { barcode: p.barcode } : {}),
            ...(p.description !== undefined ? { description: p.description } : {}),
          };
          setData((d) => ({
            ...d,
            items: d.items.map((x) => (x.id === id ? updated : x)),
          }));
          return { success: true, item: updated };
        } catch (err: any) {
          console.error("[updateItem] Unexpected error:", err);
          const msg = err?.message || "An unexpected error occurred during item update";
          toast.error(msg);
          return { success: false, error: msg };
        }
      },

      deleteItem: async (id) => {
        try {
          console.log("[deleteItem] Executing DELETE query on public.items for ID:", id);
          const { error } = await supabase.from("items").delete().eq("id", id);
          console.log("[deleteItem] Supabase DELETE response error:", error);

          if (error) {
            console.error("[deleteItem] Database error during DELETE:", error);
            const msg = error.message || "Failed to delete item";
            toast.error(msg);
            return { success: false, error: msg };
          }

          setData((d) => ({ ...d, items: d.items.filter((x) => x.id !== id) }));
          return { success: true };
        } catch (err: any) {
          console.error("[deleteItem] Unexpected error:", err);
          const msg = err?.message || "An unexpected error occurred during item deletion";
          toast.error(msg);
          return { success: false, error: msg };
        }
      },

      addSupplier: async (s) => {
        const { data: row, error } = await supabase
          .from("suppliers")
          .insert(supplierToRow(s))
          .select()
          .single();
        if (error || !row) {
          console.error(error);
          toast.error(error?.message || "Failed to add supplier");
          return;
        }
        setData((d) => ({ ...d, suppliers: [...d.suppliers, rowToSupplier(row)] }));
      },
      updateSupplier: async (id, p) => {
        const { error } = await supabase.from("suppliers").update(supplierToRow(p)).eq("id", id);
        if (error) {
          console.error(error);
          toast.error(error.message || "Failed to update supplier");
          return;
        }
        setData((d) => ({
          ...d,
          suppliers: d.suppliers.map((x) => (x.id === id ? { ...x, ...p } : x)),
        }));
      },
      deleteSupplier: async (id) => {
        const { error } = await supabase.from("suppliers").delete().eq("id", id);
        if (error) {
          console.error(error);
          toast.error(error.message || "Failed to delete supplier");
          return;
        }
        setData((d) => ({ ...d, suppliers: d.suppliers.filter((x) => x.id !== id) }));
      },

      addPurchase: async (p) => {
        const dbRemark =
          p.poNumber && p.poNumber.trim()
            ? `[PO: ${p.poNumber.trim()}] ${p.remark || ""}`.trim()
            : p.remark || "";

        const { data: pRow, error } = await supabase
          .from("purchases")
          .insert({
            supplier_id: p.supplierId || null,
            purchase_date: p.purchaseDate,
            invoice_number: p.invoiceNumber,
            employee: p.employee,
            remark: dbRemark,
            total: p.total,
            branch_id: p.branchId || null,
          })
          .select()
          .single();
        if (error || !pRow) {
          console.error(error);
          toast.error(error?.message || "Failed to save purchase");
          return;
        }

        const lineRows = p.items.map((it) => ({
          purchase_id: pRow.id,
          item_id: it.itemId,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          expiry_date: it.expiryDate,
          remark: it.remark,
        }));
        if (lineRows.length) {
          const { error: lineErr } = await supabase.from("purchase_items").insert(lineRows);
          if (lineErr) console.error(lineErr);
        }

        const txnRows = p.items.map((it) => ({
          item_id: it.itemId,
          type: "purchase" as const,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          date: p.purchaseDate,
          supplier_id: p.supplierId || null,
          branch_id: p.branchId || null,
          ref_id: pRow.id,
          expiry_date: it.expiryDate,
          employee: p.employee,
          remark: it.remark,
        }));
        const { data: newTxns } = await supabase.from("transactions").insert(txnRows).select();

        // Update stock per item
        await Promise.all(p.items.map((it) => persistStock(it.itemId, it.quantity)));

        // Insert audit log entries silently for Receiving Created, Price Override, and Expiry Override
        try {
          const auditLogsToInsert: any[] = [
            {
              table_name: "purchases",
              record_id: pRow.id,
              action: "INSERT",
              after_value: {
                event: "Receiving Created",
                invoice_number: p.invoiceNumber,
                supplier_id: p.supplierId,
                branch_id: p.branchId,
                total: p.total,
                item_count: p.items.length,
              },
              branch_id: p.branchId || null,
            },
          ];

          for (const item of p.items) {
            if (item.isPriceEdited) {
              auditLogsToInsert.push({
                table_name: "purchase_items",
                record_id: pRow.id,
                action: "UPDATE",
                after_value: {
                  event: "Price Override",
                  item_id: item.itemId,
                  edited_unit_price: item.unitPrice,
                  vat_type: item.vatType ?? "V",
                },
                branch_id: p.branchId || null,
              });
            }
            if (item.isExpiryEdited) {
              auditLogsToInsert.push({
                table_name: "purchase_items",
                record_id: pRow.id,
                action: "UPDATE",
                before_value: { original_expiry: item.originalExpiryDate },
                after_value: {
                  event: "Expiry Override",
                  item_id: item.itemId,
                  edited_expiry: item.expiryDate,
                  edited_by: p.employee || "Staff",
                  edited_at: new Date().toISOString(),
                },
                branch_id: p.branchId || null,
              });
            }
          }

          if (auditLogsToInsert.length) {
            await supabase.from("audit_logs").insert(auditLogsToInsert);
          }
        } catch (auditErr) {
          console.warn("Silent audit logging error:", auditErr);
        }

        setData((d) => ({
          ...d,
          purchases: [{ ...p, id: pRow.id, poNumber: p.poNumber?.trim() || "" }, ...d.purchases],
          transactions: [...(newTxns ?? []).map(rowToTxn), ...d.transactions],
          items: d.items.map((it) => {
            const line = p.items.find((l) => l.itemId === it.id);
            if (!line) return it;
            return { ...it, currentStock: ((it as any).currentStock ?? 0) + line.quantity } as Item;
          }),
        }));
      },

      updatePurchaseWithRevision: async ({ purchaseId, updatedFields, items, reason }) => {
        const prev = data.purchases.find((x) => x.id === purchaseId);
        if (!prev) return { success: false, error: "Document not found" };

        const userRole = currentUser?.role || "staff";
        const isOwner = userRole === "owner" || userRole === "it";
        const isAdmin = userRole === "admin";
        const isManager = userRole === "manager";
        const isStaff = userRole === "staff";

        // 1. Locked check
        if (prev.status === "Locked" && !isOwner && !isAdmin) {
          return { success: false, error: "This document is locked." };
        }

        // 2. Staff rules check
        if (isStaff) {
          const isCreator =
            prev.createdBy === currentUser?.id ||
            prev.createdBy === currentUser?.name ||
            prev.employee === currentUser?.name ||
            prev.employee === currentUser?.email;
          const docDateStr = new Date(prev.createdAt || prev.purchaseDate)
            .toISOString()
            .slice(0, 10);
          const todayStr = new Date().toISOString().slice(0, 10);

          if (!isCreator || docDateStr !== todayStr) {
            return {
              success: false,
              error: "You do not have permission to edit this document.",
            };
          }
        }

        // 3. Manager branch check
        if (isManager) {
          const hasAccess =
            currentUser?.allowedBranchIds?.includes(prev.branchId) ||
            currentUser?.branchId === prev.branchId ||
            currentUser?.isAllBranches;
          if (!hasAccess) {
            return {
              success: false,
              error: "You do not have permission to edit documents in this branch.",
            };
          }
        }

        // 4. Reason requirement
        const docDateStr = new Date(prev.purchaseDate).toISOString().slice(0, 10);
        const todayStr = new Date().toISOString().slice(0, 10);
        const isHistorical = docDateStr < todayStr;

        if ((isHistorical || !isStaff) && !reason?.trim()) {
          return { success: false, error: "Reason for Edit is required." };
        }

        const newRevNum = (prev.revision || 1) + 1;
        const changes: DocumentRevisionChange[] = [];
        const auditLogs: DocumentAuditLog[] = [];

        // Check header changes
        if (updatedFields.supplierId && updatedFields.supplierId !== prev.supplierId) {
          const oldName =
            data.suppliers.find((s) => s.id === prev.supplierId)?.name || prev.supplierId;
          const newName =
            data.suppliers.find((s) => s.id === updatedFields.supplierId)?.name ||
            updatedFields.supplierId;
          changes.push({ field: "Supplier", oldValue: oldName, newValue: newName });
        }
        if (updatedFields.invoiceNumber && updatedFields.invoiceNumber !== prev.invoiceNumber) {
          changes.push({
            field: "Invoice Number",
            oldValue: prev.invoiceNumber,
            newValue: updatedFields.invoiceNumber,
          });
        }
        if (updatedFields.poNumber !== undefined && updatedFields.poNumber !== prev.poNumber) {
          changes.push({
            field: "PO Number",
            oldValue: prev.poNumber || "—",
            newValue: updatedFields.poNumber || "—",
          });
        }
        if (updatedFields.purchaseDate && updatedFields.purchaseDate !== prev.purchaseDate) {
          changes.push({
            field: "Purchase Date",
            oldValue: prev.purchaseDate,
            newValue: updatedFields.purchaseDate,
          });
        }
        if (updatedFields.status && updatedFields.status !== prev.status) {
          changes.push({
            field: "Status",
            oldValue: prev.status || "Completed",
            newValue: updatedFields.status,
          });
        }

        // Compare items
        items.forEach((newItem) => {
          const oldItem = prev.items.find((i) => i.itemId === newItem.itemId);
          const itemObj = data.items.find((i) => i.id === newItem.itemId);
          const itemName = itemObj?.name || newItem.itemId;

          if (oldItem) {
            if (oldItem.quantity !== newItem.quantity) {
              changes.push({
                field: `Quantity (${itemName})`,
                oldValue: oldItem.quantity,
                newValue: newItem.quantity,
              });
            }
            if (oldItem.unitPrice !== newItem.unitPrice) {
              changes.push({
                field: `Unit Price (${itemName})`,
                oldValue: oldItem.unitPrice,
                newValue: newItem.unitPrice,
              });
            }
            if (oldItem.vatType !== newItem.vatType) {
              changes.push({
                field: `VAT Type (${itemName})`,
                oldValue: oldItem.vatType || "V",
                newValue: newItem.vatType || "V",
              });
            }
            if (oldItem.expiryDate !== newItem.expiryDate) {
              changes.push({
                field: `Expiry Date (${itemName})`,
                oldValue: oldItem.expiryDate || "—",
                newValue: newItem.expiryDate || "—",
              });
            }
          } else {
            changes.push({
              field: `Added Item (${itemName})`,
              oldValue: "—",
              newValue: `Qty: ${newItem.quantity}, Price: ${newItem.unitPrice}`,
            });
          }
        });

        const newTotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

        const newRevision: DocumentRevision = {
          id: crypto.randomUUID(),
          documentType: "receiving",
          documentId: prev.id,
          revisionNumber: newRevNum,
          editedBy: currentUser?.name || currentUser?.email || "User",
          editedByRole: currentUser?.role,
          editedAt: new Date().toISOString(),
          reason: reason || "Document updated",
          changes,
        };

        changes.forEach((c) => {
          auditLogs.push({
            id: crypto.randomUUID(),
            documentType: "receiving",
            documentId: prev.id,
            revisionNumber: newRevNum,
            fieldChanged: c.field,
            oldValue: String(c.oldValue ?? "—"),
            newValue: String(c.newValue ?? "—"),
            editedBy: currentUser?.name || currentUser?.email || "User",
            editedAt: new Date().toISOString(),
            reason: reason || "Document updated",
            branchId: prev.branchId,
          });
        });

        const updatedDoc: Purchase = {
          ...prev,
          ...updatedFields,
          items,
          total: newTotal,
          revision: newRevNum,
          updatedBy: currentUser?.id || currentUser?.name,
          updatedAt: new Date().toISOString(),
          revisions: [newRevision, ...(prev.revisions || [])],
        };

        // Adjust stock balances for changed item quantities
        for (const newItem of items) {
          const oldItem = prev.items.find((i) => i.itemId === newItem.itemId);
          const oldQty = oldItem ? oldItem.quantity : 0;
          const diff = newItem.quantity - oldQty;
          if (diff !== 0) {
            await persistStock(newItem.itemId, diff);
          }
        }

        setData((d) => ({
          ...d,
          purchases: d.purchases.map((p) => (p.id === purchaseId ? updatedDoc : p)),
          documentAuditLogs: [...auditLogs, ...d.documentAuditLogs],
        }));

        const targetPo = updatedDoc.poNumber ?? "";
        const targetRemark = updatedDoc.remark ?? "";
        const dbRemark = targetPo.trim()
          ? `[PO: ${targetPo.trim()}] ${targetRemark}`.trim()
          : targetRemark;

        try {
          await supabase
            .from("purchases")
            .update({
              supplier_id: updatedDoc.supplierId,
              invoice_number: updatedDoc.invoiceNumber,
              purchase_date: updatedDoc.purchaseDate,
              remark: dbRemark,
              total: updatedDoc.total,
              revision: newRevNum,
              updated_by: updatedDoc.updatedBy,
              updated_at: updatedDoc.updatedAt,
              status: updatedDoc.status,
            })
            .eq("id", purchaseId);
        } catch (err) {
          console.warn("Supabase purchase update notice:", err);
        }

        return { success: true };
      },

      togglePurchaseLock: async ({ purchaseId, lock, reason }) => {
        const userRole = currentUser?.role || "staff";
        const canLock = userRole === "owner" || userRole === "it" || userRole === "admin";
        if (!canLock) {
          return {
            success: false,
            error: "Only Owner, Admin, or IT can lock or unlock documents.",
          };
        }

        const prev = data.purchases.find((p) => p.id === purchaseId);
        if (!prev) return { success: false, error: "Document not found" };

        const newStatus: DocumentStatus = lock ? "Locked" : "Completed";
        const updatedDoc: Purchase = {
          ...prev,
          status: newStatus,
          lockedBy: lock ? currentUser?.id || currentUser?.name : undefined,
          lockedAt: lock ? new Date().toISOString() : undefined,
        };

        const auditLog: DocumentAuditLog = {
          id: crypto.randomUUID(),
          documentType: "receiving",
          documentId: prev.id,
          revisionNumber: prev.revision || 1,
          fieldChanged: "Status",
          oldValue: prev.status || "Completed",
          newValue: newStatus,
          editedBy: currentUser?.name || currentUser?.email || "User",
          editedAt: new Date().toISOString(),
          reason: reason || (lock ? "Document Locked" : "Document Unlocked"),
          branchId: prev.branchId,
        };

        setData((d) => ({
          ...d,
          purchases: d.purchases.map((p) => (p.id === purchaseId ? updatedDoc : p)),
          documentAuditLogs: [auditLog, ...d.documentAuditLogs],
        }));

        try {
          await supabase
            .from("purchases")
            .update({
              status: newStatus,
              locked_by: updatedDoc.lockedBy || null,
              locked_at: updatedDoc.lockedAt || null,
            })
            .eq("id", purchaseId);
        } catch (err) {
          console.warn("Lock update notice:", err);
        }

        return { success: true };
      },

      addStockCountDocument: async (doc) => {
        const newDoc: StockCountDocument = {
          ...doc,
          id: crypto.randomUUID(),
          documentNumber: `SC-${String(data.stockCounts.length + 1).padStart(5, "0")}`,
          revision: 1,
          createdAt: new Date().toISOString(),
          status: doc.status || "Completed",
          createdBy: doc.createdBy || currentUser?.name || currentUser?.email || "Staff",
        };

        for (const item of newDoc.items) {
          if (item.variance !== 0) {
            await persistStock(item.itemId, item.variance);
          }
        }

        setData((d) => ({
          ...d,
          stockCounts: [newDoc, ...d.stockCounts],
        }));

        return newDoc;
      },

      updateStockCountWithRevision: async ({ documentId, updatedFields, items, reason }) => {
        const prev = data.stockCounts.find((x) => x.id === documentId);
        if (!prev) return { success: false, error: "Document not found" };

        const userRole = currentUser?.role || "staff";
        const isOwner = userRole === "owner" || userRole === "it";
        const isAdmin = userRole === "admin";
        const isManager = userRole === "manager";
        const isStaff = userRole === "staff";

        if (prev.status === "Locked" && !isOwner && !isAdmin) {
          return { success: false, error: "This document is locked." };
        }

        if (isStaff) {
          const isCreator =
            prev.createdBy === currentUser?.id ||
            prev.createdBy === currentUser?.name ||
            prev.createdBy === currentUser?.email;
          const docDateStr = new Date(prev.createdAt || prev.countDate).toISOString().slice(0, 10);
          const todayStr = new Date().toISOString().slice(0, 10);

          if (!isCreator) {
            return {
              success: false,
              error: "You do not have permission to edit this Stock Count.",
            };
          }
          if (docDateStr < todayStr) {
            return {
              success: false,
              error: "Editing period has expired.",
            };
          }
        }

        if (isManager) {
          const hasAccess =
            currentUser?.allowedBranchIds?.includes(prev.branchId) ||
            currentUser?.branchId === prev.branchId ||
            currentUser?.isAllBranches;
          if (!hasAccess) {
            return {
              success: false,
              error: "You do not have permission to edit documents in this branch.",
            };
          }
        }

        const docDateStr = new Date(prev.countDate).toISOString().slice(0, 10);
        const todayStr = new Date().toISOString().slice(0, 10);
        const isHistorical = docDateStr < todayStr;

        if ((isHistorical || !isStaff) && !reason?.trim()) {
          return { success: false, error: "Reason for Edit is required." };
        }

        const newRevNum = prev.revision + 1;
        const changes: DocumentRevisionChange[] = [];
        const auditLogs: DocumentAuditLog[] = [];

        if (updatedFields.countDate && updatedFields.countDate !== prev.countDate) {
          changes.push({
            field: "Count Date",
            oldValue: prev.countDate,
            newValue: updatedFields.countDate,
          });
        }
        if (updatedFields.status && updatedFields.status !== prev.status) {
          changes.push({ field: "Status", oldValue: prev.status, newValue: updatedFields.status });
        }
        if (updatedFields.remark !== undefined && updatedFields.remark !== prev.remark) {
          changes.push({
            field: "Remark",
            oldValue: prev.remark || "—",
            newValue: updatedFields.remark || "—",
          });
        }

        items.forEach((newItem) => {
          const oldItem = prev.items.find((i) => i.itemId === newItem.itemId);
          const itemObj = data.items.find((i) => i.id === newItem.itemId);
          const itemName = itemObj?.name || newItem.itemId;

          if (oldItem) {
            if (oldItem.countedQty !== newItem.countedQty) {
              changes.push({
                field: `Counted Qty (${itemName})`,
                oldValue: oldItem.countedQty,
                newValue: newItem.countedQty,
              });
            }
            if (oldItem.variance !== newItem.variance) {
              changes.push({
                field: `Variance (${itemName})`,
                oldValue: oldItem.variance,
                newValue: newItem.variance,
              });
            }
          } else {
            changes.push({
              field: `Added Item (${itemName})`,
              oldValue: "—",
              newValue: `Counted: ${newItem.countedQty}, Variance: ${newItem.variance}`,
            });
          }
        });

        for (const newItem of items) {
          const oldItem = prev.items.find((i) => i.itemId === newItem.itemId);
          const oldVar = oldItem ? oldItem.variance : 0;
          const varDiff = newItem.variance - oldVar;
          if (varDiff !== 0) {
            await persistStock(newItem.itemId, varDiff);
          }
        }

        const newRevision: DocumentRevision = {
          id: crypto.randomUUID(),
          documentType: "stock_count",
          documentId: prev.id,
          revisionNumber: newRevNum,
          editedBy: currentUser?.name || currentUser?.email || "User",
          editedByRole: currentUser?.role,
          editedAt: new Date().toISOString(),
          reason: reason || "Stock Count updated",
          changes,
        };

        changes.forEach((c) => {
          auditLogs.push({
            id: crypto.randomUUID(),
            documentType: "stock_count",
            documentId: prev.id,
            revisionNumber: newRevNum,
            fieldChanged: c.field,
            oldValue: String(c.oldValue ?? "—"),
            newValue: String(c.newValue ?? "—"),
            editedBy: currentUser?.name || currentUser?.email || "User",
            editedAt: new Date().toISOString(),
            reason: reason || "Stock Count updated",
            branchId: prev.branchId,
          });
        });

        const updatedDoc: StockCountDocument = {
          ...prev,
          ...updatedFields,
          items,
          revision: newRevNum,
          updatedBy: currentUser?.id || currentUser?.name,
          updatedAt: new Date().toISOString(),
          revisions: [newRevision, ...(prev.revisions || [])],
        };

        setData((d) => ({
          ...d,
          stockCounts: d.stockCounts.map((x) => (x.id === documentId ? updatedDoc : x)),
          documentAuditLogs: [...auditLogs, ...d.documentAuditLogs],
        }));

        return { success: true };
      },

      toggleStockCountLock: async ({ documentId, lock, reason }) => {
        const userRole = currentUser?.role || "staff";
        const canLock = userRole === "owner" || userRole === "it" || userRole === "admin";
        if (!canLock) {
          return {
            success: false,
            error: "Only Owner, Admin, or IT can lock or unlock documents.",
          };
        }

        const prev = data.stockCounts.find((x) => x.id === documentId);
        if (!prev) return { success: false, error: "Document not found" };

        const newStatus: DocumentStatus = lock ? "Locked" : "Completed";
        const updatedDoc: StockCountDocument = {
          ...prev,
          status: newStatus,
          lockedBy: lock ? currentUser?.id || currentUser?.name : undefined,
          lockedAt: lock ? new Date().toISOString() : undefined,
        };

        const auditLog: DocumentAuditLog = {
          id: crypto.randomUUID(),
          documentType: "stock_count",
          documentId: prev.id,
          revisionNumber: prev.revision,
          fieldChanged: "Status",
          oldValue: prev.status,
          newValue: newStatus,
          editedBy: currentUser?.name || currentUser?.email || "User",
          editedAt: new Date().toISOString(),
          reason: reason || (lock ? "Document Locked" : "Document Unlocked"),
          branchId: prev.branchId,
        };

        setData((d) => ({
          ...d,
          stockCounts: d.stockCounts.map((x) => (x.id === documentId ? updatedDoc : x)),
          documentAuditLogs: [auditLog, ...d.documentAuditLogs],
        }));

        return { success: true };
      },

      addUser: async (u) => {
        const { data: row, error } = await supabase
          .from("users")
          .insert(userToRow(u))
          .select()
          .single();
        if (error || !row) {
          console.error(error);
          toast.error(error?.message || "Failed to add user");
          return;
        }
        setData((d) => ({ ...d, users: [...d.users, rowToUser(row)] }));
      },
      updateUser: async (id, p) => {
        const { error } = await supabase.from("users").update(userToRow(p)).eq("id", id);
        if (error) {
          console.error(error);
          toast.error(error.message || "Failed to update user");
          return;
        }
        setData((d) => ({
          ...d,
          users: d.users.map((x) => (x.id === id ? { ...x, ...p } : x)),
        }));
      },
      deleteUser: async (id) => {
        const targetUser = data.users.find((u) => u.id === id);
        await supabase.from("user_branches").delete().eq("user_id", id);
        await supabase.from("user_permissions").delete().eq("user_id", id);
        const { error } = await supabase.from("users").delete().eq("id", id);
        if (error) {
          console.error(error);
          toast.error(error.message || "Failed to delete user");
          return;
        }
        await supabase.from("permission_audit_logs").insert({
          target_user_id: id,
          actor_id: currentUser?.id || null,
          action: "USER_DELETE",
          details: { user_name: targetUser?.name, email: targetUser?.email },
        });
        setData((d) => ({ ...d, users: d.users.filter((x) => x.id !== id) }));
        toast.success("User deleted successfully");
      },

      saveUserWithRBAC: async (params) => {
        let targetUserId = params.id;
        const prevUser = targetUserId ? data.users.find((u) => u.id === targetUserId) : undefined;

        // 1. Insert or Update User row
        if (targetUserId) {
          const { error } = await supabase
            .from("users")
            .update({
              name: params.user.name,
              email: params.user.email,
              role: params.user.role,
              status: params.user.status,
              branch_id: params.selectedBranchIds[0] || null,
            })
            .eq("id", targetUserId);
          if (error) {
            toast.error(error.message || "Failed to update user");
            return;
          }
        } else {
          // Creating real auth.users account and public.users row
          const secondaryClient = createSecondaryAuthClient();
          const passToUse =
            params.tempPassword || "HanaPass!" + Math.random().toString(36).substring(2, 8) + "123";

          const { data: authRes, error: authErr } = await secondaryClient.auth.signUp({
            email: params.user.email,
            password: passToUse,
            options: {
              data: {
                name: params.user.name,
                role: params.user.role,
                must_change_password: true,
              },
            },
          });

          if (authErr) {
            console.warn("Auth signup notice:", authErr);
          }

          if (authRes?.user?.id) {
            targetUserId = authRes.user.id;
          } else {
            targetUserId = crypto.randomUUID();
          }

          if (params.authMethod === "email_invite") {
            await supabase.auth.resetPasswordForEmail(params.user.email, {
              redirectTo: window.location.origin + "/login?reset=true",
            });
          }

          const { data: newRow, error } = await supabase
            .from("users")
            .upsert({
              id: targetUserId,
              name: params.user.name,
              email: params.user.email,
              role: params.user.role,
              status: params.user.status,
              branch_id: params.selectedBranchIds[0] || null,
            })
            .select()
            .single();

          if (error || !newRow) {
            toast.error(error?.message || "Failed to create user record");
            return;
          }
          targetUserId = newRow.id;
        }

        // 2. Sync user_branches
        await supabase.from("user_branches").delete().eq("user_id", targetUserId);
        if (!params.isAllBranches && params.selectedBranchIds.length > 0) {
          const branchRows = params.selectedBranchIds.map((bId) => ({
            user_id: targetUserId,
            branch_id: bId,
          }));
          const { error: bErr } = await supabase.from("user_branches").insert(branchRows);
          if (bErr) console.warn("Error inserting user_branches", bErr);
        }

        // 3. Sync custom permission overrides (user_permissions)
        await supabase.from("user_permissions").delete().eq("user_id", targetUserId);
        const permissionRows = [];
        for (const permCode of Object.keys(params.permissionOverrides)) {
          const permObj = data.permissions.find((p) => p.code === permCode);
          if (!permObj) continue;
          const isGranted = params.permissionOverrides[permCode];
          permissionRows.push({
            user_id: targetUserId,
            permission_id: permObj.id,
            is_granted: isGranted,
            granted_by: currentUser?.id || null,
          });
        }
        if (permissionRows.length > 0) {
          const { error: pErr } = await supabase.from("user_permissions").insert(permissionRows);
          if (pErr) console.warn("Error inserting user_permissions", pErr);
        }

        // 4. Audit Log
        const auditLogsToInsert = [];
        if (!prevUser) {
          auditLogsToInsert.push({
            target_user_id: targetUserId,
            actor_id: currentUser?.id || null,
            action: params.authMethod === "email_invite" ? "INVITE_USER" : "USER_CREATE",
            details: {
              role: params.user.role,
              is_all_branches: params.isAllBranches,
              branches_count: params.selectedBranchIds.length,
              auth_method: params.authMethod || "temp_password",
            },
          });
        } else {
          if (prevUser.status !== params.user.status) {
            auditLogsToInsert.push({
              target_user_id: targetUserId,
              actor_id: currentUser?.id || null,
              action: params.user.status === "active" ? "USER_ACTIVATE" : "USER_DEACTIVATE",
              details: { old_status: prevUser.status, new_status: params.user.status },
            });
          }
          if (prevUser.role !== params.user.role) {
            auditLogsToInsert.push({
              target_user_id: targetUserId,
              actor_id: currentUser?.id || null,
              action: "ROLE_CHANGE",
              details: { old_role: prevUser.role, new_role: params.user.role },
            });
          }
          auditLogsToInsert.push({
            target_user_id: targetUserId,
            actor_id: currentUser?.id || null,
            action: "BRANCH_ASSIGNMENT",
            details: {
              is_all_branches: params.isAllBranches,
              selected_branch_ids: params.selectedBranchIds,
            },
          });
          if (Object.keys(params.permissionOverrides).length > 0) {
            auditLogsToInsert.push({
              target_user_id: targetUserId,
              actor_id: currentUser?.id || null,
              action: "PERMISSION_OVERRIDE",
              details: { overrides: params.permissionOverrides },
            });
          }
        }

        if (auditLogsToInsert.length > 0) {
          await supabase.from("permission_audit_logs").insert(auditLogsToInsert);
        }

        toast.success("User configuration saved successfully");
        await loadAll();
      },

      resetUserPassword: async (userId, email, method, tempPassword) => {
        try {
          if (method === "email_invite") {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin + "/login?reset=true",
            });
            if (error) {
              toast.error(error.message || "Failed to send reset email");
              return;
            }
            toast.success(`Reset password link sent to ${email}`);
          } else {
            const passToUse = tempPassword || "HanaTemp123!";
            await supabase.auth.resetPasswordForEmail(email);
            toast.success(`Temporary password instructions generated for ${email}`);
          }

          await supabase.from("permission_audit_logs").insert({
            target_user_id: userId,
            actor_id: currentUser?.id || null,
            action: "RESET_PASSWORD",
            details: { method, email },
          });

          await loadAll();
        } catch (err) {
          console.error(err);
          toast.error("Failed to reset password");
        }
      },

      addRecipeItem: async (item) => {
        const newId = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        const matchedItem = data.items.find(
          (i) => i.code.toLowerCase().trim() === item.ingredientCode.toLowerCase().trim(),
        );
        const resolvedIngCode = matchedItem ? matchedItem.code : item.ingredientCode.trim();
        const resolvedIngName = matchedItem
          ? matchedItem.name
          : item.ingredientName || resolvedIngCode;

        const newItem: RecipeItem = {
          ...item,
          ingredientCode: resolvedIngCode,
          ingredientName: resolvedIngName,
          id: newId,
          active: item.active ?? true,
          isDeleted: false,
          status: item.active ? "active" : "inactive",
          reason: item.reason || "",
          actionTimestamp: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        const nextRecipes = [...data.recipes, newItem];
        setData((d) => ({ ...d, recipes: nextRecipes }));
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("hana-recipes-v1", JSON.stringify(nextRecipes));
          } catch (e) {
            console.warn("localStorage write error", e);
          }
        }
        try {
          // Ensure ingredient exists in Supabase items table to satisfy foreign key fk_recipes_ingredient_code
          const { data: existingItem } = await supabase
            .from("items")
            .select("code")
            .eq("code", resolvedIngCode)
            .maybeSingle();

          if (!existingItem) {
            await supabase.from("items").upsert(
              {
                id: matchedItem?.id || crypto.randomUUID(),
                code: resolvedIngCode,
                name: resolvedIngName,
                category: matchedItem?.category || "Raw Material",
                primary_unit: matchedItem?.primaryUnit || item.unit || "unit",
                current_stock: matchedItem?.currentStock ?? 0,
                min_stock: matchedItem?.minStock ?? 0,
                yield_percent: matchedItem?.yieldPercent ?? 100,
                active: true,
                created_at: timestamp,
                updated_at: timestamp,
              },
              { onConflict: "code" },
            );
          }

          const fullPayload = {
            id: newId,
            menu_code: item.menuCode,
            menu_name: item.menuName,
            ingredient_code: resolvedIngCode,
            ingredient_name: resolvedIngName,
            quantity: item.quantity,
            unit: item.unit,
            sub_recipe_code: item.subRecipeCode || "",
            active: item.active ?? true,
            is_deleted: false,
            status: item.active ? "active" : "inactive",
            reason: item.reason || "",
            action_timestamp: timestamp,
            created_at: timestamp,
            updated_at: timestamp,
          };
          const { error } = await supabase.from("recipes").insert(fullPayload);
          if (error && (error.code === "PGRST204" || error.message?.includes("column"))) {
            const standardPayload = {
              id: newId,
              menu_code: item.menuCode,
              menu_name: item.menuName,
              ingredient_code: resolvedIngCode,
              ingredient_name: resolvedIngName,
              quantity: item.quantity,
              unit: item.unit,
              sub_recipe_code: item.subRecipeCode || "",
              active: item.active ?? true,
              created_at: timestamp,
              updated_at: timestamp,
            };
            await supabase.from("recipes").insert(standardPayload);
          }
        } catch (err) {
          console.warn("Supabase recipe insert error", err);
        }
        return { success: true };
      },

      updateRecipeItem: async (id, patch) => {
        const timestamp = new Date().toISOString();
        const nextRecipes = data.recipes.map((r) =>
          r.id === id ? { ...r, ...patch, updatedAt: timestamp } : r,
        );
        setData((d) => ({ ...d, recipes: nextRecipes }));
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("hana-recipes-v1", JSON.stringify(nextRecipes));
          } catch (e) {
            console.warn("localStorage write error", e);
          }
        }
        try {
          const row: any = {};
          if (patch.menuCode !== undefined) row.menu_code = patch.menuCode;
          if (patch.menuName !== undefined) row.menu_name = patch.menuName;
          if (patch.ingredientCode !== undefined) row.ingredient_code = patch.ingredientCode;
          if (patch.ingredientName !== undefined) row.ingredient_name = patch.ingredientName;
          if (patch.quantity !== undefined) row.quantity = patch.quantity;
          if (patch.unit !== undefined) row.unit = patch.unit;
          if (patch.subRecipeCode !== undefined) row.sub_recipe_code = patch.subRecipeCode;
          if (patch.active !== undefined) row.active = patch.active;
          if (patch.isDeleted !== undefined) row.is_deleted = patch.isDeleted;
          if (patch.status !== undefined) row.status = patch.status;
          if (patch.reason !== undefined) row.reason = patch.reason;
          if (patch.actionTimestamp !== undefined) row.action_timestamp = patch.actionTimestamp;
          row.updated_at = timestamp;

          const { error } = await supabase.from("recipes").update(row).eq("id", id);
          if (error && (error.code === "PGRST204" || error.message?.includes("column"))) {
            delete row.is_deleted;
            delete row.status;
            delete row.reason;
            delete row.action_timestamp;
            await supabase.from("recipes").update(row).eq("id", id);
          }
        } catch (err) {
          console.warn("Supabase recipe update error", err);
        }
        return { success: true };
      },

      deleteRecipeItem: async (id) => {
        const nextRecipes = data.recipes.filter((r) => r.id !== id);
        setData((d) => ({ ...d, recipes: nextRecipes }));
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("hana-recipes-v1", JSON.stringify(nextRecipes));
          } catch (e) {
            console.warn("localStorage write error", e);
          }
        }
        try {
          const { error } = await supabase.from("recipes").delete().eq("id", id);
          if (error) console.error("Supabase recipe delete error:", error);
        } catch (err) {
          console.warn("Supabase recipe delete error", err);
        }
        return { success: true };
      },

      deleteRecipeByMenuCode: async (menuCode, reason) => {
        if (reason) {
          const timestamp = new Date().toISOString();
          const nextRecipes = data.recipes.map((r) => {
            if (r.menuCode.toLowerCase().trim() === menuCode.toLowerCase().trim()) {
              return {
                ...r,
                active: false,
                isDeleted: true,
                status: "deleted",
                reason,
                actionTimestamp: timestamp,
                updatedAt: timestamp,
              };
            }
            return r;
          });
          setData((d) => ({ ...d, recipes: nextRecipes }));
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("hana-recipes-v1", JSON.stringify(nextRecipes));
            } catch (e) {
              console.warn("localStorage write error", e);
            }
          }
          try {
            const idsToUpdate = data.recipes
              .filter((r) => r.menuCode.toLowerCase().trim() === menuCode.toLowerCase().trim())
              .map((r) => r.id);
            if (idsToUpdate.length > 0) {
              const fullPayload = {
                active: false,
                is_deleted: true,
                status: "deleted",
                reason,
                action_timestamp: timestamp,
                updated_at: timestamp,
              };
              const { error } = await supabase
                .from("recipes")
                .update(fullPayload)
                .in("id", idsToUpdate);
              if (error && (error.code === "PGRST204" || error.message?.includes("column"))) {
                await supabase
                  .from("recipes")
                  .update({ active: false, updated_at: timestamp })
                  .in("id", idsToUpdate);
              }
            }
          } catch (err) {
            console.warn("Supabase deleteRecipeByMenuCode error", err);
          }
          return { success: true };
        } else {
          // Hard delete
          const nextRecipes = data.recipes.filter(
            (r) => r.menuCode.toLowerCase().trim() !== menuCode.toLowerCase().trim(),
          );
          setData((d) => ({ ...d, recipes: nextRecipes }));
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("hana-recipes-v1", JSON.stringify(nextRecipes));
            } catch (e) {
              console.warn("localStorage write error", e);
            }
          }
          try {
            const targetIds = data.recipes
              .filter((r) => r.menuCode.toLowerCase().trim() === menuCode.toLowerCase().trim())
              .map((r) => r.id);
            if (targetIds.length > 0) {
              await supabase.from("recipes").delete().in("id", targetIds);
            } else {
              await supabase.from("recipes").delete().eq("menu_code", menuCode);
            }
          } catch (err) {
            console.warn("Supabase recipe delete menu error", err);
          }
          return { success: true };
        }
      },

      setRecipeMenuStatus: async (menuCode, active, reason = "") => {
        const timestamp = new Date().toISOString();
        const nextRecipes = data.recipes.map((r) => {
          if (r.menuCode.toLowerCase().trim() === menuCode.toLowerCase().trim()) {
            return {
              ...r,
              active,
              isDeleted: false,
              status: active ? "active" : "inactive",
              reason: reason || r.reason || "",
              actionTimestamp: timestamp,
              updatedAt: timestamp,
            };
          }
          return r;
        });

        setData((d) => ({ ...d, recipes: nextRecipes }));
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("hana-recipes-v1", JSON.stringify(nextRecipes));
          } catch (e) {
            console.warn("localStorage write error", e);
          }
        }

        try {
          const idsToUpdate = data.recipes
            .filter((r) => r.menuCode.toLowerCase().trim() === menuCode.toLowerCase().trim())
            .map((r) => r.id);

          if (idsToUpdate.length > 0) {
            const fullPayload = {
              active,
              is_deleted: false,
              status: active ? "active" : "inactive",
              reason: reason || "",
              action_timestamp: timestamp,
              updated_at: timestamp,
            };
            const { error } = await supabase
              .from("recipes")
              .update(fullPayload)
              .in("id", idsToUpdate);

            if (error && (error.code === "PGRST204" || error.message?.includes("column"))) {
              await supabase
                .from("recipes")
                .update({ active, updated_at: timestamp })
                .in("id", idsToUpdate);
            }
          }
        } catch (err) {
          console.warn("Supabase setRecipeMenuStatus error", err);
        }
        return { success: true };
      },

      softDeleteRecipeByMenuCode: async (menuCode, reason) => {
        const timestamp = new Date().toISOString();
        const nextRecipes = data.recipes.map((r) => {
          if (r.menuCode.toLowerCase().trim() === menuCode.toLowerCase().trim()) {
            return {
              ...r,
              active: false,
              isDeleted: true,
              status: "deleted",
              reason,
              actionTimestamp: timestamp,
              updatedAt: timestamp,
            };
          }
          return r;
        });

        setData((d) => ({ ...d, recipes: nextRecipes }));
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("hana-recipes-v1", JSON.stringify(nextRecipes));
          } catch (e) {
            console.warn("localStorage write error", e);
          }
        }

        try {
          const idsToUpdate = data.recipes
            .filter((r) => r.menuCode.toLowerCase().trim() === menuCode.toLowerCase().trim())
            .map((r) => r.id);

          if (idsToUpdate.length > 0) {
            const fullPayload = {
              active: false,
              is_deleted: true,
              status: "deleted",
              reason,
              action_timestamp: timestamp,
              updated_at: timestamp,
            };
            const { error } = await supabase
              .from("recipes")
              .update(fullPayload)
              .in("id", idsToUpdate);

            if (error && (error.code === "PGRST204" || error.message?.includes("column"))) {
              await supabase
                .from("recipes")
                .update({ active: false, updated_at: timestamp })
                .in("id", idsToUpdate);
            }
          }
        } catch (err) {
          console.warn("Supabase softDeleteRecipeByMenuCode error", err);
        }
        return { success: true };
      },

      restoreRecipeMenu: async (menuCode) => {
        const timestamp = new Date().toISOString();
        const nextRecipes = data.recipes.map((r) => {
          if (r.menuCode.toLowerCase().trim() === menuCode.toLowerCase().trim()) {
            return {
              ...r,
              active: true,
              isDeleted: false,
              status: "active",
              reason: "",
              actionTimestamp: timestamp,
              updatedAt: timestamp,
            };
          }
          return r;
        });

        setData((d) => ({ ...d, recipes: nextRecipes }));
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("hana-recipes-v1", JSON.stringify(nextRecipes));
          } catch (e) {
            console.warn("localStorage write error", e);
          }
        }

        try {
          const idsToUpdate = data.recipes
            .filter((r) => r.menuCode.toLowerCase().trim() === menuCode.toLowerCase().trim())
            .map((r) => r.id);

          if (idsToUpdate.length > 0) {
            const fullPayload = {
              active: true,
              is_deleted: false,
              status: "active",
              reason: "",
              action_timestamp: timestamp,
              updated_at: timestamp,
            };
            const { error } = await supabase
              .from("recipes")
              .update(fullPayload)
              .in("id", idsToUpdate);

            if (error && (error.code === "PGRST204" || error.message?.includes("column"))) {
              await supabase
                .from("recipes")
                .update({ active: true, updated_at: timestamp })
                .in("id", idsToUpdate);
            }
          }
        } catch (err) {
          console.warn("Supabase restoreRecipeMenu error", err);
        }
        return { success: true };
      },

      hardDeleteRecipeByMenuCode: async (menuCode) => {
        const nextRecipes = data.recipes.filter(
          (r) => r.menuCode.toLowerCase().trim() !== menuCode.toLowerCase().trim(),
        );
        setData((d) => ({ ...d, recipes: nextRecipes }));
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("hana-recipes-v1", JSON.stringify(nextRecipes));
          } catch (e) {
            console.warn("localStorage write error", e);
          }
        }

        try {
          const targetIds = data.recipes
            .filter((r) => r.menuCode.toLowerCase().trim() === menuCode.toLowerCase().trim())
            .map((r) => r.id);

          if (targetIds.length > 0) {
            const { error } = await supabase.from("recipes").delete().in("id", targetIds);
            if (error) console.error("Supabase hardDeleteRecipeByMenuCode error:", error);
          } else {
            await supabase.from("recipes").delete().eq("menu_code", menuCode);
          }
        } catch (err) {
          console.warn("Supabase hardDeleteRecipeByMenuCode error", err);
        }
        return { success: true };
      },

      bulkImportRecipes: async (itemsToImport) => {
        const updatedRecipes = [...data.recipes];
        const rowsToUpsert: any[] = [];
        const now = new Date().toISOString();

        itemsToImport.forEach((item) => {
          const matchedItem = data.items.find(
            (i) => i.code.toLowerCase().trim() === item.ingredientCode.toLowerCase().trim(),
          );
          const resolvedIngCode = matchedItem ? matchedItem.code : item.ingredientCode.trim();
          const resolvedIngName = matchedItem
            ? matchedItem.name
            : item.ingredientName || resolvedIngCode;

          const existingIdx = updatedRecipes.findIndex(
            (r) =>
              r.menuCode.toLowerCase().trim() === item.menuCode.toLowerCase().trim() &&
              r.ingredientCode.toLowerCase().trim() === resolvedIngCode.toLowerCase().trim(),
          );
          if (existingIdx >= 0) {
            const existingId = updatedRecipes[existingIdx].id;
            const updatedItem: RecipeItem = {
              ...updatedRecipes[existingIdx],
              ...item,
              ingredientCode: resolvedIngCode,
              ingredientName: resolvedIngName,
              id: existingId,
              updatedAt: now,
            };
            updatedRecipes[existingIdx] = updatedItem;
            rowsToUpsert.push({
              id: existingId,
              menu_code: updatedItem.menuCode,
              menu_name: updatedItem.menuName,
              ingredient_code: resolvedIngCode,
              ingredient_name: resolvedIngName,
              quantity: updatedItem.quantity,
              unit: updatedItem.unit,
              sub_recipe_code: updatedItem.subRecipeCode || "",
              active: updatedItem.active,
              created_at: updatedRecipes[existingIdx].createdAt || now,
              updated_at: now,
            });
          } else {
            const newId = crypto.randomUUID();
            const newItem: RecipeItem = {
              ...item,
              ingredientCode: resolvedIngCode,
              ingredientName: resolvedIngName,
              id: newId,
              createdAt: now,
              updatedAt: now,
            };
            updatedRecipes.push(newItem);
            rowsToUpsert.push({
              id: newId,
              menu_code: newItem.menuCode,
              menu_name: newItem.menuName,
              ingredient_code: resolvedIngCode,
              ingredient_name: resolvedIngName,
              quantity: newItem.quantity,
              unit: newItem.unit,
              sub_recipe_code: newItem.subRecipeCode || "",
              active: newItem.active,
              created_at: now,
              updated_at: now,
            });
          }
        });

        setData((d) => ({ ...d, recipes: updatedRecipes }));
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("hana-recipes-v1", JSON.stringify(updatedRecipes));
          } catch (e) {
            console.warn("localStorage write error", e);
          }
        }

        try {
          // 1. Check foreign key prerequisites: ensure all ingredient_codes exist in items table in Supabase
          const distinctIngredientCodes = Array.from(
            new Set(rowsToUpsert.map((r) => r.ingredient_code)),
          );

          if (distinctIngredientCodes.length > 0) {
            const { data: dbItems } = await supabase
              .from("items")
              .select("code")
              .in("code", distinctIngredientCodes);

            const existingCodesSet = new Set((dbItems || []).map((i: any) => i.code));
            const missingCodes = distinctIngredientCodes.filter((c) => !existingCodesSet.has(c));

            if (missingCodes.length > 0) {
              const itemsToCreate = missingCodes.map((code) => {
                const localMatch = data.items.find(
                  (i) => i.code.toLowerCase().trim() === code.toLowerCase().trim(),
                );
                return {
                  id: localMatch?.id || crypto.randomUUID(),
                  code: localMatch?.code || code,
                  name: localMatch?.name || code,
                  category: localMatch?.category || "Raw Material",
                  primary_unit: localMatch?.primaryUnit || "unit",
                  current_stock: localMatch?.currentStock ?? 0,
                  min_stock: localMatch?.minStock ?? 0,
                  yield_percent: localMatch?.yieldPercent ?? 100,
                  active: true,
                  created_at: now,
                  updated_at: now,
                };
              });

              await supabase.from("items").upsert(itemsToCreate, { onConflict: "code" });
            }
          }

          // 2. Upsert recipes into Supabase
          const { error } = await supabase.from("recipes").upsert(rowsToUpsert);
          if (error) {
            console.error("Supabase recipe bulk import error:", error);
            // Fallback retry with standard columns if schema differences occur
            if (error.code === "PGRST204" || error.message?.includes("column")) {
              const standardRows = rowsToUpsert.map((r) => ({
                id: r.id,
                menu_code: r.menu_code,
                menu_name: r.menu_name,
                ingredient_code: r.ingredient_code,
                ingredient_name: r.ingredient_name,
                quantity: r.quantity,
                unit: r.unit,
                sub_recipe_code: r.sub_recipe_code,
                active: r.active,
                created_at: r.created_at,
                updated_at: r.updated_at,
              }));
              const retryRes = await supabase.from("recipes").upsert(standardRows);
              if (retryRes.error) {
                return {
                  success: false,
                  error: retryRes.error.message || "Failed to persist recipes to Supabase",
                };
              }
            } else {
              return {
                success: false,
                error: error.message || "Failed to persist imported recipes to Supabase database",
              };
            }
          }
        } catch (err: any) {
          console.warn("Supabase recipe bulk import error", err);
          return {
            success: false,
            error: err?.message || "Failed to persist imported recipes",
          };
        }

        return { success: true, importedCount: itemsToImport.length };
      },

      addSalesRecord: async (record) => {
        const newId = crypto.randomUUID();
        const newRecord: SalesRecord = {
          ...record,
          id: newId,
          createdAt: new Date().toISOString(),
        };
        const nextSales = [newRecord, ...data.salesRecords];
        setData((d) => ({ ...d, salesRecords: nextSales }));
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("hana-sales-v1", JSON.stringify(nextSales));
          } catch (e) {
            console.warn("localStorage write error", e);
          }
        }
        try {
          await supabase.from("sales_records").insert({
            id: newId,
            date: record.date,
            menu_code: record.menuCode,
            menu_name: record.menuName,
            quantity_sold: record.quantitySold,
            branch_id: record.branchId || null,
            branch_name: record.branchName || "",
          });
        } catch (err) {
          console.warn("Supabase sales record insert error", err);
        }
        return { success: true };
      },

      bulkImportSalesRecords: async (recordsToImport) => {
        const createdRecords: SalesRecord[] = recordsToImport.map((rec) => ({
          ...rec,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        }));

        const nextSales = [...createdRecords, ...data.salesRecords];
        setData((d) => ({ ...d, salesRecords: nextSales }));
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("hana-sales-v1", JSON.stringify(nextSales));
          } catch (e) {
            console.warn("localStorage write error", e);
          }
        }

        try {
          const rows = createdRecords.map((r) => ({
            id: r.id,
            date: r.date,
            menu_code: r.menuCode,
            menu_name: r.menuName,
            quantity_sold: r.quantitySold,
            branch_id: r.branchId || null,
            branch_name: r.branchName || "",
          }));
          await supabase.from("sales_records").insert(rows);
        } catch (err) {
          console.warn("Supabase sales bulk import error", err);
        }

        return { success: true, importedCount: createdRecords.length };
      },

      deleteSalesRecord: async (id) => {
        const nextSales = data.salesRecords.filter((s) => s.id !== id);
        setData((d) => ({ ...d, salesRecords: nextSales }));
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("hana-sales-v1", JSON.stringify(nextSales));
          } catch (e) {
            console.warn("localStorage write error", e);
          }
        }
        try {
          await supabase.from("sales_records").delete().eq("id", id);
        } catch (err) {
          console.warn("Supabase sales delete error", err);
        }
        return { success: true };
      },

      clearAllSalesRecords: async () => {
        setData((d) => ({ ...d, salesRecords: [] }));
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("hana-sales-v1", JSON.stringify([]));
          } catch (e) {
            console.warn("localStorage write error", e);
          }
        }
        try {
          await supabase
            .from("sales_records")
            .delete()
            .neq("id", "00000000-0000-0000-0000-000000000000");
        } catch (err) {
          console.warn("Supabase sales clear all error", err);
        }
        return { success: true };
      },

      addProductionRecipe: async (recipe) => {
        const res = await saveProductionRecipeToDB(recipe);
        if (res.success && res.data) {
          setData((d) => {
            const exists = d.productionRecipes.some((r) => r.id === res.data!.id);
            const next = exists
              ? d.productionRecipes.map((r) => (r.id === res.data!.id ? res.data! : r))
              : [res.data!, ...d.productionRecipes];
            return { ...d, productionRecipes: next };
          });
        }
        return res;
      },

      updateProductionRecipe: async (id, patch) => {
        const res = await saveProductionRecipeToDB({
          ...patch,
          id,
          producedItemCode: patch.producedItemCode || "",
          yieldQuantity: patch.yieldQuantity || 1,
          yieldUnit: patch.yieldUnit || "unit",
          ingredients: patch.ingredients || [],
        });
        if (res.success && res.data) {
          setData((d) => {
            const next = d.productionRecipes.map((r) => (r.id === id ? res.data! : r));
            return { ...d, productionRecipes: next };
          });
        }
        return res;
      },

      deleteProductionRecipe: async (id) => {
        const res = await deleteProductionRecipeFromDB(id);
        if (res.success) {
          setData((d) => ({
            ...d,
            productionRecipes: d.productionRecipes.filter((r) => r.id !== id),
          }));
        }
        return res;
      },

      toggleProductionRecipeStatus: async (id, active) => {
        const res = await toggleProductionRecipeStatusInDB(id, active);
        if (res.success) {
          setData((d) => ({
            ...d,
            productionRecipes: d.productionRecipes.map((r) => (r.id === id ? { ...r, active } : r)),
          }));
        }
        return res;
      },

      recordProductionBatch: async (params) => {
        const res = await executeProductionBatch({
          producedItemCode: params.producedItemCode,
          batchQuantity: params.batchQuantity,
          producedAt: params.producedAt,
          branchId: params.branchId || (selectedBranchId !== "all" ? selectedBranchId : undefined),
          branchName: params.branchName,
          note: params.note,
          createdBy: params.createdBy || currentUser?.name || "Staff",
          items: data.items,
          productionRecipes: data.productionRecipes,
          addTransactionFn: async (t) => {
            // Use existing addTransaction mechanism to guarantee single ledger source of truth
            await supabase.from("transactions").insert({
              item_id: t.itemId,
              type: t.type,
              quantity: t.quantity,
              date: t.date,
              branch_id: t.branchId || null,
              remark: t.remark || "",
            });
            bumpItemStock(t.itemId, t.quantity, t.branchId);
            setData((d) => ({
              ...d,
              transactions: [
                {
                  id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  ...t,
                },
                ...d.transactions,
              ],
            }));
          },
          currentStockFn: (itemId, branchId) => {
            if (branchId) {
              const b = data.inventoryBalance.find(
                (x) => x.itemId === itemId && x.branchId === branchId,
              );
              return b ? b.quantity : 0;
            }
            return currentStock(itemId);
          },
        });

        if (res.success && res.batch) {
          setData((d) => ({
            ...d,
            productionBatches: [res.batch!, ...d.productionBatches],
          }));
        }
        return res;
      },

      refreshProductionData: async () => {
        const [recipes, batches] = await Promise.all([
          fetchProductionRecipesFromDB(),
          fetchProductionBatchesFromDB(),
        ]);
        setData((d) => ({
          ...d,
          productionRecipes: recipes,
          productionBatches: batches,
        }));
      },

      loadAll,

      updateSettings: async (p) => {
        setData((d) => ({ ...d, settings: { ...d.settings, ...p } }));
        // Only persist branding fields to Supabase
        const brandingKeys = ["companyName", "logoUrl", "address", "phone", "email"] as const;
        const touchesBranding = brandingKeys.some((k) => k in p);
        if (!touchesBranding) return;
        const next = { ...data.settings, ...p };
        try {
          await supabase.from("company_settings").upsert({
            id: "singleton",
            company_name: next.companyName,
            logo_url: next.logoUrl,
            address: next.address,
            phone: next.phone,
            email: next.email,
            updated_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn("Failed to persist branding", e);
        }
      },
      reset: async () => {
        await loadAll();
      },
      getAvailableLots: getAvailableLotsService,
      consumeInventory: consumeInventoryService,
      generateExpiryNotifications: generateExpiryNotificationsService,
      listNotifications: listNotificationsService,
      resolveNotification: resolveNotificationService,
      dismissNotification: dismissNotificationService,
      runNotificationScheduler: runNotificationSchedulerService,
    }),
    [
      data,
      loading,
      currentUser,
      selectedBranchId,
      setSelectedBranchId,
      currentStock,
      bumpItemStock,
      loadAll,
    ],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used within StoreProvider");
  return c;
}

export function formatCurrency(n: number, _currency?: string) {
  // Currency is fixed to Thai Baht across the entire application.
  void _currency;
  const value = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `฿${value.toFixed(2)}`;
  }
}
