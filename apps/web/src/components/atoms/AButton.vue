<script setup lang="ts">
type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

withDefaults(
  defineProps<{
    variant?: Variant;
    size?: Size;
    type?: 'button' | 'submit';
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
  }
);

defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<template>
  <button
    :type="type"
    :class="['a-button', `a-button--${variant}`, `a-button--${size}`]"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<style scoped>
.a-button {
  @apply inline-flex items-center justify-center gap-2 rounded-md font-sans font-medium transition-colors;
  @apply disabled:cursor-not-allowed disabled:opacity-50;
}

.a-button--primary {
  @apply bg-primary text-white hover:bg-primary-hover;
}

.a-button--secondary {
  @apply border border-slate-alpi/30 bg-white text-primary hover:bg-glacier;
}

.a-button--ghost {
  @apply text-primary hover:bg-glacier;
}

.a-button--sm {
  @apply px-3 py-1.5 text-sm;
}

.a-button--md {
  @apply px-4 py-2 text-sm;
}

.a-button--lg {
  @apply px-6 py-3 text-base;
}
</style>
