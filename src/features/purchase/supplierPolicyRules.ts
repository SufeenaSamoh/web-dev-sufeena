/**
 * supplierPolicyRules.ts
 *
 * ข้อมูลและตรรกะการตรวจสอบ "ขั้นต่ำการสั่งซื้อ" ต่อซัพพลายเออร์และระดับรายการ (SKU)
 * อ้างอิงตาม: ตารางขั้นต่ำการสั่งซื้อ_บางนา_v2.xlsx
 *
 * เงื่อนไขหลัก:
 * 1. แบบ A (per_supplier_baht): ยอดรวมทุกรายการที่สั่งจากซัพฯ นี้ในตะกร้า >= ขั้นต่ำ (บาท)
 * 2. แบบ B (per_item_qty): ปริมาณที่สั่งของ SKU นั้นตัวเดียว >= ขั้นต่ำ (หน่วย)
 * 3. วันสั่ง → วันส่ง: คำนวณวันที่จะได้รับของโดยอิงจากวันสั่งและรอบส่งของแต่ละซัพฯ (ถ้าไม่มีให้ใช้รอบมาตรฐานร้าน)
 * 4. ปุ่ม "ยืนยันคำสั่งซื้อ" ต้องกดไม่ได้ (disabled) หากมีเงื่อนไข A หรือ B ไม่ผ่าน
 */

import type { PurchaseSupplier, PurchaseProduct } from "./types";

export interface ItemMinQtyRule {
  productCode: string;
  productName: string;
  supplierKeywords: string[];
  minQty: number;
  unit: string;
  schedulePattern?: string; // เช่น "จันทร์→พฤหัส; พฤหัส→จันทร์"
  notes?: string;
}

export interface SupplierPolicyRule {
  supplierKeywords: string[];
  supplierName: string;
  minOrderAmountBaht?: number; // แบบ A: ขั้นต่ำระดับซัพฯ (บาท)
  schedulePattern?: string; // วันสั่ง → วันส่ง เช่น "จันทร์→พฤหัส; พฤหัส→จันทร์"
  notes?: string;
}

/**
 * ฐานข้อมูลกฎขั้นต่ำระดับซัพพลายเออร์ (แบบ A) และรอบจัดส่ง
 */
