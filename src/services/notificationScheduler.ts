import { generateExpiryNotifications } from "./notifications";

export interface SchedulerResult {
  generated: number;
  skipped: number;
  expired: number;
  warning: number;
  info: number;
  /** ISO timestamp of when this run's generation finished. */
  ranAt: string;
  /**
   * true if this call did not trigger a new run because one was already in
   * progress -- it resolves to that in-flight run's result instead of
   * starting a second, redundant generateExpiryNotifications() call.
   */
  coalesced: boolean;
}

let inFlight: Promise<SchedulerResult> | null = null;
let lastRunAt: string | null = null;

/**
 * Runs the expiry-notification generation job: calls
 * generateExpiryNotifications() and returns a plain summary of what it did.
 *
 * Concurrency: if a run is already in progress, a second call does NOT
 * start another one -- it is effectively ignored as a new invocation and
 * instead awaits/returns the already-running call's result (marked
 * `coalesced: true`), so callers never have to guess whether their call
 * actually did anything.
 *
 * This function is only ever invoked when something explicitly calls it
 * (directly, via src/lib/store.tsx's runNotificationScheduler(), or from a
 * future scheduled job runner) -- nothing in this module triggers a run on
 * its own, on import, or on a timer.
 */
export async function runNotificationScheduler(): Promise<SchedulerResult> {
  if (inFlight) {
    return inFlight.then((result) => ({ ...result, coalesced: true }));
  }

  const run = (async (): Promise<SchedulerResult> => {
    const summary = await generateExpiryNotifications();
    const ranAt = new Date().toISOString();
    lastRunAt = ranAt;
    return {
      generated: summary.generated,
      skipped: summary.skipped,
      expired: summary.expired,
      warning: summary.warning,
      info: summary.info,
      ranAt,
      coalesced: false,
    };
  })();

  inFlight = run;
  try {
    return await run;
  } finally {
    inFlight = null;
  }
}

/** ISO timestamp of the last completed run, or null if it has never run. */
export function getLastNotificationSchedulerRunAt(): string | null {
  return lastRunAt;
}

/** True while a run is currently in progress. */
export function isNotificationSchedulerRunning(): boolean {
  return inFlight !== null;
}
