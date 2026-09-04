export type UUID = string;

export interface Category {
  id: UUID;
  name: string;
}

export interface Item {
  id: UUID;
  code: string;
  name: string;
  categoryId: UUID;
  supplierId?: UUID;
  /** Deprecated legacy unit string, retained for backward compatibility. */
  unit: string;
  /** Stock / Inventory unit used for purchasing, inventory balance, and counting (e.g. pack, kg, bottle). */
  stockUnit?: string;
  /** Unit normally used in recipes (e.g. g, ml, piece). */
  recipeUnit?: string;
  /** How many recipe units are contained in 1 stock unit (e.g. 5000 for 1 pack = 5000 g). */
  conversionFactor?: number;
  /** Item type classification: 'raw' or 'prepared'. */
  itemType?: "raw" | "prepared";
  minStock: number;
  purchasePrice?: number;
  barcode?: string;
  description?: string;
  active: boolean;
  /** Whether this item's stock should be tracked with an expiry date. */
  hasExpiry?: boolean;
  /** Default shelf life duration value */
  defaultShelfLife?: number;
  /** Legacy shelf life in days */
  shelfLifeDays?: number;
  /** Shelf life unit: 'Day' | 'Month' | 'Year' */
  shelfLifeUnit?: "Day" | "Month" | "Year";
  /** How many days before expiry a near-expiry warning should be raised. */
  expiryWarningDays?: number;
  /** Current stock convenience value loaded from items table. */
  currentStock?: number;
}

export interface Supplier {
  id: UUID;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
  remark: string;
  minOrderAmount?: number;
  availableBranchIds?: string[];
}

export type TxnType = "beginning" | "purchase" | "usage" | "adjustment";

export interface StockTransaction {
  id: UUID;
  itemId: UUID;
  type: TxnType;
  quantity: number; // signed
  unitPrice?: number;
  date: string; // ISO
  supplierId?: UUID;
  /** transactions.branch_id (nullable — see 001_core_columns_and_balance.sql). */
  branchId?: UUID;
  refId?: UUID;
  remark?: string;
  expiryDate?: string;
  employee?: string;
}

export type DocumentStatus = "Draft" | "Completed" | "Locked";

export interface DocumentRevisionChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface DocumentRevision {
  id: UUID;
  documentType: "receiving" | "stock_count";
  documentId: UUID;
  revisionNumber: number;
  editedBy: string;
  editedByRole?: UserRole;
  editedAt: string;
  reason: string;
  changes: DocumentRevisionChange[];
  snapshot?: Record<string, unknown>;
}

export interface DocumentAuditLog {
  id: UUID;
  documentType: "receiving" | "stock_count";
  documentId: UUID;
  revisionNumber: number;
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  editedBy: string;
  editedAt: string;
  reason: string;
  branchId?: UUID;
}

export type VatMode = "INCLUDED" | "EXCLUDED" | "NONE";

export interface PurchaseItem {
  itemId: UUID;
  quantity: number;
  unitPrice: number;
  vatType?: "V" | "N" | VatMode;
  vatMode?: VatMode;
  expiryDate?: string;
  originalExpiryDate?: string;
  isExpiryEdited?: boolean;
  isPriceEdited?: boolean;
  remark?: string;
}

export interface Purchase {
  id: UUID;
  supplierId: UUID;
  purchaseDate: string;
  invoiceNumber: string;
  poNumber?: string;
  employee: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  lockedBy?: string;
  lockedAt?: string;
  status?: DocumentStatus;
  revision?: number;
  remark: string;
  items: PurchaseItem[];
  total: number;
  branchId: UUID;
  revisions?: DocumentRevision[];
}

export interface StockCountItem {
  itemId: UUID;
  systemQty?: number;
  systemQuantity?: number;
  countedQty?: number;
  countedQuantity?: number;
  variance: number;
  unitCost?: number;
  vatType?: "V" | "N" | VatMode;
  vatMode?: VatMode;
  expiryDate?: string;
  remark?: string;
}

export interface StockCountDocument {
  id: UUID;
  documentNumber: string;
  branchId: UUID;
  countDate: string;
  status: DocumentStatus;
  revision: number;
  createdBy: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  lockedBy?: string;
  lockedAt?: string;
  remark?: string;
  items: StockCountItem[];
  revisions?: DocumentRevision[];
}

// User Management (Users page, roles, disable/delete) is backed by the
// existing public.users table — no separate profiles table. Roles: Owner,
// IT, Admin, Manager, Staff. `status` doubles as the "disable user" flag
// ("inactive" = disabled).
export type UserRole = "owner" | "it" | "admin" | "manager" | "staff" | "purchase";

