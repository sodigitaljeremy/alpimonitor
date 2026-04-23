import { onScopeDispose } from 'vue';

export interface UsePollingOptions {
  /**
   * Run `fn` once right away (before the first interval tick). Defaults to
   * `false` so the caller decides whether the initial call belongs to
   * mount-time orchestration or to the polling cadence.
   */
  immediate?: boolean;
}

/**
 * Schedule `fn` to run every `intervalMs` until the enclosing effect scope
 * disposes. Binding cleanup to `onScopeDispose` means this works inside
 * Vue components (auto-disposed on unmount) and inside Pinia stores
 * (disposed with the app), without the caller having to wire a
 * `clearInterval` by hand.
 *
 * Deliberately stateless — no `loading`/`error` refs. State belongs to the
 * caller's store or composable. This keeps the polling primitive
 * orthogonal to the work being polled.
 */
export function usePolling(
  fn: () => unknown | Promise<unknown>,
  intervalMs: number,
  options: UsePollingOptions = {}
): void {
  const { immediate = false } = options;

  if (immediate) {
    void fn();
  }

  if (intervalMs <= 0) return;

  let intervalId: ReturnType<typeof setInterval> | null = setInterval(() => {
    void fn();
  }, intervalMs);

  onScopeDispose(() => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  });
}
