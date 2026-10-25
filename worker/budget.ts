// Site-wide daily cap on Workers AI calls (/api/explain). EXPLAIN_LIMITER is per
// IP, and any new query string is a new cache key, so without this many IPs or
// varied links could run the 70B model without end. KV counters are not atomic,
// so the cap is soft: a burst can overshoot by a few calls. Every attempt counts,
// failed or not (a failed call is billed too); cache hits never reach it.
import type { KvLike } from './cache';

export const DEFAULT_DAILY_AI_CAP = 100;
const BUDGET_TTL = 2 * 24 * 60 * 60;

/** `budget:ai:<YYYY-MM-DD>` for the UTC day of `now`. */
export const budgetKey = (now: Date): string => `budget:ai:${now.toISOString().slice(0, 10)}`;

/** `DAILY_AI_CAP` as a whole number; anything else falls back to the default. "0" switches live AI off. */
export function dailyCap(raw: string | undefined): number {
  return raw !== undefined && /^\d+$/.test(raw.trim()) ? Number(raw) : DEFAULT_DAILY_AI_CAP;
}

/**
 * Takes one unit of today's budget: true if the model may be called. False when
 * the budget is spent, or when there is no KV to count in (PR Previews fail
 * closed, so a public preview URL cannot spend without limit).
 */
export async function takeBudget(kv: KvLike | undefined, cap: number, now = new Date()): Promise<boolean> {
  if (!kv || cap <= 0) return false;
  const key = budgetKey(now);
  let used = 0;
  try {
    const raw = await kv.get(key, 'json');
    used = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
  } catch {
    console.error('explain: budget read failed');
  }
  if (used >= cap) return false;
  await kv.put(key, String(used + 1), { expirationTtl: BUDGET_TTL }).catch(() => console.error('explain: budget write failed'));
  return true;
}
