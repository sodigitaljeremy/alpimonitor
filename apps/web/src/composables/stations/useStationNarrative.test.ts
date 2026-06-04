import type { StationNarrativeDTO } from '@alpimonitor/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/lib/api-client';

import { useStationNarrative } from './useStationNarrative';

function dto(overrides: Partial<StationNarrativeDTO> = {}): StationNarrativeDTO {
  return {
    stationId: 's1',
    parameter: 'DISCHARGE',
    language: 'fr',
    window: { from: '2026-06-01T00:00:00.000Z', to: '2026-06-02T00:00:00.000Z' },
    state: 'generated',
    reason: null,
    text: 'Le débit a augmenté.',
    generatedAt: '2026-06-02T00:00:00.000Z',
    grounding: {
      trend: 'RISING',
      deltaAbs: 20,
      deltaPct: 200,
      status: 'NORMAL',
      completeness: {
        expectedPoints: 144,
        presentPoints: 140,
        ratio: 0.97,
        sparse: false,
        largestGapMinutes: 10,
      },
    },
    ...overrides,
  };
}

const ARGS = {
  stationId: 's1',
  parameter: 'DISCHARGE',
  from: new Date('2026-06-01T00:00:00.000Z'),
  to: new Date('2026-06-02T00:00:00.000Z'),
};

describe('useStationNarrative', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes a generated narrative with grounding on success', async () => {
    vi.spyOn(api, 'getStationNarrative').mockResolvedValue({
      success: true,
      data: { data: dto() },
    });

    const n = useStationNarrative();
    await n.generate(ARGS);

    expect(n.state.value).toBe('generated');
    expect(n.text.value).toBe('Le débit a augmenté.');
    expect(n.grounding.value?.trend).toBe('RISING');
    expect(n.isLoading.value).toBe(false);
    expect(n.error.value).toBeNull();
    expect(n.hasRequested.value).toBe(true);
  });

  it('passes through an unavailable business state with its reason', async () => {
    vi.spyOn(api, 'getStationNarrative').mockResolvedValue({
      success: true,
      data: { data: dto({ state: 'unavailable', reason: 'insufficient_data', text: null }) },
    });

    const n = useStationNarrative();
    await n.generate(ARGS);

    expect(n.state.value).toBe('unavailable');
    expect(n.reason.value).toBe('insufficient_data');
    expect(n.text.value).toBeNull();
    expect(n.error.value).toBeNull();
  });

  it('records a transport error without setting a business state', async () => {
    vi.spyOn(api, 'getStationNarrative').mockResolvedValue({
      success: false,
      error: { kind: 'http', status: 500, statusText: 'Server Error', path: '/x' },
    });

    const n = useStationNarrative();
    await n.generate(ARGS);

    expect(n.error.value?.kind).toBe('http');
    expect(n.state.value).toBeNull();
    expect(n.isLoading.value).toBe(false);
  });

  it('forwards the language argument to the api client', async () => {
    const spy = vi.spyOn(api, 'getStationNarrative').mockResolvedValue({
      success: true,
      data: { data: dto() },
    });

    const n = useStationNarrative();
    await n.generate({ ...ARGS, language: 'en' });

    expect(spy).toHaveBeenCalledWith('s1', expect.objectContaining({ lang: 'en' }));
  });

  it('reset() clears all state', async () => {
    vi.spyOn(api, 'getStationNarrative').mockResolvedValue({
      success: true,
      data: { data: dto() },
    });

    const n = useStationNarrative();
    await n.generate(ARGS);
    n.reset();

    expect(n.state.value).toBeNull();
    expect(n.text.value).toBeNull();
    expect(n.grounding.value).toBeNull();
    expect(n.hasRequested.value).toBe(false);
    expect(n.error.value).toBeNull();
  });
});
