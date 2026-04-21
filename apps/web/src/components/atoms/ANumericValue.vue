<script setup lang="ts">
type Size = 'md' | 'lg' | 'xl';

withDefaults(
  defineProps<{
    value: string | number;
    unit?: string;
    size?: Size;
  }>(),
  {
    unit: undefined,
    size: 'md',
  }
);
</script>

<template>
  <span :class="['a-numeric-value', `a-numeric-value--${size}`]">
    <span class="a-numeric-value__value">{{ value }}</span>
    <span v-if="unit" class="a-numeric-value__unit">{{ unit }}</span>
  </span>
</template>

<style scoped>
.a-numeric-value {
  @apply inline-flex items-baseline gap-1 font-mono text-primary;
}

.a-numeric-value__value {
  @apply font-medium tabular-nums;
}

.a-numeric-value__unit {
  @apply text-slate-alpi;
}

.a-numeric-value--md {
  @apply text-base;
}

.a-numeric-value--md .a-numeric-value__unit {
  @apply text-sm;
}

.a-numeric-value--lg {
  @apply text-2xl;
}

.a-numeric-value--lg .a-numeric-value__unit {
  @apply text-base;
}

.a-numeric-value--xl {
  @apply text-4xl;
}

.a-numeric-value--xl .a-numeric-value__unit {
  @apply text-lg;
}
</style>
