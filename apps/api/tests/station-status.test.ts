import { describe, expect, it } from 'vitest';

import {
  STATION_STALE_MINUTES,
  computeMeasurementStatus,
  type ThresholdConfig,
} from '../src/utils/station-status.js';

const NOW = new Date('2026-04-21T12:00:00Z');
const recent = (minutesAgo: number): Date => new Date(NOW.getTime() - minutesAgo * 60_000);

describe('computeMeasurementStatus', () => {
  it('returns OFFLINE when recordedAt is older than the stale threshold', () => {
    const s = computeMeasurementStatus(10, recent(STATION_STALE_MINUTES + 1), null, NOW);
    expect(s).toBe('OFFLINE');
  });

  it('returns NORMAL when recent and no threshold is defined', () => {
    expect(computeMeasurementStatus(10, recent(5), null, NOW)).toBe('NORMAL');
  });

  describe('direction ABOVE', () => {
    const threshold: ThresholdConfig = {
      vigilanceValue: 25,
      alertValue: 40,
      direction: 'ABOVE',
    };

    it('NORMAL below vigilanceValue', () => {
      expect(computeMeasurementStatus(10, recent(5), threshold, NOW)).toBe('NORMAL');
    });

    it('VIGILANCE at vigilanceValue', () => {
      expect(computeMeasurementStatus(25, recent(5), threshold, NOW)).toBe('VIGILANCE');
    });

    it('VIGILANCE between vigilance and alert', () => {
      expect(computeMeasurementStatus(30, recent(5), threshold, NOW)).toBe('VIGILANCE');
    });

    it('ALERT at alertValue', () => {
      expect(computeMeasurementStatus(40, recent(5), threshold, NOW)).toBe('ALERT');
    });

    it('ALERT above alertValue', () => {
      expect(computeMeasurementStatus(100, recent(5), threshold, NOW)).toBe('ALERT');
    });
  });

  describe('direction BELOW', () => {
    const threshold: ThresholdConfig = {
      vigilanceValue: 50,
      alertValue: 10,
      direction: 'BELOW',
    };

    it('NORMAL above vigilanceValue', () => {
      expect(computeMeasurementStatus(80, recent(5), threshold, NOW)).toBe('NORMAL');
    });

    it('VIGILANCE at vigilanceValue', () => {
      expect(computeMeasurementStatus(50, recent(5), threshold, NOW)).toBe('VIGILANCE');
    });

    it('ALERT at alertValue', () => {
      expect(computeMeasurementStatus(10, recent(5), threshold, NOW)).toBe('ALERT');
    });

    it('ALERT below alertValue', () => {
      expect(computeMeasurementStatus(1, recent(5), threshold, NOW)).toBe('ALERT');
    });
  });

  it('OFFLINE wins over ALERT when also stale', () => {
    const threshold: ThresholdConfig = {
      vigilanceValue: 25,
      alertValue: 40,
      direction: 'ABOVE',
    };
    expect(computeMeasurementStatus(100, recent(STATION_STALE_MINUTES + 1), threshold, NOW)).toBe(
      'OFFLINE'
    );
  });
});
