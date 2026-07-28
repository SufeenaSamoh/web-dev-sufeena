import { supabase } from "@/lib/supabase";
import type { UUID } from "@/lib/types";

export type NotificationType =
  "LOW_STOCK" | "EXPIRY_WARNING" | "EXPIRED" | "FIFO_WARNING" | "CUSTOM";
export type NotificationSeverity = "info" | "warning" | "critical";

export interface AppNotification {
  id: UUID;
  branchId: UUID | null;
  type: NotificationType;
  severity: NotificationSeverity;
  itemId: UUID | null;
  lotId: UUID | null;
  message: string;
  isResolved: boolean;
  resolvedAt: string | null;
  isDismissed: boolean;
  dismissedAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  branch_id: string | null;
  type: NotificationType;
  severity: NotificationSeverity;
  item_id: string | null;
  lot_id: string | null;
  message: string;
  is_resolved: boolean;
  resolved_at: string | null;
  is_dismissed: boolean;
  dismissed_at: string | null;
  created_at: string;
}

function rowToNotification(r: NotificationRow): AppNotification {
  return {
    id: r.id,
    branchId: r.branch_id,
    type: r.type,
    severity: r.severity,
    itemId: r.item_id,
    lotId: r.lot_id,
    message: r.message,
    isResolved: r.is_resolved,
    resolvedAt: r.resolved_at,
    isDismissed: r.is_dismissed,
    dismissedAt: r.dismissed_at,
    createdAt: r.created_at,
  };
}

// ---------------------------------------------------------------------------
// generateExpiryNotifications()
// ---------------------------------------------------------------------------

/** Fallback used when an item has no expiry_warning_days of its own. */
const FALLBACK_WARNING_DAYS = 7;
/** "Upcoming" horizon, per the Expiry Notification Engine spec. */
const UPCOMING_WINDOW_DAYS = 30;

type ExpiryLevel = "expired" | "expires_today" | "warning" | "upcoming";

interface LevelResult {
  level: ExpiryLevel;
  type: NotificationType;
  severity: NotificationSeverity;
}

/**
 * Classifies a lot's days-until-expiry into one of the four levels from the
 * spec. The notifications table's `type` column only has EXPIRED and
 * EXPIRY_WARNING as expiry-related values (see 006_notifications.sql), so
 * Expired/Expires Today both map to type EXPIRED (both severity critical),
 * and Warning/Upcoming both map to type EXPIRY_WARNING (severity warning vs
 * info) -- the four levels stay distinguishable via `severity` and the
 * generated `message`.
 */
function classify(daysUntilExpiry: number, warningDays: number): LevelResult | null {
  if (daysUntilExpiry < 0) return { level: "expired", type: "EXPIRED", severity: "critical" };
  if (daysUntilExpiry === 0)
    return { level: "expires_today", type: "EXPIRED", severity: "critical" };
  if (daysUntilExpiry <= warningDays) {
    return { level: "warning", type: "EXPIRY_WARNING", severity: "warning" };
  }
  if (daysUntilExpiry <= UPCOMING_WINDOW_DAYS) {
    return { level: "upcoming", type: "EXPIRY_WARNING", severity: "info" };
  }
  return null;
}

function daysBetween(fromUtcMidnight: number, toUtcMidnight: number): number {
  return Math.round((toUtcMidnight - fromUtcMidnight) / 86_400_000);
}

function utcMidnight(dateStr: string): number {
  const [y, m, d] = dateStr.split("T")[0].split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function levelMessage(
  level: ExpiryLevel,
  itemLabel: string,
  lotNumber: string,
  expiryDate: string,
  daysUntilExpiry: number,
): string {
  switch (level) {
    case "expired":
      return `${itemLabel} — lot ${lotNumber} expired on ${expiryDate} (${Math.abs(daysUntilExpiry)} day(s) ago).`;
    case "expires_today":
      return `${itemLabel} — lot ${lotNumber} expires today (${expiryDate}).`;
    case "warning":
      return `${itemLabel} — lot ${lotNumber} expires in ${daysUntilExpiry} day(s) (${expiryDate}).`;
    case "upcoming":
      return `${itemLabel} — lot ${lotNumber} is expiring soon: ${daysUntilExpiry} day(s) left (${expiryDate}).`;
  }
}

interface CandidateLotRow {
  id: string;
  lot_number: string;
  branch_id: string | null;
  item_id: string;
  expiry_date: string;
  items: {
    name: string;
    code: string | null;
    has_expiry: boolean;
    expiry_warning_days: number | null;
  } | null;
}

async function getDefaultWarningDays(): Promise<number> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "default_expiry_warning_days")
    .maybeSingle();
  if (error || !data) return FALLBACK_WARNING_DAYS;
  const parsed = Number(data.value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_WARNING_DAYS;
}

async function isExpiryNotificationEnabled(): Promise<boolean> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "expiry_notification_enabled")
    .maybeSingle();
  if (error || !data) return true; // default on if the setting row is missing
  return data.value === true || data.value === "true";
}

/**
 * Structured result of a generation run. `expired`/`warning`/`info` count
 * newly created notifications by severity (critical/warning/info -- named
 * "expired" here rather than "critical" to match the Expired + Expires
 * Today levels, which both produce severity 'critical'). `skipped` counts
 * lots that qualified for a notification but already had one unresolved
 * for the same (lot, type) -- see the duplicate-check below.
 */
export interface ExpiryNotificationSummary {
  created: AppNotification[];
  generated: number;
  skipped: number;
  expired: number;
  warning: number;
  info: number;
}

const EMPTY_SUMMARY: ExpiryNotificationSummary = {
  created: [],
  generated: 0,
  skipped: 0,
  expired: 0,
  warning: 0,
  info: 0,
};