export const SUPPLIER_POLICY_RULES: SupplierPolicyRule[] = [
  {
    supplierKeywords: ["โกลบอล โอเชี่ยน ฟู้ดส์", "global ocean", "4B330178"],
    supplierName: "โกลบอล โอเชี่ยน ฟู้ดส์ จำกัด",
    minOrderAmountBaht: 2000,
    notes: "ขั้นต่ำ 2,000 บาท",
  },
  {
    supplierKeywords: ["ฟาร์มเฟรช", "farm fresh"],
    supplierName: "ฟาร์มเฟรช",
    schedulePattern: "จันทร์→เสาร์; พฤหัส→เสาร์",
    notes: "สั่งจันทร์ เข้าเสาร์, สั่งพฤหัส เข้าเสาร์",
  },
  {
    supplierKeywords: ["ซีพีเอฟ", "cpf", "cp food", "ซีพี ฟู้ดส์", "ซีพีเอฟ โกลบอล ฟู้ด โซลูชั่น"],
    supplierName: "ซีพีเอฟ โกลบอล ฟู้ด โซลูชั่น",
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→จันทร์",
    notes: "สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
  },
  {
    supplierKeywords: ["ไทยยูนิฟู้ด", "thai unifood", "thaiuni"],
    supplierName: "ไทยยูนิฟู้ด เซอร์วิส จำกัด",
    minOrderAmountBaht: 4000,
    notes: "ขั้นต่ำ 4,000 บาท (ถ้าสั่งปูอัด สั่งกุ้ง 1 ลังได้)",
  },
  {
    supplierKeywords: ["โนเบิล โมโน", "noble mono"],
    supplierName: "โนเบิล โมโน จำกัด",
    notes: "สามารถสั่งเข้าพร้อมปลานอกได้ ไม่ต้องมีขั้นต่ำ",
  },
  {
    supplierKeywords: ["ไทยโอโออิ", "thai ooi", "thaiooi"],
    supplierName: "ไทยโอโออิ จำกัด",
    minOrderAmountBaht: 5000,
    schedulePattern: "จันทร์→พฤหัส",
    notes: "ขั้นต่ำ 5,000 บาท (สั่งได้เฉพาะ จันทร์ เข้า พฤหัส)",
  },
  {
    supplierKeywords: ["คิง มารีน", "king marine"],
    supplierName: "คิง มารีน ฟู้ดส์ จำกัด",
    minOrderAmountBaht: 3000,
    schedulePattern: "พฤหัส→อังคาร",
    notes: "ขั้นต่ำ 3,000 บาท (สั่งได้เฉพาะ พฤหัส เข้า อังคาร)",
  },
  {
    supplierKeywords: ["เวลฟู้ด", "welfood", "well food", "wfood"],
    supplierName: "บ.เวลฟู้ด",
    minOrderAmountBaht: 3000,
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→จันทร์",
    notes: "ขั้นต่ำ 3,000 บาท สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
  },
  {
    supplierKeywords: ["ไดโช", "daisho"],
    supplierName: "ไดโช (ประเทศไทย) จำกัด",
    minOrderAmountBaht: 3000,
    notes: "ขั้นต่ำ 3,000 บาท",
  },
  {
    supplierKeywords: ["เอ ซี เค", "ack"],
    supplierName: "บ.เอ ซี เค",
    notes: "ขั้นต่ำตามรายการ",
  },
  {
    supplierKeywords: ["สยามฟูด", "siam food", "siamfood"],
    supplierName: "สยามฟูด เซอร์วิส",
    minOrderAmountBaht: 3000,
    notes: "ขั้นต่ำ 3,000 บาท (2 ตัว)",
  },
  {
    supplierKeywords: ["บางกอกอินเตอร์ฟูด", "bif", "bangkok inter"],
    supplierName: "บางกอกอินเตอร์ฟูด (BIF)",
    minOrderAmountBaht: 3000,
    notes: "ขั้นต่ำ 3,000 บาท (ราคา+3% กรณีซื้อปลีกยกแพ็ค)",
  },
  {
    supplierKeywords: ["ซีทีไอ", "cti food", "cti"],
    supplierName: "ซีทีไอ ฟู๊ด ซัพพลาย",
    minOrderAmountBaht: 3000,
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→จันทร์",
    notes: "ขั้นต่ำ 3,000 บาท สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
  },
  {
    supplierKeywords: ["จาโกต้า", "jagota"],
    supplierName: "จาโกต้า บราเดอร์ส เทรดดิ้ง",
    minOrderAmountBaht: 2500,
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→จันทร์",
    notes: "ขั้นต่ำ 2,500 บาท สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
  },
  {
    supplierKeywords: ["โคลคัสเจอร์", "colculture"],
    supplierName: "โคลคัสเจอร์",
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→อังคาร",
    notes: "สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าอังคาร",
  },
  {
    supplierKeywords: ["ซีโน-แปซิฟิค", "sino pacific", "sino"],
    supplierName: "บ.ซีโน-แปซิฟิค",
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→จันทร์",
    notes: "สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
  },
  {
    supplierKeywords: ["ซินโนวา", "sinnova"],
    supplierName: "ซินโนวา",
    notes: "ขั้นต่ำตามรายการสินค้า",
  },
  {
    supplierKeywords: ["มรกต", "ไซม์ ดาร์บี้", "sime darby"],
    supplierName: "ไซม์ ดาร์บี้ ออยล์ มรกต จำกัด",
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→จันทร์",
    notes: "ขั้นต่ำ 3 ปี๊บ สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
  },
  {
    supplierKeywords: ["เซ็นทรัล ฟู้ด รีเทล", "เซ็นทรัล", "central", "central food"],
    supplierName: "เซ็นทรัล ฟู้ด รีเทล จำกัด",
    minOrderAmountBaht: 1000,
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→จันทร์",
    notes: "ขั้นต่ำ 1,000 บาท สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
  },
  {
    supplierKeywords: ["ไทยน้ำทิพย์", "thainamthip", "coke", "โค้ก"],
    supplierName: "ไทยน้ำทิพย์ คอร์ปอเรชั่น จำกัด",
    notes: "ขั้นต่ำ 2 ถาด",
  },
  {
    supplierKeywords: ["ค้าเบียร์", "tiger beer", "เบียร์สด"],
    supplierName: "บ.ค้าเบียร์",
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→จันทร์",
    notes: "ขั้นต่ำ 1 ถัง สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
  },
  {
    supplierKeywords: ["เอส.เค.ลิเคอร์", "sk liquor", "sk"],
    supplierName: "เอส.เค.ลิเคอร์",
    minOrderAmountBaht: 3000,
    notes: "ขั้นต่ำ 3,000 บาท",
  },
  {
    supplierKeywords: ["อาซัน", "asan", "hana sauce"],
    supplierName: "บ.อาซัน",
    minOrderAmountBaht: 3000,
    notes: "ขั้นต่ำ 3,000 บาท",
  },
  {
    supplierKeywords: ["สุพีเรีย", "superior"],
    supplierName: "บ.สุพีเรีย",
    notes: "ส่งผ่านคลังก่อน ขั้นต่ำ 2 แกลลอน",
  },
  {
    supplierKeywords: ["ไอแอมกรู๊ป", "i am group", "iamgroup"],
    supplierName: "บ.ไอแอมกรู๊ป",
    notes: "ขั้นต่ำ 1 แพ็ค",
  },
  {
    supplierKeywords: ["คิดดีมีคุณ", "kiddee"],
    supplierName: "คิดดีมีคุณ",
    notes: "ขั้นต่ำ 50 ใบ / ขนาด",
  },
  {
    supplierKeywords: ["กลมบ๊อกซ์", "klombox"],
    supplierName: "บ.กลมบ๊อกซ์",
    notes: "ขั้นต่ำ 1 แพ็ค",
  },
  {
    supplierKeywords: ["ตั้ง ซุ่น ฮวด", "tang soon huat"],
    supplierName: "บ.ตั้ง ซุ่น ฮวด",
    notes: "ส่งผ่านคลังก่อน ขั้นต่ำ 20 ใบ / ขนาด",
  },
  {
    supplierKeywords: ["ชินเซ็น", "shinsen", "sup-5"],
    supplierName: "ชินเซ็น (Shinsen)",
    minOrderAmountBaht: 800,
    schedulePattern: "อาทิตย์→จันทร์; พุธ→พฤหัส",
    notes: "ขั้นต่ำ 800 บาท",
  },
  {
    supplierKeywords: ["เบทาโกร", "betagro"],
    supplierName: "เบทาโกร ฟู้ด ซัพพลาย (Betagro)",
    minOrderAmountBaht: 1500,
    schedulePattern: "จันทร์→อังคาร; อังคาร→พุธ; พุธ→พฤหัส; พฤหัส→ศุกร์; ศุกร์→เสาร์",
    notes: "สั่งก่อน 16:00 น. จัดส่งวันถัดไป ส่งฟรีเมื่อสั่งเกิน 1,500 บาท",
  },
  {
    supplierKeywords: ["aro", "inter food", "อินเตอร์ ฟู้ด"],
    supplierName: "อินเตอร์ ฟู้ด ซอส & ซัพพลาย (Aro Supply)",
    minOrderAmountBaht: 1000,
    schedulePattern: "อังคาร→พุธ; พฤหัส→ศุกร์; เสาร์→อาทิตย์",
    notes: "จัดส่งรอบอังคาร/พฤหัส/เสาร์ สั่งขั้นต่ำ 1,000 บาท",
  },
  {
    supplierKeywords: ["dairy gold", "แดรี่ โกลด์"],
    supplierName: "แดรี่ โกลด์ นมและเนย (Dairy Gold)",
    minOrderAmountBaht: 1200,
    schedulePattern: "จันทร์→พุธ; พุธ→ศุกร์; ศุกร์→จันทร์",
    notes: "ขนส่งรถเย็น จัดส่งทุกวันจันทร์-ศุกร์ สั่งขั้นต่ำ 1,200 บาท",
  },
];

