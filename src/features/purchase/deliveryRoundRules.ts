/**
 * deliveryRoundRules.ts
 *
 * ตารางและตรรกะคำนวณ "รอบส่งของ" (Delivery Round Calculation Engine)
 * อิงตามวันที่/เวลาสั่งจริง ณ ตอนพนักงานกดยืนยัน
 *
 * โครงสร้าง Config และกฎการคำนวณ:
 * 1. ทุกสาขา ยกเว้น พอร์โตชิโน่ — แท็บ "สั่งปกติ":
 *    - จันทร์ -> พุธ
 *    - อังคาร -> พฤหัสบดี
 *    - พุธ -> ศุกร์
 *    - พฤหัสบดี -> เสาร์–อาทิตย์
 *    - ศุกร์ -> จันทร์–อังคาร (สัปดาห์ถัดไป)
 *
 * 2. สาขาพอร์โตชิโน่ — แท็บ "สั่งปกติ":
 *    - อังคาร -> พฤหัสบดี
 *    - พฤหัส -> เสาร์
 *    - ศุกร์ -> อังคาร (สัปดาห์ถัดไป)
 *
 * 3. แท็บ "สั่งผักด่วน" (ทุกสาขา รวมพอร์โตชิโน่ — สั่งได้ทุกวัน):
 *    - ตัดรอบ 19:00 น. ถ้าสั่งหลัง 19:00 ให้เลื่อนเป็นออเดอร์ของ "วันถัดไป" อัตโนมัติ
 *    - หากวันที่สั่งตรงกับตารางปกติ -> ใช้รอบส่งของวันนั้น
 *    - หากไม่ตรง (เช่น สั่งเสาร์) -> ไล่หารอบสั่งถัดไปที่ใกล้ที่สุดในตารางปกติ แล้วใช้วันส่งของรอบนั้น
 *
 * แสดงผล: "รอบส่ง: [ช่วงวัน] ([วันที่จริง])" เช่น "รอบส่ง: เสาร์–อาทิตย์ (7–8 ก.พ.)"
 */

import type { PurchaseBranch } from "./types";

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

export const THAI_DAY_NAMES: Record<DayOfWeek, string> = {
  0: "อาทิตย์",
  1: "จันทร์",
  2: "อังคาร",
  3: "พุธ",
  4: "พฤหัสบดี",
  5: "ศุกร์",
  6: "เสาร์",
};

export const THAI_DAY_NAMES_SHORT: Record<DayOfWeek, string> = {
  0: "อา.",
  1: "จ.",
  2: "อ.",
  3: "พ.",
  4: "พฤ.",
  5: "ศ.",
  6: "ส.",
};

export const THAI_MONTH_NAMES_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

export interface ScheduleRuleItem {
  id: string;
  orderDay: DayOfWeek; // วันสั่ง 0-6
  orderDayName: string; // เช่น "จันทร์"
  deliveryDaysText: string; // เช่น "พุธ", "เสาร์–อาทิตย์", "จันทร์–อังคาร"
  startLeadDays: number; // จำนวนวันบวกจากวันสั่งไปถึงวันเริ่มส่ง (เช่น พุธ=2, เสาร์=2, จันทร์ถัดไป=3)
  endLeadDays: number; // จำนวนวันบวกจากวันสั่งไปถึงวันสิ้นสุดส่ง (เช่น พุธ=2, อาทิตย์=3, อังคารถัดไป=4)
  notes?: string;
}

export interface BranchScheduleConfig {
  branchKey: string; // 'default' | 'portochino' | branchId
  branchName: string;
  schedule: ScheduleRuleItem[];
}

export interface DeliveryRoundConfig {
  version: number;
  urgentCutoffTime: string; // e.g. "19:00"
  autoRollOverNextDay: boolean; // true: สั่งหลัง 19:00 นับเป็นวันพรุ่งนี้
  rolloverNoticeText: string; // "สั่งหลัง 19:00 แล้ว ระบบจะนับเป็นออเดอร์ของพรุ่งนี้"
  defaultSchedule: ScheduleRuleItem[]; // สำหรับทุกสาขา ยกเว้น พอร์โตชิโน่
  portoChinoSchedule: ScheduleRuleItem[]; // สำหรับสาขาพอร์โตชิโน่
  customBranchSchedules?: Record<string, ScheduleRuleItem[]>; // เผื่อ override สาขาอื่น
}

