export type BranchId = string;

export interface PurchaseBranch {
  id: BranchId;
  name: string;
  code: string;
  location: string;
  manager: string;
  phone: string;
  pin?: string; // รหัสผ่านเข้าใช้งานประจำสาขา
}

export interface PurchaseSupplier {
  id: string;
  name: string;
  code: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  deliveryTerms: string; // เงื่อนไขการจัดส่งทั่วไป
  branchDeliveryTerms?: Record<string, string>; // เงื่อนไขการจัดส่งแยกตามสาขา { [branchId]: string }
  categories: string[];
  minOrderAmount?: number; // ยอดสั่งขั้นต่ำ (บาท) ใช้คำนวณในระบบเทียบราคาอัตโนมัติ
  availableBranchIds?: string[]; // ถ้าไม่ระบุ = ใช้ได้ทุกสาขา (ค่าเริ่มต้นของชินเซ็น/WFOOD) ถ้าระบุ = ใช้ได้เฉพาะสาขาที่อยู่ในลิสต์นี้เท่านั้น (เช่น เซ็นทรัล เฉพาะพอร์โตชิโน่)
}

export interface PurchaseProduct {
  id: string;
  code: string; // รหัสสินค้า
  name: string; // รายการสินค้า
  supplierId: string;
  supplierName: string;
  category: string;
  unit: string; // หน่วย เช่น กก., ลิตร, ถุง, กล่อง, แพ็ค
  price: number; // ราคาต่อหน่วย (บาท)
  deliveryTerms: string; // เงื่อนไขการจัดส่งเฉพาะรายการ
  minOrderQty: number;
  stockAlertThreshold?: number;
  isActive?: boolean; // สถานะการใช้งาน (true = เปิดใช้งาน, false = ปิดการใช้งาน)
  notes?: string; // หมายเหตุ
  reason?: string; // เหตุผลการเปลี่ยนล่าสุด
  masterCode?: string; // รหัสกลางที่ใช้ match สินค้าตัวเดียวกันข้ามซัพพลายเออร์ สำหรับระบบเทียบราคาอัตโนมัติ
  lockedSupplierId?: string; // บังคับล็อกซัพพลายเออร์ (เช่น 'sup-5' ชินเซ็น) ข้ามระบบเลือกราคาถูกสุด
}

export type ProductChangeType =
  "create" | "price_change" | "status_change" | "spec_change" | "edit";

export interface PurchaseProductChangeLog {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  supplierName: string;
  changeType: ProductChangeType;
  changedAt: string; // วันที่เวลาที่มีการเปลี่ยน YYYY-MM-DD HH:mm
  effectiveDate: string; // วันที่เริ่มใช้ตัวใหม่ / มีผลเมื่อไหร่ YYYY-MM-DD
  reason: string; // เหตุผลการเปลี่ยน / เปลี่ยนเพราะอะไร
  notes?: string; // หมายเหตุเพิ่มเติม
  previousData?: {
    name?: string;
    price?: number;
    unit?: string;
    category?: string;
    isActive?: boolean;
    supplierName?: string;
  };
  newData?: {
    name?: string;
    price?: number;
    unit?: string;
    category?: string;
    isActive?: boolean;
    supplierName?: string;
  };
  changedBy: string; // ผู้ทำการเปลี่ยน เช่น "หัวหน้าฝ่ายจัดซื้อ", "ผู้ดูแลระบบ"
}

export type PurchaseOrderStatus = "pending" | "approved" | "in_transit" | "received" | "cancelled";

export interface PurchaseOrderItem {
  productId: string;
  productCode: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number; // ยอดเงินรวม = ราคา * จำนวน
  deliveryTerms: string;
  notes?: string;
}

export interface PurchaseOrderEditHistory {
  editedAt: string;
  editedBy: string;
  reason: string;
  previousTotalAmount: number;
  newTotalAmount: number;
  previousItemsCount: number;
  newItemsCount: number;
}

export interface PurchaseOrder {
  id: string; // เช่น ORD-202607-001
  branchId: BranchId;
  branchName: string;
  supplierId: string;
  supplierName: string;
  orderDate: string; // วันที่สั่ง YYYY-MM-DD
  orderTime?: string; // เวลาที่สั่ง HH:mm
  expectedReceivedDate: string; // วันที่คาดว่าจะรับเข้า YYYY-MM-DD
  actualReceivedDate?: string; // วันที่รับเข้าจริง YYYY-MM-DD
  deliveryTerms: string; // เงื่อนไขการจัดส่ง
  items: PurchaseOrderItem[];
  totalAmount: number; // ยอดเงินรวมทั้งใบสั่งซื้อ
  status: PurchaseOrderStatus;
  notes?: string;
  createdBy: string;
  updatedBy?: string;
  updatedAt: string;
  syncedToSheets?: boolean;
  orderType?: "normal" | "urgent"; // 🚚 รอบปกติ หรือ ⚡ สั่งด่วน (ผักด่วน)
  batchId?: string; // รหัสกลุ่มคำสั่งซื้อ (เช่น BATCH-XXXXX)
  // Cancellation & Editing Fields (Mandatory Reason Tracking)
  cancelReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  editReason?: string;
  editedAt?: string;
  editedBy?: string;
  editHistory?: PurchaseOrderEditHistory[];
  approvedAt?: string;
  approvedBy?: string;
}

export interface MonthlyBranchSummary {
  branchId: BranchId;
  branchName: string;
  orderCount: number;
  totalSpent: number;
  percentage: number;
}

export interface MonthlySupplierSummary {
  supplierId: string;
  supplierName: string;
  orderCount: number;
  totalSpent: number;
  percentage: number;
}

export interface MonthlyProductSummary {
  productCode: string;
  productName: string;
  supplierName: string;
  totalQuantity: number;
  unit: string;
  totalSpent: number;
}

export interface PurchaseMonthlyReport {
  monthYear: string; // Format: "YYYY-MM" (e.g. "2026-07")
  monthYearLabel: string; // Format: "กรกฎาคม 2026"
  totalOrders: number;
  totalSpent: number;
  branchSummaries: MonthlyBranchSummary[];
  supplierSummaries: MonthlySupplierSummary[];
  topProducts: MonthlyProductSummary[];
}

export interface PurchaseGoogleSheetsConfig {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  spreadsheetTitle: string;
  lastSyncedAt: string | null;
  isSyncing: boolean;
  autoSync: boolean;
}

export interface DatabaseAConfig {
  projectId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  oAuthClientId?: string;
  isConnected?: boolean;
  lastSyncedAt?: string;
}