/**
 * ฐานข้อมูลกฎขั้นต่ำระดับรายการ (แบบ B: per_item_qty)
 * เฉพาะ SKU ที่ระบุไว้ในตารางนี้เท่านั้นที่ต้องเช็ค
 */
export const ITEM_MIN_QTY_RULES: ItemMinQtyRule[] = [
  // 1. ฟาร์มเฟรช
  {
    productCode: "1B113351",
    productName: "สันนอกหมู(หมูดำคุโรบูตะ) ห่อฟิล์ม",
    supplierKeywords: ["ฟาร์มเฟรช", "farm fresh"],
    minQty: 15,
    unit: "กก.",
    schedulePattern: "จันทร์→เสาร์; พฤหัส→เสาร์",
    notes: "ขั้นต่ำ 1 ลัง (15 กก.) สั่งจันทร์/พฤหัส เข้าเสาร์",
  },

  // 2. CPF ซีพีเอฟ โกลบอล ฟู้ด โซลูชั่น
  {
    productCode: "1B110079",
    productName: "สะโพกไก่เลาะกระดูก 100-130g 2 Kg./แพ็ค",
    supplierKeywords: ["ซีพีเอฟ", "cpf", "cp food", "ซีพี ฟู้ดส์"],
    minQty: 6,
    unit: "กก.",
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→จันทร์",
    notes: "ขั้นต่ำ 6 กก. สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
  },
  {
    productCode: "1B114020",
    productName: "สะโพกไก่เลาะกระดูก FZ.คละsize 2kg / แพ็ค",
    supplierKeywords: ["ซีพีเอฟ", "cpf", "cp food", "ซีพี ฟู้ดส์"],
    minQty: 6,
    unit: "แพ็ค",
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→จันทร์",
    notes: "ขั้นต่ำ 6 แพ็ค สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
  },
  {
    productCode: "1B113712",
    productName: "ปีกปลายไก่ (2kg./แพ็ค)",
    supplierKeywords: ["ซีพีเอฟ", "cpf", "cp food", "ซีพี ฟู้ดส์"],
    minQty: 6,
    unit: "กก.",
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→จันทร์",
    notes: "ขั้นต่ำ 6 กก. สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
  },
  {
    productCode: "1B113351",
    productName: "สันนอกหมู(หมูดำคุโรบูตะ) ห่อฟิล์ม (CPF)",
    supplierKeywords: ["ซีพีเอฟ", "cpf", "cp food", "ซีพี ฟู้ดส์"],
    minQty: 15,
    unit: "กก.",
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→จันทร์",
    notes: "ขั้นต่ำ 1 ลัง (15 กก.) สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
  },
  {
    productCode: "1B113880",
    productName: "สันคอหมูสไลด์ (1kg/แพ็ค)",
    supplierKeywords: ["ซีพีเอฟ", "cpf", "cp food", "ซีพี ฟู้ดส์"],
    minQty: 10,
    unit: "กก.",
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→จันทร์",
    notes: "ขั้นต่ำ 10 กก. สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
  },
  {
    productCode: "1B111943",
    productName: "สันคอหมูสไลด์ (500g/แพ็ค)",
    supplierKeywords: ["ซีพีเอฟ", "cpf", "cp food", "ซีพี ฟู้ดส์"],
    minQty: 5,
    unit: "กก.",
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→จันทร์",
    notes: "ขั้นต่ำ 5 กก. สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
  },
  {
    productCode: "1B113713",
    productName: "ตับหมู 1kg. / แพ็ค",
    supplierKeywords: ["ซีพีเอฟ", "cpf", "cp food", "ซีพี ฟู้ดส์"],
    minQty: 6,
    unit: "กก.",
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→จันทร์",
    notes: "ขั้นต่ำ 6 กก. สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
  },
  {
    productCode: "9B223018",
    productName: "ไข่ไก่กล่อง cage free 10 ฟอง/แพ็ค",
    supplierKeywords: ["ซีพีเอฟ", "cpf", "cp food", "ซีพี ฟู้ดส์"],
    minQty: 10,
    unit: "ถาด",
    notes: "ขั้นต่ำ 10 ถาด รวมกันได้",
  },
  {
    productCode: "1B221415",
    productName: "กุ้งขาว (สด) 26-30 ตัว/กก (ลังโฟม)",
    supplierKeywords: ["ซีพีเอฟ", "cpf", "cp food", "ซีพี ฟู้ดส์"],
    minQty: 5,
    unit: "กก.",
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→อังคาร",
    notes: "ขั้นต่ำ 1 ลังโฟม (5 กก.) สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าอังคาร",
  },

  // 3. ไทยยูนิฟู้ด เซอร์วิส
  {
    productCode: "9B111008",
    productName: "ปูอัด SPK 9cm เกรด A 500g/36Pcs.",
    supplierKeywords: ["ไทยยูนิฟู้ด", "thai unifood"],
    minQty: 20,
    unit: "แพ็ค",
    notes: "ขั้นต่ำ 20 แพ็ค (ถ้าสั่งปูอัด สามารถสั่งกุ้งแค่ 1 ลังได้)",
  },
  {
    productCode: "1B111444",
    productName: "กุ้งขาวแช่แข็ง 26-30 (1kg/แพ็ค)",
    supplierKeywords: ["ไทยยูนิฟู้ด", "thai unifood"],
    minQty: 12,
    unit: "แพ็ค",
    notes: "ขั้นต่ำ 12 แพ็ค (ลังละ 6 กก.)",
  },
  {
    productCode: "1B113857",
    productName: "กุ้งขาวแช่แข็ง 26-30 (700g/แพ็ค)",
    supplierKeywords: ["ไทยยูนิฟู้ด", "thai unifood"],
    minQty: 24,
    unit: "แพ็ค",
    notes: "ขั้นต่ำ 24 แพ็ค (ลังละ 12 แพ็ค)",
  },

  // 4. บ.เอ ซี เค
  {
    productCode: "2B222946",
    productName: "ผักสลัดมิกซ์ 100g",
    supplierKeywords: ["เอ ซี เค", "ack"],
    minQty: 15,
    unit: "แพ็ค",
    notes: "ขั้นต่ำ 15 แพ็ค",
  },

  // 5. โคลคัสเจอร์
  {
    productCode: "7B112317",
    productName: "ไอศกรีมรส ส้มยูสุ ซอร์เบ (3kg/ถาด)",
    supplierKeywords: ["โคลคัสเจอร์", "colculture"],
    minQty: 2,
    unit: "ถาด",
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→อังคาร",
    notes: "ขั้นต่ำ 2 ถาด สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าอังคาร",
  },

  // 6. บ.ซีโน-แปซิฟิค
  {
    productCode: "4B333885",
    productName: "ซอสสเต็กพริกไทยดำ แม็คคอร์มิค 235g/ขวด",
    supplierKeywords: ["ซีโน-แปซิฟิค", "sino pacific"],
    minQty: 20,
    unit: "ขวด",
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→จันทร์",
    notes: "ขั้นต่ำ 20 ขวด (10 ขวด/ลัง) สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
  },

  // 7. ซินโนวา
  {
    productCode: "8B114123",
    productName: "เค้ก อูจิมัทฉะชีสเค้ก 85g/ชิ้น",
    supplierKeywords: ["ซินโนวา", "sinnova"],
    minQty: 36,
    unit: "ชิ้น",
    notes: "ขั้นต่ำ 36 ชิ้น (12 ชิ้น/กล่อง)",
  },

  // 8. ไซม์ ดาร์บี้ ออยล์ มรกต จำกัด
  {
    productCode: "4B331279",
    productName: "น้ำมันถั่วเหลือง ตรามรกต 13.75 L",
    supplierKeywords: ["มรกต", "ไซม์ ดาร์บี้", "sime darby"],
    minQty: 3,
    unit: "ปี๊บ",
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→จันทร์",
    notes: "ขั้นต่ำ 3 ปี๊บ สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
  },

  // 9. เซ็นทรัล ฟู้ด รีเทล
  {
    productCode: "9B334031",
    productName: "วุ้นเส้นแห้ง (40g/ห่อ (10ห่อ/แพ็ค))",
    supplierKeywords: ["เซ็นทรัล", "central"],
    minQty: 10,
    unit: "ห่อ",
    notes: "ขั้นต่ำ 10 ห่อ",
  },
  {
    productCode: "4B334175",
    productName: "กะปิตราชั่ง 90g / กระปุก",
    supplierKeywords: ["เซ็นทรัล", "central"],
    minQty: 6,
    unit: "กระปุก",
    notes: "ขั้นต่ำ 6 กระปุก (6 กระปุก/แพ็ค)",
  },

  // 10. ไทยน้ำทิพย์ คอร์ปอเรชั่น
  {
    productCode: "5B640393",
    productName: "โค้กกระป๋อง 325cc 24กป./ถาด",
    supplierKeywords: ["ไทยน้ำทิพย์", "thainamthip", "coke", "โค้ก"],
    minQty: 2,
    unit: "ถาด",
    notes: "ขั้นต่ำ 2 ถาด (24 กป./ถาด)",
  },

  // 11. บ.ค้าเบียร์
  {
    productCode: "5B643796",
    productName: "เบียร์สด Tiger 20L / ถัง",
    supplierKeywords: ["ค้าเบียร์", "tiger beer"],
    minQty: 1,
    unit: "ถัง",
    schedulePattern: "จันทร์→พฤหัส; พฤหัส→จันทร์",
    notes: "ขั้นต่ำ 1 ถัง สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
  },

  // 12. บ.สุพีเรีย
  {
    productCode: "9X440618",
    productName: "ผลิตภัณฑ์ล้างภาชนะในเครื่องล้างจาน พรีเมี่ยม",
    supplierKeywords: ["สุพีเรีย", "superior"],
    minQty: 2,
    unit: "แกลลอน",
    notes: "ขั้นต่ำ 2 แกลลอน (ส่งผ่านคลังก่อน)",
  },

  // 13. บ.ไอแอมกรู๊ป
  {
    productCode: "9X543883",
    productName: "กล่องใส่ปลา ST02L+ฝา",
    supplierKeywords: ["ไอแอมกรู๊ป", "iamgroup"],
    minQty: 1,
    unit: "แพ็ค",
    notes: "ขั้นต่ำ 1 แพ็ค (50 ชุด/แพ็ค)",
  },

  // 14. บ.คิดดีมีคุณ
  {
    productCode: "9X543944",
    productName: "ถุงเก็บอุณหภูมิ สีขาว 26x28+17cm",
    supplierKeywords: ["คิดดีมีคุณ", "kiddee"],
    minQty: 50,
    unit: "ใบ",
    notes: "ขั้นต่ำ 50 ใบ (2 แพ็ค)",
  },

  // 15. บ.กลมบ๊อกซ์
  {
    productCode: "9X543924",
    productName: "กล่องพิซซ่า12 นิ้ว สีคราฟ (50ใบ/แพ็ค)",
    supplierKeywords: ["กลมบ๊อกซ์", "klombox"],
    minQty: 1,
    unit: "แพ็ค",
    notes: "ขั้นต่ำ 1 แพ็ค (50 ใบ/แพ็ค)",
  },

  // 16. บ.ตั้ง ซุ่น ฮวด
  {
    productCode: "9X542968",
    productName: "ขวดพลาสติกใส ขวดเพชร 500 ml ทรงเหลี่ยม+ฝาอลู",
    supplierKeywords: ["ตั้ง ซุ่น ฮวด", "tang soon huat"],
    minQty: 20,
    unit: "ใบ",
    notes: "ขั้นต่ำ 20 ใบ / ขนาด (ส่งผ่านคลังก่อน)",
  },
];

