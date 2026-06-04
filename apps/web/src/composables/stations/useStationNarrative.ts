/**
 * On-demand facade for the AI narration of a station/parameter (ADR-012, A5).
 *
 * Unlike the measurements facade, this is NOT backed by the Pinia store: a
 * narrative is a per-drawer, user-triggered enrichment (the "Générer le résumé"
 * button), not shared cross-component state. It owns its own local reactive
 * state and delegates the HTTP call to the api-client. Consumers call
 * `generate()` explicitly — there is no auto-fetch (LLM calls are paid/latent
 * and the sliding window means the server cache rarely hits).
 */

import type {
  NarrativeGrounding,
  NarrativeState,
  NarrativeUnavailableReason,
} from '@alpimonitor/shared';
import { computed, ref, type ComputedRef } from 'vue';

import { api, type ApiError } from '@/lib/api-client';

export interface GenerateNarrativeArgs {
  stationId: string;
  parameter: string;
  from: Date;
  to: Date;
  language?: string;
}

export interface UseStationNarrative {
  /** Business state once a narrative has been requested; null before any call. */
  state: ComputedRef<NarrativeState | null>;
  text: ComputedRef<string | null>;
  reason: ComputedRef<NarrativeUnavailableReason | null>;
  grounding: ComputedRef<NarrativeGrounding | null>;
  isLoading: ComputedRef<boolean>;
  /** Transport/HTTP error (distinct from the business `unavailable` state). */
  error: ComputedRef<ApiError | null>;
  hasRequested: ComputedRef<boolean>;
  generate: (args: GenerateNarrativeArgs) => Promise<void>;
  reset: () => void;
}

export function useStationNarrative(): UseStationNarrative {
  const state = ref<NarrativeState | null>(null);
  const text = ref<string | null>(null);
  const reason = ref<NarrativeUnavailableReason | null>(null);
  const grounding = ref<NarrativeGrounding | null>(null);
  const isLoading = ref(false);
  const error = ref<ApiError | null>(null);
  const hasRequested = ref(false);

  function reset(): void {
    state.value = null;
    text.value = null;
    reason.value = null;
    grounding.value = null;
    isLoading.value = false;
    error.value = null;
    hasRequested.value = false;
  }

  async function generate(args: GenerateNarrativeArgs): Promise<void> {
    isLoading.value = true;
    error.value = null;
    hasRequested.value = true;

    const result = await api.getStationNarrative(args.stationId, {
      parameter: args.parameter,
      from: args.from,
      to: args.to,
      lang: args.language,
    });

    if (result.success) {
      const dto = result.data.data;
      state.value = dto.state;
      text.value = dto.text;
      reason.value = dto.reason;
      grounding.value = dto.grounding;
    } else {
      error.value = result.error;
    }
    isLoading.value = false;
  }

  return {
    state: computed(() => state.value),
    text: computed(() => text.value),
    reason: computed(() => reason.value),
    grounding: computed(() => grounding.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    hasRequested: computed(() => hasRequested.value),
    generate,
    reset,
  };
}
