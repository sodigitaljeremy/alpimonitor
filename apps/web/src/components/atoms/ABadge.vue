<script setup lang="ts">
type Variant = 'live' | 'research' | 'neutral';

withDefaults(
  defineProps<{
    variant?: Variant;
  }>(),
  {
    variant: 'neutral',
  }
);
</script>

<template>
  <span :class="['a-badge', `a-badge--${variant}`]">
    <slot />
  </span>
</template>

<style scoped>
.a-badge {
  @apply inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-sans text-xs font-medium uppercase tracking-wide;
}

.a-badge--live {
  @apply border-primary/20 bg-primary/5 text-primary;
}

.a-badge--research {
  @apply border-alpine/40 bg-alpine/10 text-graphite;
}

.a-badge--neutral {
  @apply border-slate-alpi/30 bg-glacier text-slate-alpi;
}
</style>