/**
 * ค้นหากฎขั้นต่ำระดับรายการ (แบบ B) ของ SKU สินค้า
 */
export function findItemMinQtyRule(
  productCode: string,
  supplierName?: string,
): ItemMinQtyRule | undefined {
  if (!productCode) return undefined;
  const cleanCode = productCode.trim().toUpperCase();

  return ITEM_MIN_QTY_RULES.find((rule) => {
    if (rule.productCode.toUpperCase() !== cleanCode) return false;
    if (!supplierName || rule.supplierKeywords.length === 0) return true;

    const lowerSup = supplierName.toLowerCase();
    return rule.supplierKeywords.some((kw) => lowerSup.includes(kw.toLowerCase()));
  });
}

/**
 * ค้นหากฎนโยบายระดับซัพพลายเออร์ (แบบ A และรอบส่ง)
 */
export function findSupplierPolicyRule(
  supplier: PurchaseSupplier | string,
): SupplierPolicyRule | undefined {
  const supName = typeof supplier === "string" ? supplier : supplier.name || "";
  const supId = typeof supplier === "string" ? "" : supplier.id || "";
  const supCode = typeof supplier === "string" ? "" : supplier.code || "";
  const lowerName = supName.toLowerCase();

  return SUPPLIER_POLICY_RULES.find((rule) => {
    return rule.supplierKeywords.some((kw) => {
      const lowerKw = kw.toLowerCase();
      return (
        lowerName.includes(lowerKw) ||
        (supId && supId.toLowerCase().includes(lowerKw)) ||
        (supCode && supCode.toLowerCase().includes(lowerKw))
      );
    });
  });
}

