import { useEventListener } from '@vueuse/core';
import type { Ref } from 'vue';

/**
 * Call `onClose` when the user presses Escape, but only while `isOpen`
 * is `true`. Deliberately a no-op otherwise — this composable is safe
 * to mount unconditionally at the top of a setup block; it won't fight
 * other Escape handlers on the page when the owning dialog is closed.
 *
 * Cleanup is wired through @vueuse/core's `useEventListener`, which
 * auto-disposes with the enclosing scope (Vue component unmount or
 * Pinia store teardown).
 */
export function useEscapeClose(isOpen: Ref<boolean>, onClose: () => void): void {
  useEventListener(window, 'keydown', (evt: KeyboardEvent) => {
    if (evt.key !== 'Escape') return;
    if (!isOpen.value) return;
    onClose();
  });
}