// ค่าตั้งต้นมาตรฐานตามตารางข้อกำหนด
export const DEFAULT_STANDARD_SCHEDULE: ScheduleRuleItem[] = [
  {
    id: "std-mon",
    orderDay: 1,
    orderDayName: "จันทร์",
    deliveryDaysText: "พุธ",
    startLeadDays: 2,
    endLeadDays: 2,
    notes: "สั่งจันทร์ เข้าพุธ",
  },
  {
    id: "std-tue",
    orderDay: 2,
    orderDayName: "อังคาร",
    deliveryDaysText: "พฤหัสบดี",
    startLeadDays: 2,
    endLeadDays: 2,
    notes: "สั่งอังคาร เข้าพฤหัสบดี",
  },
  {
    id: "std-wed",
    orderDay: 3,
    orderDayName: "พุธ",
    deliveryDaysText: "ศุกร์",
    startLeadDays: 2,
    endLeadDays: 2,
    notes: "สั่งพุธ เข้าศุกร์",
  },
  {
    id: "std-thu",
    orderDay: 4,
    orderDayName: "พฤหัสบดี",
    deliveryDaysText: "เสาร์–อาทิตย์",
    startLeadDays: 2, // Thu + 2 = Sat
    endLeadDays: 3, // Thu + 3 = Sun
    notes: "สั่งพฤหัสบดี เข้าเสาร์–อาทิตย์",
  },
  {
    id: "std-fri",
    orderDay: 5,
    orderDayName: "ศุกร์",
    deliveryDaysText: "จันทร์–อังคาร (สัปดาห์ถัดไป)",
    startLeadDays: 3, // Fri + 3 = Mon
    endLeadDays: 4, // Fri + 4 = Tue
    notes: "สั่งศุกร์ เข้าจันทร์–อังคาร สัปดาห์ถัดไป",
  },
];

export const DEFAULT_PORTO_CHINO_SCHEDULE: ScheduleRuleItem[] = [
  {
    id: "porto-tue",
    orderDay: 2,
    orderDayName: "อังคาร",
    deliveryDaysText: "พฤหัสบดี",
    startLeadDays: 2,
    endLeadDays: 2,
    notes: "สั่งอังคาร เข้าพฤหัสบดี",
  },
  {
    id: "porto-thu",
    orderDay: 4,
    orderDayName: "พฤหัสบดี",
    deliveryDaysText: "เสาร์",
    startLeadDays: 2,
    endLeadDays: 2,
    notes: "สั่งพฤหัสบดี เข้าเสาร์",
  },
  {
    id: "porto-fri",
    orderDay: 5,
    orderDayName: "ศุกร์",
    deliveryDaysText: "อังคาร (สัปดาห์ถัดไป)",
    startLeadDays: 4, // Fri + 4 = Tue
    endLeadDays: 4,
    notes: "สั่งศุกร์ เข้าอังคาร สัปดาห์ถัดไป",
  },
];

export const DEFAULT_DELIVERY_ROUND_CONFIG: DeliveryRoundConfig = {
  version: 1,
  urgentCutoffTime: "19:00",
  autoRollOverNextDay: true,
  rolloverNoticeText: "สั่งหลัง 19:00 แล้ว ระบบจะนับเป็นออเดอร์ของพรุ่งนี้",
  defaultSchedule: DEFAULT_STANDARD_SCHEDULE,
  portoChinoSchedule: DEFAULT_PORTO_CHINO_SCHEDULE,
  customBranchSchedules: {},
};

const LS_DELIVERY_CONFIG_KEY = "hana_delivery_round_config_v2";

/**
 * ดึงการตั้งค่ารอบจัดส่ง (โหลดจาก localStorage หรือใช้ค่าเริ่มต้น)
 */
export function getDeliveryRoundConfig(): DeliveryRoundConfig {
  try {
    const raw = localStorage.getItem(LS_DELIVERY_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.defaultSchedule && parsed.portoChinoSchedule) {
        return {
          ...DEFAULT_DELIVERY_ROUND_CONFIG,
          ...parsed,
        };
      }
    }
  } catch (e) {
    console.warn("Failed to load delivery round config, using default:", e);
  }
  return DEFAULT_DELIVERY_ROUND_CONFIG;
}

/**
 * บันทึกการตั้งค่ารอบจัดส่ง
 */
