import React, { useState, useEffect } from "react";
import {
  calculateDeliveryRound,
  DeliveryRoundResult,
  getDeliveryRoundConfig,
  DeliveryRoundConfig,
} from "./deliveryRoundRules";
import type { PurchaseBranch } from "./types";
import {
  Truck,
  Clock,
  Calendar,
  AlertTriangle,
  Info,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
  ChevronRight,
} from "lucide-react";
import { DeliveryRoundConfigCard } from "./DeliveryRoundConfigCard";

interface DeliveryRoundBannerProps {
  currentBranch: PurchaseBranch;
  orderType: "normal" | "urgent";
  onOrderTypeChange?: (type: "normal" | "urgent") => void;
  orderDate?: string;
  showTabs?: boolean;
  onOpenConfig?: () => void;
  className?: string;
}

export const DeliveryRoundBanner: React.FC<DeliveryRoundBannerProps> = ({
  currentBranch,
  orderType,
  onOrderTypeChange,
  orderDate,
  showTabs = true,
  onOpenConfig,
  className = "",
}) => {
  const [config, setConfig] = useState<DeliveryRoundConfig>(getDeliveryRoundConfig());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Live clock tick every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Listen to config changes
  useEffect(() => {
    const handleConfigChange = () => {
      setConfig(getDeliveryRoundConfig());
    };
    window.addEventListener("delivery-round-config-changed", handleConfigChange);
    return () => window.removeEventListener("delivery-round-config-changed", handleConfigChange);
  }, []);

  // Calculate live delivery round
  const result: DeliveryRoundResult = calculateDeliveryRound({
    branch: currentBranch,
    orderType,
    orderTimestamp: currentTime,
    config,
  });

  const formattedTime = currentTime.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Tab Switcher if enabled */}
      {showTabs && onOrderTypeChange ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 text-white p-2 sm:p-2.5 rounded-2xl border border-slate-700/80 shadow-md">
          <div className="flex items-center gap-1.5 p-1 bg-slate-800/90 rounded-xl">
            <button
              type="button"
              onClick={() => onOrderTypeChange("normal")}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                orderType === "normal"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>สั่งปกติ (Normal Order)</span>
            </button>

            <button
              type="button"
              onClick={() => onOrderTypeChange("urgent")}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                orderType === "urgent"
                  ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>สั่งผักด่วน (Express Vegetable)</span>
            </button>
          </div>

          {/* Real-time Indicator & Config Trigger */}
          <div className="flex items-center gap-3 px-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300 text-[11px] font-semibold">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>เวลาปัจจุบัน:</span>
              <strong className="text-white font-mono">{formattedTime} น.</strong>
            </div>

            <button
              type="button"
              onClick={() => (onOpenConfig ? onOpenConfig() : setIsConfigModalOpen(true))}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold border border-slate-700 flex items-center gap-1 transition-all cursor-pointer"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>ตารางรอบส่ง</span>
            </button>
          </div>
        </div>
      ) : (
        /* Single-mode bar (no tabs) */
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 text-white p-2.5 sm:px-4 sm:py-2.5 rounded-2xl border border-slate-700/80 shadow-md">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-1.5 rounded-xl ${
                orderType === "urgent"
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-emerald-500/20 text-emerald-400"
              }`}
            >
              {orderType === "urgent" ? (
                <Sparkles className="w-4 h-4" />
              ) : (
                <Truck className="w-4 h-4" />
              )}
            </div>
            <div>
              <span className="text-xs font-black text-white flex items-center gap-1.5">
                <span>
                  {orderType === "urgent"
                    ? "รอบสั่งซื้อผักด่วน (Express Vegetable)"
                    : "รอบสั่งซื้อวัตถุดิบทั่วไป (รอบปกติ)"}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                    orderType === "urgent"
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  }`}
                >
                  {orderType === "urgent" ? "Express Vegetable" : "Normal Round Only"}
                </span>
              </span>
              <p className="text-[10.5px] text-slate-400">
                {orderType === "urgent"
                  ? `จัดส่งร่วมกับรอบรถของสาขา ${currentBranch.name} (ตัดรอบ 19:00 น.)`
                  : `สั่งตามตารางรอบจัดส่งปกติของสาขา ${currentBranch.name} (รอบสั่งผักด่วนมีเฉพาะในแท็บ "สั่งซื้อผัก")`}
              </p>
            </div>
          </div>

          {/* Real-time Indicator & Config Trigger */}
          <div className="flex items-center gap-3 px-1 text-xs shrink-0">
            <div className="flex items-center gap-1.5 text-slate-300 text-[11px] font-semibold">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>เวลาปัจจุบัน:</span>
              <strong className="text-white font-mono">{formattedTime} น.</strong>
            </div>

            <button
              type="button"
              onClick={() => (onOpenConfig ? onOpenConfig() : setIsConfigModalOpen(true))}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold border border-slate-700 flex items-center gap-1 transition-all cursor-pointer"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>ตารางรอบส่ง</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Delivery Round Hero Card */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border transition-all shadow-sm relative overflow-hidden ${
          orderType === "urgent"
            ? "bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-amber-300/60 dark:border-amber-700/60 dark:bg-amber-950/20"
            : "bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border-emerald-300/60 dark:border-emerald-700/60 dark:bg-emerald-950/20"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`p-3 rounded-2xl shrink-0 ${
                orderType === "urgent"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              }`}
            >
              <Truck className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    orderType === "urgent"
                      ? "bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                      : "bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                  }`}
                >
                  {orderType === "urgent" ? "⚡ รอบสั่งผักด่วน" : "🚚 รอบสั่งปกติ"}
                </span>

                <span className="text-xs text-slate-500 dark:text-slate-400">
                  สาขา: <strong>{currentBranch.name}</strong>
                </span>

                {result.isNearestNextRound && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[10px] font-bold rounded-md">
                    รอบสั่งถัดไปที่ใกล้ที่สุด (+{result.nearestOffsetDays} วัน)
                  </span>
                )}
              </div>

              {/* Prominent Delivery Round Text */}
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3
                  className={`text-lg sm:text-xl font-black tracking-tight ${
                    orderType === "urgent"
                      ? "text-amber-900 dark:text-amber-200"
                      : "text-emerald-950 dark:text-emerald-200"
                  }`}
                >
                  {result.displayText}
                </h3>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                <span>
                  กำหนดวันส่งจริง:{" "}
                  <strong className="text-slate-900 dark:text-slate-100 underline decoration-emerald-500 decoration-2">
                    {result.calendarRangeFullThai}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  นับเป็นออเดอร์ของ:{" "}
                  <strong>
                    วัน{result.effectiveOrderDayName} ({result.effectiveOrderDateIso})
                  </strong>
                </span>
              </p>
            </div>
          </div>

          {/* Right Status Pill / Warnings */}
          <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
            {orderType === "urgent" ? (
              <div className="flex flex-col sm:items-end gap-1">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 rounded-xl border border-amber-500/30 text-xs font-extrabold">
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>ตัดรอบ {config.urgentCutoffTime || "19:00"} น.</span>
                </div>
                {result.isAfterCutoff && (
                  <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-800 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {result.cutoffNotice || "สั่งหลัง 19:00 แล้ว ระบบจะนับเป็นออเดอร์ของพรุ่งนี้"}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:items-end gap-1">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 rounded-xl border border-emerald-500/30 text-xs font-extrabold">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>รอบปกติสาขา: {result.allowedNormalDaysText}</span>
                </div>
                {!result.isAllowedOrderDayInNormalTab && (
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="w-3 h-3" />
                    วันนี้ไม่อยู่ในตารางสั่งปกติ (จะไล่หารอบถัดไป)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal for Config */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-3xl">
            <DeliveryRoundConfigCard onClose={() => setIsConfigModalOpen(false)} isModal={true} />
          </div>
        </div>
      )}
    </div>
  );
};
