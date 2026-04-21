export type Translate = (key: string, params?: Record<string, unknown>) => string;

/**
 * Formats a "minutes ago" duration for a compact card value. `null` means
 * the event has never happened — rendered as a typographic em-dash placeholder
 * via the i18n key, not a word, so the card stays visually balanced.
 */
export function formatMinutesAgo(minutes: number | null, t: Translate): string {
  if (minutes === null) return t('keyMetrics.relativeTime.never');
  if (minutes === 0) return t('keyMetrics.relativeTime.justNow');
  if (minutes < 60) return t('keyMetrics.relativeTime.minutesAgo', { minutes });
  const hours = Math.floor(minutes / 60);
  return t('keyMetrics.relativeTime.hoursAgo', { hours });
}
