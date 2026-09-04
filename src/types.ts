import type { UUID } from "./lib/types";

export interface Supplier {
  id: UUID;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
  remark?: string;
  minOrderAmount?: number; // ยอดสั่งขั้นต่ำ (บาท) — ชินเซ็น = 800, WFOOD = 1000, เซ็นทรัล = 1000
  availableBranchIds?: string[]; // ถ้าไม่ระบุ = ใช้ได้ทุกสาขา, ถ้าระบุ = ใช้ได้เฉพาะสาขาที่กำหนด
}

export interface Product {
  id: UUID;
  code: string;
  name: string;
  categoryId?: UUID;
  supplierId?: UUID;
  unit: string;
  price?: number;
  purchasePrice?: number;
  active?: boolean;
  masterCode?: string; // รหัสกลางจับคู่ "สินค้าตัวเดียวกัน" ข้ามซัพพลายเออร์
}

export * from "./lib/types";
export * from "./features/purchase/types";
