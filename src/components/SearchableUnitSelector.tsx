import React, { useState, useMemo, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Search, Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatUnitThai, UNIT_THAI_MAP } from "@/lib/unitConversion";

export const COMMON_UNIT_CATEGORIES = [
  {
    name: "น้ำหนัก (Weight)",
    icon: "⚖️",
    units: [
      { code: "kg", th: "กิโลกรัม", desc: "1 kg = 1,000 g" },
      { code: "g", th: "กรัม", desc: "หน่วยย่อย" },
      { code: "mg", th: "มิลลิกรัม", desc: "0.001 g" },
      { code: "lb", th: "ปอนด์", desc: "~453.59 g" },
    ],
  },
  {
    name: "ปริมาตร (Volume)",
    icon: "🥛",
    units: [
      { code: "L", th: "ลิตร", desc: "1 L = 1,000 ml" },
      { code: "ml", th: "มิลลิลิตร", desc: "หน่วยย่อย" },
      { code: "ถ้วย", th: "ถ้วยตวง", desc: "~240 ml" },
      { code: "ช้อนโต๊ะ", th: "ช้อนโต๊ะ", desc: "1 tbsp = 15 ml" },
      { code: "ช้อนชา", th: "ช้อนชา", desc: "1 tsp = 5 ml" },
      { code: "หยด", th: "หยด", desc: "ปริมาณน้อย" },
    ],
  },
  {
    name: "บรรจุภัณฑ์ & นับชิ้น (Packaging / Count)",
    icon: "📦",
    units: [
      { code: "ชิ้น", th: "ชิ้น (Piece)", desc: "นับรายชิ้น" },
      { code: "ถุง", th: "ถุง (Bag)", desc: "บรรจุถุง" },
      { code: "แพ็ค", th: "แพ็ค (Pack)", desc: "ห่อ / แพ็ค" },
      { code: "กล่อง", th: "กล่อง (Box)", desc: "บรรจุกล่อง" },
      { code: "ขวด", th: "ขวด (Bottle)", desc: "บรรจุขวด" },
      { code: "ลัง", th: "ลัง (Carton)", desc: "ลังใหญ่" },
      { code: "กระป๋อง", th: "กระป๋อง (Can)", desc: "บรรจุกระป๋อง" },
      { code: "แผง", th: "แผง (Tray)", desc: "เช่น ไข่แผง" },
      { code: "โหล", th: "โหล (Dozen)", desc: "12 ชิ้น" },
      { code: "ฟอง", th: "ฟอง", desc: "สำหรับไข่" },
      { code: "ชุด", th: "ชุด (Set)", desc: "เป็นชุด" },
      { code: "มัด", th: "มัด", desc: "รวมมัด" },
      { code: "ลูก", th: "ลูก", desc: "ผลไม้ / ผัก" },
      { code: "หัว", th: "หัว", desc: "ผักกาด / กะหล่ำ" },
      { code: "ต้น", th: "ต้น", desc: "ผักเป็นต้น" },
    ],
  },
];

export interface SearchableUnitSelectorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options?: string[];
  helperText?: string;
  placeholder?: string;
  className?: string;
  id?: string;
  autoFocus?: boolean;
}

