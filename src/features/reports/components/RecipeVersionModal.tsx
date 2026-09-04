import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  RecipeVersion,
  RecipeVersionIngredient,
} from "@/features/reports/types/usageVariance";
import type { RecipeItem, User } from "@/lib/types";
import {
  Layers,
  Plus,
  Calendar,
  CheckCircle2,
  GitBranch,
  History,
  FileText,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface RecipeVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: RecipeItem[];
  versions: RecipeVersion[];
  onSaveNewVersion: (newVersion: RecipeVersion) => void;
  currentUser: User | null;
}

export const RecipeVersionModal: React.FC<RecipeVersionModalProps> = ({
  isOpen,
  onClose,
  recipes,
  versions,
  onSaveNewVersion,
  currentUser,
}) => {
  const [selectedMenuCode, setSelectedMenuCode] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [changeSummary, setChangeSummary] = useState<string>("");

  // Extract unique menu codes
  const uniqueMenus = Array.from(
    new Map(
      recipes
        .filter((r) => r.menuCode && !r.isDeleted)
        .map((r) => [r.menuCode.toUpperCase(), { code: r.menuCode, name: r.menuName }]),
    ).values(),
  );

  const activeMenuCode = selectedMenuCode || uniqueMenus[0]?.code || "";
  const activeMenuObj = uniqueMenus.find(
    (m) => m.code.toUpperCase() === activeMenuCode.toUpperCase(),
  );

  const menuVersions = versions
    .filter((v) => v.menuCode.toUpperCase() === activeMenuCode.toUpperCase())
    .sort((a, b) => b.versionNumber - a.versionNumber);

  const currentRecipeItems = recipes.filter(
    (r) =>
      r.menuCode.toUpperCase() === activeMenuCode.toUpperCase() &&
      !r.isDeleted &&
      r.active !== false,
  );

  const handleCreateVersion = () => {
    if (!activeMenuObj) return;
    if (!effectiveDate) {
      toast.error("กรุณาระบุวันที่มีผลบังคับใช้ (Effective Date)");
      return;
    }

    const nextVerNumber = (menuVersions[0]?.versionNumber || 1) + 1;
    const ingredients: RecipeVersionIngredient[] = currentRecipeItems.map((r) => ({
      ingredientCode: r.ingredientCode,
      ingredientName: r.ingredientName,
      quantity: r.quantity,
      unit: r.unit,
      subRecipeCode: r.subRecipeCode,
    }));

    const newVersion: RecipeVersion = {
      id: `ver-${activeMenuCode.toLowerCase()}-${nextVerNumber}`,
      menuCode: activeMenuObj.code,
      menuName: activeMenuObj.name,
      versionNumber: nextVerNumber,
      versionTag: `v${nextVerNumber}.0`,
      effectiveDate,
      ingredients,
      changeSummary: changeSummary.trim() || `ปรับปรุงสูตร Version ${nextVerNumber}.0`,
      isActive: true,
      createdBy: currentUser?.name || currentUser?.email || "ผู้ดูแลระบบ",
      createdAt: new Date().toISOString(),
    };

    onSaveNewVersion(newVersion);
    toast.success(`สร้างสูตร Version ${newVersion.versionTag} สำเร็จแล้ว`);
    setShowCreateForm(false);
    setChangeSummary("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-primary" />
              จัดการประวัติและเวอร์ชันสูตรอาหาร (Recipe / BOM Versioning)
            </DialogTitle>
            <Button
              size="sm"
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="rounded-xl text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {showCreateForm ? "ดูประวัติเวอร์ชัน" : "สร้างเวอร์ชันใหม่ (New BOM Version)"}
            </Button>
          </div>
          <DialogDescription className="text-xs">
            กำหนดวันที่มีผลบังคับใช้ของแต่ละสูตรอาหาร เพื่อให้ระบบคำนวณการใช้ตามสูตร (Theoretical
            Usage) ย้อนหลังได้อย่างแม่นยำตามสูตรจริงในแต่ละช่วงเวลา
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Menu Selection Sidebar */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              เลือกเมนูอาหาร ({uniqueMenus.length})
            </Label>
            <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
              {uniqueMenus.map((menu) => {
                const isSelected = menu.code.toUpperCase() === activeMenuCode.toUpperCase();
                const verCount = versions.filter(
                  (v) => v.menuCode.toUpperCase() === menu.code.toUpperCase(),
                ).length;
                return (
                  <button
                    key={menu.code}
                    onClick={() => {
                      setSelectedMenuCode(menu.code);
                      setShowCreateForm(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-bold shadow-sm"
                        : "hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="truncate">
                      <div className="font-semibold truncate">{menu.name}</div>
                      <div
                        className={`text-[10px] ${
                          isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                        }`}
                      >
                        {menu.code}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 shrink-0 ${
                        isSelected
                          ? "border-primary-foreground/40 text-primary-foreground"
                          : "border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      {verCount || 1} ver
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Version Details / Create Form */}
          <div className="md:col-span-2 space-y-4">
            {showCreateForm ? (
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-500" />
                  บันทึกสูตรเวอร์ชันใหม่: {activeMenuObj?.name} ({activeMenuObj?.code})
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Version Number</Label>
                    <Input
                      disabled
                      value={`v${(menuVersions[0]?.versionNumber || 1) + 1}.0`}
                      className="h-10 rounded-xl mt-1 text-xs bg-muted/40 font-bold"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">
                      วันที่มีผลบังคับใช้ (Effective Date) <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className="h-10 rounded-xl mt-1 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">คำอธิบายการเปลี่ยนแปลง (Change Log Summary)</Label>
                  <Textarea
                    placeholder="เช่น ปรับลดขนาดแซลมอนจาก 120g เป็น 100g ตามโปรโมชั่นไตรมาส 3..."
                    value={changeSummary}
                    onChange={(e) => setChangeSummary(e.target.value)}
                    className="mt-1 rounded-xl text-xs min-h-[70px]"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-muted-foreground block mb-2">
                    วัตถุดิบในสูตรปัจจุบันที่จะถูก Snapshot เป็นเวอร์ชันใหม่ (
                    {currentRecipeItems.length})
                  </Label>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 font-semibold text-muted-foreground">
                        <tr>
                          <th className="p-2 text-left">วัตถุดิบ</th>
                          <th className="p-2 text-right">ปริมาณตวง</th>
                          <th className="p-2 text-left">หน่วย</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {currentRecipeItems.map((ing) => (
                          <tr key={ing.id}>
                            <td className="p-2">
                              {ing.ingredientName} ({ing.ingredientCode})
                            </td>
                            <td className="p-2 text-right font-bold">{ing.quantity}</td>
                            <td className="p-2 text-muted-foreground">{ing.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                    className="rounded-xl text-xs"
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    onClick={handleCreateVersion}
                    className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    บันทึก Snapshot เวอร์ชันใหม่
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {activeMenuObj?.name} ({activeMenuObj?.code})
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      ประวัติเวอร์ชันสูตรและวันที่มีผลใช้งาน ({menuVersions.length} เวอร์ชัน)
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {menuVersions.length > 0 ? (
                    menuVersions.map((v, idx) => (
                      <div
                        key={v.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          idx === 0
                            ? "border-primary/40 bg-primary/5 dark:bg-primary/10"
                            : "border-slate-200 dark:border-slate-800 bg-card"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={`text-xs font-bold ${
                                idx === 0
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                              }`}
                            >
                              {v.versionTag || `v${v.versionNumber}.0`}
                            </Badge>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              มีผลตั้งแต่: {v.effectiveDate}
                            </span>
                            {idx === 0 && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-emerald-600 border-emerald-300"
                              >
                                กำลังใช้งานล่าสุด
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> สร้างโดย {v.createdBy} (
                            {new Date(v.createdAt).toLocaleDateString("th-TH")})
                          </span>
                        </div>

                        {v.changeSummary && (
                          <p className="text-xs text-muted-foreground mt-2 bg-slate-100/60 dark:bg-slate-800/40 p-2 rounded-xl">
                            {v.changeSummary}
                          </p>
                        )}

                        <div className="mt-3">
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                            วัตถุดิบในสูตร ({v.ingredients?.length || 0}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {v.ingredients?.map((ing) => (
                              <span
                                key={ing.ingredientCode}
                                className="text-[11px] px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                              >
                                {ing.ingredientName}: <strong>{ing.quantity}</strong> {ing.unit}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-2xl">
                      ยังไม่มี Snapshot ประวัติสูตร ระบบจะใช้สูตรปัจจุบันในการคำนวณ
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" onClick={onClose} className="rounded-xl text-xs">
            ปิด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
