// The LINDAS ingestion cron ticks every 10 minutes — see DEFAULT_SCHEDULE
// ('*/10 * * * *') in plugins/ingestion.ts. Completeness math (expected vs
// present points over a window) is anchored to that cadence, so it lives in a
// single named constant rather than a magic literal sprinkled at call sites.
//
// Future improvement (not implemented): infer the effective cadence from the
// median of inter-point deltas, to stay correct if the federal source changes
// its native resolution.
export const INGESTION_INTERVAL_MINUTES = 10;
