import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  Firestore,
  Unsubscribe,
} from "firebase/firestore";
import {
  PurchaseBranch,
  PurchaseSupplier,
  PurchaseProduct,
  PurchaseOrder,
  PurchaseProductChangeLog,
  DatabaseAConfig,
  PurchaseOrderStatus,
} from "../features/purchase/types";
import { REAL_VEGETABLE_PRODUCTS } from "../data/vegetables";
import { ALL_PORTO_CENTRAL_AND_SPECIAL_PRODUCTS } from "../data/portoCentralProducts";

// Default Database A connection credentials (from ordering system)
export const DEFAULT_DATABASE_A_CONFIG: DatabaseAConfig = {
  projectId: "poetic-transducer-5t3g1",
  appId: "1:127254917729:web:0632bf2ded4f591daf3020",
  apiKey: "AIzaSyDne6oxXDq1dwfGYx4fqTph7FSneuTYhUs",
  authDomain: "poetic-transducer-5t3g1.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-storerawmaterial-2f975217-1ea4-4ef3-9f8e-8746ea166a62",
  storageBucket: "poetic-transducer-5t3g1.firebasestorage.app",
  messagingSenderId: "127254917729",
  oAuthClientId: "127254917729-iksj27etqvmegbnt5p6io602i96bf2k0.apps.googleusercontent.com",
};

const LS_CONFIG_KEY = "database_a_connection_config";
const LS_OFFLINE_ORDERS = "database_a_offline_orders";
const LS_OFFLINE_PRODUCTS = "database_a_offline_products_v4";
const LS_OFFLINE_SUPPLIERS = "database_a_offline_suppliers_v4";
const LS_OFFLINE_BRANCHES = "database_a_offline_branches";
const LS_OFFLINE_LOGS = "database_a_offline_logs";

export const COLLECTIONS_A = {
  BRANCHES: "branches",
  SUPPLIERS: "suppliers",
  PRODUCTS: "products",
  ORDERS: "orders",
  LOGS: "product_logs",
};

// Initial Seed Data for fallback
export const INITIAL_BRANCHES_A: PurchaseBranch[] = [
  {
    id: "branch-1",
    name: "สาขา 1 - วัชรพล",
    code: "BR-01",
    location: "ถ.วัชรพล เขตบางเขน กรุงเทพฯ",
    manager: "คุณสมชาย ใจดี",
    phone: "081-234-5671",
    pin: "1111",
  },
  {
    id: "branch-2",
    name: "สาขา 2 - พระราม33",
    code: "BR-02",
    location: "ซ.พระราม 33 เขตยานนาวา กรุงเทพฯ",
    manager: "คุณวิภาวี สุขสันต์",
    phone: "082-345-6782",
    pin: "2222",
  },
  {
    id: "branch-3",
    name: "สาขา 3 - บางแก้ว",
    code: "BR-03",
    location: "ต.บางแก้ว อ.บางพลี สมุทรปราการ",
    manager: "คุณณัฐพงษ์ มั่นคง",
    phone: "083-456-7893",
    pin: "3333",
  },
  {
    id: "branch-4",
    name: "สาขา 4 - บางนา",
    code: "BR-04",
    location: "ถ.บางนา-ตราด เขตบางนา กรุงเทพฯ",
    manager: "คุณกมลวรรณ เด่นดวง",
    phone: "084-567-8904",
    pin: "7777",
  },
  {
    id: "branch-5",
    name: "สาขา 5 - พอโตชิโน่",
    code: "BR-05",
    location: "โครงการพอโตชิโน่ ถ.พระราม 2 จ.สมุทรสาคร",
    manager: "คุณอรรถพล โชคดี",
    phone: "085-678-9015",
    pin: "0011",
  },
];

