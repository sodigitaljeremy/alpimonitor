import { computed, type ComputedRef } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * Resolve an i18n message key that points to an array and return it as a
 * typed list. Falls back to an empty array when the key is missing or does
 * not resolve to an array — so callers can render without a guard.
 *
 * Why: vue-i18n's `tm()` returns `unknown`, and several organisms were
 * duplicating the same `Array.isArray` + map dance to consume list-shaped
 * locale data. Centralising it here removes the duplication and confines
 * the type assertion to a single, audited location.
 */
export function useI18nList<T>(key: string): ComputedRef<T[]> {
  const { tm } = useI18n();
  return computed(() => {
    const raw = tm(key);
    return Array.isArray(raw) ? (raw as T[]) : [];
  });
}
