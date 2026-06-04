import type { NarrationFeatures } from './narration-features.js';

// AI layer — extension A3 (ADR-012). Deterministic prompt builder.
//
// Bump PROMPT_VERSION whenever the prompt changes: it is part of the Insight
// cache key (inputHash), so a new version invalidates old cached narratives
// instead of silently serving text produced by an older instruction set.
export const PROMPT_VERSION = 'narration-v1';

const PARAMETER_LABELS: Record<string, string> = {
  DISCHARGE: 'débit',
  WATER_LEVEL: "niveau d'eau",
  TEMPERATURE: 'température',
  TURBIDITY: 'turbidité',
};

// The system prompt is the grounding contract: the model may ONLY rephrase the
// supplied facts. It must not predict, extrapolate, or invent any number.
function buildSystem(language: string): string {
  return [
    'Tu es un assistant qui rédige un résumé hydrologique factuel.',
    `Réponds dans la langue identifiée par le code "${language}" (par défaut le français).`,
    'Règles STRICTES :',
    "- Utilise UNIQUEMENT les faits chiffrés fournis. N'invente, ne prédis, n'extrapole aucune valeur.",
    '- Toute valeur numérique de ta réponse doit provenir des faits fournis.',
    "- Si les données sont signalées incomplètes (sparse), dis-le et n'affirme pas de tendance ferme.",
    '- Si un statut de seuil est absent (null), ne mentionne aucun franchissement de seuil.',
    '- Sois concis : 1 à 2 phrases, ton neutre, pas de spéculation.',
  ].join('\n');
}

// The user message is a compact, unambiguous fact sheet. Only non-null facts
// are listed so the model is never tempted to fill a blank.
function buildUser(features: NarrationFeatures): string {
  const label = PARAMETER_LABELS[features.parameter] ?? features.parameter;
  const lines: string[] = [
    `Paramètre : ${label} (${features.parameter}), unité : ${features.unit}`,
    `Fenêtre : du ${features.window.from} au ${features.window.to}`,
    `Points de mesure : ${features.completeness.presentPoints} présents / ${features.completeness.expectedPoints} attendus (complétude ${Math.round(features.completeness.ratio * 100)}%${features.completeness.sparse ? ', DONNÉES INCOMPLÈTES' : ''})`,
  ];

  if (features.completeness.largestGapMinutes !== null) {
    lines.push(`Plus grand trou entre mesures : ${features.completeness.largestGapMinutes} min`);
  }
  if (!features.hasData) {
    lines.push('Aucune mesure dans la fenêtre.');
    return lines.join('\n');
  }

  lines.push(`Valeur initiale : ${features.firstValue} ${features.unit}`);
  lines.push(`Valeur finale : ${features.lastValue} ${features.unit}`);
  lines.push(
    `Minimum : ${features.minValue} ${features.unit}, maximum : ${features.maxValue} ${features.unit}`
  );

  if (features.deltaAbs !== null) {
    const pct = features.deltaPct !== null ? ` (${features.deltaPct}%)` : '';
    lines.push(`Variation : ${features.deltaAbs} ${features.unit}${pct}`);
  }
  if (features.trend !== null) {
    lines.push(`Tendance classifiée : ${features.trend}`);
  }
  lines.push(
    features.status !== null
      ? `Statut vs seuils : ${features.status}`
      : 'Statut vs seuils : non disponible (aucun seuil défini)'
  );

  return lines.join('\n');
}

export interface NarrationPrompt {
  system: string;
  user: string;
}

export function buildNarrationPrompt(
  features: NarrationFeatures,
  language: string
): NarrationPrompt {
  return { system: buildSystem(language), user: buildUser(features) };
}
