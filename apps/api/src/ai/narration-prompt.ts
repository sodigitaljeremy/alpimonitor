import type { NarrationFeatures } from './narration-features.js';

// AI layer — extension A3 (ADR-012). Deterministic prompt builder.
//
// Bump PROMPT_VERSION whenever the prompt changes: it is part of the Insight
// cache key (inputHash), so a new version invalidates old cached narratives
// instead of silently serving text produced by an older instruction set.
export const PROMPT_VERSION = 'narration-v4';

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
    "- Commence par le sens d'évolution du débit, en le nommant explicitement (hausse, baisse ou stabilité).",
    '- Mentionne TOUJOURS la valeur initiale et la valeur finale avec leur unité (ex. « de 118 m³/s à 167 m³/s »).',
    "- Ne cite JAMAIS d'horodatage brut (format ISO comme 2026-06-04T13:00:00Z) ; réfère-toi à la période en langage naturel (ex. « sur les dernières 24 heures »).",
    "- Si les données sont signalées incomplètes (sparse), mentionne-le seulement comme réserve en fin de phrase, et n'affirme pas de tendance ferme.",
    '- Si un statut de seuil est absent (null), ne mentionne aucun franchissement de seuil.',
    '- Sois concis : 1 à 2 phrases, ton neutre, pas de spéculation.',
    "- Réponds en texte brut : pas de Markdown, pas de gras, pas d'astérisques, pas de retours à la ligne multiples.",
  ].join('\n');
}

// The user message is a compact, unambiguous fact sheet. Only non-null facts
// are listed so the model is never tempted to fill a blank.
function buildUser(features: NarrationFeatures): string {
  const label = PARAMETER_LABELS[features.parameter] ?? features.parameter;
  // Duration in hours rather than raw ISO timestamps — the model must phrase the
  // period naturally ("sur les dernières N heures"), never echo ISO strings.
  const durationHours = Math.round(
    (Date.parse(features.window.to) - Date.parse(features.window.from)) / 3_600_000
  );
  const lines: string[] = [
    `Paramètre : ${label} (${features.parameter}), unité : ${features.unit}`,
    `Période analysée : ${durationHours} heures (les plus récentes)`,
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
