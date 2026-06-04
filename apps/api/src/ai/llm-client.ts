// AI layer — extension A3 (ADR-012). Isolated LLM client interface.
//
// A calls Mistral directly through this interface. D inserts a LiteLLM proxy
// BEHIND the same interface — the narration service never changes. Failures
// surface as a typed `LlmError`, never an unhandled crash.

export type LlmErrorKind = 'config' | 'network' | 'http' | 'timeout' | 'parse';

export class LlmError extends Error {
  constructor(
    readonly kind: LlmErrorKind,
    message: string,
    override readonly cause?: unknown
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

export interface LlmCompletionRequest {
  system: string;
  user: string;
}

export interface LlmCompletion {
  text: string;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
}

export interface LlmClient {
  readonly provider: string;
  readonly model: string;
  complete(req: LlmCompletionRequest): Promise<LlmCompletion>;
}

export interface MistralClientOptions {
  apiKey?: string; // defaults to process.env.MISTRAL_API_KEY
  model?: string; // defaults to 'mistral-small-latest'
  endpoint?: string;
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
  // Injectables for deterministic tests.
  fetchImpl?: typeof fetch;
  now?: () => number;
}

const DEFAULT_MODEL = 'mistral-small-latest';
const DEFAULT_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 15_000;
// Low temperature: the model phrases pre-computed facts, we want stability.
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 220;

interface MistralChoiceMessage {
  content?: unknown;
}
interface MistralChoice {
  message?: MistralChoiceMessage;
}
interface MistralUsage {
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
}
interface MistralResponse {
  choices?: MistralChoice[];
  usage?: MistralUsage;
}

function asIntOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null;
}

export function createMistralClient(opts: MistralClientOptions = {}): LlmClient {
  const model = opts.model ?? DEFAULT_MODEL;
  const endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const temperature = opts.temperature ?? DEFAULT_TEMPERATURE;
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const doFetch = opts.fetchImpl ?? fetch;
  const clock = opts.now ?? Date.now;

  return {
    provider: 'mistral',
    model,
    async complete(req: LlmCompletionRequest): Promise<LlmCompletion> {
      const apiKey = opts.apiKey ?? process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        throw new LlmError('config', 'MISTRAL_API_KEY is not set');
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const startedAt = clock();

      let res: Response;
      try {
        res = await doFetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature,
            max_tokens: maxTokens,
            messages: [
              { role: 'system', content: req.system },
              { role: 'user', content: req.user },
            ],
          }),
          signal: controller.signal,
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw new LlmError('timeout', `Mistral request timed out after ${timeoutMs}ms`, err);
        }
        throw new LlmError('network', 'Mistral request failed at the network layer', err);
      } finally {
        clearTimeout(timer);
      }

      const latencyMs = Math.max(0, Math.round(clock() - startedAt));

      if (!res.ok) {
        throw new LlmError('http', `Mistral responded ${res.status} ${res.statusText}`);
      }

      let body: MistralResponse;
      try {
        body = (await res.json()) as MistralResponse;
      } catch (err) {
        throw new LlmError('parse', 'Mistral response was not valid JSON', err);
      }

      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim() === '') {
        throw new LlmError('parse', 'Mistral response had no text content');
      }

      return {
        text: content.trim(),
        promptTokens: asIntOrNull(body.usage?.prompt_tokens),
        completionTokens: asIntOrNull(body.usage?.completion_tokens),
        latencyMs,
      };
    },
  };
}