/**
 * ดึงยอดสั่งขั้นต่ำระดับซัพพลายเออร์ (แบบ A)
 * ให้ความสำคัญกับค่าที่ระบุใน Supplier Master ก่อน หากไม่มีให้ดูจากนโยบายตารางบางนา
 */
export function getSupplierMinOrderAmount(
  supplier?: { name?: string; minOrderAmount?: number; [key: string]: unknown } | string,
): number {
  if (!supplier) return 0;
  if (typeof supplier !== "string" && supplier.minOrderAmount && supplier.minOrderAmount > 0) {
    return supplier.minOrderAmount;
  }

  const supName = typeof supplier === "string" ? supplier : supplier.name || "";
  const policy = findSupplierPolicyRule(supName);
  return policy?.minOrderAmountBaht || 0;
}

export interface DeliveryScheduleEstimate {
  scheduleText: string;
  expectedDateIso: string; // YYYY-MM-DD
  expectedDateThai: string; // เช่น "พฤหัสบดีที่ 4 ก.ย. 2026"
  dayName: string; // เช่น "วันพฤหัสบดี"
  leadDays: number;
  isSpecificSchedule: boolean;
}

const THAI_DAY_NAMES = [
  "วันอาทิตย์",
  "วันจันทร์",
  "วันอังคาร",
  "วันพุธ",
  "วันพฤหัสบดี",
  "วันศุกร์",
  "วันเสาร์",
];