/**
 * Scans every consumable lot (qty_remaining > 0, status != 'expired') whose
 * item has has_expiry = true, classifies each one against today's date,
 * and inserts a public.notifications row for any lot that doesn't already
 * have an unresolved notification of the same type. Does not touch FEFO
 * allocation (public.fn_consume_fefo) in any way -- this only reads
 * inventory_lots/items and writes to notifications.
 *
 * Intended to be invoked periodically (e.g. from
 * src/services/notificationScheduler.ts) rather than on every page load;
 * there is no UI wiring here by design.
 */
export async function generateExpiryNotifications(): Promise<ExpiryNotificationSummary> {
  if (!(await isExpiryNotificationEnabled())) return EMPTY_SUMMARY;

  const defaultWarningDays = await getDefaultWarningDays();

  const { data: lotRows, error: lotsError } = await supabase
    .from("inventory_lots")
    .select(
      "id, lot_number, branch_id, item_id, expiry_date, items!inner(name, code, has_expiry, expiry_warning_days)",
    )
    .gt("qty_remaining", 0)
    .neq("status", "expired")
    .not("expiry_date", "is", null)
    .eq("items.has_expiry", true);
  if (lotsError) throw lotsError;

  const lots = (lotRows ?? []) as unknown as CandidateLotRow[];
  if (lots.length === 0) return EMPTY_SUMMARY;

  const today = utcMidnight(new Date().toISOString());

  interface Candidate {
    lotId: string;
    branchId: string | null;
    itemId: string;
    type: NotificationType;
    severity: NotificationSeverity;
    message: string;
  }

  const candidates: Candidate[] = [];
  for (const lot of lots) {
    if (!lot.items || !lot.expiry_date) continue;
    const warningDays = lot.items.expiry_warning_days ?? defaultWarningDays;
    const daysUntilExpiry = daysBetween(today, utcMidnight(lot.expiry_date));
    const result = classify(daysUntilExpiry, warningDays);
    if (!result) continue;

    const itemLabel = lot.items.code ? `${lot.items.code} · ${lot.items.name}` : lot.items.name;
    candidates.push({
      lotId: lot.id,
      branchId: lot.branch_id,
      itemId: lot.item_id,
      type: result.type,
      severity: result.severity,
      message: levelMessage(
        result.level,
        itemLabel,
        lot.lot_number,
        lot.expiry_date,
        daysUntilExpiry,
      ),
    });
  }
  if (candidates.length === 0) return EMPTY_SUMMARY;

  // Duplicate check: skip any (lot_id, type) pair that already has an
  // unresolved notification.
  const lotIds = [...new Set(candidates.map((c) => c.lotId))];
  const { data: existingRows, error: existingError } = await supabase
    .from("notifications")
    .select("lot_id, type")
    .in("lot_id", lotIds)
    .eq("is_resolved", false);
  if (existingError) throw existingError;

  const existingKeys = new Set((existingRows ?? []).map((r) => `${r.lot_id}:${r.type}`));
  const toInsert = candidates.filter((c) => !existingKeys.has(`${c.lotId}:${c.type}`));
  const skipped = candidates.length - toInsert.length;
  if (toInsert.length === 0) {
    return { ...EMPTY_SUMMARY, skipped };
  }

  const nowIso = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from("notifications")
    .insert(
      toInsert.map((c) => ({
        branch_id: c.branchId,
        item_id: c.itemId,
        lot_id: c.lotId,
        type: c.type,
        severity: c.severity,
        message: c.message,
        is_resolved: false,
        created_at: nowIso,
      })),
    )
    .select();
  if (insertError) throw insertError;

  const created = (inserted ?? []).map((r) => rowToNotification(r as NotificationRow));
  const bySeverity = { expired: 0, warning: 0, info: 0 };
  for (const n of created) {
    if (n.severity === "critical") bySeverity.expired += 1;
    else if (n.severity === "warning") bySeverity.warning += 1;
    else bySeverity.info += 1;
  }

  return {
    created,
    generated: created.length,
    skipped,
    expired: bySeverity.expired,
    warning: bySeverity.warning,
    info: bySeverity.info,
  };
}

// ---------------------------------------------------------------------------
// listNotifications() / resolveNotification() / dismissNotification()
// ---------------------------------------------------------------------------

export interface ListNotificationsFilter {
  isResolved?: boolean;
  isDismissed?: boolean;
  type?: NotificationType;
  severity?: NotificationSeverity;
  itemId?: UUID;
  lotId?: UUID;
  branchId?: UUID;
}

/** Lists notifications, newest first. With no filter, returns every row. */
export async function listNotifications(
  filter: ListNotificationsFilter = {},
): Promise<AppNotification[]> {
  let query = supabase.from("notifications").select("*").order("created_at", { ascending: false });

  if (filter.isResolved !== undefined) query = query.eq("is_resolved", filter.isResolved);
  if (filter.isDismissed !== undefined) query = query.eq("is_dismissed", filter.isDismissed);
  if (filter.type) query = query.eq("type", filter.type);
  if (filter.severity) query = query.eq("severity", filter.severity);
  if (filter.itemId) query = query.eq("item_id", filter.itemId);
  if (filter.lotId) query = query.eq("lot_id", filter.lotId);
  if (filter.branchId) query = query.eq("branch_id", filter.branchId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => rowToNotification(r as NotificationRow));
}

/** Marks a notification as resolved (the underlying issue was addressed). */
export async function resolveNotification(id: UUID): Promise<AppNotification> {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToNotification(data as NotificationRow);
}

/** Marks a notification as dismissed (hidden from view, independent of resolution). */
export async function dismissNotification(id: UUID): Promise<AppNotification> {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToNotification(data as NotificationRow);
}
