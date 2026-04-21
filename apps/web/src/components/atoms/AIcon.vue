<script setup lang="ts">
type Name =
  | 'station'
  | 'clock'
  | 'chart'
  | 'signal'
  | 'arrow-down'
  | 'external'
  | 'github'
  | 'linkedin'
  | 'close';

withDefaults(
  defineProps<{
    name: Name;
    size?: number;
  }>(),
  {
    size: 24,
  }
);
</script>

<template>
  <svg
    :width="size"
    :height="size"
    :class="['a-icon', `a-icon--${name}`]"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="name === 'station'">
      <path d="M12 2c-3.314 0-6 2.5-6 6 0 4.5 6 12 6 12s6-7.5 6-12c0-3.5-2.686-6-6-6z" />
      <circle cx="12" cy="8" r="2" />
    </template>
    <template v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </template>
    <template v-else-if="name === 'chart'">
      <path d="M3 21V5" />
      <path d="M3 21h18" />
      <path d="M7 17v-5" />
      <path d="M12 17v-9" />
      <path d="M17 17v-7" />
    </template>
    <template v-else-if="name === 'signal'">
      <path d="M2 12c3-3 7-3 10 0s7 3 10 0" />
      <path d="M5 16c2-2 5-2 7 0s5 2 7 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" />
    </template>
    <template v-else-if="name === 'arrow-down'">
      <path d="M12 5v14" />
      <path d="m6 13 6 6 6-6" />
    </template>
    <template v-else-if="name === 'external'">
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </template>
    <template v-else-if="name === 'github'">
      <path
        d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"
      />
    </template>
    <template v-else-if="name === 'linkedin'">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" fill="currentColor" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </template>
  </svg>
</template>

<style scoped>
.a-icon {
  @apply shrink-0;
}
</style>
