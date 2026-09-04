import React, { useState, useEffect } from "react";
import {
  DeliveryRoundConfig,
  ScheduleRuleItem,
  getDeliveryRoundConfig,
  saveDeliveryRoundConfig,
  resetDeliveryRoundConfig,
  DEFAULT_STANDARD_SCHEDULE,
  DEFAULT_PORTO_CHINO_SCHEDULE,
  THAI_DAY_NAMES,
  DayOfWeek,
} from "./deliveryRoundRules";
import {
  Calendar,
  Clock,
  RotateCcw,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Truck,
  Sparkles,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface DeliveryRoundConfigCardProps {
  onClose?: () => void;
  isModal?: boolean;
}

export const DeliveryRoundConfigCard: React.FC<DeliveryRoundConfigCardProps> = ({
  onClose,
  isModal = false,
}) => {
  const [config, setConfig] = useState<DeliveryRoundConfig>(getDeliveryRoundConfig());
  const [activeSubTab, setActiveSubTab] = useState<"standard" | "portochino" | "urgent">(
    "standard",
  );

  useEffect(() => {
    setConfig(getDeliveryRoundConfig());
  }, []);

  const handleSave = () => {
    saveDeliveryRoundConfig(config);
    toast.success("บันทึกการตั้งค่ารอบจัดส่งเรียบร้อยแล้ว");
    if (onClose) onClose();
  };

  const handleReset = () => {
    if (confirm("คุณต้องการคืนค่าตารางรอบจัดส่งกลับเป็นค่าเริ่มต้นจากระบบใช่หรือไม่?")) {
      const def = resetDeliveryRoundConfig();
      setConfig(def);
      toast.info("คืนค่ารอบจัดส่งมาตรฐานเรียบร้อย");
    }
  };

  const updateScheduleItem = (
    type: "defaultSchedule" | "portoChinoSchedule",
    index: number,
    field: keyof ScheduleRuleItem,
    value: string | number | undefined,
  ) => {
    setConfig((prev) => {
      const list = [...prev[type]];
      if (list[index]) {
        list[index] = {
          ...list[index],
          [field]: value,
          ...(field === "orderDay" ? { orderDayName: THAI_DAY_NAMES[value as DayOfWeek] } : {}),
        };
      }
      return {
        ...prev,
        [type]: list,
      };
    });
  };

  const addScheduleRow = (type: "defaultSchedule" | "portoChinoSchedule") => {
    setConfig((prev) => {
      const list = [...prev[type]];
      const newRow: ScheduleRuleItem = {
        id: `row-${Date.now()}`,
        orderDay: 1,
        orderDayName: "จันทร์",
        deliveryDaysText: "พุธ",
        startLeadDays: 2,
        endLeadDays: 2,
        notes: "กำหนดเอง",
      };
      return {
        ...prev,
        [type]: [...list, newRow],
      };
    });
  };

  const removeScheduleRow = (type: "defaultSchedule" | "portoChinoSchedule", index: number) => {
    setConfig((prev) => {
      const list = [...prev[type]];
      list.splice(index, 1);
      return {
        ...prev,
        [type]: list,
      };
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>ตารางอ้างอิงรอบสั่ง-ส่งสินค้า (Delivery Schedule Config)</span>
              <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                Configurable
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              กำหนดตารางรอบสั่งและวันส่งสำหรับแท็บสั่งปกติและแท็บสั่งผักด่วน
              ระบบจะคำนวณและแสดงผลอัตโนมัติแบบเรียลไทม์
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>คืนค่าเริ่มต้น</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>บันทึกการตั้งค่า</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab("standard")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "standard"
              ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>ทุกสาขา ยกเว้น พอร์โตชิโน่ (สั่งปกติ)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("portochino")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "portochino"
              ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>สาขาพอร์โตชิโน่ (สั่งปกติ)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("urgent")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "urgent"
              ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>กติกาแท็บ "สั่งผักด่วน" (ตัดรอบ 19:00)</span>
        </button>
      </div>

      {/* Content Area */}
      {activeSubTab === "standard" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              ตารางรอบสั่ง-ส่ง สำหรับสาขา 1 (วัชรพล), สาขา 2 (พระราม33), สาขา 3 (บางแก้ว), สาขา 4
              (บางนา)
            </p>
            <button
              type="button"
              onClick={() => addScheduleRow("defaultSchedule")}
              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 hover:bg-emerald-100 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> เพิ่มรอบสั่ง
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 px-4 font-black">วันสั่ง (Order Day)</th>
                  <th className="py-3 px-4 font-black">ข้อความวันส่ง (Delivery Days Text)</th>
                  <th className="py-3 px-4 font-black text-center">เริ่มส่ง (+วัน)</th>
                  <th className="py-3 px-4 font-black text-center">ส่งครบ (+วัน)</th>
                  <th className="py-3 px-4 font-black">คำอธิบาย</th>
                  <th className="py-3 px-4 text-center">ลบ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {config.defaultSchedule.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-2.5 px-4">
                      <select
                        value={row.orderDay}
                        onChange={(e) =>
                          updateScheduleItem(
                            "defaultSchedule",
                            idx,
                            "orderDay",
                            Number(e.target.value),
                          )
                        }
                        className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
                      >
                        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                          <option key={d} value={d}>
                            {THAI_DAY_NAMES[d as DayOfWeek]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-4">
                      <input
                        type="text"
                        value={row.deliveryDaysText}
                        onChange={(e) =>
                          updateScheduleItem(
                            "defaultSchedule",
                            idx,
                            "deliveryDaysText",
                            e.target.value,
                          )
                        }
                        className="w-full p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <input
                        type="number"
                        min={0}
                        max={14}
                        value={row.startLeadDays}
                        onChange={(e) =>
                          updateScheduleItem(
                            "defaultSchedule",
                            idx,
                            "startLeadDays",
                            Number(e.target.value),
                          )
                        }
                        className="w-16 p-1.5 text-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <input
                        type="number"
                        min={0}
                        max={14}
                        value={row.endLeadDays}
                        onChange={(e) =>
                          updateScheduleItem(
                            "defaultSchedule",
                            idx,
                            "endLeadDays",
                            Number(e.target.value),
                          )
                        }
                        className="w-16 p-1.5 text-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <input
                        type="text"
                        value={row.notes || ""}
                        onChange={(e) =>
                          updateScheduleItem("defaultSchedule", idx, "notes", e.target.value)
                        }
                        placeholder="หมายเหตุ"
                        className="w-full p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => removeScheduleRow("defaultSchedule", idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                        title="ลบแถว"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === "portochino" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              ตารางรอบสั่ง-ส่ง เฉพาะสำหรับ <strong>สาขาพอร์โตชิโน่ (สาขา 5)</strong>
            </p>
            <button
              type="button"
              onClick={() => addScheduleRow("portoChinoSchedule")}
              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 hover:bg-emerald-100 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> เพิ่มรอบสั่ง
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 px-4 font-black">วันสั่ง (Order Day)</th>
                  <th className="py-3 px-4 font-black">ข้อความวันส่ง (Delivery Days Text)</th>
                  <th className="py-3 px-4 font-black text-center">เริ่มส่ง (+วัน)</th>
                  <th className="py-3 px-4 font-black text-center">ส่งครบ (+วัน)</th>
                  <th className="py-3 px-4 font-black">คำอธิบาย</th>
                  <th className="py-3 px-4 text-center">ลบ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {config.portoChinoSchedule.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-2.5 px-4">
                      <select
                        value={row.orderDay}
                        onChange={(e) =>
                          updateScheduleItem(
                            "portoChinoSchedule",
                            idx,
                            "orderDay",
                            Number(e.target.value),
                          )
                        }
                        className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
                      >
                        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                          <option key={d} value={d}>
                            {THAI_DAY_NAMES[d as DayOfWeek]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-4">
                      <input
                        type="text"
                        value={row.deliveryDaysText}
                        onChange={(e) =>
                          updateScheduleItem(
                            "portoChinoSchedule",
                            idx,
                            "deliveryDaysText",
                            e.target.value,
                          )
                        }
                        className="w-full p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <input
                        type="number"
                        min={0}
                        max={14}
                        value={row.startLeadDays}
                        onChange={(e) =>
                          updateScheduleItem(
                            "portoChinoSchedule",
                            idx,
                            "startLeadDays",
                            Number(e.target.value),
                          )
                        }
                        className="w-16 p-1.5 text-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <input
                        type="number"
                        min={0}
                        max={14}
                        value={row.endLeadDays}
                        onChange={(e) =>
                          updateScheduleItem(
                            "portoChinoSchedule",
                            idx,
                            "endLeadDays",
                            Number(e.target.value),
                          )
                        }
                        className="w-16 p-1.5 text-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <input
                        type="text"
                        value={row.notes || ""}
                        onChange={(e) =>
                          updateScheduleItem("portoChinoSchedule", idx, "notes", e.target.value)
                        }
                        placeholder="หมายเหตุ"
                        className="w-full p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => removeScheduleRow("portoChinoSchedule", idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                        title="ลบแถว"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === "urgent" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-3">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                เวลาตัดรอบสำหรับ "สั่งผักด่วน" (Cutoff Time):
              </label>
              <input
                type="time"
                value={config.urgentCutoffTime}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, urgentCutoffTime: e.target.value }))
                }
                className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-black text-sm text-emerald-600"
              />
              <p className="text-[11px] text-slate-500">
                ค่าเริ่มต้นคือ 19:00 น. หากสั่งก่อนเวลานี้จะนับเป็นออเดอร์ของวันนี้
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-3">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>เลื่อนเป็นออเดอร์ของวันถัดไปอัตโนมัติเมื่อสั่งหลังเวลาตัดรอบ:</span>
                <input
                  type="checkbox"
                  checked={config.autoRollOverNextDay}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, autoRollOverNextDay: e.target.checked }))
                  }
                  className="w-4 h-4 text-emerald-600 rounded"
                />
              </label>
              <p className="text-[11px] text-slate-500">
                เมื่อเปิดใช้งาน หากพนักงานสั่งหลัง 19:00 น.
                ระบบจะนับเป็นออเดอร์ของวันพรุ่งนี้อัตโนมัติ และคำนวณรอบส่งจากวันใหม่
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-2">
            <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
              ข้อความแจ้งเตือนพนักงานเมื่อสั่งหลังตัดรอบ:
            </label>
            <input
              type="text"
              value={config.rolloverNoticeText}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, rolloverNoticeText: e.target.value }))
              }
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs"
            />
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs space-y-1 text-emerald-900 dark:text-emerald-200">
            <h4 className="font-extrabold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" /> ตรรกะการคำนวณรอบส่งผักด่วน:
            </h4>
            <p>1. เช็คเวลาสั่งจริงเทียบกับ 19:00 น. หากเกินจะเลื่อนวันสั่งเป็นวันถัดไป</p>
            <p>
              2. ตรวจสอบว่าตรงกับวันสั่งในตารางปกติของสาขาหรือไม่ หากตรงจะใช้รอบส่งของวันนั้นเลย
            </p>
            <p>
              3. หากไม่ตรง (เช่น สั่งวันเสาร์)
              ระบบจะไล่หาล่วงหน้าทีละวันจนเจอวันสั่งถัดไปที่มีในตารางปกติ แล้วใช้วันส่งของรอบนั้น
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