const THAI_MONTH_NAMES_SHORT = [
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

/**
 * คำนวณวันที่จะได้รับของโดยอิงจาก "วันสั่ง → วันส่ง" ของซัพพลายเออร์/สินค้า
 * หากไม่มีข้อมูลระบุ ให้ใช้รอบมาตรฐานของร้าน (สั่งอาทิตย์/พุธ → เข้าจันทร์/พฤหัส)
 */
export function calculateExpectedDeliveryDate(
  orderDateIso: string,
  schedulePattern?: string,
): DeliveryScheduleEstimate {
  const baseDate = orderDateIso ? new Date(orderDateIso + "T00:00:00") : new Date();
  const dayOfWeek = baseDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  const pattern = schedulePattern?.trim();

  let targetDayOfWeek = 4; // default Thursday
  let leadDays = 1;
  let isSpecificSchedule = false;
  let scheduleText = "รอบมาตรฐาน (สั่งอาทิตย์/พุธ → เข้าจันทร์/พฤหัส)";

  if (pattern) {
    isSpecificSchedule = true;
    scheduleText = pattern;

    // Pattern 1: จันทร์→พฤหัส; พฤหัส→จันทร์
    if (pattern.includes("จันทร์→พฤหัส") && pattern.includes("พฤหัส→จันทร์")) {
      if (dayOfWeek >= 1 && dayOfWeek <= 3) {
        // Mon-Wed -> Thu
        leadDays = (4 - dayOfWeek + 7) % 7 || 7;
        targetDayOfWeek = 4;
      } else {
        // Thu-Sun -> next Mon
        leadDays = (1 - dayOfWeek + 7) % 7 || 7;
        targetDayOfWeek = 1;
      }
    }
    // Pattern 2: จันทร์→เสาร์; พฤหัส→เสาร์
    else if (pattern.includes("จันทร์→เสาร์") && pattern.includes("พฤหัส→เสาร์")) {
      leadDays = (6 - dayOfWeek + 7) % 7 || 7;
      targetDayOfWeek = 6;
    }
    // Pattern 3: จันทร์→พฤหัส; พฤหัส→อังคาร
    else if (pattern.includes("จันทร์→พฤหัส") && pattern.includes("พฤหัส→อังคาร")) {
      if (dayOfWeek >= 1 && dayOfWeek <= 3) {
        leadDays = (4 - dayOfWeek + 7) % 7 || 7;
        targetDayOfWeek = 4;
      } else {
        leadDays = (2 - dayOfWeek + 7) % 7 || 7;
        targetDayOfWeek = 2;
      }
    }
    // Pattern 4: จันทร์→พฤหัส (รอบเดียว เช่น ไทยโอโออิ)
    else if (pattern === "จันทร์→พฤหัส") {
      leadDays = (4 - dayOfWeek + 7) % 7 || 7;
      targetDayOfWeek = 4;
    }
    // Pattern 5: พฤหัส→อังคาร (รอบเดียว เช่น คิง มารีน)
    else if (pattern === "พฤหัส→อังคาร") {
      leadDays = (2 - dayOfWeek + 7) % 7 || 7;
      targetDayOfWeek = 2;
    }
    // Pattern 6: สั่งก่อน 16:00 จัดส่งวันถัดไป (เช่น เบทาโกร)
    else if (pattern.includes("วันถัดไป") || pattern.includes("จันทร์→อังคาร")) {
      leadDays = 1;
      targetDayOfWeek = (dayOfWeek + 1) % 7;
    }
    // Pattern 7: อาทิตย์→จันทร์; พุธ→พฤหัส (ชินเซ็น)
    else if (pattern.includes("อาทิตย์→จันทร์") || pattern.includes("พุธ→พฤหัส")) {
      if (dayOfWeek === 0) {
        leadDays = 1; // Sun -> Mon
        targetDayOfWeek = 1;
      } else if (dayOfWeek >= 1 && dayOfWeek <= 3) {
        leadDays = (4 - dayOfWeek + 7) % 7 || 7; // Mon-Wed -> Thu
        targetDayOfWeek = 4;
      } else {
        leadDays = (1 - dayOfWeek + 7) % 7 || 7; // Thu-Sat -> Mon
        targetDayOfWeek = 1;
      }
    }
    // Generic fallback for custom string
    else {
      leadDays = 2;
      targetDayOfWeek = (dayOfWeek + 2) % 7;
    }
  } else {
    // Default store schedule: สั่งอาทิตย์/พุธ → เข้าจันทร์/พฤหัส
    if (dayOfWeek === 0) {
      leadDays = 1; // Sun -> Mon
      targetDayOfWeek = 1;
    } else if (dayOfWeek >= 1 && dayOfWeek <= 3) {
      leadDays = (4 - dayOfWeek + 7) % 7 || 7; // Mon-Wed -> Thu
      targetDayOfWeek = 4;
    } else {
      leadDays = (1 - dayOfWeek + 7) % 7 || 7; // Thu-Sat -> Mon
      targetDayOfWeek = 1;
    }
  }

  // Calculate target date
  const targetDate = new Date(baseDate);
  targetDate.setDate(targetDate.getDate() + leadDays);

  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, "0");
  const d = String(targetDate.getDate()).padStart(2, "0");
  const iso = `${y}-${m}-${d}`;

  const dayName = THAI_DAY_NAMES[targetDate.getDay()];
  const thaiDateFormatted = `${dayName}ที่ ${targetDate.getDate()} ${THAI_MONTH_NAMES_SHORT[targetDate.getMonth()]} ${y + 543}`;

  return {
    scheduleText,
    expectedDateIso: iso,
    expectedDateThai: thaiDateFormatted,
    dayName,
    leadDays,
    isSpecificSchedule,
  };
}