export function saveDeliveryRoundConfig(config: DeliveryRoundConfig): void {
  try {
    localStorage.setItem(LS_DELIVERY_CONFIG_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent("delivery-round-config-changed", { detail: config }));
  } catch (e) {
    console.error("Failed to save delivery round config:", e);
  }
}

/**
 * รีเซ็ตการตั้งค่ารอบจัดส่งกลับเป็นค่าเริ่มต้น
 */
export function resetDeliveryRoundConfig(): DeliveryRoundConfig {
  saveDeliveryRoundConfig(DEFAULT_DELIVERY_ROUND_CONFIG);
  return DEFAULT_DELIVERY_ROUND_CONFIG;
}

/**
 * ตรวจสอบว่าสาขานี้คือสาขาพอร์โตชิโน่หรือไม่
 */
export function isBranchPortoChino(branch?: PurchaseBranch | string | null): boolean {
  if (!branch) return false;
  const str =
    typeof branch === "string" ? branch : `${branch.id} ${branch.name} ${branch.code || ""}`;
  const lower = str.toLowerCase();
  return (
    lower.includes("พอร์โต") ||
    lower.includes("พอโต") ||
    lower.includes("portochino") ||
    lower.includes("porto") ||
    lower.includes("branch-5") ||
    lower.includes("br-05")
  );
}

/**
 * ดึงตารางรอบจัดส่งปกติของสาขานั้นๆ
 */
export function getBranchScheduleTable(
  branch?: PurchaseBranch | string | null,
  config: DeliveryRoundConfig = getDeliveryRoundConfig(),
): ScheduleRuleItem[] {
  if (isBranchPortoChino(branch)) {
    return config.portoChinoSchedule || DEFAULT_PORTO_CHINO_SCHEDULE;
  }
  if (branch && typeof branch !== "string" && config.customBranchSchedules?.[branch.id]) {
    return config.customBranchSchedules[branch.id];
  }
  return config.defaultSchedule || DEFAULT_STANDARD_SCHEDULE;
}

export interface DeliveryRoundResult {
  displayText: string; // เช่น "รอบส่ง: เสาร์–อาทิตย์ (7–8 ก.พ.)"
  deliveryDaysText: string; // เช่น "เสาร์–อาทิตย์" หรือ "พุธ"
  calendarRangeText: string; // เช่น "7–8 ก.พ."
  calendarRangeFullThai: string; // เช่น "7–8 ก.พ. 2569"
  expectedReceivedStartDateIso: string; // "2026-02-07"
  expectedReceivedEndDateIso: string; // "2026-02-08"
  effectiveOrderDateIso: string; // "2026-02-05"
  effectiveOrderDayName: string; // "พฤหัสบดี"
  actualOrderTimestampIso: string; // เวลาสั่งจริง
  isUrgentTab: boolean;
  isAfterCutoff: boolean;
  cutoffNotice?: string;
  isNearestNextRound: boolean;
  nearestOffsetDays: number;
  isAllowedOrderDayInNormalTab: boolean;
  allowedNormalDaysText: string;
  ruleUsed?: ScheduleRuleItem;
}

/**
 * ฟังก์ชันจัดรูปแบบช่วงวันที่เป็นภาษาไทย
 * เช่น:
 * - วันเดียว: "4 ก.พ."
 * - ช่วงเดือนเดียวกัน: "7–8 ก.พ."
 * - ช่วงข้ามเดือน: "30 ม.ค. – 1 ก.พ."
 * - ช่วงข้ามปี: "31 ธ.ค. 2568 – 2 ม.ค. 2569"
 */
export function formatCalendarRangeThai(
  startDate: Date,
  endDate: Date,
  includeYear: boolean = false,
): string {
  const d1 = startDate.getDate();
  const m1 = startDate.getMonth();
  const y1 = startDate.getFullYear() + 543;

  const d2 = endDate.getDate();
  const m2 = endDate.getMonth();
  const y2 = endDate.getFullYear() + 543;

  const isSameDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();

  if (isSameDay) {
    return includeYear
      ? `${d1} ${THAI_MONTH_NAMES_SHORT[m1]} ${y1}`
      : `${d1} ${THAI_MONTH_NAMES_SHORT[m1]}`;
  }

  if (m1 === m2 && y1 === y2) {
    return includeYear
      ? `${d1}–${d2} ${THAI_MONTH_NAMES_SHORT[m1]} ${y1}`
      : `${d1}–${d2} ${THAI_MONTH_NAMES_SHORT[m1]}`;
  }

  if (y1 === y2) {
    return includeYear
      ? `${d1} ${THAI_MONTH_NAMES_SHORT[m1]} – ${d2} ${THAI_MONTH_NAMES_SHORT[m2]} ${y1}`
      : `${d1} ${THAI_MONTH_NAMES_SHORT[m1]} – ${d2} ${THAI_MONTH_NAMES_SHORT[m2]}`;
  }

  return `${d1} ${THAI_MONTH_NAMES_SHORT[m1]} ${y1} – ${d2} ${THAI_MONTH_NAMES_SHORT[m2]} ${y2}`;
}

