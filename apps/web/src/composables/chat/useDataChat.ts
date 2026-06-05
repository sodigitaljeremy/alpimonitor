/**
 * On-demand facade for the data chat (ADR-012, C6 / D7).
 *
 * Like useStationNarrative — and unlike the measurements/alerts facades — this
 * is NOT backed by a Pinia store: a chat thread is local, per-panel state, not
 * shared cross-component data. It owns its own reactive state and delegates the
 * HTTP call to the api-client.
 *
 * The backend is STATELESS and SINGLE-TURN (each POST /ask is independent — no
 * server-side history). The `messages` ref is purely a client-side transcript of
 * the current session so the panel can render the question/answer thread; we do
 * NOT replay it to the server.
 *
 * Guard refusals are mapped to honest, user-facing reasons (429 → too many
 * requests, 503 → AI unavailable, 400 → bad request) rather than leaking raw
 * HTTP shapes into the UI.
 */

import type { AskToolUse } from '@alpimonitor/shared';
import { computed, ref, type ComputedRef } from 'vue';

import { api, type ApiError } from '@/lib/api-client';

export interface ChatUserMessage {
  id: number;
  role: 'user';
  content: string;
}

export interface ChatAssistantMessage {
  id: number;
  role: 'assistant';
  answer: string;
  // Honest trace of which whitelisted tools ran — surfaced discreetly in the UI.
  used: AskToolUse[];
  language: string;
}

export type ChatMessage = ChatUserMessage | ChatAssistantMessage;

// The failure modes the panel must distinguish, each with a translatable reason.
export type ChatErrorReason = 'rate_limited' | 'ai_unavailable' | 'bad_request' | 'unknown';

export interface ChatError {
  reason: ChatErrorReason;
  // The underlying transport error, kept for logging/telemetry.
  cause: ApiError;
}

export interface UseDataChat {
  messages: ComputedRef<ChatMessage[]>;
  isLoading: ComputedRef<boolean>;
  error: ComputedRef<ChatError | null>;
  hasMessages: ComputedRef<boolean>;
  ask: (question: string, language?: string) => Promise<void>;
  reset: () => void;
}

// Map a transport ApiError onto a user-facing chat reason. The guards (C4/C5)
// answer with specific HTTP statuses; anything else is an honest 'unknown'.
function toChatError(error: ApiError): ChatError {
  if (error.kind === 'http') {
    if (error.status === 429) return { reason: 'rate_limited', cause: error };
    if (error.status === 503) return { reason: 'ai_unavailable', cause: error };
    if (error.status === 400) return { reason: 'bad_request', cause: error };
  }
  return { reason: 'unknown', cause: error };
}

export function useDataChat(): UseDataChat {
  const messages = ref<ChatMessage[]>([]);
  const isLoading = ref(false);
  const error = ref<ChatError | null>(null);
  // Monotonic id per facade instance — stable keys without Date/Math.random.
  let nextId = 0;

  function reset(): void {
    messages.value = [];
    isLoading.value = false;
    error.value = null;
    nextId = 0;
  }

  async function ask(question: string, language?: string): Promise<void> {
    const trimmed = question.trim();
    // Never spend an LLM call on an empty prompt; the API would 400 anyway.
    if (trimmed === '' || isLoading.value) return;

    error.value = null;
    isLoading.value = true;
    // Show the question immediately; the answer (or error) follows.
    messages.value.push({ id: nextId++, role: 'user', content: trimmed });

    const result = await api.ask(trimmed, language);

    if (result.success) {
      const dto = result.data;
      messages.value.push({
        id: nextId++,
        role: 'assistant',
        answer: dto.answer,
        used: dto.used,
        language: dto.language,
      });
    } else {
      error.value = toChatError(result.error);
    }
    isLoading.value = false;
  }

  return {
    messages: computed(() => messages.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    hasMessages: computed(() => messages.value.length > 0),
    ask,
    reset,
  };
}
