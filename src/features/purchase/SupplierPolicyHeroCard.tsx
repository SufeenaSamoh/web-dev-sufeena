import React from "react";
import { Truck, Calendar, DollarSign, Info, Clock, Package, X, ShieldCheck } from "lucide-react";
import type { PurchaseSupplier } from "./types";
import { getSupplierPolicyDetails, type SupplierValidationSummary } from "./supplierPolicyRules";

interface SupplierPolicyHeroCardProps {
  supplier: PurchaseSupplier;
  orderDate: string;
  branchId: string;
  branchName: string;
  branchProductsCount: number;
  cartSummary?: SupplierValidationSummary;
  onClearFilter: () => void;
}

export const SupplierPolicyHeroCard: React.FC<SupplierPolicyHeroCardProps> = ({
  supplier,
  orderDate,
  branchId,
  branchName,
  branchProductsCount,
  cartSummary,
  onClearFilter,
}) => {
  const policy = getSupplierPolicyDetails(supplier, orderDate, branchId);
  const currentTotal = cartSummary?.totalAmount || 0;
  const currentItemsCount = cartSummary?.items?.length || 0;
  const meetsMin = cartSummary?.meetsMinimum ?? policy.minOrderAmountBaht === 0;
  const deficit = Math.max(0, policy.minOrderAmountBaht - currentTotal);
  const percentage =
    policy.minOrderAmountBaht > 0
      ? Math.min(100, Math.round((currentTotal / policy.minOrderAmountBaht) * 100))
      : 100;

  return (
    <div
      id="supplier-policy-hero-card"
      className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white rounded-3xl p-4 sm:p-6 border border-slate-700/80 shadow-xl relative overflow-hidden transition-all animate-in fade-in slide-in-from-top-2 duration-300"
    >
      {/* Background Decorative Accent */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/70 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                {policy.supplierName}
              </h3>
              {supplier.code && (
                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-mono text-[11px] text-slate-300 font-bold">
                  {supplier.code}
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10.5px] font-extrabold flex items-center gap-1">
                <Package className="w-3 h-3" />
                {branchProductsCount} รายการในสาขา{branchName}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              เงื่อนไขขั้นต่ำการสั่งซื้อและรอบจัดส่งประจำสาขา (อิงข้อมูล Master Database)
            </p>
          </div>
        </div>

        {/* Clear Filter button */}
        <button
          type="button"
          onClick={onClearFilter}
          className="self-start sm:self-center px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600/80 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
        >
          <X className="w-3.5 h-3.5 text-slate-400" />
          <span>ดูทุกซัพพลายเออร์</span>
        </button>
      </div>

      {/* 4-Column Core Specs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-4 relative z-10">
        {/* Card 1: Minimum Order Amount */}
        <div className="bg-slate-800/80 backdrop-blur-xs rounded-2xl p-4 border border-slate-700/80 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                ยอดสั่งขั้นต่ำ (Min Order)
              </span>
              {policy.hasMinAmount ? (
                <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-black border border-purple-500/30">
                  ต่อบิล
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-black border border-blue-500/30">
                  ตามรายการ
                </span>
              )}
            </div>

            <div>
              {policy.hasMinAmount ? (
                <p className="text-xl sm:text-2xl font-black text-emerald-400">
                  ฿{(policy.minOrderAmountBaht ?? 0).toLocaleString()}
                </p>
              ) : (
                <p className="text-sm sm:text-base font-extrabold text-slate-200">
                  ไม่มีกำหนดยอดรวม
                </p>
              )}
              <p className="text-[11px] text-slate-400 mt-0.5">
                {policy.hasMinAmount
                  ? "ส่งฟรีเมื่อสั่งถึงยอดขั้นต่ำ"
                  : "คิดตามจำนวนสั่งขั้นต่ำของแต่ละสินค้า"}
              </p>
            </div>
          </div>

          {/* Cart status with this supplier */}
          {currentItemsCount > 0 && policy.hasMinAmount && (
            <div className="mt-3 pt-2.5 border-t border-slate-700/60 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">
                  เลือกอยู่:{" "}
                  <strong className="text-white">฿{(currentTotal ?? 0).toLocaleString()}</strong>
                </span>
                <span className={`font-black ${meetsMin ? "text-emerald-400" : "text-amber-400"}`}>
                  {meetsMin ? "✓ ถึงขั้นต่ำแล้ว" : `ขาดอีก ฿${(deficit ?? 0).toLocaleString()}`}
                </span>
              </div>
              <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    meetsMin ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Order & Delivery Schedule (สั่งวันไหน ส่งวันไหน) */}
        <div className="bg-slate-800/80 backdrop-blur-xs rounded-2xl p-4 border border-slate-700/80 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                รอบสั่ง → รอบส่ง
              </span>
              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-black border border-blue-500/30">
                รอบปกติ
              </span>
            </div>

            <div>
              <p className="text-sm sm:text-base font-black text-white leading-snug">
                {policy.schedulePattern}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {policy.schedulePattern.includes("จันทร์→พฤหัส")
                  ? "สั่งจันทร์ เข้าพฤหัส / สั่งพฤหัส เข้าจันทร์"
                  : policy.schedulePattern.includes("วันถัดไป")
                    ? "สั่งก่อน 16:00 น. จัดส่งวันถัดไป"
                    : policy.schedulePattern.includes("อาทิตย์→จันทร์")
                      ? "สั่งอาทิตย์ เข้าจันทร์ / สั่งพุธ เข้าพฤหัส"
                      : "จัดส่งตามรอบการจัดส่งมาตรฐานของสาขา"}
              </p>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center gap-1.5 text-[10.5px] text-slate-300">
            <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>รอบตัดคำสั่งซื้อ: 16:00 น.</span>
          </div>
        </div>

        {/* Card 3: Estimated Delivery Date based on selected Order Date */}
        <div className="bg-slate-800/80 backdrop-blur-xs rounded-2xl p-4 border border-slate-700/80 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                ของจะเข้าสาขาวันไหน
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/30">
                คำนวณสด
              </span>
            </div>

            <div>
              <p className="text-sm sm:text-base font-black text-amber-300">
                🚚 {policy.deliveryEstimate.expectedDateThai}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                หากกดส่งใบสั่งซื้อในวันที่เลือก ({orderDate})
              </p>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400">ระยะเวลาเตรียม/ส่ง:</span>
            <span className="font-extrabold text-slate-200">
              ประมาณ {policy.deliveryEstimate.leadDays} วัน
            </span>
          </div>
        </div>

        {/* Card 4: Special Rules & Notes */}
        <div className="bg-slate-800/80 backdrop-blur-xs rounded-2xl p-4 border border-slate-700/80 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                เงื่อนไข & หมายเหตุพิเศษ
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>

            <div className="text-xs text-slate-200 space-y-1">
              <p className="font-semibold text-slate-300">
                {policy.branchTerms ||
                  policy.notes ||
                  "ไม่มีเงื่อนไขพิเศษเพิ่มเติม จัดส่งตามรอบปกติ"}
              </p>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center gap-1.5 text-[10.5px] text-slate-400">
            <span>สาขา: {branchName}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