export const INITIAL_SUPPLIERS_A: PurchaseSupplier[] = [
  {
    id: "sup-1",
    name: "บริษัท ซีพี ฟู้ดส์ จำกัด (CP Foods)",
    code: "SUP-CP",
    contactPerson: "คุณกิตติศักดิ์",
    phone: "02-711-8000",
    email: "order@cpfood.co.th",
    address: "313 อาคารซีพี ทาวเวอร์ ถ.สีลม กรุงเทพฯ",
    deliveryTerms: "สั่งขั้นต่ำ 2,000 บาท จัดส่งฟรีภายใน 24 ชม. (เครดิต 30 วัน)",
    branchDeliveryTerms: {
      "branch-1": "สั่งขั้นต่ำ 1,500 บาท ส่งตรงถึงวัชรพลทุกวันก่อน 09:00 น.",
      "branch-2": "สั่งขั้นต่ำ 2,000 บาท ส่งรอบเช้า (08:00 - 11:00 น.)",
      "branch-3": "สั่งขั้นต่ำ 2,500 บาท (บางแก้วส่งรอบ 11:00 น. เป็นต้นไป)",
      "branch-4": "สั่งขั้นต่ำ 1,500 บาท ส่งตรงโซนบางนาวันจันทร์-เสาร์",
    },
    categories: ["เนื้อสัตว์สด", "ไก่สด", "หมูสด"],
    minOrderAmount: 2000,
  },
  {
    id: "sup-2",
    name: "เบทาโกร ฟู้ด ซัพพลาย (Betagro)",
    code: "SUP-BETA",
    contactPerson: "คุณพิมพ์ใจ",
    phone: "02-833-8000",
    email: "sales@betagro.com",
    address: "47 ถ.งามวงศ์วาน หลักสี่ กรุงเทพฯ",
    deliveryTerms: "สั่งก่อน 16:00 น. จัดส่งวันถัดไป ส่งฟรีเมื่อสั่งเกิน 1,500 บาท",
    branchDeliveryTerms: {
      "branch-1": "ส่งฟรีสั่งเกิน 1,200 บาท รอบเช้า 08:30 น.",
      "branch-3": "ส่งเฉพาะวันอังคาร พฤหัส และเสาร์ สั่งขั้นต่ำ 1,800 บาท",
    },
    categories: ["ไข่ไก่สด", "ผักอนามัย", "เนื้อแปรรูป"],
    minOrderAmount: 1500,
  },
  {
    id: "sup-3",
    name: "อินเตอร์ ฟู้ด ซอส & ซัพพลาย (Aro Supply)",
    code: "SUP-ARO",
    contactPerson: "คุณธนพล",
    phone: "02-987-6543",
    email: "order@interfood.co.th",
    address: "88/12 ถนนบางนา-ตราด กม.5 สมุทรปราการ",
    deliveryTerms: "จัดส่งรอบอังคาร/พฤหัส/เสาร์ สั่งขั้นต่ำ 1,000 บาท",
    branchDeliveryTerms: {
      "branch-2": "จัดส่งรอบจันทร์/พุธ/ศุกร์ สั่งขั้นต่ำ 1,000 บาท",
      "branch-4": "จัดส่งรอบอังคาร/พฤหัส สั่งขั้นต่ำ 1,200 บาท",
    },
    categories: ["เครื่องปรุงรส", "ซอส", "น้ำมันพืช", "แห้ง/บรรจุภัณฑ์"],
    minOrderAmount: 1000,
  },
  {
    id: "sup-4",
    name: "แดรี่ โกลด์ นมและเนย (Dairy Gold)",
    code: "SUP-DAIRY",
    contactPerson: "คุณสุชาดา",
    phone: "02-331-9988",
    email: "supply@dairygold.co.th",
    address: "102 ถ.สุขุมวิท 71 กรุงเทพฯ",
    deliveryTerms: "ขนส่งรถเย็น ควบคุมอุณหภูมิ 2-4°C จัดส่งทุกวันจันทร์-ศุกร์",
    branchDeliveryTerms: {
      "branch-1": "ขนส่งรถเย็น จัดส่งทุกวันจันทร์/พุธ/ศุกร์ สั่งก่อน 12:00 น.",
      "branch-3": "ขนส่งรถเย็น จัดส่งทุกวันอังคาร/พฤหัส/เสาร์",
    },
    categories: ["นมสด", "เนยสด", "วิปปิ้งครีม", "ชีส"],
    minOrderAmount: 1200,
  },
  {
    id: "sup-5",
    name: "ชินเซ็น (Shinsen)",
    code: "SUP-SHINSEN",
    contactPerson: "คุณวรินทร",
    phone: "02-123-4567",
    email: "order@shinsen.co.th",
    address: "ตลาดไท ถ.พหลโยธิน ปทุมธานี",
    deliveryTerms: "สั่งขั้นต่ำ 800 บาท",
    categories: ["วัตถุดิบสด", "ผัก", "แห้ง/บรรจุภัณฑ์"],
    minOrderAmount: 800,
  },
  {
    id: "sup-6",
    name: "WFOOD",
    code: "SUP-WFOOD",
    contactPerson: "คุณณภัทร",
    phone: "02-987-6543",
    email: "sales@wfood.com",
    address: "บางนา กรุงเทพฯ",
    deliveryTerms: "สั่งขั้นต่ำ 1,000 บาท",
    categories: ["วัตถุดิบสด", "ผัก", "แห้ง/บรรจุภัณฑ์"],
    minOrderAmount: 1000,
  },
  {
    id: "sup-7",
    name: "เซ็นทรัล",
    code: "SUP-CENTRAL",
    contactPerson: "-",
    phone: "-",
    email: "-",
    address: "-",
    deliveryTerms: "สั่งขั้นต่ำ 1,000 บาท",
    categories: ["วัตถุดิบสด", "ผัก", "แห้ง/บรรจุภัณฑ์"],
    minOrderAmount: 1000,
    availableBranchIds: ["branch-5"], // ใช้เฉพาะสาขาพอร์โตชิโน่ (รหัส 0011 / branch-5)
  },
  // --- ซัพพลายเออร์เพิ่มเติมจากตารางขั้นต่ำการสั่งซื้อ_บางนา_v2.xlsx ---
  {
    id: "sup-gof",
    name: "โกลบอล โอเชี่ยน ฟู้ดส์ จำกัด",
    code: "SUP-GOF",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0001",
    email: "sales@globalocean.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "สั่งขั้นต่ำ 2,000 บาท",
    categories: ["อาหารแห้ง", "เครื่องปรุงรส"],
    minOrderAmount: 2000,
  },
  {
    id: "sup-farmfresh",
    name: "ฟาร์มเฟรช",
    code: "SUP-FARMFRESH",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0002",
    email: "sales@farmfresh.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "สั่งจันทร์/พฤหัส เข้าเสาร์ ขั้นต่ำ 1 ลัง (15 กก.)",
    categories: ["เนื้อสัตว์สด", "หมูคุโรบูตะ"],
    minOrderAmount: 0,
  },
  {
    id: "sup-cpf",
    name: "ซีพีเอฟ โกลบอล ฟู้ด โซลูชั่น",
    code: "SUP-CPF-GFS",
    contactPerson: "ฝ่ายบริการลูกค้า",
    phone: "02-800-8000",
    email: "order@cpf-gfs.co.th",
    address: "313 อาคารซีพี ทาวเวอร์ ถ.สีลม กรุงเทพฯ",
    deliveryTerms: "สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
    categories: ["เนื้อสัตว์สด", "ไก่สด", "หมูสด", "อาหารแช่แข็ง", "ไข่ไก่"],
    minOrderAmount: 0,
  },
  {
    id: "sup-thaiuni",
    name: "ไทยยูนิฟู้ด เซอร์วิส จำกัด",
    code: "SUP-THAIUNI",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0004",
    email: "sales@thaiunifood.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "สั่งขั้นต่ำ 4,000 บาท (ถ้าสั่งปูอัด สามารถสั่งกุ้ง 1 ลังได้)",
    categories: ["อาหารแช่แข็ง", "อาหารทะเล", "ปูอัด"],
    minOrderAmount: 4000,
  },
  {
    id: "sup-noble",
    name: "โนเบิล โมโน จำกัด",
    code: "SUP-NOBLE",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0005",
    email: "order@noblemono.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "สั่งเข้าพร้อมปลานอกได้ ไม่ต้องมีขั้นต่ำ",
    categories: ["อาหารทะเล", "โฮตาเตะ"],
    minOrderAmount: 0,
  },
  {
    id: "sup-thaiooi",
    name: "ไทยโอโออิ จำกัด",
    code: "SUP-THAIOOI",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0006",
    email: "sales@thaiooi.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ขั้นต่ำ 5,000 บาท (สั่งได้เฉพาะ จันทร์ เข้า พฤหัส)",
    categories: ["อาหารทะเล", "หอยนางรมญี่ปุ่น"],
    minOrderAmount: 5000,
  },
  {
    id: "sup-kingmarine",
    name: "คิง มารีน ฟู้ดส์ จำกัด",
    code: "SUP-KINGMARINE",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0007",
    email: "sales@kingmarine.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ขั้นต่ำ 3,000 บาท (สั่งได้เฉพาะ พฤหัส เข้า อังคาร)",
    categories: ["อาหารทะเล", "เอฮิเระ"],
    minOrderAmount: 3000,
  },
  {
    id: "sup-wellfood",
    name: "บ.เวลฟู้ด",
    code: "SUP-WELLFOOD",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0008",
    email: "sales@wellfood.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ขั้นต่ำ 3,000 บาท (สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์)",
    categories: ["เนื้อวัว", "วากิว"],
    minOrderAmount: 3000,
  },
  {
    id: "sup-daisho",
    name: "ไดโช (ประเทศไทย) จำกัด",
    code: "SUP-DAISHO",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0009",
    email: "sales@daisho.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ขั้นต่ำ 3,000 บาท",
    categories: ["เครื่องปรุงรส", "สาหร่าย", "วัตถุดิบญี่ปุ่น"],
    minOrderAmount: 3000,
  },
  {
    id: "sup-ack",
    name: "บ.เอ ซี เค",
    code: "SUP-ACK",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0010",
    email: "sales@ack.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ขั้นต่ำ 15 แพ็ค",
    categories: ["ผักสด", "สลัด"],
    minOrderAmount: 0,
  },
  {
    id: "sup-siamfood",
    name: "สยามฟูด เซอร์วิส",
    code: "SUP-SIAMFOOD",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0011",
    email: "sales@siamfood.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ขั้นต่ำ 3,000 บาท (2 ตัว)",
    categories: ["อาหารแช่แข็ง", "แซลมอนเทร้า"],
    minOrderAmount: 3000,
  },
  {
    id: "sup-bif",
    name: "บางกอกอินเตอร์ฟูด (BIF)",
    code: "SUP-BIF",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0012",
    email: "sales@bif.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ขั้นต่ำ 3,000 บาท (ราคา+3% กรณีซื้อปลีกยกแพ็ค)",
    categories: ["เบเกอรี่", "ของหวาน", "ไดฟุกุ"],
    minOrderAmount: 3000,
  },
  {
    id: "sup-cti",
    name: "ซีทีไอ ฟู๊ด ซัพพลาย",
    code: "SUP-CTI",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0013",
    email: "sales@ctifood.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ขั้นต่ำ 3,000 บาท (สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์)",
    categories: ["เนื้อวัว", "วากิว"],
    minOrderAmount: 3000,
  },
  {
    id: "sup-jagota",
    name: "จาโกต้า บราเดอร์ส เทรดดิ้ง",
    code: "SUP-JAGOTA",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0014",
    email: "sales@jagota.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ขั้นต่ำ 2,500 บาท (สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์)",
    categories: ["เนื้อวัว", "วากิว", "สินค้านำเข้า"],
    minOrderAmount: 2500,
  },
  {
    id: "sup-colculture",
    name: "โคลคัสเจอร์",
    code: "SUP-COLCULTURE",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0015",
    email: "sales@colculture.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าอังคาร (ขั้นต่ำ 2 ถาด)",
    categories: ["ไอศกรีม", "ของหวาน"],
    minOrderAmount: 0,
  },
  {
    id: "sup-sino",
    name: "บ.ซีโน-แปซิฟิค",
    code: "SUP-SINO",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0016",
    email: "sales@sinopacific.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์ (ขั้นต่ำ 20 ขวด)",
    categories: ["เครื่องปรุงรส", "ซอส"],
    minOrderAmount: 0,
  },
  {
    id: "sup-sinnova",
    name: "ซินโนวา",
    code: "SUP-SINNOVA",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0017",
    email: "sales@sinnova.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ขั้นต่ำ 36 ชิ้น (12 ชิ้น/กล่อง)",
    categories: ["เบเกอรี่", "เค้ก"],
    minOrderAmount: 0,
  },
  {
    id: "sup-morakot",
    name: "ไซม์ ดาร์บี้ ออยล์ มรกต จำกัด",
    code: "SUP-MORAKOT",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0018",
    email: "sales@morakot.com",
    address: "กรุงเทพฯ",
    deliveryTerms: "สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์ (ขั้นต่ำ 3 ปี๊บ)",
    categories: ["น้ำมันพืช"],
    minOrderAmount: 0,
  },
  {
    id: "sup-cfr",
    name: "เซ็นทรัล ฟู้ด รีเทล จำกัด",
    code: "SUP-CFR",
    contactPerson: "ฝ่ายขาย B2B",
    phone: "02-100-0019",
    email: "sales@centralfood.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ขั้นต่ำ 1,000 บาท (สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์)",
    categories: ["เครื่องดื่ม", "ของแห้ง", "เครื่องปรุง"],
    minOrderAmount: 1000,
  },
  {
    id: "sup-thainamthip",
    name: "ไทยน้ำทิพย์ คอร์ปอเรชั่น จำกัด",
    code: "SUP-THAINAMTHIP",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0020",
    email: "sales@thainamthip.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ขั้นต่ำ 2 ถาด",
    categories: ["เครื่องดื่ม", "น้ำอัดลม"],
    minOrderAmount: 0,
  },
  {
    id: "sup-kabeer",
    name: "บ.ค้าเบียร์",
    code: "SUP-KABEER",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0021",
    email: "sales@kabeer.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์ (ขั้นต่ำ 1 ถัง)",
    categories: ["เครื่องดื่มแอลกอฮอล์", "เบียร์สด"],
    minOrderAmount: 0,
  },
  {
    id: "sup-skliquor",
    name: "เอส.เค.ลิเคอร์",
    code: "SUP-SKLIQUOR",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0022",
    email: "sales@skliquor.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ขั้นต่ำ 3,000 บาท",
    categories: ["เครื่องดื่มแอลกอฮอล์", "สาเก"],
    minOrderAmount: 3000,
  },
  {
    id: "sup-asan",
    name: "บ.อาซัน",
    code: "SUP-ASAN",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0023",
    email: "sales@asan.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ขั้นต่ำ 3,000 บาท",
    categories: ["เครื่องปรุงรส", "ซอส"],
    minOrderAmount: 3000,
  },
  {
    id: "sup-superior",
    name: "บ.สุพีเรีย",
    code: "SUP-SUPERIOR",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0024",
    email: "sales@superior.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ส่งผ่านคลังก่อน ขั้นต่ำ 2 แกลลอน",
    categories: ["อุปกรณ์ทำความสะอาด", "น้ำยาล้างจาน"],
    minOrderAmount: 0,
  },
  {
    id: "sup-iamgroup",
    name: "บ.ไอแอมกรู๊ป",
    code: "SUP-IAMGROUP",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0025",
    email: "sales@iamgroup.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ขั้นต่ำ 1 แพ็ค (50 ชุด/แพ็ค)",
    categories: ["บรรจุภัณฑ์", "กล่องใส"],
    minOrderAmount: 0,
  },
  {
    id: "sup-kiddee",
    name: "คิดดีมีคุณ",
    code: "SUP-KIDDEE",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0026",
    email: "sales@kiddee.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ขั้นต่ำ 50 ใบ (2 แพ็ค)",
    categories: ["บรรจุภัณฑ์", "ถุงเก็บอุณหภูมิ"],
    minOrderAmount: 0,
  },
  {
    id: "sup-klombox",
    name: "บ.กลมบ๊อกซ์",
    code: "SUP-KLOMBOX",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0027",
    email: "sales@klombox.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ขั้นต่ำ 1 แพ็ค (50 ใบ/แพ็ค)",
    categories: ["บรรจุภัณฑ์", "กล่องพิซซ่า"],
    minOrderAmount: 0,
  },
  {
    id: "sup-tangsoonhuat",
    name: "บ.ตั้ง ซุ่น ฮวด",
    code: "SUP-TANGSOONHUAT",
    contactPerson: "ฝ่ายขาย",
    phone: "02-100-0028",
    email: "sales@tangsoonhuat.co.th",
    address: "กรุงเทพฯ",
    deliveryTerms: "ส่งผ่านคลังก่อน ขั้นต่ำ 20 ใบ / ขนาด",
    categories: ["บรรจุภัณฑ์", "ขวดพลาสติก"],
    minOrderAmount: 0,
  },
];

