<script setup lang="ts">
import type { BadgeStatus } from '@/lib/status';

withDefaults(
  defineProps<{
    status?: BadgeStatus;
    label: string;
  }>(),
  {
    status: 'live',
  }
);
</script>

<template>
  <div :class="['m-status-badge', `m-status-badge--${status}`]" role="status" aria-live="polite">
    <span class="m-status-badge__dot" aria-hidden="true" />
    <span class="m-status-badge__label">{{ label }}</span>
  </div>
</template>

<style scoped>
.m-status-badge {
  @apply inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1.5 font-sans text-sm font-medium backdrop-blur;
}

.m-status-badge__dot {
  @apply h-2 w-2 rounded-full;
}

.m-status-badge--live {
  @apply border-primary/20 text-primary;
}

.m-status-badge--live .m-status-badge__dot {
  @apply bg-primary shadow-glow-primary;
}

.m-status-badge--stale {
  @apply border-alpine/40 text-graphite;
}

.m-status-badge--stale .m-status-badge__dot {
  @apply bg-alpine;
}

.m-status-badge--offline {
  @apply border-slate-alpi/40 text-slate-alpi;
}

.m-status-badge--offline .m-status-badge__dot {
  @apply bg-slate-alpi;
}

.m-status-badge--loading {
  @apply border-slate-alpi/20 text-slate-alpi;
}

.m-status-badge--loading .m-status-badge__dot {
  @apply animate-pulse bg-slate-alpi/60;
}

@media (prefers-reduced-motion: reduce) {
  .m-status-badge--loading .m-status-badge__dot {
    @apply animate-none;
  }
}
</style>
