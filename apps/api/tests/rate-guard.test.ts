import { describe, expect, it } from 'vitest';

import { createRateGuard } from '../src/ai/chat/rate-guard.js';

// AI layer — extension C4 (ADR-012 D3/D4). The unified guard, proven deterministic:
// the clock and today's cost are injected, so no DB and no real time are involved.

// Mutable clock + cost the test drives explicitly.
function harness(initial: { iso: string; costUsd?: number }) {
  let nowMs = new Date(initial.iso).getTime();
  let costUsd = initial.costUsd ?? 0;
  const guard = createRateGuard({
    now: () => new Date(nowMs),
    getCostUsdToday: async () => costUsd,
  });
  return {
    guard,
    advanceMs: (ms: number) => {
      nowMs += ms;
    },
    setCost: (usd: number) => {
      costUsd = usd;
    },
  };
}

const IP = '203.0.113.7';

describe('rate-guard — cost cap (D4) takes priority, read-only', () => {
  it('allows under the cap, refuses at the cap without consuming a slot', async () => {
    const h = harness({ iso: '2026-06-05T10:00:00.000Z', costUsd: 0.49 });
    expect((await h.guard.check(IP)).ok).toBe(true);

    // Hit the cap: every IP is blocked at once, with cost_cap and a Retry-After
    // pointing at the next UTC day.
    h.setCost(0.5);
    const refused = await h.guard.check(IP);
    expect(refused).toMatchObject({ ok: false, reason: 'cost_cap' });
    if (!refused.ok) expect(refused.retryAfterSec).toBe(14 * 3600); // 10:00 → 24:00 UTC

    // The cap consumed nothing: drop back under it and the minute budget is intact
    // (only the single allowed call above counted).
    h.setCost(0);
    for (let i = 0; i < 4; i++) expect((await h.guard.check(IP)).ok).toBe(true);
    const sixth = await h.guard.check(IP);
    expect(sixth).toMatchObject({ ok: false, reason: 'rate_minute' });
  });
});

describe('rate-guard — per-minute window (D3)', () => {
  it('allows 5 within the minute, refuses the 6th, then resets after the window', async () => {
    const h = harness({ iso: '2026-06-05T10:00:00.000Z' });

    for (let i = 0; i < 5; i++) expect((await h.guard.check(IP)).ok).toBe(true);

    const sixth = await h.guard.check(IP);
    expect(sixth).toMatchObject({ ok: false, reason: 'rate_minute' });
    if (!sixth.ok) expect(sixth.retryAfterSec).toBe(60);

    // Cross the minute boundary → the window resets, requests flow again.
    h.advanceMs(60_000);
    expect((await h.guard.check(IP)).ok).toBe(true);
  });

  it('isolates windows per IP', async () => {
    const h = harness({ iso: '2026-06-05T10:00:00.000Z' });
    for (let i = 0; i < 5; i++) expect((await h.guard.check('ip-a')).ok).toBe(true);
    expect((await h.guard.check('ip-a')).ok).toBe(false);
    // A different IP has its own budget.
    expect((await h.guard.check('ip-b')).ok).toBe(true);
  });
});

describe('rate-guard — per-day window (D3)', () => {
  it('allows 20/day across minutes, refuses the 21st', async () => {
    const h = harness({ iso: '2026-06-05T10:00:00.000Z' });

    // Spread 20 calls over 5 distinct minutes (4 each) to stay under the per-minute
    // cap while exhausting the daily budget.
    let allowed = 0;
    for (let minute = 0; minute < 5; minute++) {
      for (let i = 0; i < 4; i++) {
        if ((await h.guard.check(IP)).ok) allowed++;
      }
      h.advanceMs(60_000);
    }
    expect(allowed).toBe(20);

    const twentyFirst = await h.guard.check(IP);
    expect(twentyFirst).toMatchObject({ ok: false, reason: 'rate_day' });
    if (!twentyFirst.ok) expect(twentyFirst.retryAfterSec).toBeGreaterThan(0);

    // A fresh UTC day clears the daily window.
    h.advanceMs(DAY_FROM('2026-06-05T10:05:00.000Z', '2026-06-06T00:00:00.000Z'));
    expect((await h.guard.check(IP)).ok).toBe(true);
  });
});

// Helper: ms between two ISO instants, for advancing the injected clock across a
// day boundary without Date.now().
function DAY_FROM(fromIso: string, toIso: string): number {
  return new Date(toIso).getTime() - new Date(fromIso).getTime();
}