export const INITIAL_PRODUCTS_A: PurchaseProduct[] = [
  {
    id: "prod-101",
    code: "PORK-001",
    name: "เนื้อหมูสันนอกสด (Pork Loin)",
    supplierId: "sup-1",
    supplierName: "บริษัท ซีพี ฟู้ดส์ จำกัด (CP Foods)",
    category: "เนื้อสัตว์สด",
    unit: "กก.",
    price: 185,
    deliveryTerms: "ขนส่งรถเย็น ควบคุมอุณหภูมิไม่เกิน 4°C",
    minOrderQty: 5,
  },
  {
    id: "prod-102",
    code: "PORK-002",
    name: "เนื้อหมูบด A (Minced Pork)",
    supplierId: "sup-1",
    supplierName: "บริษัท ซีพี ฟู้ดส์ จำกัด (CP Foods)",
    category: "เนื้อสัตว์สด",
    unit: "กก.",
    price: 160,
    deliveryTerms: "บรรจุถุงสูญญากาศ 1 กก.",
    minOrderQty: 5,
  },
  {
    id: "prod-103",
    code: "CHICK-001",
    name: "อกไก่สดลอกหนัง (Chicken Breast)",
    supplierId: "sup-1",
    supplierName: "บริษัท ซีพี ฟู้ดส์ จำกัด (CP Foods)",
    category: "ไก่สด",
    unit: "กก.",
    price: 120,
    deliveryTerms: "ส่งฟรีเมื่อสั่งรวมเกิน 2,000 บาท",
    minOrderQty: 10,
  },
  {
    id: "prod-201",
    code: "EGG-001",
    name: "ไข่ไก่สด เบอร์ 2 (แผง 30 ฟอง)",
    supplierId: "sup-2",
    supplierName: "เบทาโกร ฟู้ด ซัพพลาย (Betagro)",
    category: "ไข่ไก่สด",
    unit: "แผง",
    price: 125,
    deliveryTerms: "บรรจุกล่องกระดาษกันกระแทก สั่งขั้นต่ำ 5 แผง",
    minOrderQty: 5,
  },
  {
    id: "prod-202",
    code: "VEG-001",
    name: "ผักกาดหอมไฮโดรโปนิกส์สด",
    supplierId: "sup-2",
    supplierName: "เบทาโกร ฟู้ด ซัพพลาย (Betagro)",
    category: "ผักอนามัย",
    unit: "กก.",
    price: 95,
    deliveryTerms: "เก็บเกี่ยววันต่อวัน จัดส่งช่วงเช้าก่อน 10:00 น.",
    minOrderQty: 2,
  },
  {
    id: "prod-301",
    code: "SAUCE-001",
    name: "ซอสโชยุปรุงรสญี่ปุ่น (แกลลอน 5 ลิตร)",
    supplierId: "sup-3",
    supplierName: "อินเตอร์ ฟู้ด ซอส & ซัพพลาย (Aro Supply)",
    category: "เครื่องปรุงรส",
    unit: "แกลลอน",
    price: 380,
    deliveryTerms: "สั่งขั้นต่ำ 1 แกลลอน",
    minOrderQty: 1,
  },
  {
    id: "prod-302",
    code: "OIL-001",
    name: "น้ำมันถั่วเหลือง (ปี๊บ 13.75 ลิตร)",
    supplierId: "sup-3",
    supplierName: "อินเตอร์ ฟู้ด ซอส & ซัพพลาย (Aro Supply)",
    category: "น้ำมันพืช",
    unit: "ปี๊บ",
    price: 640,
    deliveryTerms: "ส่งฟรีเฉพาะรอบประจำวันอังคาร/พฤหัส",
    minOrderQty: 1,
  },
  {
    id: "prod-401",
    code: "MILK-001",
    name: "นมสดพาสเจอร์ไรส์รสจืด (แกลลอน 2 ลิตร)",
    supplierId: "sup-4",
    supplierName: "แดรี่ โกลด์ นมและเนย (Dairy Gold)",
    category: "นมสด",
    unit: "แกลลอน",
    price: 115,
    deliveryTerms: "รถเย็น 2-4°C วันหมดอายุไม่ต่ำกว่า 10 วัน",
    minOrderQty: 4,
  },
  {
    id: "prod-402",
    code: "BUTTER-001",
    name: "เนยสดแท้ชนิดจืด (ก้อน 500 กรัม)",
    supplierId: "sup-4",
    supplierName: "แดรี่ โกลด์ นมและเนย (Dairy Gold)",
    category: "เนยสด",
    unit: "ก้อน",
    price: 175,
    deliveryTerms: "ขนส่งรถเย็น สั่งขั้นต่ำ 6 ก้อน",
    minOrderQty: 6,
  },
  // --- หมวดผักและวัตถุดิบสด: ชินเซ็น (Shinsen) และ WFOOD จากไฟล์จริง ส่งผัก_บางนา.xlsx ---
  ...REAL_VEGETABLE_PRODUCTS,
  // --- หมวดผักและวัตถุดิบสดเพิ่มเติมเฉพาะสาขาพอร์โตชิโน่: เซ็นทรัล (Central) และสินค้าพิเศษ ---
  ...ALL_PORTO_CENTRAL_AND_SPECIAL_PRODUCTS,
  // --- รายการสินค้าจากตารางขั้นต่ำการสั่งซื้อ_บางนา_v2.xlsx ---
  {
    id: "prod-4B330178",
    code: "4B330178",
    name: "ผงโรยปลาไหล 12 g (10ขวด/แพ็ค) หน่วยเป็นขวด",
    supplierId: "sup-gof",
    supplierName: "โกลบอล โอเชี่ยน ฟู้ดส์ จำกัด",
    category: "เครื่องปรุงรส",
    unit: "ขวด",
    price: 180,
    deliveryTerms: "ขั้นต่ำ 2,000 บาท/บิล",
    minOrderQty: 1,
  },
  {
    id: "prod-1B113351-ff",
    code: "1B113351",
    name: "สันนอกหมู(หมูดำคุโรบูตะ) ห่อฟิล์ม (ฟาร์มเฟรช)",
    supplierId: "sup-farmfresh",
    supplierName: "ฟาร์มเฟรช",
    category: "เนื้อสัตว์สด",
    unit: "กก.",
    price: 290,
    deliveryTerms: "ขั้นต่ำ 1 ลัง (15 กก.) สั่งจันทร์/พฤหัส เข้าเสาร์",
    minOrderQty: 15,
  },
  {
    id: "prod-1B110079",
    code: "1B110079",
    name: "สะโพกไก่เลาะกระดูก 100-130g 2 Kg./แพ็ค",
    supplierId: "sup-cpf",
    supplierName: "ซีพีเอฟ โกลบอล ฟู้ด โซลูชั่น",
    category: "ไก่สด",
    unit: "กก.",
    price: 145,
    deliveryTerms: "ขั้นต่ำ 6 กก. สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
    minOrderQty: 6,
  },
  {
    id: "prod-1B114020",
    code: "1B114020",
    name: "สะโพกไก่เลาะกระดูก FZ.คละsize 2kg / แพ็ค",
    supplierId: "sup-cpf",
    supplierName: "ซีพีเอฟ โกลบอล ฟู้ด โซลูชั่น",
    category: "ไก่สด",
    unit: "แพ็ค",
    price: 280,
    deliveryTerms: "ขั้นต่ำ 6 แพ็ค สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
    minOrderQty: 6,
  },
  {
    id: "prod-1B113712",
    code: "1B113712",
    name: "ปีกปลายไก่ (2kg./แพ็ค)",
    supplierId: "sup-cpf",
    supplierName: "ซีพีเอฟ โกลบอล ฟู้ด โซลูชั่น",
    category: "ไก่สด",
    unit: "กก.",
    price: 110,
    deliveryTerms: "ขั้นต่ำ 6 กก. สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
    minOrderQty: 6,
  },
  {
    id: "prod-1B113351-cpf",
    code: "1B113351",
    name: "สันนอกหมู(หมูดำคุโรบูตะ) ห่อฟิล์ม (CPF)",
    supplierId: "sup-cpf",
    supplierName: "ซีพีเอฟ โกลบอล ฟู้ด โซลูชั่น",
    category: "หมูสด",
    unit: "กก.",
    price: 310,
    deliveryTerms: "ขั้นต่ำ 1 ลัง (15 กก.) สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
    minOrderQty: 15,
  },
  {
    id: "prod-1B113880",
    code: "1B113880",
    name: "สันคอหมูสไลด์ (1kg/แพ็ค)",
    supplierId: "sup-cpf",
    supplierName: "ซีพีเอฟ โกลบอล ฟู้ด โซลูชั่น",
    category: "หมูสด",
    unit: "กก.",
    price: 220,
    deliveryTerms: "ขั้นต่ำ 10 กก. สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
    minOrderQty: 10,
  },
  {
    id: "prod-1B111943",
    code: "1B111943",
    name: "สันคอหมูสไลด์ (500g/แพ็ค)",
    supplierId: "sup-cpf",
    supplierName: "ซีพีเอฟ โกลบอล ฟู้ด โซลูชั่น",
    category: "หมูสด",
    unit: "กก.",
    price: 120,
    deliveryTerms: "ขั้นต่ำ 5 กก. สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
    minOrderQty: 5,
  },
  {
    id: "prod-1B113713",
    code: "1B113713",
    name: "ตับหมู 1kg. / แพ็ค",
    supplierId: "sup-cpf",
    supplierName: "ซีพีเอฟ โกลบอล ฟู้ด โซลูชั่น",
    category: "หมูสด",
    unit: "กก.",
    price: 95,
    deliveryTerms: "ขั้นต่ำ 6 กก. สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
    minOrderQty: 6,
  },
  {
    id: "prod-9B223018",
    code: "9B223018",
    name: "ไข่ไก่กล่อง cage free 10 ฟอง/แพ็ค (ไข่กินดิบ)",
    supplierId: "sup-cpf",
    supplierName: "ซีพีเอฟ โกลบอล ฟู้ด โซลูชั่น",
    category: "ไข่ไก่",
    unit: "ถาด",
    price: 92,
    deliveryTerms: "ขั้นต่ำ 10 ถาด รวมกันได้",
    minOrderQty: 10,
  },
  {
    id: "prod-1B221415",
    code: "1B221415",
    name: "กุ้งขาว (สด) 26-30 ตัว/กก (1 ลังโฟม)",
    supplierId: "sup-cpf",
    supplierName: "ซีพีเอฟ โกลบอล ฟู้ด โซลูชั่น",
    category: "อาหารทะเล",
    unit: "กก.",
    price: 240,
    deliveryTerms: "ขั้นต่ำ 1 ลังโฟม (5 กก.) สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าอังคาร",
    minOrderQty: 5,
  },
  {
    id: "prod-9B111008",
    code: "9B111008",
    name: "ปูอัด SPK 9cm เกรด A 500g/36Pcs.",
    supplierId: "sup-thaiuni",
    supplierName: "ไทยยูนิฟู้ด เซอร์วิส จำกัด",
    category: "อาหารแช่แข็ง",
    unit: "แพ็ค",
    price: 110,
    deliveryTerms: "ขั้นต่ำ 20 แพ็ค (ถ้าสั่งปูอัด สั่งกุ้งแค่ 1 ลังได้)",
    minOrderQty: 20,
  },
  {
    id: "prod-1B111444",
    code: "1B111444",
    name: "กุ้งขาวแช่แข็ง 26-30 (1kg/แพ็ค)",
    supplierId: "sup-thaiuni",
    supplierName: "ไทยยูนิฟู้ด เซอร์วิส จำกัด",
    category: "อาหารแช่แข็ง",
    unit: "แพ็ค",
    price: 230,
    deliveryTerms: "ขั้นต่ำ 12 แพ็ค (ลังละ 6 กก.) สั่งขั้นต่ำรวม 4,000 บาท",
    minOrderQty: 12,
  },
  {
    id: "prod-1B113857",
    code: "1B113857",
    name: "กุ้งขาวแช่แข็ง 26-30 (700g/แพ็ค)",
    supplierId: "sup-thaiuni",
    supplierName: "ไทยยูนิฟู้ด เซอร์วิส จำกัด",
    category: "อาหารแช่แข็ง",
    unit: "แพ็ค",
    price: 175,
    deliveryTerms: "ขั้นต่ำ 24 แพ็ค (ลังละ 12 แพ็ค) สั่งขั้นต่ำรวม 4,000 บาท",
    minOrderQty: 24,
  },
  {
    id: "prod-1B114222",
    code: "1B114222",
    name: "HOTATE แช่แข็ง size L 21-25 ตัว/กก",
    supplierId: "sup-noble",
    supplierName: "โนเบิล โมโน จำกัด",
    category: "อาหารทะเล",
    unit: "แพ็ค",
    price: 890,
    deliveryTerms: "สั่งเข้าพร้อมปลานอกได้ ไม่ต้องมีขั้นต่ำ",
    minOrderQty: 1,
  },
  {
    id: "prod-1B113619",
    code: "1B113619",
    name: "หอยนางรมญี่ปุ่นแช่แข็ง 2L 1Kg./แพ็ค",
    supplierId: "sup-thaiooi",
    supplierName: "ไทยโอโออิ จำกัด",
    category: "อาหารทะเล",
    unit: "แพ็ค",
    price: 650,
    deliveryTerms: "ขั้นต่ำ 5,000 บาท (สั่งได้เฉพาะ จันทร์ เข้า พฤหัส)",
    minOrderQty: 1,
  },
  {
    id: "prod-9B221635",
    code: "9B221635",
    name: "Eihire เอฮิเระ ครีบปลากระเบนปรุงรส 500g.",
    supplierId: "sup-kingmarine",
    supplierName: "คิง มารีน ฟู้ดส์ จำกัด",
    category: "อาหารทะเล",
    unit: "แพ็ค",
    price: 420,
    deliveryTerms: "ขั้นต่ำ 3,000 บาท (สั่งได้เฉพาะ พฤหัส เข้า อังคาร)",
    minOrderQty: 1,
  },
  {
    id: "prod-1B113788",
    code: "1B113788",
    name: "เนื้อกระบังลม Aus.Beef Wagyu outside skirt",
    supplierId: "sup-wellfood",
    supplierName: "บ.เวลฟู้ด",
    category: "เนื้อวัว",
    unit: "กก.",
    price: 780,
    deliveryTerms: "ขั้นต่ำ 3,000 บาท (สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์)",
    minOrderQty: 1,
  },
  {
    id: "prod-4B333483",
    code: "4B333483",
    name: "สาหร่ายคอมบุ ( 1 KG/แพ็ค)",
    supplierId: "sup-daisho",
    supplierName: "ไดโช (ประเทศไทย) จำกัด",
    category: "เครื่องปรุงรส",
    unit: "แพ็ค",
    price: 450,
    deliveryTerms: "ขั้นต่ำ 3,000 บาท/บิล",
    minOrderQty: 1,
  },
  {
    id: "prod-2B222946",
    code: "2B222946",
    name: "ผักสลัดมิกซ์ 100g",
    supplierId: "sup-ack",
    supplierName: "บ.เอ ซี เค",
    category: "ผักสด",
    unit: "แพ็ค",
    price: 35,
    deliveryTerms: "ขั้นต่ำ 15 แพ็ค",
    minOrderQty: 15,
  },
  {
    id: "prod-1B113602",
    code: "1B113602",
    name: "ปลาแซลมอนเทร้า (แช่แข็ง) 5-6Kg./ตัว",
    supplierId: "sup-siamfood",
    supplierName: "สยามฟูด เซอร์วิส",
    category: "อาหารแช่แข็ง",
    unit: "กก.",
    price: 1650,
    deliveryTerms: "ขั้นต่ำ 3,000 บาท (2 ตัว)",
    minOrderQty: 1,
  },
  {
    id: "prod-8B112201",
    code: "8B112201",
    name: "Green tea Thaifuku 40g. ไดฟุกุชาเขียว (20 ชิ้น/แพ็ค)",
    supplierId: "sup-bif",
    supplierName: "บางกอกอินเตอร์ฟูด (BIF)",
    category: "เบเกอรี่",
    unit: "แพ็ค",
    price: 290,
    deliveryTerms: "ขั้นต่ำ 3,000 บาท (ราคา+3% ซื้อปลีกยกแพ็ค)",
    minOrderQty: 1,
  },
  {
    id: "prod-1B114077-cti",
    code: "1B114077",
    name: "เนื้อกระบังลม Aus. Wagyu Inside skirt MB6-7 (CTI)",
    supplierId: "sup-cti",
    supplierName: "ซีทีไอ ฟู๊ด ซัพพลาย",
    category: "เนื้อวัว",
    unit: "กก.",
    price: 850,
    deliveryTerms: "ขั้นต่ำ 3,000 บาท (สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์)",
    minOrderQty: 1,
  },
  {
    id: "prod-1B114077-jagota",
    code: "1B114077",
    name: "เนื้อกระบังลม Aus. Wagyu Inside skirt MB6-7 (Jagota)",
    supplierId: "sup-jagota",
    supplierName: "จาโกต้า บราเดอร์ส เทรดดิ้ง",
    category: "เนื้อวัว",
    unit: "กก.",
    price: 820,
    deliveryTerms: "ขั้นต่ำ 2,500 บาท (สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์)",
    minOrderQty: 1,
  },
  {
    id: "prod-7B112317",
    code: "7B112317",
    name: "ไอศกรีมรส ส้มยูสุ ซอร์เบ (3kg/ถาด)",
    supplierId: "sup-colculture",
    supplierName: "โคลคัสเจอร์",
    category: "ไอศกรีม",
    unit: "ถาด",
    price: 790,
    deliveryTerms: "ขั้นต่ำ 2 ถาด (สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าอังคาร)",
    minOrderQty: 2,
  },
  {
    id: "prod-4B333885",
    code: "4B333885",
    name: "ซอสสเต็กพริกไทยดำ แม็คคอร์มิค 235g/ขวด",
    supplierId: "sup-sino",
    supplierName: "บ.ซีโน-แปซิฟิค",
    category: "เครื่องปรุงรส",
    unit: "ขวด",
    price: 85,
    deliveryTerms: "ขั้นต่ำ 20 ขวด (10 ขวด/ลัง) สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์",
    minOrderQty: 20,
  },
  {
    id: "prod-8B114123",
    code: "8B114123",
    name: "เค้ก อูจิมัทฉะชีสเค้ก 85g/ชิ้น",
    supplierId: "sup-sinnova",
    supplierName: "ซินโนวา",
    category: "เบเกอรี่",
    unit: "ชิ้น",
    price: 48,
    deliveryTerms: "ขั้นต่ำ 36 ชิ้น (12 ชิ้น/กล่อง)",
    minOrderQty: 36,
  },
  {
    id: "prod-4B331279",
    code: "4B331279",
    name: "น้ำมันถั่วเหลือง ตรามรกต 13.75 L",
    supplierId: "sup-morakot",
    supplierName: "ไซม์ ดาร์บี้ ออยล์ มรกต จำกัด",
    category: "น้ำมันพืช",
    unit: "ปี๊บ",
    price: 620,
    deliveryTerms: "ขั้นต่ำ 3 ปี๊บ (สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์)",
    minOrderQty: 3,
  },
  {
    id: "prod-5B640389",
    code: "5B640389",
    name: "ไฮเนเก้นขวด 620 มล.x12ขวด(ลัง) / ลัง",
    supplierId: "sup-cfr",
    supplierName: "เซ็นทรัล ฟู้ด รีเทล จำกัด",
    category: "เครื่องดื่ม",
    unit: "ลัง",
    price: 780,
    deliveryTerms: "ขั้นต่ำรวม 1,000 บาท (สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์)",
    minOrderQty: 1,
  },
  {
    id: "prod-4B330460",
    code: "4B330460",
    name: "เด็กสมบูรณ์ ซอสเห็ดหอม 800 กรัม x 3 ขวด / แพ็ค",
    supplierId: "sup-cfr",
    supplierName: "เซ็นทรัล ฟู้ด รีเทล จำกัด",
    category: "เครื่องปรุงรส",
    unit: "แพ็ค",
    price: 165,
    deliveryTerms: "ขั้นต่ำรวม 1,000 บาท (สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์)",
    minOrderQty: 1,
  },
  {
    id: "prod-9X543989",
    code: "9X543989",
    name: "แก้วน้ำ 16oz.(50ใบ/ชุด) (แจกน้ำrider)",
    supplierId: "sup-cfr",
    supplierName: "เซ็นทรัล ฟู้ด รีเทล จำกัด",
    category: "บรรจุภัณฑ์",
    unit: "แพ็ค",
    price: 95,
    deliveryTerms: "ขั้นต่ำรวม 1,000 บาท (สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์)",
    minOrderQty: 1,
  },
  {
    id: "prod-9B334031",
    code: "9B334031",
    name: "วุ้นเส้นแห้ง (40g/ห่อ (10ห่อ/แพ็ค))",
    supplierId: "sup-cfr",
    supplierName: "เซ็นทรัล ฟู้ด รีเทล จำกัด",
    category: "ของแห้ง",
    unit: "ห่อ",
    price: 65,
    deliveryTerms: "ขั้นต่ำ 10 ห่อ (สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์)",
    minOrderQty: 10,
  },
  {
    id: "prod-4B334175",
    code: "4B334175",
    name: "กะปิตราชั่ง 90g / กระปุก",
    supplierId: "sup-cfr",
    supplierName: "เซ็นทรัล ฟู้ด รีเทล จำกัด",
    category: "เครื่องปรุงรส",
    unit: "กระปุก",
    price: 32,
    deliveryTerms: "ขั้นต่ำ 6 กระปุก (6กระปุก/แพ็ค)",
    minOrderQty: 6,
  },
  {
    id: "prod-5B640393",
    code: "5B640393",
    name: "โค้กกระป๋อง 325cc 24กป./ถาด",
    supplierId: "sup-thainamthip",
    supplierName: "ไทยน้ำทิพย์ คอร์ปอเรชั่น จำกัด",
    category: "เครื่องดื่ม",
    unit: "ถาด",
    price: 340,
    deliveryTerms: "ขั้นต่ำ 2 ถาด (24 กป./ถาด)",
    minOrderQty: 2,
  },
  {
    id: "prod-5B643796",
    code: "5B643796",
    name: "เบียร์สด Tiger 20L / ถัง",
    supplierId: "sup-kabeer",
    supplierName: "บ.ค้าเบียร์",
    category: "เครื่องดื่ม",
    unit: "ถัง",
    price: 2450,
    deliveryTerms: "ขั้นต่ำ 1 ถัง (สั่งจันทร์ เข้าพฤหัส, สั่งพฤหัส เข้าจันทร์)",
    minOrderQty: 1,
  },
  {
    id: "prod-5B640394",
    code: "5B640394",
    name: "HAKUTSURU DAIGINJYO 300 ML",
    supplierId: "sup-skliquor",
    supplierName: "เอส.เค.ลิเคอร์",
    category: "เครื่องดื่ม",
    unit: "ขวด",
    price: 420,
    deliveryTerms: "ขั้นต่ำ 3,000 บาท/บิล",
    minOrderQty: 1,
  },
  {
    id: "prod-4B332823",
    code: "4B332823",
    name: "HANA Sauce 4.5 ลิตร/แกลลอน",
    supplierId: "sup-asan",
    supplierName: "บ.อาซัน",
    category: "เครื่องปรุงรส",
    unit: "แกลลอน",
    price: 580,
    deliveryTerms: "ขั้นต่ำ 3,000 บาท/บิล",
    minOrderQty: 1,
  },
  {
    id: "prod-9X440618",
    code: "9X440618",
    name: "ผลิตภัณฑ์ล้างภาชนะในเครื่องล้างจาน พรีเมี่ยม",
    supplierId: "sup-superior",
    supplierName: "บ.สุพีเรีย",
    category: "อุปกรณ์ทำความสะอาด",
    unit: "แกลลอน",
    price: 350,
    deliveryTerms: "ส่งผ่านคลังก่อน ขั้นต่ำ 2 แกลลอน",
    minOrderQty: 2,
  },
  {
    id: "prod-9X543883",
    code: "9X543883",
    name: "กล่องใส่ปลา ST02L+ฝา (50ชุด/แพ็ค)",
    supplierId: "sup-iamgroup",
    supplierName: "บ.ไอแอมกรู๊ป",
    category: "บรรจุภัณฑ์",
    unit: "แพ็ค",
    price: 210,
    deliveryTerms: "ขั้นต่ำ 1 แพ็ค",
    minOrderQty: 1,
  },
  {
    id: "prod-9X543944",
    code: "9X543944",
    name: "ถุงเก็บอุณหภูมิ สีขาว 26x28+17cm",
    supplierId: "sup-kiddee",
    supplierName: "คิดดีมีคุณ",
    category: "บรรจุภัณฑ์",
    unit: "ใบ",
    price: 8.5,
    deliveryTerms: "ขั้นต่ำ 50 ใบ (2 แพ็ค)",
    minOrderQty: 50,
  },
  {
    id: "prod-9X543924",
    code: "9X543924",
    name: "กล่องพิซซ่า12 นิ้ว สีคราฟ (50ใบ/แพ็ค)",
    supplierId: "sup-klombox",
    supplierName: "บ.กลมบ๊อกซ์",
    category: "บรรจุภัณฑ์",
    unit: "แพ็ค",
    price: 340,
    deliveryTerms: "ขั้นต่ำ 1 แพ็ค (50 ใบ/แพ็ค)",
    minOrderQty: 1,
  },
  {
    id: "prod-9X542968",
    code: "9X542968",
    name: "ขวดพลาสติกใส ขวดเพชร 500 ml ทรงเหลี่ยม+ฝาอลู",
    supplierId: "sup-tangsoonhuat",
    supplierName: "บ.ตั้ง ซุ่น ฮวด",
    category: "บรรจุภัณฑ์",
    unit: "ใบ",
    price: 6.5,
    deliveryTerms: "ส่งผ่านคลังก่อน ขั้นต่ำ 20 ใบ / ขนาด",
    minOrderQty: 20,
  },
];

