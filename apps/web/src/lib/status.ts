/**
 * Visual status indicator for data freshness. Maps 1:1 to MStatusBadge
 * variants and is produced by OHeroSection from the status store.
 */
export type BadgeStatus = 'live' | 'stale' | 'offline' | 'loading';
