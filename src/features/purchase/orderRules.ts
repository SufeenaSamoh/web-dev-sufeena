import type { PurchaseOrder } from "./types";
import type { User } from "@/types";
import { isTodayLocal } from "@/lib/branchFilter";
import { hasPermission } from "@/lib/permissions";

export interface OrderModifiableResult {
  allowed: boolean;
  reason?: string;
  isSameDay: boolean;
  isPending: boolean;
  isAuthorizedBranch: boolean;
  isPrivileged: boolean;
  requiresReason: boolean;
  isPastDate?: boolean;
  needsContactProcurement?: boolean;
}

export interface OrderDeletableResult {
  allowed: boolean;
  reason?: string;
  isPrivileged: boolean;
  requiresReason: boolean;
  isSameDay?: boolean;
  isPending?: boolean;
  isPastDate?: boolean;
  needsContactProcurement?: boolean;
}

export const CONTACT_PROCUREMENT_MESSAGE =
  "กรุณาติดต่อฝ่ายจัดซื้อเพื่อแก้ไข เพื่อยกเลิก ปรับปรุงรายการ";

/**
 * ตรวจสอบความถูกต้องของวันที่ว่าตรงกับวันนี้ตามเวลาท้องถิ่นหรือไม่
 * ป้องกันปัญหา Timezone Offset ของสตริง YYYY-MM-DD
 */
export function isTodayDateSafe(dateStr?: string): boolean {
  if (!dateStr) return false;
  const match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
  }
  return isTodayLocal(dateStr);
}

/**
 * ตรวจสอบว่าเป็นผู้ใช้ระดับผู้มีสิทธิ์พิเศษ (Admin, IT, Purchase, Owner) หรือไม่
 * สิทธิ์กลุ่มนี้สามารถแก้ไขและลบคำสั่งซื้อได้ตลอดเวลา แต่ต้องระบุเหตุผลทุกครั้ง
 */
export function isPrivilegedOrderUser(user: User | null): boolean {
  if (!user || user.status === "inactive") return false;
  return (
    user.role === "admin" || user.role === "it" || user.role === "purchase" || user.role === "owner"
  );
}

/**
 * ตรวจสอบว่าผู้ใช้ปัจจุบันเป็นผู้ทำรายการสั่งซื้อ (หรือเป็นพนักงานประจำสาขาที่สั่งซื้อ) หรือไม่
 */
export function isStaffOrOrderCreator(order: PurchaseOrder, currentUser: User | null): boolean {
  if (!currentUser || currentUser.status === "inactive") return false;
  if (isPrivilegedOrderUser(currentUser)) return true;

  // ตรวจสอบชื่อผู้สั่ง
  const creatorStr = (order.createdBy || "").trim().toLowerCase();
  const userName = (currentUser.name || "").trim().toLowerCase();
  const userEmail = (currentUser.email || "").trim().toLowerCase();

  if (creatorStr && userName && (creatorStr.includes(userName) || userName.includes(creatorStr))) {
    return true;
  }
  if (creatorStr && userEmail && creatorStr.includes(userEmail)) {
    return true;
  }

  // ผู้ใช้ประจำสาขาเดียวกันกับคำสั่งซื้อ
  const isSameBranch =
    currentUser.branchId === order.branchId ||
    currentUser.isAllBranches ||
    (currentUser.allowedBranchIds?.includes(order.branchId) ?? false);

  if (isSameBranch) {
    if (currentUser.role === "staff" || currentUser.role === "manager") {
      return true;
    }
  }

  return false;
}

/**
 * ตรวจสอบเงื่อนไขว่าสามารถแก้ไขรายการสินค้าหรือยกเลิกคำสั่งซื้อได้หรือไม่
 * เงื่อนไข:
 * 1. ผู้ใช้ระดับ Admin, IT, Purchase (และ Owner):
 *    - สามารถแก้ไขได้ตลอดเวลา (ต้องระบุเหตุผลทุกครั้ง)
 * 2. Staff คนที่สั่งซื้อ / พนักงานสาขา:
 *    - สามารถแก้ไขหรือยกเลิกได้ ภายในวันนั้นที่กดสั่ง (Same day) และสถานะยังเป็น pending
 *    - ถ้าเลยวันมาแล้ว หรือฝ่ายจัดซื้ออนุมัติแล้ว: จะไม่อนุญาต และแจ้งให้ติดต่อฝ่ายจัดซื้อเพื่อแก้ไข ยกเลิก ปรับปรุงรายการ
 */