export const INITIAL_ORDERS_A: PurchaseOrder[] = [
  {
    id: "ORD-202607-001",
    branchId: "branch-1",
    branchName: "สาขา 1 - วัชรพล",
    supplierId: "sup-1",
    supplierName: "บริษัท ซีพี ฟู้ดส์ จำกัด (CP Foods)",
    orderDate: "2026-07-20",
    expectedReceivedDate: "2026-07-21",
    actualReceivedDate: "2026-07-21",
    deliveryTerms: "สั่งขั้นต่ำ 2,000 บาท จัดส่งฟรีภายใน 24 ชม.",
    items: [
      {
        productId: "prod-101",
        productCode: "PORK-001",
        productName: "เนื้อหมูสันนอกสด (Pork Loin)",
        supplierId: "sup-1",
        supplierName: "บริษัท ซีพี ฟู้ดส์ จำกัด (CP Foods)",
        quantity: 15,
        unit: "กก.",
        unitPrice: 185,
        totalPrice: 2775,
        deliveryTerms: "ขนส่งรถเย็น ควบคุมอุณหภูมิไม่เกิน 4°C",
      },
      {
        productId: "prod-103",
        productCode: "CHICK-001",
        productName: "อกไก่สดลอกหนัง (Chicken Breast)",
        supplierId: "sup-1",
        supplierName: "บริษัท ซีพี ฟู้ดส์ จำกัด (CP Foods)",
        quantity: 20,
        unit: "กก.",
        unitPrice: 120,
        totalPrice: 2400,
        deliveryTerms: "ส่งฟรีเมื่อสั่งรวมเกิน 2,000 บาท",
      },
    ],
    totalAmount: 5175,
    status: "received",
    notes: "ส่งเรียบร้อย ตรวจรับสภาพสินค้าสมบูรณ์",
    createdBy: "คุณสมชาย (ผู้จัดการสาขา 1)",
    updatedAt: "2026-07-21 10:30",
    syncedToSheets: true,
  },
  {
    id: "ORD-202607-002",
    branchId: "branch-2",
    branchName: "สาขา 2 - พระราม33",
    supplierId: "sup-4",
    supplierName: "แดรี่ โกลด์ นมและเนย (Dairy Gold)",
    orderDate: "2026-07-21",
    expectedReceivedDate: "2026-07-22",
    actualReceivedDate: "2026-07-22",
    deliveryTerms: "ขนส่งรถเย็น ควบคุมอุณหภูมิ 2-4°C",
    items: [
      {
        productId: "prod-401",
        productCode: "MILK-001",
        productName: "นมสดพาสเจอร์ไรส์รสจืด (แกลลอน 2 ลิตร)",
        supplierId: "sup-4",
        supplierName: "แดรี่ โกลด์ นมและเนย (Dairy Gold)",
        quantity: 12,
        unit: "แกลลอน",
        unitPrice: 115,
        totalPrice: 1380,
        deliveryTerms: "รถเย็น 2-4°C",
      },
    ],
    totalAmount: 1380,
    status: "received",
    notes: "รับเข้าคลังสินค้าสาขาพระราม33 แล้ว",
    createdBy: "คุณวิภาวี (ผู้จัดการสาขา 2)",
    updatedAt: "2026-07-22 09:15",
    syncedToSheets: true,
  },
  {
    id: "ORD-202607-003",
    branchId: "branch-3",
    branchName: "สาขา 3 - บางแก้ว",
    supplierId: "sup-2",
    supplierName: "เบทาโกร ฟู้ด ซัพพลาย (Betagro)",
    orderDate: "2026-07-22",
    expectedReceivedDate: "2026-07-23",
    deliveryTerms: "สั่งก่อน 16:00 น. จัดส่งวันถัดไป",
    items: [
      {
        productId: "prod-201",
        productCode: "EGG-001",
        productName: "ไข่ไก่สด เบอร์ 2 (แผง 30 ฟอง)",
        supplierId: "sup-2",
        supplierName: "เบทาโกร ฟู้ด ซัพพลาย (Betagro)",
        quantity: 15,
        unit: "แผง",
        unitPrice: 125,
        totalPrice: 1875,
        deliveryTerms: "บรรจุกล่องกระดาษกันกระแทก",
      },
      {
        productId: "prod-202",
        productCode: "VEG-001",
        productName: "ผักกาดหอมไฮโดรโปนิกส์สด",
        supplierId: "sup-2",
        supplierName: "เบทาโกร ฟู้ด ซัพพลาย (Betagro)",
        quantity: 10,
        unit: "กก.",
        unitPrice: 95,
        totalPrice: 950,
        deliveryTerms: "เก็บเกี่ยววันต่อวัน",
      },
    ],
    totalAmount: 2825,
    status: "in_transit",
    notes: "ผู้จัดส่งออกเดินทางแล้ว คาดว่าถึง 10.30 น.",
    createdBy: "คุณณัฐพงษ์ (ผู้จัดการสาขา 3)",
    updatedAt: "2026-07-22 17:00",
    syncedToSheets: true,
  },
  {
    id: "ORD-202607-004",
    branchId: "branch-4",
    branchName: "สาขา 4 - บางนา",
    supplierId: "sup-3",
    supplierName: "อินเตอร์ ฟู้ด ซอส & ซัพพลาย (Aro Supply)",
    orderDate: "2026-07-23",
    expectedReceivedDate: "2026-07-24",
    deliveryTerms: "จัดส่งรอบอังคาร/พฤหัส/เสาร์",
    items: [
      {
        productId: "prod-301",
        productCode: "SAUCE-001",
        productName: "ซอสโชยุปรุงรสญี่ปุ่น (แกลลอน 5 ลิตร)",
        supplierId: "sup-3",
        supplierName: "อินเตอร์ ฟู้ด ซอส & ซัพพลาย (Aro Supply)",
        quantity: 3,
        unit: "แกลลอน",
        unitPrice: 380,
        totalPrice: 1140,
        deliveryTerms: "สั่งขั้นต่ำ 1 แกลลอน",
      },
      {
        productId: "prod-302",
        productCode: "OIL-001",
        productName: "น้ำมันถั่วเหลือง (ปี๊บ 13.75 ลิตร)",
        supplierId: "sup-3",
        supplierName: "อินเตอร์ ฟู้ด ซอส & ซัพพลาย (Aro Supply)",
        quantity: 4,
        unit: "ปี๊บ",
        unitPrice: 640,
        totalPrice: 2560,
        deliveryTerms: "ส่งฟรีเฉพาะรอบประจำวัน",
      },
    ],
    totalAmount: 3700,
    status: "approved",
    notes: "จัดซื้อยืนยันรายการแล้ว กำลังประสานงานขนส่ง",
    createdBy: "คุณกมลวรรณ (ผู้จัดการสาขา 4)",
    updatedAt: "2026-07-23 08:30",
    syncedToSheets: true,
  },
];

