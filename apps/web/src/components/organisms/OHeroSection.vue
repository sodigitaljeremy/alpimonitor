<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AIcon from '@/components/atoms/AIcon.vue';
import MStatusBadge from '@/components/molecules/MStatusBadge.vue';
import { usePolling } from '@/composables/shared/usePolling';
import type { BadgeStatus } from '@/lib/status';
import { useStatusStore } from '@/stores/status';

const { t } = useI18n();

const statusStore = useStatusStore();
const { error, hasLoadedOnce, isHealthy, minutesSinceLastSuccess } = storeToRefs(statusStore);

const badgeStatus = computed<BadgeStatus>(() => {
  if (!hasLoadedOnce.value) return 'loading';
  if (error.value) return 'offline';
  if (minutesSinceLastSuccess.value === null) return 'offline';
  return isHealthy.value ? 'live' : 'stale';
});

const badgeLabel = computed(() => {
  switch (badgeStatus.value) {
    case 'loading':
      return t('status.loading');
    case 'offline':
      return t('status.offline');
    case 'live':
    case 'stale':
      return minutesSinceLastSuccess.value === 0
        ? t('status.lastUpdateJustNow')
        : t('status.lastUpdate', { minutes: minutesSinceLastSuccess.value ?? 0 });
  }
  return '';
});

const POLL_INTERVAL_MS = 60_000;

usePolling(() => statusStore.fetchStatus(), POLL_INTERVAL_MS, { immediate: true });
</script>

<template>
  <section class="o-hero-section" aria-labelledby="hero-title">
    <div class="o-hero-section__inner">
      <div class="o-hero-section__status">
        <MStatusBadge :status="badgeStatus" :label="badgeLabel" />
      </div>

      <div class="o-hero-section__content">
        <p class="o-hero-section__eyebrow">{{ t('meta.tagline') }}</p>
        <h1 id="hero-title" class="o-hero-section__title">
          {{ t('hero.title') }}
        </h1>
        <p class="o-hero-section__subtitle">{{ t('hero.subtitle') }}</p>
        <p class="o-hero-section__intro">{{ t('hero.intro') }}</p>
      </div>

      <a href="#map" class="o-hero-section__scroll" :aria-label="t('meta.scrollHint')">
        <span class="o-hero-section__scroll-label">{{ t('meta.scrollHint') }}</span>
        <AIcon name="arrow-down" :size="18" />
      </a>
    </div>

    <svg
      class="o-hero-section__silhouette"
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0,120 L0,80 L120,40 L220,75 L320,25 L420,70 L540,20 L660,65 L780,35 L900,75 L1020,30 L1140,60 L1260,25 L1360,55 L1440,40 L1440,120 Z"
        fill="currentColor"
      />
    </svg>
  </section>
</template>

<style scoped>
.o-hero-section {
  @apply relative flex min-h-screen flex-col overflow-hidden bg-glacier;
}

.o-hero-section__inner {
  @apply relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-between px-6 py-10 md:px-10 md:py-16;
}

.o-hero-section__status {
  @apply flex justify-start md:justify-end;
}

.o-hero-section__content {
  @apply flex max-w-2xl flex-col gap-5 pt-8 md:pt-16;
}

.o-hero-section__eyebrow {
  @apply font-mono text-xs font-medium uppercase tracking-[0.25em] text-primary/70;
}

.o-hero-section__title {
  @apply font-sans text-5xl font-semibold tracking-tight text-primary md:text-7xl;
}

.o-hero-section__subtitle {
  @apply text-lg leading-relaxed text-graphite md:text-xl;
}

.o-hero-section__intro {
  @apply max-w-xl text-base leading-relaxed text-slate-alpi;
}

.o-hero-section__scroll {
  @apply mt-10 inline-flex items-center gap-2 self-start font-sans text-sm font-medium text-primary transition-colors hover:text-primary-hover;
}

.o-hero-section__scroll-label {
  @apply font-mono text-xs uppercase tracking-[0.2em];
}

.o-hero-section__silhouette {
  @apply absolute inset-x-0 bottom-0 h-24 w-full text-primary/5 md:h-32;
}

@media (prefers-reduced-motion: reduce) {
  .o-hero-section__scroll {
    @apply transition-none;
  }
}
</style>
