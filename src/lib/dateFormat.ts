/**
 * Central Date Formatting Utilities for Hana Procurement System
 *
 * Standard Format: DD/MM/YYYY (Christian Era / ปี ค.ศ., 4 digits, zero-padded)
 * Example: 19/08/2026 (not 19/8/2026, and not 2569)
 */

/**
 * Normalizes any year to Christian Era (ค.ศ. / CE)
 * If year is in Buddhist Era (พ.ศ. > 2400), subtracts 543.
 */
function normalizeYearToCE(year: number): number {
  if (year > 2400) {
    return year - 543;
  }
  return year;
}

/**
 * Formats any Date object, ISO string, timestamp, or date string into DD/MM/YYYY (CE)
 *
 * @example
 * formatDate("2026-08-19") => "19/08/2026"
 * formatDate(new Date(2026, 7, 5)) => "05/08/2026"
 * formatDate("2026-08-05T14:30:00Z") => "05/08/2026"
 * formatDate("2569-08-19") => "19/08/2026"
 * formatDate(null) => "-"
 */
export function formatDate(
  value: Date | string | number | null | undefined,
  fallback = "-",
): string {
  if (!value) return fallback;

  try {
    // If it's a string, check for standard YYYY-MM-DD or YYYY/MM/DD format directly first
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return fallback;

      // Handle simple YYYY-MM-DD or YYYY/MM/DD
      const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
      if (isoMatch) {
        let year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10);
        const day = parseInt(isoMatch[3], 10);

        year = normalizeYearToCE(year);

        const padDay = String(day).padStart(2, "0");
        const padMonth = String(month).padStart(2, "0");
        const padYear = String(year).padStart(4, "0");

        return `${padDay}/${padMonth}/${padYear}`;
      }

      // Handle DD/MM/YYYY or DD-MM-YYYY already formatted
      const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1], 10);
        const month = parseInt(ddmmyyyyMatch[2], 10);
        let year = parseInt(ddmmyyyyMatch[3], 10);

        year = normalizeYearToCE(year);

        const padDay = String(day).padStart(2, "0");
        const padMonth = String(month).padStart(2, "0");
        const padYear = String(year).padStart(4, "0");

        return `${padDay}/${padMonth}/${padYear}`;
      }
    }

    // Fallback to standard JS Date parsing
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) {
      return fallback;
    }

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    let year = d.getFullYear();
    year = normalizeYearToCE(year);
    const padYear = String(year).padStart(4, "0");

    return `${day}/${month}/${padYear}`;
  } catch {
    return fallback;
  }
}

/**
 * Formats any date into DD/MM/YYYY HH:mm (CE)
 *
 * @example
 * formatDateTime("2026-08-19T14:30:00") => "19/08/2026 14:30"
 */
export function formatDateTime(
  value: Date | string | number | null | undefined,
  fallback = "-",
): string {
  if (!value) return fallback;

  try {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) {
      return fallback;
    }

    const datePart = formatDate(d, fallback);
    if (datePart === fallback) return fallback;

    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");

    return `${datePart} ${hours}:${minutes}`;
  } catch {
    return fallback;
  }
}

/**
 * Formats a date range into standard string
 * @example "19/08/2026 - 21/08/2026"
 */
export function formatDateRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
  fallback = "-",
): string {
  const formattedStart = formatDate(start, "");
  const formattedEnd = formatDate(end, "");

  if (formattedStart && formattedEnd) {
    return `${formattedStart} - ${formattedEnd}`;
  }
  if (formattedStart) return formattedStart;
  if (formattedEnd) return formattedEnd;
  return fallback;
}