export const INITIAL_PRODUCT_LOGS_A: PurchaseProductChangeLog[] = [
  {
    id: "log-101",
    productId: "prod-101",
    productCode: "PORK-001",
    productName: "เนื้อหมูสันนอกสด (Pork Loin)",
    supplierName: "บริษัท ซีพี ฟู้ดส์ จำกัด (CP Foods)",
    changeType: "price_change",
    changedAt: "2026-07-15 14:30",
    effectiveDate: "2026-07-16",
    reason: "ปรับราคาตามสภาวะตลาดเนื้อหมูสดปรับตัวขึ้น 10 บาท/กก. (ต้นทุนอาหารสัตว์ปรับขึ้น)",
    notes: "ผ่านการอนุมัติจากฝ่ายจัดซื้อกลางแล้ว แจ้งผู้จัดการทั้ง 4 สาขาล่วงหน้า 3 วัน",
    previousData: { price: 175, isActive: true },
    newData: { price: 185, isActive: true },
    changedBy: "คุณสมศักดิ์ (หัวหน้าฝ่ายจัดซื้อกลาง)",
  },
];

// Singleton instances for Database A
let appA: FirebaseApp | null = null;
let firestoreA: Firestore | null = null;

export function getDatabaseAConfig(): DatabaseAConfig {
  if (typeof window === "undefined") return DEFAULT_DATABASE_A_CONFIG;
  try {
    const raw = localStorage.getItem(LS_CONFIG_KEY);
    if (raw) return { ...DEFAULT_DATABASE_A_CONFIG, ...JSON.parse(raw) };
  } catch (e) {
    console.error("Failed to load Database A config from localStorage:", e);
  }
  return DEFAULT_DATABASE_A_CONFIG;
}

