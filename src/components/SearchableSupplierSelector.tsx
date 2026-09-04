import React, { useState, useMemo, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { Supplier } from "@/lib/types";
import {
  findSupplierPolicyRule,
  getSupplierMinOrderAmount,
} from "@/features/purchase/supplierPolicyRules";

export interface GenericSupplier {
  id: string;
  name: string;
  code?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  active?: boolean;
  minOrderAmount?: number;
  [key: string]: unknown;
}

export interface SearchableSupplierSelectorProps {
  /** Optional custom list of suppliers. If omitted, uses suppliers from the central store. */
  suppliers?: (Supplier | GenericSupplier)[];
  /** Currently selected supplier ID or special value (e.g. "all", "none", "") */
  value: string;
  /** Callback fired when a supplier is selected */
  onChange: (value: string, supplier?: GenericSupplier | null) => void;
  /** Optional placeholder when nothing is selected */
  placeholder?: string;
  /** Optional placeholder for the search input box */
  searchPlaceholder?: string;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Additional CSS class names for the trigger button */
  className?: string;
  /** Additional trigger-specific class name */
  triggerClassName?: string;
  /** Popover container width class */
  popoverWidth?: string;
  /** Whether to show the "All / ทั้งหมด" option (ideal for filter dropdowns) */
  allowAll?: boolean;
  /** Value used for the "All" option (defaults to "all") */
  allValue?: string;
  /** Label for the "All" option */
  allLabel?: string;
  /** Whether to show a "None / ไม่ระบุ" option (ideal for optional forms) */
  allowNone?: boolean;
  /** Value used for the "None" option (defaults to "none") */
  noneValue?: string;
  /** Label for the "None" option */
  noneLabel?: string;
  /** Whether to show a quick clear (x) button on the trigger when a value is selected */
  allowClear?: boolean;
  /** Size variant */
  size?: "sm" | "default" | "lg";
  /** Whether to filter out inactive suppliers (defaults to false for flexibility) */
  activeOnly?: boolean;
  /** Whether to display supplier code badges */
  showCode?: boolean;
  /** Custom ID for testing or label association */
  id?: string;
}

export function SearchableSupplierSelector({
  suppliers: customSuppliers,
  value,
  onChange,
  placeholder = "เลือกซัพพลายเออร์...",
  searchPlaceholder = "ค้นหาชื่อ, รหัสซัพพลายเออร์ หรือเบอร์โทร...",
  disabled = false,
  className,
  triggerClassName,
  popoverWidth = "w-[320px] sm:w-[400px]",
  allowAll = false,
  allValue = "all",
  allLabel = "ทั้งหมด (ทุกซัพพลายเออร์)",
  allowNone = false,
  noneValue = "none",
  noneLabel = "ไม่ระบุซัพพลายเออร์ (None)",
  allowClear = false,
  size = "default",
  activeOnly = false,
  showCode = true,
  id,
}: SearchableSupplierSelectorProps) {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Use provided suppliers list or fallback to central store
  const rawSuppliers = useMemo(() => {
    return customSuppliers ?? store?.suppliers ?? [];
  }, [customSuppliers, store?.suppliers]);

  // Find currently selected item
  const selectedSupplier = useMemo(() => {
    if (!value || value === allValue || value === noneValue) return null;
    return rawSuppliers.find((s) => s.id === value) || null;
  }, [rawSuppliers, value, allValue, noneValue]);

  // Is "All" or "None" selected
  const isAllSelected = allowAll && value === allValue;
  const isNoneSelected = allowNone && value === noneValue;

  // Filter suppliers by search query and active status
  const filteredSuppliers = useMemo(() => {
    let list = rawSuppliers;
    if (activeOnly) {
      list = list.filter((s) => s.active !== false);
    }

    const q = search.trim().toLowerCase();
    if (!q) return list;

    return list.filter((s) => {
      const matchName = (s.name || "").toLowerCase().includes(q);
      const matchCode = (s.code || "").toLowerCase().includes(q);
      const matchContact = (s.contactPerson || "").toLowerCase().includes(q);
      const matchPhone = (s.phone || "").toLowerCase().includes(q);
      const matchEmail = (s.email || "").toLowerCase().includes(q);
      const matchAddress = (s.address || "").toLowerCase().includes(q);
      return matchName || matchCode || matchContact || matchPhone || matchEmail || matchAddress;
    });
  }, [rawSuppliers, activeOnly, search]);

  // All interactive options (including All and None if enabled and match search)
  const availableOptions = useMemo(() => {
    const opts: Array<{ type: "all" | "none" | "supplier"; data?: GenericSupplier }> = [];
    const q = search.trim().toLowerCase();

    if (
      allowAll &&
      (!q || allLabel.toLowerCase().includes(q) || "all".includes(q) || "ทั้งหมด".includes(q))
    ) {
      opts.push({ type: "all" });
    }
    if (
      allowNone &&
      (!q || noneLabel.toLowerCase().includes(q) || "none".includes(q) || "ไม่ระบุ".includes(q))
    ) {
      opts.push({ type: "none" });
    }

    filteredSuppliers.forEach((s) => {
      opts.push({ type: "supplier", data: s });
    });

    return opts;
  }, [allowAll, allowNone, allLabel, noneLabel, search, filteredSuppliers]);

  // Auto focus search on open & reset highlight
  useEffect(() => {
    if (open) {
      setHighlightedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < availableOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = availableOptions[highlightedIndex];
      if (current) {
        if (current.type === "all") {
          onChange(allValue, null);
        } else if (current.type === "none") {
          onChange(noneValue, null);
        } else if (current.data) {
          onChange(current.data.id, current.data);
        }
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (allowAll) {
      onChange(allValue, null);
    } else if (allowNone) {
      onChange(noneValue, null);
    } else {
      onChange("", null);
    }
  };

  // Size styling classes
  const sizeClasses = {
    sm: "h-8 text-xs px-2.5 rounded-lg",
    default: "h-10 text-xs sm:text-sm px-3 rounded-xl",
    lg: "h-11 text-sm px-3.5 rounded-xl",
  }[size];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full justify-between font-normal text-left bg-background border-border/80 hover:bg-muted/30 transition-all shadow-none relative select-none",
            sizeClasses,
            !selectedSupplier && !isAllSelected && !isNoneSelected && "text-muted-foreground",
            disabled && "opacity-50 cursor-not-allowed",
            className,
            triggerClassName,
          )}
        >
          <div className="flex items-center gap-2 truncate min-w-0 pr-1">
            {isAllSelected ? (
              <span className="font-semibold text-foreground truncate">{allLabel}</span>
            ) : isNoneSelected ? (
              <span className="text-muted-foreground truncate">{noneLabel}</span>
            ) : selectedSupplier ? (
              <div className="flex items-center gap-1.5 truncate">
                {showCode && selectedSupplier.code && (
                  <span className="font-mono text-[11px] font-bold text-muted-foreground shrink-0 bg-muted/60 px-1 py-0.2 rounded">
                    [{selectedSupplier.code}]
                  </span>
                )}
                <span className="font-semibold text-foreground truncate">
                  {selectedSupplier.name}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground truncate">{placeholder}</span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {allowClear &&
              (selectedSupplier ||
                (allowAll && !isAllSelected) ||
                (allowNone && !isNoneSelected)) && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleClear}
                  title="ล้างการเลือก"
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className={cn(
          "p-0 rounded-2xl border border-border shadow-2xl bg-popover z-50 overflow-hidden",
          popoverWidth,
        )}
      >
        {/* Search Header */}
        <div className="p-2.5 border-b border-border/70 bg-muted/20">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="h-8.5 pl-8 pr-7 text-xs bg-background rounded-xl border-border/80 focus-visible:ring-1 focus-visible:ring-emerald-500 shadow-none font-normal"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                title="ล้างคำค้นหา"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Options List */}
        <div
          ref={listRef}
          className="max-h-64 sm:max-h-72 overflow-y-auto p-1.5 divide-y divide-border/20"
        >
          {availableOptions.length === 0 ? (
            <div className="py-7 px-4 text-center text-xs text-muted-foreground space-y-1.5">
              <div className="font-bold text-foreground text-sm">ไม่พบซัพพลายเออร์ที่ค้นหา</div>
              <p className="text-[11px] text-muted-foreground">
                ลองค้นหาด้วยรหัส หรือชื่อร้านค้า เช่น &quot;CP&quot;, &quot;Betagro&quot;,
                &quot;SUP-001&quot;
              </p>
            </div>
          ) : (
            availableOptions.map((opt, idx) => {
              const isHighlighted = idx === highlightedIndex;

              if (opt.type === "all") {
                const isSelected = isAllSelected;
                return (
                  <div
                    key="option-all"
                    onClick={() => {
                      onChange(allValue, null);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-2 rounded-xl cursor-pointer text-xs transition-colors",
                      isSelected
                        ? "bg-emerald-500/15 text-emerald-950 dark:text-emerald-200 font-bold"
                        : isHighlighted
                          ? "bg-muted/70 text-foreground"
                          : "hover:bg-muted/50 text-foreground",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-bold truncate">{allLabel}</div>
                      <div className="text-[10px] text-muted-foreground">
                        แสดงข้อมูลจากซัพพลายเออร์ทุกราย ({rawSuppliers.length} เจ้า)
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                  </div>
                );
              }

              if (opt.type === "none") {
                const isSelected = isNoneSelected;
                return (
                  <div
                    key="option-none"
                    onClick={() => {
                      onChange(noneValue, null);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-2 rounded-xl cursor-pointer text-xs transition-colors",
                      isSelected
                        ? "bg-emerald-500/15 text-emerald-950 dark:text-emerald-200 font-bold"
                        : isHighlighted
                          ? "bg-muted/70 text-foreground"
                          : "hover:bg-muted/50 text-foreground",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{noneLabel}</div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                  </div>
                );
              }

              const sup = opt.data!;
              const isSelected = sup.id === value;
              const rule = findSupplierPolicyRule(sup.name);
              const minAmount = getSupplierMinOrderAmount(sup);

              return (
                <div
                  key={sup.id}
                  onClick={() => {
                    onChange(sup.id, sup);
                    setOpen(false);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={cn(
                    "flex items-center justify-between gap-2 px-3 py-2 rounded-xl cursor-pointer text-xs transition-colors",
                    isSelected
                      ? "bg-emerald-500/15 text-emerald-950 dark:text-emerald-200 font-bold"
                      : isHighlighted
                        ? "bg-muted/70 text-foreground"
                        : "hover:bg-muted/50 text-foreground",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {showCode && sup.code && (
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] py-0 px-1 font-bold text-muted-foreground h-4 shrink-0 bg-muted/40"
                        >
                          {sup.code}
                        </Badge>
                      )}
                      <span className="font-semibold truncate">{sup.name}</span>
                      {minAmount > 0 && (
                        <span className="text-[9.5px] px-1.5 py-0.2 rounded-full font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800 shrink-0">
                          ขั้นต่ำ ฿{minAmount.toLocaleString()}
                        </span>
                      )}
                      {rule?.schedulePattern && (
                        <span className="text-[9.5px] px-1.5 py-0.2 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                          {rule.schedulePattern}
                        </span>
                      )}
                    </div>
                    {(sup.contactPerson || sup.phone || rule?.specialNotes) && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate flex items-center gap-1.5">
                        {sup.contactPerson && <span>ผู้ติดต่อ: {sup.contactPerson}</span>}
                        {sup.contactPerson && sup.phone && <span>•</span>}
                        {sup.phone && <span>โทร: {sup.phone}</span>}
                        {rule?.specialNotes && (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 dark:text-amber-400 truncate max-w-[200px]">
                              {rule.specialNotes}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {isSelected && (
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Summary */}
        <div className="p-2 border-t border-border/70 bg-muted/10 text-[11px] text-muted-foreground flex items-center justify-between px-3">
          <span>ซัพพลายเออร์ที่พบ {filteredSuppliers.length} รายการ</span>
          {(selectedSupplier || isAllSelected || isNoneSelected || search) && (
            <button
              type="button"
              onClick={() => {
                if (search) {
                  setSearch("");
                } else if (allowClear) {
                  onChange(allowAll ? allValue : "", null);
                }
              }}
              className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-semibold"
            >
              {search ? "ล้างการค้นหา" : "ล้างการเลือก"}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
