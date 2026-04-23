import { effectScope, ref, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useScrollLock } from './useScrollLock';

describe('useScrollLock', () => {
  let scope: ReturnType<typeof effectScope>;

  beforeEach(() => {
    document.body.style.overflow = '';
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
    document.body.style.overflow = '';
  });

  it('sets body overflow to "hidden" when isOpen flips to true', async () => {
    const isOpen = ref(false);
    scope.run(() => useScrollLock(isOpen));
    await nextTick();

    expect(document.body.style.overflow).toBe('');

    isOpen.value = true;
    await nextTick();

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores the previous overflow value when isOpen flips back to false', async () => {
    const isOpen = ref(false);
    // Pre-existing inline style that the lock must preserve on restore.
    document.body.style.overflow = 'auto';

    scope.run(() => useScrollLock(isOpen));
    await nextTick();

    isOpen.value = true;
    await nextTick();
    expect(document.body.style.overflow).toBe('hidden');

    isOpen.value = false;
    await nextTick();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('restores overflow on scope dispose when the drawer unmounts while still open', async () => {
    const isOpen = ref(false);
    document.body.style.overflow = 'scroll';

    scope.run(() => useScrollLock(isOpen));
    isOpen.value = true;
    await nextTick();
    expect(document.body.style.overflow).toBe('hidden');

    scope.stop();

    expect(document.body.style.overflow).toBe('scroll');
  });
});
