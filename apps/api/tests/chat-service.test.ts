import { describe, expect, it } from 'vitest';

import type { AlertDTO, StationLatestMeasurement } from '@alpimonitor/shared';

import type {
  LlmClient,
  LlmCompletionRequest,
  LlmToolCall,
  LlmToolCompletion,
  LlmToolCompletionRequest,
} from '../src/ai/llm-client.js';
import { createChatService } from '../src/ai/chat/chat-service.js';
import { CHAT_TOOLS } from '../src/ai/chat/tools.js';
import type {
  FindStationsQuery,
  LatestMeasurementsQuery,
  ListAlertsQuery,
  MeasurementStats,
  MeasurementStatsQuery,
  QueryPort,
  StationIdentity,
} from '../src/ai/chat/query-port.js';

// AI layer — extension C3b (ADR-012 D5/D6). The chat loop, proven deterministic:
// a SCRIPTED LlmClient feeds a fixed sequence of completions and an in-memory
// QueryPort answers the tools. No Mistral, no Prisma — just the orchestration.

// --- Scripted LLM: returns queued completions, records every request ---------
class ScriptedLlmClient implements LlmClient {
  readonly provider = 'fake';
  readonly model = 'fake-model';
  readonly calls: LlmToolCompletionRequest[] = [];

  constructor(private readonly script: LlmToolCompletion[]) {}

  async complete(_req: LlmCompletionRequest): Promise<never> {
    throw new Error('complete() is not used by the chat service');
  }

  async completeWithTools(req: LlmToolCompletionRequest): Promise<LlmToolCompletion> {
    // Snapshot messages at call time: the service mutates one live array across
    // rounds (the real client serialises it immediately), so we must capture it
    // now rather than hold a reference that later rounds keep growing.
    this.calls.push({ ...req, messages: [...req.messages] });
    const next = this.script[this.calls.length - 1];
    // A call beyond the script means the loop ran longer than expected (e.g. it
    // ignored the D5 bound) — fail loudly instead of hanging.
    if (!next) throw new Error(`unexpected LLM call #${this.calls.length}`);
    return next;
  }
}

function toolCall(id: string, name: string, args: string): LlmToolCall {
  return { id, name, arguments: args };
}

function withToolCalls(toolCalls: LlmToolCall[]): LlmToolCompletion {
  return {
    text: null,
    toolCalls,
    promptTokens: null,
    completionTokens: null,
    latencyMs: 0,
    costUsd: null,
  };
}

function withText(text: string): LlmToolCompletion {
  return {
    text,
    toolCalls: null,
    promptTokens: null,
    completionTokens: null,
    latencyMs: 0,
    costUsd: null,
  };
}

// --- In-memory QueryPort (substitutability, mirrors C1) ----------------------
const SION_IDENTITY: StationIdentity = {
  id: 'stn-sion',
  name: 'Sion',
  riverName: 'Rhône',
  dataSource: 'LIVE',
  parameters: ['DISCHARGE'],
};

const SION_LATEST: StationLatestMeasurement[] = [
  {
    parameter: 'DISCHARGE',
    unit: 'm³/s',
    value: 42.5,
    recordedAt: '2026-06-04T21:00:00.000Z',
    status: 'NORMAL',
  },
];

class InMemoryQueryPort implements QueryPort {
  async findStations(query: FindStationsQuery): Promise<StationIdentity[]> {
    const needle = query.search?.trim().toLowerCase();
    if (!needle) return [SION_IDENTITY];
    return [SION_IDENTITY].filter(
      (s) => s.name.toLowerCase().includes(needle) || s.riverName.toLowerCase().includes(needle)
    );
  }

  async getLatestMeasurements(query: LatestMeasurementsQuery): Promise<StationLatestMeasurement[]> {
    return query.stationId === 'stn-sion' ? SION_LATEST : [];
  }

  async getMeasurementStats(_query: MeasurementStatsQuery): Promise<MeasurementStats | null> {
    return null;
  }

