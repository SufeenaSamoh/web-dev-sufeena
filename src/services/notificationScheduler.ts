import { generateExpiryNotifications, type ExpiryNotificationSummary } from "./notifications";

export interface SchedulerResult {
  executedAt: string;
  expirySummary: ExpiryNotificationSummary;
  status: "success" | "partial" | "failed";
}

export async function runNotificationScheduler(): Promise<SchedulerResult> {
  const executedAt = new Date().toISOString();
  try {
    const expirySummary = await generateExpiryNotifications();
    return {
      executedAt,
      expirySummary,
      status: "success",
    };
  } catch (err) {
    console.warn("runNotificationScheduler error:", err);
    return {
      executedAt,
      expirySummary: { generatedCount: 0, expiredCount: 0, warningCount: 0 },
      status: "failed",
    };
  }
}
