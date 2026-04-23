import { effectScope } from 'vue';
import { ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEscapeClose } from './useEscapeClose';

function dispatchKey(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

describe('useEscapeClose', () => {
  let scope: ReturnType<typeof effectScope>;

  beforeEach(() => {
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
  });

  it('calls onClose when Escape is pressed and isOpen is true', () => {
    const onClose = vi.fn();
    const isOpen = ref(true);

    scope.run(() => useEscapeClose(isOpen, onClose));
    dispatchKey('Escape');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when Escape is pressed and isOpen is false', () => {
    const onClose = vi.fn();
    const isOpen = ref(false);

    scope.run(() => useEscapeClose(isOpen, onClose));
    dispatchKey('Escape');

    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores non-Escape keys even when isOpen is true', () => {
    const onClose = vi.fn();
    const isOpen = ref(true);

    scope.run(() => useEscapeClose(isOpen, onClose));
    dispatchKey('Enter');
    dispatchKey('ArrowDown');
    dispatchKey(' ');

    expect(onClose).not.toHaveBeenCalled();
  });
});
