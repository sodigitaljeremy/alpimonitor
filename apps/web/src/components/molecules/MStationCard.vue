<script setup lang="ts">
import ABadge from '@/components/atoms/ABadge.vue';
import ASourcingBadge from '@/components/atoms/ASourcingBadge.vue';

type Kind = 'federal' | 'research';
type Theme = 'light' | 'dark';
type SourcingStatus = 'CONFIRMED' | 'ILLUSTRATIVE';

const props = withDefaults(
  defineProps<{
    name: string;
    river: string;
    context: string;
    kind?: Kind;
    theme?: Theme;
    sourcingStatus?: SourcingStatus;
  }>(),
  {
    kind: 'research',
    theme: 'light',
    sourcingStatus: undefined,
  }
);

// Only render the sourcing badge on research cards — federal BAFU stations
// are implicitly CONFIRMED (real LINDAS data), showing the badge there
// would add noise without information. See ADR-008.
const showSourcingBadge = () => props.kind === 'research' && props.sourcingStatus !== undefined;
</script>

<template>
  <article
    :class="['m-station-card', `m-station-card--theme-${theme}`, `m-station-card--kind-${kind}`]"
  >
    <header class="m-station-card__header">
      <ABadge :variant="kind === 'federal' ? 'live' : 'research'">
        {{ kind === 'federal' ? 'BAFU live' : 'CREALP' }}
      </ABadge>
    </header>
    <h4 class="m-station-card__name">{{ name }}</h4>
    <p class="m-station-card__river">{{ river }}</p>
    <p class="m-station-card__context">{{ context }}</p>
    <footer v-if="showSourcingBadge()" class="m-station-card__footer">
      <ASourcingBadge :status="sourcingStatus!" />
    </footer>
  </article>
</template>

<style scoped>
.m-station-card {
  @apply flex flex-col gap-2 rounded-lg border p-5 backdrop-blur transition-colors;
}

.m-station-card__header {
  @apply flex items-center justify-between;
}

.m-station-card__name {
  @apply mt-1 font-sans text-base font-semibold;
}

.m-station-card__river {
  @apply font-mono text-xs uppercase tracking-wider;
}

.m-station-card__context {
  @apply text-sm;
}

.m-station-card__footer {
  @apply mt-3 flex flex-wrap;
}

/* Light theme — for white / glacier host backgrounds. */
.m-station-card--theme-light {
  @apply border-slate-alpi/20 bg-white;
}

.m-station-card--theme-light .m-station-card__name {
  @apply text-primary;
}

.m-station-card--theme-light .m-station-card__river {
  @apply text-slate-alpi;
}

.m-station-card--theme-light .m-station-card__context {
  @apply text-graphite;
}

/* Dark theme — for graphite / deep host backgrounds. */
.m-station-card--theme-dark {
  @apply border-white/10 bg-white/5;
}

.m-station-card--theme-dark .m-station-card__name {
  @apply text-white;
}

.m-station-card--theme-dark .m-station-card__river {
  @apply text-white/70;
}

.m-station-card--theme-dark .m-station-card__context {
  @apply text-white/60;
}

/* Research badge defaults to text-graphite for light surfaces; on the
   dark theme that rendered 1.43:1 on the composited surface. Alpine is
   the RESEARCH token already used for borders/bg here — 5.85:1, WCAG AA. */
.m-station-card--theme-dark :deep(.a-badge--research) {
  @apply text-alpine;
}

/* Federal kind overrides border + background to carry the "live" accent,
   regardless of theme. Kind modifier sits after theme in the DOM so its
   declarations take precedence. */
.m-station-card--kind-federal.m-station-card--theme-light {
  @apply border-primary/30 bg-primary/5;
}

.m-station-card--kind-federal.m-station-card--theme-dark {
  @apply border-primary/40 bg-primary/10;
}
</style>
