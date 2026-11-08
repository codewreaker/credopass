/**
 * The media sweeper's schedule.
 *
 * **Why it runs in the service and not in CI.** The sweep needs the production
 * `DATABASE_URL` and the bucket credentials. CI is deliberately not given
 * either — `.github/workflows/ci-api.yml` says so in as many words — so a
 * scheduled GitHub Action calling a script was never an option. The service
 * already holds both, and it is the only thing that does.
 *
 * **Why daily rather than the weekly that was asked for.** A timer inside a
 * process is reset by every deploy, so a weekly one in a service that ships
 * more often than weekly would mostly never fire. Daily, plus one run shortly
 * after boot, means it actually happens. Frequency is safe to raise because
 * `ORPHAN_GRACE_MS` — not the schedule — is what protects a recently uploaded
 * image: nothing younger than a week is ever a candidate, so running twice in
 * an hour deletes exactly what running once would.
 *
 * It is best-effort and never fatal. A sweep that throws must not take the API
 * down with it; reclaiming disk is not worth a single failed request.
 */

import * as Storage from '../services/storage';
import { getDatabase } from '../db/client';

/** Long enough after boot that a deploy's first requests are not competing. */
const BOOT_DELAY_MS = 2 * 60 * 1000;
const INTERVAL_MS = 24 * 60 * 60 * 1000;

async function runOnce(): Promise<void> {
  try {
    const result = await Storage.sweepOrphanedMedia(await getDatabase());
    const touched = result.pendingRemoved + result.orphanedRemoved;
    // Silence on a no-op. A line a day saying "deleted nothing" trains people
    // to skip the logs this job exists to be read in.
    if (touched > 0 || result.failed.length > 0) {
      console.log(
        `🧹 media sweep: ${result.orphanedRemoved} orphaned, ${result.pendingRemoved} abandoned, ` +
          `${(result.bytesReclaimed / 1_048_576).toFixed(1)}MB reclaimed` +
          (result.failed.length ? `, ${result.failed.length} failed (will retry)` : '')
      );
    }
  } catch (error) {
    console.error('🧹 media sweep failed (will retry on the next tick):', error);
  }
}

/**
 * Arm the sweeper. Returns a stop function so a test can take it back down.
 *
 * `unref()` on both timers: a pending timer must not be the reason the process
 * refuses to exit on shutdown.
 */
export function startMediaSweep(): () => void {
  const boot = setTimeout(() => void runOnce(), BOOT_DELAY_MS);
  const interval = setInterval(() => void runOnce(), INTERVAL_MS);
  boot.unref?.();
  interval.unref?.();

  return () => {
    clearTimeout(boot);
    clearInterval(interval);
  };
}