export function SearchableUnitSelector({
  label,
  value = "",
  onChange,
  options = [],
  helperText,
  placeholder = "พิมพ์ค้นหา หรือเลือกหน่วยนับ...",
  className,
  id,
  autoFocus = false,
}: SearchableUnitSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value || "");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync internal search text when external value changes
  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  // Combine and deduplicate options: presets + custom options
  const allKnownUnits = useMemo(() => {
    const map = new Map<string, { code: string; label: string; sub?: string; category?: string }>();

    // 1. Add preset category units
    COMMON_UNIT_CATEGORIES.forEach((cat) => {
      cat.units.forEach((u) => {
        const key = u.code.toLowerCase().trim();
        if (!map.has(key)) {
          map.set(key, {
            code: u.code,
            label: u.th,
            sub: u.desc,
            category: cat.name,
          });
        }
      });
    });

    // 2. Add options passed in (from existing items in DB)
    options.forEach((opt) => {
      if (!opt?.trim()) return;
      const trimmed = opt.trim();
      const key = trimmed.toLowerCase();
      if (!map.has(key)) {
        const th = formatUnitThai(trimmed) || trimmed;
        map.set(key, {
          code: trimmed,
          label: th,
          sub: th !== trimmed ? `${th} (${trimmed})` : undefined,
          category: "หน่วยที่ใช้ในระบบ (Custom Units)",
        });
      }
    });

    // 3. Make sure current value is included if non-empty
    if (value && value.trim()) {
      const vTrim = value.trim();
      const key = vTrim.toLowerCase();
      if (!map.has(key)) {
        const th = formatUnitThai(vTrim) || vTrim;
        map.set(key, {
          code: vTrim,
          label: th,
          category: "หน่วยปัจจุบัน",
        });
      }
    }

    return Array.from(map.values());
  }, [options, value]);

  // Filter units matching user search query
  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allKnownUnits;

    return allKnownUnits.filter((item) => {
      const matchCode = item.code.toLowerCase().includes(q);
      const matchLabel = item.label.toLowerCase().includes(q);
      const matchSub = (item.sub || "").toLowerCase().includes(q);
      const matchCategory = (item.category || "").toLowerCase().includes(q);
      return matchCode || matchLabel || matchSub || matchCategory;
    });
  }, [allKnownUnits, search]);

  const exactMatchExists = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return allKnownUnits.some((u) => u.code.toLowerCase() === q || u.label.toLowerCase() === q);
  }, [allKnownUnits, search]);

  const handleSelectUnit = (unitCode: string) => {
    onChange(unitCode);
    setSearch(unitCode);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    onChange(val);
    if (!open) setOpen(true);
    setHighlightedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    const totalCount = filteredUnits.length + (!exactMatchExists && search.trim() ? 1 : 0);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < totalCount - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!exactMatchExists && search.trim() && highlightedIndex === 0) {
        handleSelectUnit(search.trim());
      } else {
        const offset = !exactMatchExists && search.trim() ? 1 : 0;
        const targetIndex = highlightedIndex - offset;
        if (targetIndex >= 0 && targetIndex < filteredUnits.length) {
          handleSelectUnit(filteredUnits[targetIndex].code);
        } else if (search.trim()) {
          handleSelectUnit(search.trim());
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  // Quick picks
  const quickPillUnits = ["kg", "g", "L", "ml", "ชิ้น", "ถุง", "แพ็ค", "กล่อง", "ขวด", "ลัง"];

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label htmlFor={id} className="text-xs font-semibold text-foreground">
            {label}
          </Label>
          {value && (
            <span className="text-[11px] text-muted-foreground font-medium">
              เลือก: <strong className="text-primary font-bold">{value}</strong>
              {formatUnitThai(value) && formatUnitThai(value) !== value
                ? ` (${formatUnitThai(value)})`
                : ""}
            </span>
          )}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative flex items-center">
            <Input
              id={id}
              ref={inputRef}
              type="text"
              autoFocus={autoFocus}
              value={search}
              onChange={handleInputChange}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="pr-16 text-sm font-medium bg-background border-border/80 rounded-xl focus-visible:ring-1 focus-visible:ring-primary h-10 shadow-xs"
            />

            <div className="absolute right-1.5 flex items-center gap-0.5">
              {search && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearch("");
                    onChange("");
                    inputRef.current?.focus();
                  }}
                  title="ล้างข้อมูล"
                  className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(!open)}
                title="เปิดรายการหน่วยนับ"
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
              >
                <ChevronsUpDown className="h-4 w-4 opacity-70" />
              </button>
            </div>
          </div>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="p-0 w-[320px] sm:w-[380px] max-w-[95vw] rounded-2xl border border-border shadow-2xl bg-popover z-50 overflow-hidden"
        >
          {/* Quick Choice Pills */}
          <div className="p-2.5 bg-muted/30 border-b border-border/60">
            <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center justify-between">
              <span>⚡ หน่วยที่ใช้บ่อย (Quick Select):</span>
              <span className="text-[10px] text-muted-foreground/80">คลิกเลือกได้เลย</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickPillUnits.map((u) => {
                const isSelected = value.toLowerCase().trim() === u.toLowerCase().trim();
                const thLabel = formatUnitThai(u);
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleSelectUnit(u)}
                    className={cn(
                      "px-2 py-0.5 rounded-lg text-xs font-semibold transition-all border",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-background hover:bg-muted/80 text-foreground border-border/80 hover:border-border",
                    )}
                  >
                    {u} {thLabel && thLabel !== u ? `(${thLabel})` : ""}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtered List */}
          <div ref={listRef} className="max-h-60 overflow-y-auto p-1.5 divide-y divide-border/20">
            {/* Custom Input Option if not exact match */}
            {!exactMatchExists && search.trim() && (
              <div
                onClick={() => handleSelectUnit(search.trim())}
                onMouseEnter={() => setHighlightedIndex(0)}
                className={cn(
                  "flex items-center justify-between gap-2 px-3 py-2 rounded-xl cursor-pointer text-xs mb-1 transition-colors",
                  highlightedIndex === 0
                    ? "bg-amber-500/15 text-amber-950 dark:text-amber-200 border border-amber-500/30"
                    : "hover:bg-amber-500/10 text-amber-950 dark:text-amber-200",
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
                  <div>
                    <div className="font-bold">
                      ใช้หน่วยที่พิมพ์:{" "}
                      <span className="underline">&quot;{search.trim()}&quot;</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      บันทึกเป็นหน่วยกำหนดเอง (Custom Unit)
                    </div>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-amber-500/10 border-amber-500/30"
                >
                  Enter ↵
                </Badge>
              </div>
            )}

            {filteredUnits.length === 0 && exactMatchExists ? (
              <div className="py-6 px-4 text-center text-xs text-muted-foreground">
                ไม่พบหน่วยนับที่ค้นหา สามารถพิมพ์หน่วยที่ต้องการแล้วกดบันทึกได้ทันที
              </div>
            ) : (
              filteredUnits.map((u, idx) => {
                const adjustedIndex = !exactMatchExists && search.trim() ? idx + 1 : idx;
                const isHighlighted = adjustedIndex === highlightedIndex;
                const isSelected =
                  value.toLowerCase().trim() === u.code.toLowerCase().trim() ||
                  value.toLowerCase().trim() === u.label.toLowerCase().trim();

                return (
                  <div
                    key={`${u.code}-${idx}`}
                    onClick={() => handleSelectUnit(u.code)}
                    onMouseEnter={() => setHighlightedIndex(adjustedIndex)}
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-2 rounded-xl cursor-pointer text-xs transition-colors",
                      isSelected
                        ? "bg-primary/10 text-primary font-bold"
                        : isHighlighted
                          ? "bg-muted/70 text-foreground"
                          : "hover:bg-muted/50 text-foreground",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{u.code}</span>
                        {u.label && u.label !== u.code && (
                          <span className="text-muted-foreground font-medium">• {u.label}</span>
                        )}
                        {u.category && (
                          <span className="text-[10px] text-muted-foreground/60 ml-auto mr-1 truncate max-w-[110px]">
                            {u.category.split(" ")[0]}
                          </span>
                        )}
                      </div>
                      {u.sub && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">{u.sub}</div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Info */}
          <div className="p-2 border-t border-border/60 bg-muted/10 text-[11px] text-muted-foreground flex items-center justify-between px-3">
            <span>พิมพ์คำค้น หรือพิมพ์ชื่อหน่วยใหม่ได้อิสระ</span>
            {value && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  onChange("");
                }}
                className="text-xs text-primary hover:underline font-semibold"
              >
                ล้างค่า
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {helperText && <p className="text-[11px] text-muted-foreground">{helperText}</p>}
    </div>
  );
}
