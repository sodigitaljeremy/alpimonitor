// AI layer — extension C4 (ADR-012 D3/D4). The single, testable guard in front of
// the public chat endpoint. It unifies TWO concerns that both protect the LLM
// budget, in a deliberate order:
//
//   1. Daily cost cap (D4) FIRST. Read-only against the SAME observability source
//      as /ai/status (today's total costUsd across narration A + chat C). At or
//      above the cap → refuse 'cost_cap' WITHOUT consuming a request slot and
//      WITHOUT emitting any LLM call. The cap is a circuit breaker, not a quota.
//   2. Per-IP rate limit (D3), home-made fixed windows: 5/min and 20/day. A slot
//      is consumed ONLY when the request is allowed; a refusal never increments.
//
// Everything time-dependent is injected (now, getCostUsdToday), so the whole guard
// is deterministic in tests with zero DB and zero clock flakiness — mirroring the
// chat service's injected clock. No @fastify/rate-limit dependency (consistent
// with the "rate limiting non wired" non-scope: this is a targeted, defensible
// in-house implementation).

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export interface RateGuardLimits {
  // Daily ceiling on total LLM cost (narration + chat). Default $0.50.
  costCapUsd: number;
  // Per-IP fixed-window quotas. Defaults: 5/min, 20/day.
  perMinute: number;
  perDay: number;
}

const DEFAULT_LIMITS: RateGuardLimits = {
  costCapUsd: 0.5,
  perMinute: 5,
  perDay: 20,
};

export type RateGuardRefusalReason = 'cost_cap' | 'rate_minute' | 'rate_day';

export type RateGuardDecision =
  | { ok: true }
  | { ok: false; reason: RateGuardRefusalReason; retryAfterSec: number };

export interface RateGuardDeps {
  // Injected clock; resolved once per check().
  now: () => Date;
  // Today's total LLM cost in USD, read-only (wired to the D observability source
  // in production, a stub in tests). Read BEFORE any slot is consumed.
  getCostUsdToday: () => Promise<number>;
  limits?: Partial<RateGuardLimits>;
}

export interface RateGuard {
  check(ip: string): Promise<RateGuardDecision>;
}

// Per-IP counters for two clock-aligned fixed windows. windowStart marks the
// floored boundary the count belongs to; a check in a newer window resets it.
interface IpWindows {
  minuteStart: number;
  minuteCount: number;
  dayStart: number;
  dayCount: number;
}

function floorToMinute(ms: number): number {
  return Math.floor(ms / MINUTE_MS) * MINUTE_MS;
}

function startOfUtcDay(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

export function createRateGuard(deps: RateGuardDeps): RateGuard {
  const limits: RateGuardLimits = { ...DEFAULT_LIMITS, ...deps.limits };
  const byIp = new Map<string, IpWindows>();

  // Drop IPs with no activity in the current UTC day. The day window is the
  // longest-lived, so an entry whose day window has rolled over has both windows
  // expired — safe to forget, keeping the map bounded by *recently active* IPs.
  function purgeExpired(dayStart: number): void {
    for (const [ip, w] of byIp) {
      if (w.dayStart !== dayStart) byIp.delete(ip);
    }
  }

  return {
    async check(ip: string): Promise<RateGuardDecision> {
      const nowMs = deps.now().getTime();
      const minuteStart = floorToMinute(nowMs);
      const dayStart = startOfUtcDay(nowMs);

      // 1. Cost cap first — read-only, consumes nothing, blocks every IP at once.
      const costUsdToday = await deps.getCostUsdToday();
      if (costUsdToday >= limits.costCapUsd) {
        const retryAfterSec = Math.ceil((dayStart + DAY_MS - nowMs) / 1000);
        return { ok: false, reason: 'cost_cap', retryAfterSec };
      }

      purgeExpired(dayStart);

      // Resolve (and lazily roll over) this IP's two windows.
      let w = byIp.get(ip);
      if (!w) {
        w = { minuteStart, minuteCount: 0, dayStart, dayCount: 0 };
        byIp.set(ip, w);
      }
      if (w.minuteStart !== minuteStart) {
        w.minuteStart = minuteStart;
        w.minuteCount = 0;
      }
      if (w.dayStart !== dayStart) {
        w.dayStart = dayStart;
        w.dayCount = 0;
      }

      // 2. Rate limits — minute then day. Refuse BEFORE consuming a slot.
      if (w.minuteCount >= limits.perMinute) {
        const retryAfterSec = Math.ceil((minuteStart + MINUTE_MS - nowMs) / 1000);
        return { ok: false, reason: 'rate_minute', retryAfterSec };
      }
      if (w.dayCount >= limits.perDay) {
        const retryAfterSec = Math.ceil((dayStart + DAY_MS - nowMs) / 1000);
        return { ok: false, reason: 'rate_day', retryAfterSec };
      }

      // Allowed → consume one slot in both windows.
      w.minuteCount += 1;
      w.dayCount += 1;
      return { ok: true };
    },
  };
}