export function saveDatabaseAConfig(config: Partial<DatabaseAConfig>): DatabaseAConfig {
  const current = getDatabaseAConfig();
  const updated = { ...current, ...config, lastSyncedAt: new Date().toISOString() };
  if (typeof window !== "undefined") {
    localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(updated));
  }
  // Re-initialize app instance with new config
  appA = null;
  firestoreA = null;
  return updated;
}

export function initDatabaseA(): { app: FirebaseApp; db: Firestore } {
  if (appA && firestoreA) {
    return { app: appA, db: firestoreA };
  }

  const config = getDatabaseAConfig();
  const appName = "DatabaseA_OrderingSystem";

  const existing = getApps().find((a) => a.name === appName);
  appA = existing || initializeApp(config, appName);
  firestoreA = config.firestoreDatabaseId
    ? getFirestore(appA, config.firestoreDatabaseId)
    : getFirestore(appA);

  return { app: appA, db: firestoreA };
}

export async function testDatabaseAConnection(): Promise<{
  success: boolean;
  message: string;
  orderCount?: number;
  productCount?: number;
  supplierCount?: number;
}> {
  try {
    const { db } = initDatabaseA();
    const [ordersSnap, prodsSnap, supsSnap] = await Promise.all([
      getDocs(collection(db, COLLECTIONS_A.ORDERS)),
      getDocs(collection(db, COLLECTIONS_A.PRODUCTS)),
      getDocs(collection(db, COLLECTIONS_A.SUPPLIERS)),
    ]);

    saveDatabaseAConfig({ isConnected: true });
    return {
      success: true,
      message: "เชื่อมต่อ Database A (Firestore ระบบสั่งซื้อ) สำเร็จเรียบร้อย",
      orderCount: ordersSnap.size,
      productCount: prodsSnap.size,
      supplierCount: supsSnap.size,
    };
  } catch (err: unknown) {
    console.error("Database A connection test error:", err);
    saveDatabaseAConfig({ isConnected: false });
    const msg =
      err instanceof Error ? err.message : "การเชื่อมต่อล้มเหลว ตรวจสอบ API Key และ Config";
    return {
      success: false,
      message: `ไม่สามารถเชื่อมต่อ Database A: ${msg}`,
    };
  }
}

// Local cache helpers
function loadLocal<T extends { id?: string; code?: string }>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T[];
    // If it's products or suppliers, make sure any missing initial items from fallback are merged
    if (key === LS_OFFLINE_PRODUCTS || key === LS_OFFLINE_SUPPLIERS) {
      const existingIds = new Set(parsed.map((x) => x.id || x.code));
      const missing = fallback.filter((x) => !existingIds.has(x.id || x.code));
      if (missing.length > 0) {
        const merged = [...parsed, ...missing];
        saveLocal(key, merged);
        return merged;
      }
    }
    return parsed;
  } catch {
    return fallback;
  }
}

function saveLocal<T>(key: string, data: T[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, JSON.stringify(data));
  }
}

