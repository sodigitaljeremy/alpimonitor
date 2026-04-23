import { onScopeDispose, watch, type Ref } from 'vue';

/**
 * Lock body scroll while `isOpen` is `true` by writing
 * `document.body.style.overflow = 'hidden'` — and restore the previous
 * inline value when it flips back, or when the enclosing scope disposes.
 *
 * We mutate the inline style on `body` rather than a class because no
 * other rule in the cascade covers this case and we want the restore to
 * be precise: whatever value was on `body.style.overflow` before we
 * locked is what we put back. Apps that never set it inline just see
 * the empty string — which is what the cascade already gave them.
 *
 * Single-consumer only. Two consumers mounting this simultaneously would
 * race on the `previousOverflow` snapshot: the second would capture
 * `'hidden'` (already set by the first) and restore it on close, leaving
 * the body locked. AlpiMonitor has one drawer today — if future
 * drawers/overlays stack, this needs a module-scoped ref-count or a
 * single coordinator. See ADR-010.
 */
export function useScrollLock(isOpen: Ref<boolean>): void {
  if (typeof document === 'undefined') return;

  let previousOverflow: string | null = null;

  watch(
    isOpen,
    (open) => {
      if (open) {
        if (previousOverflow === null) {
          previousOverflow = document.body.style.overflow;
        }
        document.body.style.overflow = 'hidden';
      } else if (previousOverflow !== null) {
        document.body.style.overflow = previousOverflow;
        previousOverflow = null;
      }
    },
    { immediate: true }
  );

  onScopeDispose(() => {
    if (previousOverflow !== null) {
      document.body.style.overflow = previousOverflow;
      previousOverflow = null;
    }
  });
}
