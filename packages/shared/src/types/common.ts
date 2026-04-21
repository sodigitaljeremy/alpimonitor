export type Parameter = 'DISCHARGE' | 'WATER_LEVEL' | 'TEMPERATURE' | 'TURBIDITY';

export type FlowType = 'NATURAL' | 'RESIDUAL' | 'DOTATION';

// Mirrors the Prisma DataSource enum — see ADR-007.
// LIVE = ingested from LINDAS (federal BAFU).
// RESEARCH = instrumented by CREALP / operators, not publicly streamed.
// SEED = demo-only.
export type DataSource = 'LIVE' | 'RESEARCH' | 'SEED';