  async listAlerts(_query: ListAlertsQuery): Promise<AlertDTO[]> {
    return [];
  }
}

function buildService(script: LlmToolCompletion[]) {
  const llm = new ScriptedLlmClient(script);
  const service = createChatService({ llm, queryPort: new InMemoryQueryPort() });
  return { llm, service };
}

describe('chat service — grounding-strict tool loop (D5/D6)', () => {
  it('answers a simple question via one tool call, grounded + traced', async () => {
    const { llm, service } = buildService([
      withToolCalls([toolCall('c1', 'get_latest_measurements', '{"stationId":"stn-sion"}')]),
      withText('Le débit à Sion est de 42,5 m³/s.'),
    ]);

    const result = await service.ask('Quel est le débit à Sion ?');

    expect(result.answer).toBe('Le débit à Sion est de 42,5 m³/s.');
    expect(result.used).toEqual([
      {
        tool: 'get_latest_measurements',
        args: '{"stationId":"stn-sion"}',
        resultSummary: '1 résultat(s)',
      },
    ]);
    // Two LLM calls, both labelled operation:'chat' with the four whitelisted tools.
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[0]!.operation).toBe('chat');
    expect(llm.calls[0]!.tools).toBe(CHAT_TOOLS);
    expect(llm.calls[0]!.toolChoice).toBe('auto');
  });

  it('chains find_stations → get_latest_measurements across two rounds', async () => {
    const { llm, service } = buildService([
      withToolCalls([toolCall('c1', 'find_stations', '{"search":"sion"}')]),
      withToolCalls([toolCall('c2', 'get_latest_measurements', '{"stationId":"stn-sion"}')]),
      withText('Sion (Rhône) : débit 42,5 m³/s.'),
    ]);

    const result = await service.ask('Donne-moi le débit de la station de Sion.');

    expect(result.answer).toBe('Sion (Rhône) : débit 42,5 m³/s.');
    expect(result.used.map((u) => u.tool)).toEqual(['find_stations', 'get_latest_measurements']);
    expect(llm.calls).toHaveLength(3);

    // The 2nd call must carry the threaded conversation: the assistant tool-call
    // turn plus the find_stations result, so the model can resolve the id.
    const secondCallMessages = llm.calls[1]!.messages;
    expect(secondCallMessages.map((m) => m.role)).toEqual(['user', 'assistant', 'tool']);
    const toolMsg = secondCallMessages[2]!;
    expect(toolMsg.toolCallId).toBe('c1');
    expect(toolMsg.content).toContain('stn-sion');
  });

  it('enforces the hard 2-round bound: 3rd call is forced to prose, no 4th call', async () => {
    // The model keeps asking for tools on rounds 1 and 2; round 3 is forced.
    const { llm, service } = buildService([
      withToolCalls([toolCall('c1', 'find_stations', '{"search":"sion"}')]),
      withToolCalls([toolCall('c2', 'get_latest_measurements', '{"stationId":"stn-sion"}')]),
      withText('Réponse finale forcée après deux tours.'),
    ]);

    const result = await service.ask('Question qui boucle.');

    expect(result.answer).toBe('Réponse finale forcée après deux tours.');
    // Exactly three LLM calls — a fourth would throw in the scripted client.
    expect(llm.calls).toHaveLength(3);
    // The bounded final call disables tools so it can only answer in prose.
    expect(llm.calls[2]!.toolChoice).toBe('none');
    expect(llm.calls[0]!.toolChoice).toBe('auto');
    expect(llm.calls[1]!.toolChoice).toBe('auto');
    // Only the two tool rounds were dispatched.
    expect(result.used).toHaveLength(2);
  });

  it('answers out-of-scope questions without any tool call (grounding refusal)', async () => {
    const { llm, service } = buildService([withText('Je ne peux pas répondre à cette question.')]);

    const result = await service.ask('Quel temps fera-t-il demain à Sion ?');

    expect(result.answer).toBe('Je ne peux pas répondre à cette question.');
    expect(result.used).toEqual([]);
    expect(llm.calls).toHaveLength(1);
  });
});
