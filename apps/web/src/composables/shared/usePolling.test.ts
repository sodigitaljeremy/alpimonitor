import { effectScope, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePolling } from './usePolling';

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not run fn before the first interval when immediate is false', async () => {
    const fn = vi.fn();
    const scope = effectScope();
    scope.run(() => usePolling(fn, 1000));

    await nextTick();
    expect(fn).toHaveBeenCalledTimes(0);
    scope.stop();
  });

  it('runs fn immediately when immediate is true', async () => {
    const fn = vi.fn();
    const scope = effectScope();
    scope.run(() => usePolling(fn, 1000, { immediate: true }));

    await nextTick();
    expect(fn).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it('runs fn at the given interval', async () => {
    const fn = vi.fn();
    const scope = effectScope();
    scope.run(() => usePolling(fn, 1000));

    await vi.advanceTimersByTimeAsync(1000);
    await nextTick();
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    await nextTick();
    expect(fn).toHaveBeenCalledTimes(2);
    scope.stop();
  });

  it('stops running fn once the enclosing scope disposes', async () => {
    const fn = vi.fn();
    const scope = effectScope();
    scope.run(() => usePolling(fn, 1000));

    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(1);

    scope.stop();

    await vi.advanceTimersByTimeAsync(5000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('is a no-op scheduler when intervalMs is zero', async () => {
    const fn = vi.fn();
    const scope = effectScope();
    scope.run(() => usePolling(fn, 0, { immediate: true }));

    await nextTick();
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(fn).toHaveBeenCalledTimes(1);
    scope.stop();
  });
});
