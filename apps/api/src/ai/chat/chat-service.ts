import type { LlmChatMessage, LlmClient } from '../llm-client.js';
import { buildChatSystemPrompt } from './chat-prompt.js';
import type { QueryPort } from './query-port.js';
import { CHAT_TOOLS, createToolDispatcher, type ToolResult } from './tools.js';

// AI layer — extension C3b (ADR-012 D5/D6). The chat orchestrator: it drives the
// grounding-strict tool-calling loop between Mistral and the QueryPort.
//
// Each round, the model may answer with prose (done) or request tool calls; the
// dispatcher runs them against the whitelist, their results are appended, and the
// model is called again. The loop is HARD-bounded to two tool rounds (D5): a
// third LLM call is forced to `tool_choice: 'none'` so it can only produce the
// final prose answer — there is never a fourth call.
//
// LlmErrors propagate untouched (the route layer, C4, maps them to HTTP). The
// service stays Prisma-free: it depends on the QueryPort interface, so the whole
// loop is testable with an in-memory fake (see chat-service.test.ts).

const MAX_TOOL_ROUNDS = 2; // → at most 3 LLM calls; the 3rd is forced to prose

export interface ChatToolUse {
  tool: string;
  // Raw JSON arguments string exactly as the model emitted them.
  args: string;
  // A compact, human-readable trace of what the call returned (count / absence /
  // error) — enough for observability without echoing the full payload.
  resultSummary: string;
}

export interface ChatAnswer {
  answer: string;
  used: ChatToolUse[];
}

export interface ChatServiceDeps {
  llm: LlmClient;
  queryPort: QueryPort;
  // Injectable clock, forwarded to the dispatcher so windowed stats resolve
  // deterministically in tests.
  now?: () => Date;
}

export interface AskOptions {
  language?: string; // default 'fr'
}

export interface ChatService {
  ask(question: string, opts?: AskOptions): Promise<ChatAnswer>;
}

function summarizeResult(result: ToolResult): string {
  if (!result.ok) return `erreur: ${result.error}`;
  const { data } = result;
  if (data === null) return 'aucune donnée';
  if (Array.isArray(data)) return `${data.length} résultat(s)`;
  return 'ok';
}

export function createChatService(deps: ChatServiceDeps): ChatService {
  const dispatcher = createToolDispatcher({ queryPort: deps.queryPort, now: deps.now });

  return {
    async ask(question, opts = {}): Promise<ChatAnswer> {
      const system = buildChatSystemPrompt(opts.language ?? 'fr');
      const messages: LlmChatMessage[] = [{ role: 'user', content: question }];
      const used: ChatToolUse[] = [];

      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const isFinalCall = round === MAX_TOOL_ROUNDS;

        const completion = await deps.llm.completeWithTools({
          system,
          messages,
          tools: CHAT_TOOLS,
          // Force prose on the bounded final call; let the model choose otherwise.
          toolChoice: isFinalCall ? 'none' : 'auto',
          operation: 'chat',
        });

        const toolCalls = completion.toolCalls ?? [];
        if (isFinalCall || toolCalls.length === 0) {
          return { answer: completion.text ?? '', used };
        }

        // Replay the assistant's tool-call turn, then each tool result, so the
        // next round sees exactly what it requested and what it got.
        messages.push({
          role: 'assistant',
          content: completion.text ?? '',
          toolCalls,
        });

        for (const call of toolCalls) {
          const result = await dispatcher.dispatch({ name: call.name, arguments: call.arguments });
          messages.push({
            role: 'tool',
            content: JSON.stringify(result),
            toolCallId: call.id,
          });
          used.push({
            tool: call.name,
            args: call.arguments,
            resultSummary: summarizeResult(result),
          });
        }
      }

      // Unreachable: the loop always returns on the final (forced) call.
      return { answer: '', used };
    },
  };
}
