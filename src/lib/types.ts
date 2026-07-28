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
  unit: string;
  minStock: number;
  purchasePrice?: number;
  barcode?: string;
  description?: string;
  active: boolean;
  /** Whether this item's stock should be tracked with an expiry date. */
  hasExpiry: boolean;
  /** Default shelf life in days from receive date, used when has_expiry is true. */
  shelfLifeDays?: number;
  /** How many days before expiry a near-expiry warning should be raised. */
  expiryWarningDays?: number;
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
  refId?: UUID;
  remark?: string;
  expiryDate?: string;
  employee?: string;
}

export interface PurchaseItem {
  itemId: UUID;
  quantity: number;
  unitPrice: number;
  expiryDate?: string;
  remark?: string;
}

export interface Purchase {
  id: UUID;
  supplierId: UUID;
  purchaseDate: string;
  invoiceNumber: string;
  employee: string;
  remark: string;
  items: PurchaseItem[];
  total: number;
  branchId: UUID;
}

// User Management (Users page, roles, disable/delete) is backed by the
// existing public.users table — no separate profiles table. Roles: Owner,
// Admin, Manager, Staff. `status` doubles as the "disable user" flag
// ("inactive" = disabled).
export type UserRole = "owner" | "admin" | "manager" | "staff";

export interface User {
  id: UUID;
  name: string;
  email: string;
  role: UserRole;
  branchId?: UUID;
  status: "active" | "inactive";
}

export interface Branch {
  id: UUID;
  name: string;
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
  theme: "light" | "dark";
}
