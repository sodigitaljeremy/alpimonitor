<script setup lang="ts">
import ABadge from '@/components/atoms/ABadge.vue';

type Kind = 'federal' | 'research';
type Theme = 'light' | 'dark';

withDefaults(
  defineProps<{
    name: string;
    river: string;
    context: string;
    kind?: Kind;
    theme?: Theme;
  }>(),
  {
    kind: 'research',
    theme: 'light',
  }
);
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
