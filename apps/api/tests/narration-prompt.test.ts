import { describe, expect, it } from 'vitest';

import { computeNarrationFeatures } from '../src/ai/narration-features.js';
import { PROMPT_VERSION, buildNarrationPrompt } from '../src/ai/narration-prompt.js';

const FROM = '2026-06-01T00:00:00.000Z';
const TO = '2026-06-02T00:00:00.000Z';

function features(
  points: { t: string; v: number }[],
  threshold?: {
    vigilanceValue: number;
    alertValue: number;
    direction: 'ABOVE' | 'BELOW';
  }
) {
  return computeNarrationFeatures({
    parameter: 'DISCHARGE',
    unit: 'm³/s',
    windowFrom: FROM,
    windowTo: TO,
    points,
    expectedIntervalMinutes: 10,
    threshold,
  });
}

describe('buildNarrationPrompt', () => {
  it('exposes a stable prompt version (cache-key component)', () => {
    expect(PROMPT_VERSION).toBe('narration-v1');
  });

  it('embeds the requested language code in the system prompt', () => {
    const p = buildNarrationPrompt(features([{ t: FROM, v: 1 }]), 'en');
    expect(p.system).toContain('"en"');
    expect(p.system).toContain('UNIQUEMENT les faits');
  });

  it('lists grounded facts (label, values, delta) for a populated window', () => {
    const p = buildNarrationPrompt(
      features([
        { t: FROM, v: 10 },
        { t: '2026-06-01T23:50:00.000Z', v: 30 },
      ]),
      'fr'
    );
    expect(p.user).toContain('débit');
    expect(p.user).toContain('Valeur initiale : 10');
    expect(p.user).toContain('Valeur finale : 30');
    expect(p.user).toContain('Variation : 20');
    expect(p.user).toContain('RISING');
  });

  it('flags incomplete data so the model will not assert a firm trend', () => {
    const p = buildNarrationPrompt(features([{ t: FROM, v: 5 }]), 'fr');
    expect(p.user).toContain('DONNÉES INCOMPLÈTES');
  });

  it('states "no threshold" rather than inventing a status', () => {
    const p = buildNarrationPrompt(
      features([
        { t: FROM, v: 10 },
        { t: '2026-06-01T23:50:00.000Z', v: 30 },
      ]),
      'fr'
    );
    expect(p.user).toContain('non disponible (aucun seuil défini)');
  });

  it('reports a threshold status when one is provided', () => {
    const p = buildNarrationPrompt(
      features(
        [
          { t: FROM, v: 10 },
          { t: '2026-06-01T23:50:00.000Z', v: 90 },
        ],
        { vigilanceValue: 40, alertValue: 80, direction: 'ABOVE' }
      ),
      'fr'
    );
    expect(p.user).toContain('Statut vs seuils : ALERT');
  });

  it('says there is no measurement for an empty window', () => {
    const p = buildNarrationPrompt(features([]), 'fr');
    expect(p.user).toContain('Aucune mesure');
  });
});