/**
 * ค้นหากฎขั้นต่ำระดับสินค้า (แบบ B) ทั้งหมดที่อยู่ในซัพพลายเออร์นี้
 */
export function getItemRulesForSupplier(supplier: PurchaseSupplier | string): ItemMinQtyRule[] {
  const supName = typeof supplier === "string" ? supplier : supplier.name || "";
  const supId = typeof supplier === "string" ? "" : supplier.id || "";
  const supCode = typeof supplier === "string" ? "" : supplier.code || "";
  const lowerName = supName.toLowerCase();

  return ITEM_MIN_QTY_RULES.filter((rule) => {
    return rule.supplierKeywords.some((kw) => {
      const lowerKw = kw.toLowerCase();
      return (
        lowerName.includes(lowerKw) ||
        (supId && supId.toLowerCase().includes(lowerKw)) ||
        (supCode && supCode.toLowerCase().includes(lowerKw))
      );
    });
  });
}

/**
 * ดึงข้อมูลนโยบายและรอบการจัดส่งแบบสรุปสมบูรณ์สำหรับซัพพลายเออร์ที่เลือก
 */
export interface SupplierPolicyDetails {
  supplierId?: string;
  supplierName: string;
  minOrderAmountBaht: number;
  hasMinAmount: boolean;
  schedulePattern: string;
  isSpecificSchedule: boolean;
  notes?: string;
  deliveryEstimate: DeliveryScheduleEstimate;
  itemRules: ItemMinQtyRule[];
  branchTerms?: string;
}

export function getSupplierPolicyDetails(
  supplier: PurchaseSupplier | string,
  orderDateIso: string,
  branchId?: string,
): SupplierPolicyDetails {
  const supName = typeof supplier === "string" ? supplier : supplier.name || "";
  const supId = typeof supplier === "string" ? undefined : supplier.id;
  const policyRule = findSupplierPolicyRule(supplier);
  const minAmount = getSupplierMinOrderAmount(supplier);

  const deliveryEstimate = calculateExpectedDeliveryDate(orderDateIso, policyRule?.schedulePattern);

  const itemRules = getItemRulesForSupplier(supplier);

  const branchTerms =
    (typeof supplier !== "string" && branchId && supplier.branchDeliveryTerms?.[branchId]) ||
    (typeof supplier !== "string" && supplier.deliveryTerms) ||
    policyRule?.notes ||
    "";

  return {
    supplierId: supId,
    supplierName: supName,
    minOrderAmountBaht: minAmount,
    hasMinAmount: minAmount > 0,
    schedulePattern: policyRule?.schedulePattern || "ตามรอบมาตรฐานสาขา",
    isSpecificSchedule: deliveryEstimate.isSpecificSchedule,
    notes: policyRule?.notes || (typeof supplier !== "string" ? supplier.notes : undefined),
    deliveryEstimate,
    itemRules,
    branchTerms,
  };
}

// ==========================================
// Cart Minimum Validation Interfaces & Engine
// ==========================================

export interface CartItemForValidation {
  product: PurchaseProduct;
  quantity: number;
  notes?: string;
  subtotal: number;
}

export interface ItemValidationViolation {
  productId: string;
  productCode: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  currentQty: number;
  minQty: number;
  unit: string;
  deficitQty: number;
  message: string;
  notes?: string;
}

export interface SupplierValidationViolation {
  supplierId: string;
  supplierName: string;
  currentTotal: number;
  currentAmount?: number;
  minOrderAmount: number;
  deficitAmount: number;
  difference?: number;
  message: string;
  percentage: number;
  notes?: string;
}

export interface SupplierValidationSummary {
  supplier: PurchaseSupplier | undefined;
  supplierId: string;
  supplierName: string;
  items: CartItemForValidation[];
  totalAmount: number;
  minOrderAmount: number;
  meetsMinimum: boolean;
  deficitAmount: number;
  difference?: number;
  percentage: number;
  hasItemViolations: boolean;
  itemViolations: ItemValidationViolation[];
  deliveryEstimate: DeliveryScheduleEstimate;
  deliveryTermsText: string;
}

export interface CartPolicyValidationResult {
  isValid: boolean;
  canSubmit: boolean;
  hasItemViolations: boolean;
  hasSupplierViolations: boolean;
  itemViolations: ItemValidationViolation[];
  supplierViolations: SupplierValidationViolation[];
  supplierSummaries: SupplierValidationSummary[];
  totalCartAmount: number;
  totalCartItemsCount: number;
  totalCartUnits: number;
  suppliersInvolvedCount: number;
}

