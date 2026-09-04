import { supabase } from "@/lib/supabase";

export interface AppNotification {
  id: string;
  branchId?: string | null;
  type: "LOW_STOCK" | "EXPIRY_WARNING" | "EXPIRED" | "FIFO_WARNING" | "CUSTOM";
  severity: "info" | "warning" | "critical";
  itemId?: string | null;
  lotId?: string | null;
  message: string;
  isResolved: boolean;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  isDismissed: boolean;
  dismissedAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface ExpiryNotificationSummary {
  generatedCount: number;
  expiredCount: number;
  warningCount: number;
}

export interface ListNotificationsFilter {
  branchId?: string;
  type?: string;
  isResolved?: boolean;
  isDismissed?: boolean;
}

const rowToNotification = (r: Record<string, unknown>): AppNotification => ({
  id: r.id as string,
  branchId: (r.branch_id as string) ?? null,
  type: r.type as AppNotification["type"],
  severity: (r.severity as AppNotification["severity"]) ?? "info",
  itemId: (r.item_id as string) ?? null,
  lotId: (r.lot_id as string) ?? null,
  message: (r.message as string) ?? "",
  isResolved: (r.is_resolved as boolean) ?? false,
  resolvedAt: (r.resolved_at as string) ?? null,
  resolvedBy: (r.resolved_by as string) ?? null,
  isDismissed: (r.is_dismissed as boolean) ?? false,
  dismissedAt: (r.dismissed_at as string) ?? null,
  createdBy: (r.created_by as string) ?? null,
  createdAt: (r.created_at as string) ?? new Date().toISOString(),
});

export async function listNotifications(
  filter?: ListNotificationsFilter,
): Promise<AppNotification[]> {
  try {
    let query = supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter?.branchId) {
      query = query.eq("branch_id", filter.branchId);
    }
    if (filter?.type) {
      query = query.eq("type", filter.type);
    }
    if (filter?.isResolved !== undefined) {
      query = query.eq("is_resolved", filter.isResolved);
    }
    if (filter?.isDismissed !== undefined) {
      query = query.eq("is_dismissed", filter.isDismissed);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(rowToNotification);
  } catch (err) {
    console.warn("listNotifications error:", err);
    return [];
  }
}

export async function generateExpiryNotifications(): Promise<ExpiryNotificationSummary> {
  let generatedCount = 0;
  let expiredCount = 0;
  let warningCount = 0;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: lots } = await supabase
      .from("inventory_lots")
      .select("*, items(name, expiry_warning_days)")
      .eq("status", "active")
      .gt("qty_remaining", 0)
      .not("expiry_date", "is", null);

    // Query unresolved notifications to prevent creating duplicate alerts
    const { data: existingRows } = await supabase
      .from("notifications")
      .select("lot_id, type")
      .eq("is_resolved", false)
      .eq("is_dismissed", false);

    const existingKeySet = new Set(
      (existingRows ?? []).map(
        (r: { lot_id?: string | null; type?: string }) => `${r.lot_id}_${r.type}`,
      ),
    );

    if (lots && lots.length > 0) {
      for (const lot of lots) {
        if (!lot.expiry_date) continue;

        const expiry = new Date(lot.expiry_date);
        const now = new Date(today);
        const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const warningThreshold = lot.items?.expiry_warning_days ?? 7;

        if (diffDays <= 0) {
          expiredCount++;
          const key = `${lot.id}_EXPIRED`;
          if (!existingKeySet.has(key)) {
            generatedCount++;
            existingKeySet.add(key);
            await supabase.from("notifications").insert({
              branch_id: lot.branch_id,
              type: "EXPIRED",
              severity: "critical",
              item_id: lot.item_id,
              lot_id: lot.id,
              message: `ล็อต ${lot.lot_number || "-"} สินค้า ${lot.items?.name || "วัตถุดิบ"} หมดอายุแล้ว (เมื่อ ${lot.expiry_date})`,
            });
          }
        } else if (diffDays <= warningThreshold) {
          warningCount++;
          const key = `${lot.id}_EXPIRY_WARNING`;
          if (!existingKeySet.has(key)) {
            generatedCount++;
            existingKeySet.add(key);
            await supabase.from("notifications").insert({
              branch_id: lot.branch_id,
              type: "EXPIRY_WARNING",
              severity: "warning",
              item_id: lot.item_id,
              lot_id: lot.id,
              message: `ล็อต ${lot.lot_number || "-"} สินค้า ${lot.items?.name || "วัตถุดิบ"} จะหมดอายุในอีก ${diffDays} วัน (${lot.expiry_date})`,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn("generateExpiryNotifications error:", err);
  }

  return { generatedCount, expiredCount, warningCount };
}

export async function resolveNotification(id: string): Promise<AppNotification> {
  const now = new Date().toISOString();
  try {
    const { data, error } = await supabase
      .from("notifications")
      .update({ is_resolved: true, resolved_at: now })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) throw error;
    return rowToNotification(data);
  } catch (err) {
    console.warn("resolveNotification error:", err);
    return {
      id,
      type: "CUSTOM",
      severity: "info",
      message: "Resolved",
      isResolved: true,
      resolvedAt: now,
      isDismissed: false,
      createdAt: now,
    };
  }
}

export async function dismissNotification(id: string): Promise<AppNotification> {
  const now = new Date().toISOString();
  try {
    const { data, error } = await supabase
      .from("notifications")
      .update({ is_dismissed: true, dismissed_at: now })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) throw error;
    return rowToNotification(data);
  } catch (err) {
    console.warn("dismissNotification error:", err);
    return {
      id,
      type: "CUSTOM",
      severity: "info",
      message: "Dismissed",
      isResolved: false,
      isDismissed: true,
      dismissedAt: now,
      createdAt: now,
    };
  }
}