export function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * ฟังก์ชันหลักในการคำนวณ "รอบส่งของ"
 *
 * @param params.branch สาขาที่สั่ง (ใช้เช็คว่าเป็นพอร์โตชิโน่หรือสาขาปกติ)
 * @param params.orderType 'normal' (สั่งปกติ) | 'urgent' (สั่งผักด่วน)
 * @param params.orderTimestamp เวลาที่สั่ง (Date หรือ ISO string) - ค่าตั้งต้นคือ ณ เวลาปัจจุบันตอนเรียกฟังก์ชัน
 * @param params.config การตั้งค่ารอบส่ง (ถ้าไม่ระบุจะดึงจาก localStorage)
 */
export function calculateDeliveryRound(params: {
  branch?: PurchaseBranch | string | null;
  orderType: "normal" | "urgent";
  orderTimestamp?: Date | string;
  config?: DeliveryRoundConfig;
}): DeliveryRoundResult {
  const config = params.config || getDeliveryRoundConfig();
  const isUrgent = params.orderType === "urgent";

  // 1. อ่านเวลาที่สั่งจริง
  let actualDate: Date;
  if (!params.orderTimestamp) {
    actualDate = new Date();
  } else if (typeof params.orderTimestamp === "string") {
    // If only YYYY-MM-DD was passed without time, append current time
    if (/^\d{4}-\d{2}-\d{2}$/.test(params.orderTimestamp)) {
      const now = new Date();
      actualDate = new Date(
        `${params.orderTimestamp}T${String(now.getHours()).padStart(2, "0")}:${String(
          now.getMinutes(),
        ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`,
      );
    } else {
      actualDate = new Date(params.orderTimestamp);
    }
  } else {
    actualDate = new Date(params.orderTimestamp);
  }

  const actualIso = actualDate.toISOString();
  const scheduleTable = getBranchScheduleTable(params.branch, config);

  // คำนวณรายชื่อวันสั่งที่อนุญาตในแท็บสั่งปกติ
  const allowedDaysSet = new Set<DayOfWeek>(scheduleTable.map((s) => s.orderDay));
  const allowedNormalDaysText = scheduleTable.map((s) => s.orderDayName).join(", ");

  // 2. ตรวจสอบเวลาตัดรอบกรณีแท็บ "สั่งผักด่วน"
  const effectiveDate = new Date(actualDate);
  let isAfterCutoff = false;
  let cutoffNotice: string | undefined = undefined;

  if (isUrgent) {
    // แยกชั่วโมงและนาทีของ cutoffTime (เช่น "19:00")
    const [cutoffHourStr, cutoffMinStr] = (config.urgentCutoffTime || "19:00").split(":");
    const cutoffHour = parseInt(cutoffHourStr || "19", 10);
    const cutoffMin = parseInt(cutoffMinStr || "0", 10);

    const actualHour = actualDate.getHours();
    const actualMin = actualDate.getMinutes();

    const isPastCutoff =
      actualHour > cutoffHour || (actualHour === cutoffHour && actualMin >= cutoffMin);

    if (isPastCutoff && config.autoRollOverNextDay) {
      isAfterCutoff = true;
      // เลื่อนเป็นวันถัดไป
      effectiveDate.setDate(effectiveDate.getDate() + 1);
      const nextDayName = THAI_DAY_NAMES[effectiveDate.getDay() as DayOfWeek];
      cutoffNotice = `${config.rolloverNoticeText || "สั่งหลัง 19:00 แล้ว ระบบจะนับเป็นออเดอร์ของพรุ่งนี้"} (วัน${nextDayName})`;
    }
  }

  const effectiveDayOfWeek = effectiveDate.getDay() as DayOfWeek;
  const effectiveDayName = THAI_DAY_NAMES[effectiveDayOfWeek];
  const effectiveOrderDateIso = toIsoDate(effectiveDate);

  // เช็คว่าในแท็บปกติ วันนี้เปิดให้สั่งหรือไม่
  const isAllowedOrderDayInNormalTab = allowedDaysSet.has(effectiveDayOfWeek);

  // 3. หาว่า "วันที่สั่ง" (effectiveDate) ตรงกับวันสั่งในตารางแท็บปกติของสาขานั้นหรือไม่
  let matchedRule: ScheduleRuleItem | undefined = scheduleTable.find(
    (s) => s.orderDay === effectiveDayOfWeek,
  );

  let isNearestNextRound = false;
  let nearestOffsetDays = 0;
  const baseOrderDateForDelivery = new Date(effectiveDate);

  if (matchedRule) {
    // กรณีที่ 1: ตรงกับตารางปกติ -> ใช้รอบส่งเดียวกับแท็บปกติของวันนั้นเลย
    isNearestNextRound = false;
    nearestOffsetDays = 0;
  } else {
    // กรณีที่ 2: ไม่ตรง (เช่น สั่งวันเสาร์ หรือสาขาพอร์โตชิโน่สั่งวันจันทร์)
    // -> ไล่หา "รอบสั่งถัดไปที่ใกล้ที่สุด" จากตารางแท็บปกติ (นับไปข้างหน้าทีละวันจนเจอวันที่มีอยู่ในตาราง)
    isNearestNextRound = true;
    for (let offset = 1; offset <= 7; offset++) {
      const candidateDay = ((effectiveDayOfWeek + offset) % 7) as DayOfWeek;
      const found = scheduleTable.find((s) => s.orderDay === candidateDay);
      if (found) {
        matchedRule = found;
        nearestOffsetDays = offset;
        baseOrderDateForDelivery.setDate(baseOrderDateForDelivery.getDate() + offset);
        break;
      }
    }
  }

  // Fallback กรณีตารางว่าง
  if (!matchedRule) {
    matchedRule = {
      id: "fallback",
      orderDay: effectiveDayOfWeek,
      orderDayName: effectiveDayName,
      deliveryDaysText: "ตามรอบมาตรฐานสาขา",
      startLeadDays: 2,
      endLeadDays: 2,
    };
  }

  // 4. คำนวณวันที่ปฏิทินจริง (Start Date และ End Date)
  const deliveryStartDate = new Date(baseOrderDateForDelivery);
  deliveryStartDate.setDate(deliveryStartDate.getDate() + matchedRule.startLeadDays);

  const deliveryEndDate = new Date(baseOrderDateForDelivery);
  deliveryEndDate.setDate(deliveryEndDate.getDate() + matchedRule.endLeadDays);

  const expectedReceivedStartDateIso = toIsoDate(deliveryStartDate);
  const expectedReceivedEndDateIso = toIsoDate(deliveryEndDate);

  const calendarRangeText = formatCalendarRangeThai(deliveryStartDate, deliveryEndDate, false);
  const calendarRangeFullThai = formatCalendarRangeThai(deliveryStartDate, deliveryEndDate, true);

  // ตัดคำว่า "(สัปดาห์ถัดไป)" ออกใน deliveryDaysText สั้นถ้าต้องการ หรือคงไว้
  const deliveryDaysText = matchedRule.deliveryDaysText;

  // ผลลัพธ์: "รอบส่ง: [ช่วงวัน] ([วันที่จริง])" เช่น "รอบส่ง: เสาร์–อาทิตย์ (7–8 ก.พ.)"
  const displayText = `รอบส่ง: ${deliveryDaysText} (${calendarRangeText})`;

  return {
    displayText,
    deliveryDaysText,
    calendarRangeText,
    calendarRangeFullThai,
    expectedReceivedStartDateIso,
    expectedReceivedEndDateIso,
    effectiveOrderDateIso,
    effectiveOrderDayName: effectiveDayName,
    actualOrderTimestampIso: actualIso,
    isUrgentTab: isUrgent,
    isAfterCutoff,
    cutoffNotice,
    isNearestNextRound,
    nearestOffsetDays,
    isAllowedOrderDayInNormalTab,
    allowedNormalDaysText,
    ruleUsed: matchedRule,
  };
}
