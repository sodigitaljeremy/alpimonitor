<script setup lang="ts">
import AIcon from '@/components/atoms/AIcon.vue';
import ANumericValue from '@/components/atoms/ANumericValue.vue';

defineProps<{
  icon: 'station' | 'clock' | 'chart' | 'signal';
  label: string;
  value: string;
  hint: string;
}>();
</script>

<template>
  <article class="m-stat-card">
    <div class="m-stat-card__icon">
      <AIcon :name="icon" :size="28" />
    </div>
    <div class="m-stat-card__body">
      <p class="m-stat-card__label">{{ label }}</p>
      <ANumericValue :value="value" size="lg" />
      <p class="m-stat-card__hint">{{ hint }}</p>
    </div>
  </article>
</template>

<style scoped>
.m-stat-card {
  @apply flex flex-col gap-4 rounded-lg border border-slate-alpi/15 bg-white p-6 shadow-card transition-colors;
}

.m-stat-card:hover {
  @apply border-primary/20;
}

.m-stat-card__icon {
  @apply flex h-11 w-11 items-center justify-center rounded-md bg-glacier text-primary;
  opacity: 0.85;
}

.m-stat-card__label {
  @apply font-sans text-xs font-medium uppercase tracking-wider text-slate-alpi;
}

.m-stat-card__body {
  @apply flex flex-col gap-1;
}

.m-stat-card__hint {
  @apply mt-1 text-sm text-slate-alpi;
}
</style>
