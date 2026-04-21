<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import MSectionHeader from '@/components/molecules/MSectionHeader.vue';
import MStatCard from '@/components/molecules/MStatCard.vue';

const { t } = useI18n();

const metrics = computed(() => [
  {
    icon: 'station' as const,
    label: t('keyMetrics.stations.label'),
    value: t('keyMetrics.stations.value'),
    hint: t('keyMetrics.stations.hint'),
  },
  {
    icon: 'clock' as const,
    label: t('keyMetrics.frequency.label'),
    value: t('keyMetrics.frequency.value'),
    hint: t('keyMetrics.frequency.hint'),
  },
  {
    icon: 'chart' as const,
    label: t('keyMetrics.measurementsToday.label'),
    value: t('keyMetrics.measurementsToday.value'),
    hint: t('keyMetrics.measurementsToday.hint'),
  },
  {
    icon: 'signal' as const,
    label: t('keyMetrics.lastSync.label'),
    value: t('keyMetrics.lastSync.value'),
    hint: t('keyMetrics.lastSync.hint'),
  },
]);
</script>

<template>
  <section class="o-key-metrics-section" aria-labelledby="key-metrics-title">
    <div class="o-key-metrics-section__inner">
      <MSectionHeader
        heading-id="key-metrics-title"
        :title="t('keyMetrics.title')"
        :subtitle="t('keyMetrics.subtitle')"
        tone="light"
      />

      <div class="o-key-metrics-section__grid">
        <MStatCard
          v-for="metric in metrics"
          :key="metric.icon"
          :icon="metric.icon"
          :label="metric.label"
          :value="metric.value"
          :hint="metric.hint"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.o-key-metrics-section {
  @apply bg-glacier-soft py-20;
}

.o-key-metrics-section__inner {
  @apply mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 md:px-10;
}

.o-key-metrics-section__grid {
  @apply grid gap-4 sm:grid-cols-2 lg:grid-cols-4;
}
</style>