export function subscribeDatabaseAOrders(
  onData: (orders: PurchaseOrder[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  // Return cached or fallback immediately
  const localOrders = loadLocal<PurchaseOrder>(LS_OFFLINE_ORDERS, INITIAL_ORDERS_A);
  onData(localOrders);

  try {
    const { db } = initDatabaseA();
    return onSnapshot(
      collection(db, COLLECTIONS_A.ORDERS),
      (snapshot) => {
        if (!snapshot.empty) {
          const items = snapshot.docs.map((d) => d.data() as PurchaseOrder);
          items.sort((a, b) =>
            (b.updatedAt || b.orderDate).localeCompare(a.updatedAt || a.orderDate),
          );
          saveLocal(LS_OFFLINE_ORDERS, items);
          saveDatabaseAConfig({ isConnected: true });
          onData(items);
        } else {
          // If empty in DB A, ensure local data is shown
          onData(localOrders);
        }
      },
      (err) => {
        console.warn(
          "Firestore Database A orders subscription warning (using local fallback):",
          err,
        );
        onError?.(err);
      },
    );
  } catch (err) {
    onError?.(err as Error);
    return () => {};
  }
}

export function subscribeDatabaseAProducts(
  onData: (products: PurchaseProduct[]) => void,
): Unsubscribe {
  const local = loadLocal<PurchaseProduct>(LS_OFFLINE_PRODUCTS, INITIAL_PRODUCTS_A);
  onData(local);

  // Trigger background seed on start to guarantee Firestore collections are populated
  seedDatabaseAWithVegetablesAndSuppliers(false).catch((err) =>
    console.warn("Background seed Database A products check:", err),
  );

  try {
    const { db } = initDatabaseA();
    return onSnapshot(
      collection(db, COLLECTIONS_A.PRODUCTS),
      (snapshot) => {
        if (!snapshot.empty) {
          const firestoreItems = snapshot.docs.map((d) => d.data() as PurchaseProduct);
          // Check if any required vegetable or Porto products are missing from Firestore snapshot
          const existingIds = new Set(firestoreItems.map((p) => p.id));
          const missingItems = INITIAL_PRODUCTS_A.filter((v) => !existingIds.has(v.id));

          const merged =
            missingItems.length > 0 ? [...firestoreItems, ...missingItems] : firestoreItems;
          saveLocal(LS_OFFLINE_PRODUCTS, merged);
          onData(merged);

          // If Firestore is missing items, seed them asynchronously
          if (missingItems.length > 0) {
            seedDatabaseAWithVegetablesAndSuppliers(true).catch(console.error);
          }
        } else {
          // If collection is empty, trigger seed immediately and supply initial catalog
          seedDatabaseAWithVegetablesAndSuppliers(true).catch(console.error);
          onData(INITIAL_PRODUCTS_A);
        }
      },
      (err) => {
        console.warn("Database A products snapshot warning (using local catalog):", err);
        onData(INITIAL_PRODUCTS_A);
      },
    );
  } catch {
    return () => {};
  }
}

export function subscribeDatabaseASuppliers(
  onData: (suppliers: PurchaseSupplier[]) => void,
): Unsubscribe {
  const local = loadLocal<PurchaseSupplier>(LS_OFFLINE_SUPPLIERS, INITIAL_SUPPLIERS_A);
  onData(local);

  try {
    const { db } = initDatabaseA();
    return onSnapshot(
      collection(db, COLLECTIONS_A.SUPPLIERS),
      (snapshot) => {
        if (!snapshot.empty) {
          const firestoreSuppliers = snapshot.docs.map((d) => d.data() as PurchaseSupplier);
          const existingIds = new Set(firestoreSuppliers.map((s) => s.id));
          const missingSups = INITIAL_SUPPLIERS_A.filter((s) => !existingIds.has(s.id));

          const merged =
            missingSups.length > 0 ? [...firestoreSuppliers, ...missingSups] : firestoreSuppliers;
          saveLocal(LS_OFFLINE_SUPPLIERS, merged);
          onData(merged);

          if (missingSups.length > 0) {
            seedDatabaseAWithVegetablesAndSuppliers(true).catch(console.error);
          }
        } else {
          seedDatabaseAWithVegetablesAndSuppliers(true).catch(console.error);
          onData(INITIAL_SUPPLIERS_A);
        }
      },
      (err) => {
        console.warn("Database A suppliers snapshot warning (using local fallback):", err);
        onData(INITIAL_SUPPLIERS_A);
      },
    );
  } catch {
    return () => {};
  }
}

export function subscribeDatabaseABranches(
  onData: (branches: PurchaseBranch[]) => void,
): Unsubscribe {
  const local = loadLocal<PurchaseBranch>(LS_OFFLINE_BRANCHES, INITIAL_BRANCHES_A);
  onData(local);

  try {
    const { db } = initDatabaseA();
    return onSnapshot(
      collection(db, COLLECTIONS_A.BRANCHES),
      (snapshot) => {
        if (!snapshot.empty) {
          const items = snapshot.docs.map((d) => d.data() as PurchaseBranch);
          saveLocal(LS_OFFLINE_BRANCHES, items);
          onData(items);
        }
      },
      (err) => console.warn("Database A branches snapshot warning:", err),
    );
  } catch {
    return () => {};
  }
}

export function subscribeDatabaseAProductLogs(
  onData: (logs: PurchaseProductChangeLog[]) => void,
): Unsubscribe {
  const local = loadLocal<PurchaseProductChangeLog>(LS_OFFLINE_LOGS, INITIAL_PRODUCT_LOGS_A);
  onData(local);

  try {
    const { db } = initDatabaseA();
    return onSnapshot(
      collection(db, COLLECTIONS_A.LOGS),
      (snapshot) => {
        if (!snapshot.empty) {
          const items = snapshot.docs.map((d) => d.data() as PurchaseProductChangeLog);
          items.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
          saveLocal(LS_OFFLINE_LOGS, items);
          onData(items);
        }
      },
      (err) => console.warn("Database A logs snapshot warning:", err),
    );
  } catch {
    return () => {};
  }
}

// Helper to strip undefined values recursively so Firestore setDoc does not throw
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === "object" && !(data instanceof Date)) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        cleaned[key] = sanitizeForFirestore(val);
      }
    }
    return cleaned as T;
  }
  return data;
}

// Write Actions to Database A
export async function saveOrderToDatabaseA(order: PurchaseOrder) {
  const cleanOrder = sanitizeForFirestore(order);
  // Update local cache first
  const current = loadLocal<PurchaseOrder>(LS_OFFLINE_ORDERS, INITIAL_ORDERS_A);
  const updated = [cleanOrder, ...current.filter((o) => o.id !== cleanOrder.id)];
  saveLocal(LS_OFFLINE_ORDERS, updated);

  try {
    const { db } = initDatabaseA();
    await setDoc(doc(db, COLLECTIONS_A.ORDERS, cleanOrder.id), cleanOrder, { merge: true });
  } catch (err) {
    console.error("Failed to write order to Database A (saved locally):", err);
  }
}

export async function updateOrderStatusInDatabaseA(
  orderId: string,
  newStatus: PurchaseOrderStatus,
  actualReceivedDate?: string,
  updatedBy?: string,
) {
  const current = loadLocal<PurchaseOrder>(LS_OFFLINE_ORDERS, INITIAL_ORDERS_A);
  const target = current.find((o) => o.id === orderId);
  if (!target) return;

  const updatedOrder: PurchaseOrder = {
    ...target,
    status: newStatus,
    actualReceivedDate:
      actualReceivedDate ||
      (newStatus === "received"
        ? new Date().toISOString().slice(0, 10)
        : target.actualReceivedDate),
    updatedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
    updatedBy: updatedBy || target.updatedBy,
  };

  await saveOrderToDatabaseA(updatedOrder);
}

export async function deleteOrderFromDatabaseA(
  orderId: string,
  deleteReason?: string,
  deletedBy?: string,
) {
  const current = loadLocal<PurchaseOrder>(LS_OFFLINE_ORDERS, INITIAL_ORDERS_A);
  const targetOrder = current.find((o) => o.id === orderId);
  saveLocal(
    LS_OFFLINE_ORDERS,
    current.filter((o) => o.id !== orderId),
  );

  // Store audit record for deleted order with reason
  if (deleteReason) {
    const deletedRecord = {
      orderId,
      deleteReason,
      deletedBy: deletedBy || "Unknown",
      deletedAt: new Date().toISOString(),
      orderSnapshot: targetOrder || null,
    };
    const currentDeleted = loadLocal<Record<string, unknown>[]>(
      "database_a_deleted_orders_audit",
      [],
    );
    saveLocal("database_a_deleted_orders_audit", [deletedRecord, ...currentDeleted].slice(0, 200));
  }

  try {
    const { db } = initDatabaseA();
    await deleteDoc(doc(db, COLLECTIONS_A.ORDERS, orderId));
  } catch (err) {
    console.error("Failed to delete order from Database A:", err);
  }
}

export async function saveSupplierToDatabaseA(supplier: PurchaseSupplier) {
  const cleanSupplier = sanitizeForFirestore(supplier);
  const current = loadLocal<PurchaseSupplier>(LS_OFFLINE_SUPPLIERS, INITIAL_SUPPLIERS_A);
  saveLocal(LS_OFFLINE_SUPPLIERS, [
    ...current.filter((s) => s.id !== cleanSupplier.id),
    cleanSupplier,
  ]);

  try {
    const { db } = initDatabaseA();
    await setDoc(doc(db, COLLECTIONS_A.SUPPLIERS, cleanSupplier.id), cleanSupplier, {
      merge: true,
    });
  } catch (err) {
    console.error("Failed to save supplier to Database A:", err);
  }
}

export async function deleteSupplierFromDatabaseA(supplierId: string) {
  const current = loadLocal<PurchaseSupplier>(LS_OFFLINE_SUPPLIERS, INITIAL_SUPPLIERS_A);
  saveLocal(
    LS_OFFLINE_SUPPLIERS,
    current.filter((s) => s.id !== supplierId),
  );

  try {
    const { db } = initDatabaseA();
    await deleteDoc(doc(db, COLLECTIONS_A.SUPPLIERS, supplierId));
  } catch (err) {
    console.error("Failed to delete supplier from Database A:", err);
  }
}