export type PermissionCode =
  | "dashboard:view"
  | "inventory:view"
  | "inventory:view_fefo"
  | "expiry:view"
  | "master_items:view"
  | "master_items:edit"
  | "suppliers:view"
  | "suppliers:edit"
  | "beginning_stock:view"
  | "beginning_stock:create"
  | "purchase:view"
  | "purchase:create"
  | "purchase.edit_own"
  | "purchase.edit_history"
  | "receiving:view"
  | "receiving:create"
  | "receiving.edit_own"
  | "receiving.edit_history"
  | "receiving.unlock"
  | "receiving.delete"
  | "stock_count:view"
  | "stock_count:create"
  | "stock_count:print"
  | "stock_count.print"
  | "stock_count.edit_own"
  | "stock_count.edit_history"
  | "stock_count.unlock"
  | "stock_count.delete"
  | "audit.view"
  | "reports:view"
  | "reports:financial"
  | "reports:export"
  | "import_data:execute"
  | "user_management:manage"
  | "settings:manage"
  | "approval:execute"
  | "delete_records:execute"
  | "modify_cost:execute"
  | "modify_selling_price:execute"
  | "procurement_master:view"
  | "procurement_master:manage"
  | (string & {});

export interface Role {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Permission {
  id: UUID;
  code: PermissionCode;
  category: string;
  name: string;
  description?: string;
  createdAt?: string;
}

export interface RolePermission {
  roleId: string;
  permissionId: UUID;
  createdAt?: string;
}

export interface UserPermission {
  id: UUID;
  userId: UUID;
  permissionId: UUID;
  isGranted: boolean;
  grantedBy?: UUID;
  createdAt?: string;
}

export interface UserBranch {
  userId: UUID;
  branchId: UUID;
  createdAt?: string;
}

export interface PermissionAuditLog {
  id: UUID;
  targetUserId: UUID;
  actorId?: UUID;
  action: string;
  permissionCode?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface User {
  id: UUID;
  name: string;
  email: string;
  role: UserRole;
  branchId?: UUID;
  status: "active" | "inactive";
  /** RBAC Branch Access */
  allowedBranchIds?: UUID[];
  isAllBranches?: boolean;
  /** Effective calculated set of granted permission codes */
  permissionCodes?: Set<string>;
  mustChangePassword?: boolean;
}

export interface Branch {
  id: UUID;
  name: string;
}

/**
 * public.inventory_balance — the real per-branch, per-item stock source of
 * truth (see supabase/migrations/001_core_columns_and_balance.sql).
 * `items.current_stock` is a deprecated convenience value; reports must
 * use this instead.
 */
export interface InventoryBalance {
  branchId: UUID;
  itemId: UUID;
  quantity: number;
  updatedAt: string;
}

export interface Settings {
  companyName: string;
  logoUrl: string;
  address: string;
  phone: string;
  email: string;
  timezone: string;
  currency: string;
  lowStockThreshold: number;
  expiryWarningDays?: number;
  variancePercentThreshold?: number; // เกณฑ์ผลต่างการใช้จริง vs สูตร (%) - default 5%
  varianceValueThreshold?: number; // เกณฑ์มูลค่าผลต่างการใช้จริง vs สูตร (บาท) - default 100 บาท
  theme: "light" | "dark";
}

export * from "@/features/reports/types/usageVariance";

export interface RecipeItem {
  id: UUID;
  menuCode: string;
  menuName: string;
  ingredientCode: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  subRecipeCode?: string;
  active: boolean;
  isDeleted?: boolean;
  status?: "active" | "inactive" | "deleted" | string;
  reason?: string;
  actionTimestamp?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalesRecord {
  id: UUID;
  date: string; // YYYY-MM-DD
  menuCode: string;
  menuName: string;
  quantitySold: number;
  branchId?: UUID;
  branchName?: string;
  createdAt?: string;
}

export interface ProductionRecipeIngredient {
  id: UUID;
  productionRecipeId?: UUID;
  ingredientCode: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  createdAt?: string;
}

export interface ProductionRecipe {
  id: UUID;
  producedItemCode: string;
  yieldQuantity: number;
  yieldUnit: string;
  active: boolean;
  note?: string;
  ingredients: ProductionRecipeIngredient[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductionBatchConsumption {
  id: UUID;
  productionBatchId: UUID;
  ingredientCode: string;
  ingredientName: string;
  quantityConsumed: number;
  unit: string;
  createdAt?: string;
}

export interface ProductionBatch {
  id: UUID;
  producedItemCode: string;
  producedItemName?: string;
  batchQuantity: number;
  yieldUnit: string;
  producedAt: string; // ISO string
  branchId?: UUID;
  branchName?: string;
  note?: string;
  createdBy: string;
  createdAt?: string;
  consumptions: ProductionBatchConsumption[];
}