/**
 * ตรวจสอบความถูกต้องของตะกร้าสินค้าตามกฎขั้นต่ำทั้ง 2 แบบ (A & B) แบบเรียลไทม์
 */
export function validateCartPolicies(
  cartItems: CartItemForValidation[],
  suppliers: PurchaseSupplier[],
  orderDateIso: string,
  branchId?: string,
): CartPolicyValidationResult {
  const itemViolations: ItemValidationViolation[] = [];
  const supplierGroupsMap = new Map<string, SupplierValidationSummary>();

  // 1. ตรวจสอบระดับรายการ (แบบ B - per_item_qty)
  cartItems.forEach((cartItem) => {
    const { product, quantity, subtotal } = cartItem;
    const itemRule = findItemMinQtyRule(product.code, product.supplierName);

    let isItemViolated = false;
    let deficitQty = 0;

    if (itemRule && quantity > 0 && quantity < itemRule.minQty) {
      isItemViolated = true;
      deficitQty = Math.max(0, itemRule.minQty - quantity);

      const violation: ItemValidationViolation = {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        supplierId: product.supplierId,
        supplierName: product.supplierName,
        currentQty: quantity,
        minQty: itemRule.minQty,
        unit: itemRule.unit || product.unit,
        deficitQty,
        message: `สินค้า "${product.name}" (${product.code}) สั่งขั้นต่ำ ${itemRule.minQty} ${itemRule.unit} (ขาดอีก ${deficitQty} ${itemRule.unit})`,
        notes: itemRule.notes,
      };

      itemViolations.push(violation);
    }

    // จัดกลุ่มตามซัพพลายเออร์
    const supId = product.supplierId;
    const sup = suppliers.find((s) => s.id === supId);
    const supName = sup?.name || product.supplierName;

    if (!supplierGroupsMap.has(supId)) {
      const minAmount = getSupplierMinOrderAmount(sup || supName);
      const supPolicy = findSupplierPolicyRule(sup || supName);
      const schedulePattern = supPolicy?.schedulePattern;
      const deliveryEstimate = calculateExpectedDeliveryDate(orderDateIso, schedulePattern);

      const deliveryTerms =
        (branchId && sup?.branchDeliveryTerms?.[branchId]) ||
        sup?.deliveryTerms ||
        supPolicy?.notes ||
        "จัดส่งตามรอบปกติ";

      supplierGroupsMap.set(supId, {
        supplier: sup,
        supplierId: supId,
        supplierName: supName,
        items: [],
        totalAmount: 0,
        minOrderAmount: minAmount,
        meetsMinimum: false,
        deficitAmount: 0,
        percentage: 100,
        hasItemViolations: false,
        itemViolations: [],
        deliveryEstimate,
        deliveryTermsText: deliveryTerms,
      });
    }

    const group = supplierGroupsMap.get(supId)!;
    group.items.push(cartItem);
    group.totalAmount += subtotal;

    if (isItemViolated) {
      group.hasItemViolations = true;
      const addedViolation = itemViolations[itemViolations.length - 1];
      if (addedViolation) {
        group.itemViolations.push(addedViolation);
      }
    }
  });

  // 2. ตรวจสอบระดับซัพพลายเออร์ (แบบ A - per_supplier_baht)
  const supplierViolations: SupplierValidationViolation[] = [];
  const supplierSummaries: SupplierValidationSummary[] = [];

  supplierGroupsMap.forEach((group) => {
    const minAmount = group.minOrderAmount || 0;
    group.meetsMinimum = minAmount <= 0 || group.totalAmount >= minAmount;
    group.deficitAmount = Math.max(0, minAmount - group.totalAmount);
    group.difference = group.deficitAmount;
    group.percentage =
      minAmount > 0 ? Math.min(100, Math.round((group.totalAmount / minAmount) * 100)) : 100;

    if (!group.meetsMinimum && minAmount > 0) {
      const violation: SupplierValidationViolation = {
        supplierId: group.supplierId,
        supplierName: group.supplierName,
        currentTotal: group.totalAmount || 0,
        currentAmount: group.totalAmount || 0,
        minOrderAmount: minAmount,
        deficitAmount: group.deficitAmount,
        difference: group.deficitAmount,
        percentage: group.percentage,
        message: `ซัพพลายเออร์ "${group.supplierName}" ยอดสั่งซื้อ ฿${(group.totalAmount || 0).toLocaleString()} ยังไม่ถึงขั้นต่ำ ฿${minAmount.toLocaleString()} (ขาดอีก ฿${group.deficitAmount.toLocaleString()})`,
        notes: group.supplier?.deliveryTerms,
      };
      supplierViolations.push(violation);
    }

    supplierSummaries.push(group);
  });

  const hasItemViolations = itemViolations.length > 0;
  const hasSupplierViolations = supplierViolations.length > 0;
  const isValid = !hasItemViolations && !hasSupplierViolations && cartItems.length > 0;

  const totalCartAmount = cartItems.reduce((sum, i) => sum + i.subtotal, 0);
  const totalCartItemsCount = cartItems.length;
  const totalCartUnits = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  return {
    isValid,
    canSubmit: isValid,
    hasItemViolations,
    hasSupplierViolations,
    itemViolations,
    supplierViolations,
    supplierSummaries,
    totalCartAmount,
    totalCartItemsCount,
    totalCartUnits,
    suppliersInvolvedCount: supplierSummaries.length,
  };
}