export function checkOrderModifiable(
  order: PurchaseOrder,
  currentUser: User | null,
): OrderModifiableResult {
  if (!currentUser || currentUser.status === "inactive") {
    return {
      allowed: false,
      reason: "ไม่มีสิทธิ์เข้าถึงหรือผู้ใช้งานถูกระงับ",
      isSameDay: false,
      isPending: false,
      isAuthorizedBranch: false,
      isPrivileged: false,
      requiresReason: true,
      isPastDate: false,
      needsContactProcurement: false,
    };
  }

  const isPrivileged = isPrivilegedOrderUser(currentUser);

  // 1. ตรวจสอบสิทธิ์ประจำสาขา
  const isAuthorizedBranch =
    isPrivileged ||
    currentUser.role === "manager" ||
    currentUser.isAllBranches ||
    order.branchId === currentUser.branchId ||
    (currentUser.allowedBranchIds?.includes(order.branchId) ?? false) ||
    isStaffOrOrderCreator(order, currentUser);

  if (!isAuthorizedBranch) {
    return {
      allowed: false,
      reason: "คุณไม่มีสิทธิ์จัดการคำสั่งซื้อของสาขานี้",
      isSameDay: true,
      isPending: true,
      isAuthorizedBranch: false,
      isPrivileged,
      requiresReason: true,
      isPastDate: false,
      needsContactProcurement: false,
    };
  }

  const isPending = order.status === "pending";
  const isSameDay =
    isTodayDateSafe(order.orderDate) ||
    isTodayDateSafe(order.updatedAt) ||
    isTodayDateSafe(order.cancelledAt);

  // สิทธิ์ Admin, IT, Purchase สามารถแก้ไขได้ตลอดเวลา โดยต้องระบุเหตุผลทุกครั้ง
  if (isPrivileged) {
    return {
      allowed: true,
      reason: undefined,
      isSameDay,
      isPending,
      isAuthorizedBranch: true,
      isPrivileged: true,
      requiresReason: true,
      isPastDate: !isSameDay,
      needsContactProcurement: false,
    };
  }

  // สำหรับผู้ใช้ทั่วไป (Staff คนสั่งซื้อ / Manager สาขา):
  // 1. ตรวจสอบวันที่สั่งซื้อ: ต้องทำภายในวันนั้นเท่านั้น
  if (!isSameDay) {
    return {
      allowed: false,
      reason: "เลยวันที่สั่งซื้อแล้ว กรุณาติดต่อฝ่ายจัดซื้อเพื่อแก้ไข เพื่อยกเลิก ปรับปรุงรายการ",
      isSameDay: false,
      isPending,
      isAuthorizedBranch: true,
      isPrivileged: false,
      requiresReason: true,
      isPastDate: true,
      needsContactProcurement: true,
    };
  }

  // 2. ตรวจสอบสถานะการอนุมัติ (ต้องยังไม่อนุมัติ - สถานะ pending เท่านั้น)
  if (!isPending) {
    let reason = "ไม่สามารถแก้ไขหรือยกเลิกได้";
    if (order.status === "approved") {
      reason =
        "ไม่สามารถแก้ไขหรือยกเลิกได้ เนื่องจากฝ่ายจัดซื้อได้กดอนุมัติรายการแล้ว กรุณาติดต่อฝ่ายจัดซื้อเพื่อแก้ไข เพื่อยกเลิก ปรับปรุงรายการ";
    } else if (order.status === "in_transit") {
      reason =
        "ไม่สามารถแก้ไขหรือยกเลิกได้ เนื่องจากสินค้าอยู่ระหว่างจัดส่ง กรุณาติดต่อฝ่ายจัดซื้อเพื่อแก้ไข เพื่อยกเลิก ปรับปรุงรายการ";
    } else if (order.status === "received") {
      reason =
        "ไม่สามารถแก้ไขหรือยกเลิกได้ เนื่องจากตรวจรับสินค้าเข้าคลังแล้ว กรุณาติดต่อฝ่ายจัดซื้อเพื่อแก้ไข เพื่อยกเลิก ปรับปรุงรายการ";
    } else if (order.status === "cancelled") {
      reason = "คำสั่งซื้อนี้ถูกยกเลิกไปแล้ว";
    }

    return {
      allowed: false,
      reason,
      isSameDay,
      isPending: false,
      isAuthorizedBranch: true,
      isPrivileged: false,
      requiresReason: true,
      isPastDate: false,
      needsContactProcurement: order.status !== "cancelled",
    };
  }

  return {
    allowed: true,
    isSameDay: true,
    isPending: true,
    isAuthorizedBranch: true,
    isPrivileged: false,
    requiresReason: true,
    isPastDate: false,
    needsContactProcurement: false,
  };
}

