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
  // Estimated USD cost. The raw provider client leaves this null; the
  // ObservingLlmClient decorator computes and fills it (extension D).
  costUsd: number | null;
}

// --- Tool-calling (extension C2, ADR-012) ---------------------------------
//
// The chat layer (C) drives Mistral's function-calling: the model is given a
// whitelist of tools and answers EITHER with prose OR with structured tool
// calls to run against the QueryPort. Narration (A) does not use any of this —
// `complete()` is left untouched.

export interface LlmToolDef {
  type: 'function';
  function: {
    name: string;
    description?: string;
    // JSON Schema for the tool arguments; opaque to this layer.
    parameters: Record<string, unknown>;
  };
}

// Mistral/OpenAI-compatible tool_choice values, plus the forced-function form.
export type LlmToolChoice =
  | 'auto'
  | 'any'
  | 'none'
  | { type: 'function'; function: { name: string } };

export interface LlmToolCall {
  id: string;
  name: string;
  // Raw JSON string exactly as the model emitted it; parsed by the caller (C).
  arguments: string;
}

export interface LlmChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  // Present on an assistant turn that requested tools (replayed in the next round).
  toolCalls?: LlmToolCall[];
  // Present on a tool-result turn, linking it back to the call it answers.
  toolCallId?: string;
}

export interface LlmToolCompletionRequest {
  system: string;
  messages: LlmChatMessage[];
  tools: LlmToolDef[];
  toolChoice?: LlmToolChoice;
  // Per-call observability label (e.g. 'chat'); overrides the decorator default.
  operation?: string;
}

export interface LlmToolCompletion {
  // Either text, tool calls, or both — at least one is always present.
  text: string | null;
  toolCalls: LlmToolCall[] | null;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
  costUsd: number | null;
}

export interface LlmClient {
  readonly provider: string;
  readonly model: string;
  complete(req: LlmCompletionRequest): Promise<LlmCompletion>;
  completeWithTools(req: LlmToolCompletionRequest): Promise<LlmToolCompletion>;
}

export interface MistralClientOptions {
  apiKey?: string; // defaults to process.env.MISTRAL_API_KEY
  model?: string; // defaults to 'mistral-small-latest'
  // Provider label recorded in observability. 'mistral' for the direct call;
  // 'litellm' when the same OpenAI-compatible client points at a LiteLLM proxy.
  provider?: string;
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

interface MistralToolCall {
  id?: unknown;
  function?: { name?: unknown; arguments?: unknown };
}
interface MistralChoiceMessage {
  content?: unknown;
  tool_calls?: unknown;
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

// Serialize one of our chat messages into the Mistral/OpenAI wire shape.
function toWireMessage(m: LlmChatMessage): Record<string, unknown> {
  if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: m.content,
      tool_calls: m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments },
      })),
    };
  }
  if (m.role === 'tool') {
    return { role: 'tool', content: m.content, tool_call_id: m.toolCallId };
  }
  return { role: m.role, content: m.content };
}

// Parse the model's tool_calls, dropping any malformed entry. Returns null when
// there are no usable calls (the response was prose).
function parseToolCalls(raw: unknown): LlmToolCall[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const calls: LlmToolCall[] = [];
  for (const tc of raw as MistralToolCall[]) {
    const name = tc?.function?.name;
    if (typeof name !== 'string') continue;
    const args = tc?.function?.arguments;
    calls.push({
      id: typeof tc.id === 'string' ? tc.id : '',
      name,
      arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {}),
    });
  }
  return calls.length > 0 ? calls : null;
}

export function createMistralClient(opts: MistralClientOptions = {}): LlmClient {
  const model = opts.model ?? DEFAULT_MODEL;
  const endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const temperature = opts.temperature ?? DEFAULT_TEMPERATURE;
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const clock = opts.now ?? Date.now;

  return {
    provider: opts.provider ?? 'mistral',
    model,
    async complete(req: LlmCompletionRequest): Promise<LlmCompletion> {
      const apiKey = opts.apiKey ?? process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        throw new LlmError('config', 'MISTRAL_API_KEY is not set');
      }

      // Resolve fetch at call time (not at factory time) so a test that stubs
      // the global after construction — and a runtime that swaps it — both work.
      const doFetch = opts.fetchImpl ?? globalThis.fetch;

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
        costUsd: null, // filled by the ObservingLlmClient decorator (D)
      };
    },

    // Tool-calling sibling of complete() (C2). Same transport and typed-error
    // discipline; sends `tools`/`tool_choice` and returns prose, tool calls, or
    // both. complete() is intentionally left byte-for-byte unchanged.
    async completeWithTools(req: LlmToolCompletionRequest): Promise<LlmToolCompletion> {
      const apiKey = opts.apiKey ?? process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        throw new LlmError('config', 'MISTRAL_API_KEY is not set');
      }

      const doFetch = opts.fetchImpl ?? globalThis.fetch;

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
            messages: [{ role: 'system', content: req.system }, ...req.messages.map(toWireMessage)],
            tools: req.tools,
            tool_choice: req.toolChoice ?? 'auto',
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

      const message = body.choices?.[0]?.message;
      const rawContent = message?.content;
      const text =
        typeof rawContent === 'string' && rawContent.trim() !== '' ? rawContent.trim() : null;
      const toolCalls = parseToolCalls(message?.tool_calls);

      // A tool-calling turn is valid with prose, tool calls, or both — but never
      // neither.
      if (text === null && toolCalls === null) {
        throw new LlmError('parse', 'Mistral response had neither text nor tool calls');
      }

      return {
        text,
        toolCalls,
        promptTokens: asIntOrNull(body.usage?.prompt_tokens),
        completionTokens: asIntOrNull(body.usage?.completion_tokens),
        latencyMs,
        costUsd: null, // filled by the ObservingLlmClient decorator (D)
      };
    },
  };
}
