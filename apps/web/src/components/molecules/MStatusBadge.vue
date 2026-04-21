<script setup lang="ts">
type Status = 'live' | 'stale' | 'offline';

withDefaults(
  defineProps<{
    status?: Status;
    label: string;
  }>(),
  {
    status: 'live',
  }
);
</script>

<template>
  <div :class="['m-status-badge', `m-status-badge--${status}`]" role="status">
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
  @apply bg-primary;
  box-shadow: 0 0 0 3px rgba(15, 40, 71, 0.12);
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
</style>