/**
 * ตรวจสอบสิทธิ์ว่าผู้ใช้สามารถลบคำสั่งซื้อออกจากระบบได้อย่างถาวรหรือไม่
 * กฎระเบียบ:
 * 1. Admin, IT, Purchase: สามารถลบได้ตลอดเวลา (ต้องระบุเหตุผล)
 * 2. Staff คนที่สั่งซื้อ (หรือพนักงานสาขา):
 *    - สามารถลบได้ ภายในวันนั้นที่กดสั่ง (Same day) และสถานะยังเป็น pending
 *    - ถ้าเลยวันมาแล้ว: ไม่อนุญาต และแจ้งให้ติดต่อฝ่ายจัดซื้อเพื่อแก้ไข เพื่อยกเลิก ปรับปรุงรายการ
 */
export function checkOrderDeletable(
  order: PurchaseOrder,
  currentUser: User | null,
): OrderDeletableResult {
  if (!currentUser || currentUser.status === "inactive") {
    return {
      allowed: false,
      reason: "ไม่มีสิทธิ์เข้าถึงหรือผู้ใช้งานถูกระงับ",
      isPrivileged: false,
      requiresReason: true,
      isPastDate: false,
      needsContactProcurement: false,
    };
  }

  const isPrivileged = isPrivilegedOrderUser(currentUser);

  if (isPrivileged) {
    return {
      allowed: true,
      isPrivileged: true,
      requiresReason: true,
      isSameDay: true,
      isPending: true,
      isPastDate: false,
      needsContactProcurement: false,
    };
  }

  // ตรวจสอบสิทธิ์พนักงานสาขา / ผู้สั่งซื้อ
  const isAuthorizedBranch =
    currentUser.role === "manager" ||
    currentUser.isAllBranches ||
    order.branchId === currentUser.branchId ||
    (currentUser.allowedBranchIds?.includes(order.branchId) ?? false) ||
    isStaffOrOrderCreator(order, currentUser);

  if (!isAuthorizedBranch) {
    return {
      allowed: false,
      reason: "คุณไม่มีสิทธิ์ลบคำสั่งซื้อของสาขานี้",
      isPrivileged: false,
      requiresReason: true,
      isPastDate: false,
      needsContactProcurement: false,
    };
  }

  const isSameDay =
    isTodayDateSafe(order.orderDate) ||
    isTodayDateSafe(order.updatedAt) ||
    isTodayDateSafe(order.cancelledAt);
  const isPending = order.status === "pending";

  // ตรวจสอบว่าเลยวันแล้วหรือไม่
  if (!isSameDay) {
    return {
      allowed: false,
      reason: "เลยวันที่สั่งซื้อแล้ว กรุณาติดต่อฝ่ายจัดซื้อเพื่อแก้ไข เพื่อยกเลิก ปรับปรุงรายการ",
      isPrivileged: false,
      requiresReason: true,
      isSameDay: false,
      isPending,
      isPastDate: true,
      needsContactProcurement: true,
    };
  }

  // ตรวจสอบสถานะ: หากฝ่ายจัดซื้ออนุมัติแล้ว จะไม่สามารถลบได้
  if (!isPending) {
    return {
      allowed: false,
      reason:
        "ไม่สามารถลบได้ เนื่องจากฝ่ายจัดซื้อได้กดอนุมัติรายการแล้ว กรุณาติดต่อฝ่ายจัดซื้อเพื่อดำเนินการ",
      isPrivileged: false,
      requiresReason: true,
      isSameDay: true,
      isPending: false,
      isPastDate: false,
      needsContactProcurement: true,
    };
  }

  // ภายในวันนั้นที่กดสั่ง และสถานะยังเป็น pending: Staff คนที่สั่งซื้อสามารถลบได้
  return {
    allowed: true,
    isPrivileged: false,
    requiresReason: true,
    isSameDay: true,
    isPending: true,
    isPastDate: false,
    needsContactProcurement: false,
  };
}

/**
 * ตรวจสอบสิทธิ์ว่าผู้ใช้สามารถกดอนุมัติใบสั่งซื้อได้หรือไม่ (ฝ่ายจัดซื้อ, ผู้จัดการ, แอดมิน, เจ้าของ)
 */
export function canApproveOrder(order: PurchaseOrder, currentUser: User | null): boolean {
  if (!currentUser || currentUser.status === "inactive") return false;
  if (order.status !== "pending") return false;

  return (
    currentUser.role === "owner" ||
    currentUser.role === "it" ||
    currentUser.role === "admin" ||
    currentUser.role === "purchase" ||
    currentUser.role === "manager" ||
    hasPermission(currentUser, "purchase.approve") ||
    hasPermission(currentUser, "purchase.manage")
  );
}