export async function saveProductToDatabaseA(product: PurchaseProduct) {
  const cleanProduct = sanitizeForFirestore(product);
  const current = loadLocal<PurchaseProduct>(LS_OFFLINE_PRODUCTS, INITIAL_PRODUCTS_A);
  saveLocal(LS_OFFLINE_PRODUCTS, [
    ...current.filter((p) => p.id !== cleanProduct.id),
    cleanProduct,
  ]);

  try {
    const { db } = initDatabaseA();
    await setDoc(doc(db, COLLECTIONS_A.PRODUCTS, cleanProduct.id), cleanProduct, { merge: true });
  } catch (err) {
    console.error("Failed to save product to Database A:", err);
  }
}

export async function deleteProductFromDatabaseA(productId: string) {
  const current = loadLocal<PurchaseProduct>(LS_OFFLINE_PRODUCTS, INITIAL_PRODUCTS_A);
  saveLocal(
    LS_OFFLINE_PRODUCTS,
    current.filter((p) => p.id !== productId),
  );

  try {
    const { db } = initDatabaseA();
    await deleteDoc(doc(db, COLLECTIONS_A.PRODUCTS, productId));
  } catch (err) {
    console.error("Failed to delete product from Database A:", err);
  }
}

export async function saveBranchToDatabaseA(branch: PurchaseBranch) {
  const cleanBranch = sanitizeForFirestore(branch);
  const current = loadLocal<PurchaseBranch>(LS_OFFLINE_BRANCHES, INITIAL_BRANCHES_A);
  saveLocal(LS_OFFLINE_BRANCHES, [...current.filter((b) => b.id !== cleanBranch.id), cleanBranch]);

  try {
    const { db } = initDatabaseA();
    await setDoc(doc(db, COLLECTIONS_A.BRANCHES, cleanBranch.id), cleanBranch, { merge: true });
  } catch (err) {
    console.error("Failed to save branch to Database A:", err);
  }
}

export async function deleteBranchFromDatabaseA(branchId: string) {
  const current = loadLocal<PurchaseBranch>(LS_OFFLINE_BRANCHES, INITIAL_BRANCHES_A);
  saveLocal(
    LS_OFFLINE_BRANCHES,
    current.filter((b) => b.id !== branchId),
  );

  try {
    const { db } = initDatabaseA();
    await deleteDoc(doc(db, COLLECTIONS_A.BRANCHES, branchId));
  } catch (err) {
    console.error("Failed to delete branch from Database A:", err);
  }
}

export async function saveProductLogToDatabaseA(log: PurchaseProductChangeLog) {
  const cleanLog = sanitizeForFirestore(log);
  const current = loadLocal<PurchaseProductChangeLog>(LS_OFFLINE_LOGS, INITIAL_PRODUCT_LOGS_A);
  saveLocal(LS_OFFLINE_LOGS, [cleanLog, ...current]);

  try {
    const { db } = initDatabaseA();
    await setDoc(doc(db, COLLECTIONS_A.LOGS, cleanLog.id), cleanLog, { merge: true });
  } catch (err) {
    console.error("Failed to save product log to Database A:", err);
  }
}

export async function clearAllOrdersInDatabaseA() {
  saveLocal(LS_OFFLINE_ORDERS, []);
  try {
    const { db } = initDatabaseA();
    const snap = await getDocs(collection(db, COLLECTIONS_A.ORDERS));
    for (const d of snap.docs) {
      await deleteDoc(doc(db, COLLECTIONS_A.ORDERS, d.id));
    }
  } catch (err) {
    console.error("Failed to clear all orders in Database A:", err);
  }
}

export async function clearAllLogsInDatabaseA() {
  saveLocal(LS_OFFLINE_LOGS, []);
  try {
    const { db } = initDatabaseA();
    const snap = await getDocs(collection(db, COLLECTIONS_A.LOGS));
    for (const d of snap.docs) {
      await deleteDoc(doc(db, COLLECTIONS_A.LOGS, d.id));
    }
  } catch (err) {
    console.error("Failed to clear all logs in Database A:", err);
  }
}

/**
 * Seed or Sync all master vegetable products (116 items) and base suppliers (Shinsen, WFOOD, CP, Betagro, etc.)
 * directly into Firestore Database A collections.
 */
export async function seedDatabaseAWithVegetablesAndSuppliers(force: boolean = false): Promise<{
  success: boolean;
  message: string;
  seededProducts: number;
  totalVegetables: number;
  seededSuppliers: number;
}> {
  try {
    const { db } = initDatabaseA();

    // 1. Check existing suppliers and products in Firestore
    const [supsSnap, prodsSnap, branchesSnap] = await Promise.all([
      getDocs(collection(db, COLLECTIONS_A.SUPPLIERS)),
      getDocs(collection(db, COLLECTIONS_A.PRODUCTS)),
      getDocs(collection(db, COLLECTIONS_A.BRANCHES)),
    ]);

    const existingSupIds = new Set(supsSnap.docs.map((d) => d.id));
    const existingProdIds = new Set(prodsSnap.docs.map((d) => d.id));
    const existingBranchIds = new Set(branchesSnap.docs.map((d) => d.id));

    let seededSuppliers = 0;
    let seededProducts = 0;
    let seededBranches = 0;

    // 2. Seed Branches if missing
    const branchesToSeed = force
      ? INITIAL_BRANCHES_A
      : INITIAL_BRANCHES_A.filter((b) => !existingBranchIds.has(b.id));

    if (branchesToSeed.length > 0) {
      const branchBatch = writeBatch(db);
      for (const branch of branchesToSeed) {
        branchBatch.set(doc(db, COLLECTIONS_A.BRANCHES, branch.id), sanitizeForFirestore(branch), {
          merge: true,
        });
        seededBranches++;
      }
      await branchBatch.commit();
    }

    // 3. Seed Suppliers if missing or forced (especially sup-5 Shinsen and sup-6 WFOOD)
    const suppliersToSeed = force
      ? INITIAL_SUPPLIERS_A
      : INITIAL_SUPPLIERS_A.filter((s) => !existingSupIds.has(s.id));

    if (suppliersToSeed.length > 0) {
      const supBatch = writeBatch(db);
      for (const sup of suppliersToSeed) {
        supBatch.set(doc(db, COLLECTIONS_A.SUPPLIERS, sup.id), sanitizeForFirestore(sup), {
          merge: true,
        });
        seededSuppliers++;
      }
      await supBatch.commit();
    }

    // 4. Seed Products (including all REAL_VEGETABLE_PRODUCTS and base initial items)
    const allRequiredProducts = INITIAL_PRODUCTS_A;
    const productsToSeed = force
      ? allRequiredProducts
      : allRequiredProducts.filter((p) => !existingProdIds.has(p.id));

    if (productsToSeed.length > 0) {
      // Chunk in batches of 300 to stay safely under Firestore 500 writes per batch limit
      const chunkSize = 300;
      for (let i = 0; i < productsToSeed.length; i += chunkSize) {
        const chunk = productsToSeed.slice(i, i + chunkSize);
        const prodBatch = writeBatch(db);
        for (const prod of chunk) {
          prodBatch.set(doc(db, COLLECTIONS_A.PRODUCTS, prod.id), sanitizeForFirestore(prod), {
            merge: true,
          });
          seededProducts++;
        }
        await prodBatch.commit();
      }
    }

    // 5. Update local cache
    const currentLocalProds = loadLocal<PurchaseProduct>(LS_OFFLINE_PRODUCTS, INITIAL_PRODUCTS_A);
    const prodMap = new Map<string, PurchaseProduct>();
    INITIAL_PRODUCTS_A.forEach((p) => prodMap.set(p.id, p));
    currentLocalProds.forEach((p) => prodMap.set(p.id, p));
    saveLocal(LS_OFFLINE_PRODUCTS, Array.from(prodMap.values()));

    const currentLocalSups = loadLocal<PurchaseSupplier>(LS_OFFLINE_SUPPLIERS, INITIAL_SUPPLIERS_A);
    const supMap = new Map<string, PurchaseSupplier>();
    INITIAL_SUPPLIERS_A.forEach((s) => supMap.set(s.id, s));
    currentLocalSups.forEach((s) => supMap.set(s.id, s));
    saveLocal(LS_OFFLINE_SUPPLIERS, Array.from(supMap.values()));

    const currentLocalBranches = loadLocal<PurchaseBranch>(LS_OFFLINE_BRANCHES, INITIAL_BRANCHES_A);
    const branchMap = new Map<string, PurchaseBranch>();
    INITIAL_BRANCHES_A.forEach((b) => branchMap.set(b.id, b));
    currentLocalBranches.forEach((b) => branchMap.set(b.id, b));
    saveLocal(LS_OFFLINE_BRANCHES, Array.from(branchMap.values()));

    return {
      success: true,
      message: `ซิงค์ข้อมูลสำเร็จ: นำเข้าสินค้า ${seededProducts} รายการ (ผักจริง ${REAL_VEGETABLE_PRODUCTS.length} รายการ), ซัพพลายเออร์ ${seededSuppliers} ราย, สาขา ${seededBranches} สาขา เข้าสู่ Firestore เรียบร้อยแล้ว`,
      seededProducts,
      totalVegetables: REAL_VEGETABLE_PRODUCTS.length,
      seededSuppliers,
    };
  } catch (err: unknown) {
    console.error("Error seeding Database A:", err);
    const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกลง Firestore";
    return {
      success: false,
      message: `ไม่สามารถนำเข้าข้อมูลลง Firestore ได้: ${msg}`,
      seededProducts: 0,
      totalVegetables: REAL_VEGETABLE_PRODUCTS.length,
      seededSuppliers: 0,
    };
  }
}
