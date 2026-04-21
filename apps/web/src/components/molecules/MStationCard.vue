<script setup lang="ts">
import ABadge from '@/components/atoms/ABadge.vue';

withDefaults(
  defineProps<{
    name: string;
    river: string;
    context: string;
    kind?: 'federal' | 'research';
  }>(),
  {
    kind: 'research',
  }
);
</script>

<template>
  <article :class="['m-station-card', kind === 'federal' && 'm-station-card--federal']">
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
  @apply flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-5 backdrop-blur;
}

.m-station-card__header {
  @apply flex items-center justify-between;
}

.m-station-card__name {
  @apply mt-1 font-sans text-base font-semibold text-white;
}

.m-station-card__river {
  @apply font-mono text-xs uppercase tracking-wider text-white/70;
}

.m-station-card__context {
  @apply text-sm text-white/60;
}

.m-station-card--federal {
  @apply border-primary/40 bg-primary/10;
}
</style>
