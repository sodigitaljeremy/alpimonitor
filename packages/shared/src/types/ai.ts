// AI layer — extension D (ADR-012). Observability DTO for LLM calls.
// Aggregates today's LlmCallRun rows. The front maps these metrics to a badge
// (operational / degraded / unavailable); rich numbers stay here, not on the home.

export interface AiStatusResponse {
  ai: {
    callsToday: number;
    // null when no call happened today (avoids a misleading 0% / 100%).
    errorRate: number | null;
    costUsdToday: number;
    avgLatencyMs: number | null;
    lastCallAt: string | null;
  };
}
