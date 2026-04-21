import { describe, expect, it } from 'vitest';

import { formatMinutesAgo, type Translate } from './relativeTime';

// Mimic vue-i18n's t(key, params) signature. Returns a deterministic string
// that encodes both the key and the params so assertions can match the
// branch taken without depending on the real French labels.
const t: Translate = (key, params) => {
  if (params) return `${key}|${JSON.stringify(params)}`;
  return key;
};

describe('formatMinutesAgo', () => {
  it('renders null as the "never" token', () => {
    expect(formatMinutesAgo(null, t)).toBe('keyMetrics.relativeTime.never');
  });

  it('renders 0 as "just now" rather than "0 min ago"', () => {
    expect(formatMinutesAgo(0, t)).toBe('keyMetrics.relativeTime.justNow');
  });

  it('uses the minutes branch for 1..59', () => {
    expect(formatMinutesAgo(1, t)).toBe('keyMetrics.relativeTime.minutesAgo|{"minutes":1}');
    expect(formatMinutesAgo(59, t)).toBe('keyMetrics.relativeTime.minutesAgo|{"minutes":59}');
  });

  it('crosses over to the hours branch at 60 and floors', () => {
    expect(formatMinutesAgo(60, t)).toBe('keyMetrics.relativeTime.hoursAgo|{"hours":1}');
    expect(formatMinutesAgo(119, t)).toBe('keyMetrics.relativeTime.hoursAgo|{"hours":1}');
    expect(formatMinutesAgo(120, t)).toBe('keyMetrics.relativeTime.hoursAgo|{"hours":2}');
  });

  it('handles large values without overflow or scientific notation', () => {
    expect(formatMinutesAgo(1440, t)).toBe('keyMetrics.relativeTime.hoursAgo|{"hours":24}');
  });
});
