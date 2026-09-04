import React, { useRef } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { formatDate } from "@/lib/dateFormat";
import { cn } from "@/lib/utils";

export interface ThaiDatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  placeholder?: string;
  id?: string;
  name?: string;
  required?: boolean;
  showIcon?: boolean;
}

export const ThaiDatePicker: React.FC<ThaiDatePickerProps> = ({
  value = "",
  onChange,
  className,
  inputClassName,
  disabled = false,
  min,
  max,
  placeholder = "DD/MM/YYYY",
  id,
  name,
  required,
  showIcon = true,
}) => {
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const displayDate = value ? formatDate(value) : "";

  const handleContainerClick = () => {
    if (disabled) return;
    if (hiddenInputRef.current) {
      if (typeof hiddenInputRef.current.showPicker === "function") {
        try {
          hiddenInputRef.current.showPicker();
          return;
        } catch {
          // fallback
        }
      }
      hiddenInputRef.current.focus();
      hiddenInputRef.current.click();
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className={cn(
        "relative flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer select-none",
        "bg-background text-foreground border-input hover:border-slate-400 dark:hover:border-slate-500",
        "focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500",
        disabled && "opacity-50 cursor-not-allowed bg-muted",
        className,
      )}
    >
      <span
        className={cn(
          "font-mono font-bold text-xs tracking-wide text-current select-none",
          !displayDate && "opacity-60 font-normal",
          inputClassName,
        )}
      >
        {displayDate || placeholder}
      </span>

      {showIcon && (
        <CalendarIcon className="w-4 h-4 text-current opacity-70 hover:opacity-100 transition-opacity shrink-0 pointer-events-none" />
      )}

      {/* Hidden native input for accessible picker popup */}
      <input
        ref={hiddenInputRef}
        type="date"
        id={id}
        name={name}
        value={value || ""}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 pointer-events-auto cursor-pointer w-full h-full -z-0"
        tabIndex={-1}
        aria-label={placeholder}
      />
    </div>
  );
};
