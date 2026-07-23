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

export type UserRole = "admin" | "manager" | "employee";

export interface User {
  id: UUID;
  name: string;
  email: string;
  role: UserRole;
  branchId: UUID;
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
