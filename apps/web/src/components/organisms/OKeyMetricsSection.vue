<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import MSectionHeader from '@/components/molecules/MSectionHeader.vue';
import MStatCard from '@/components/molecules/MStatCard.vue';

const { t } = useI18n();

type Metric = {
  icon: 'station' | 'clock' | 'chart' | 'signal';
  labelKey: string;
  valueKey: string;
  hintKey: string;
};

const metrics: Metric[] = [
  {
    icon: 'station',
    labelKey: 'keyMetrics.stations.label',
    valueKey: 'keyMetrics.stations.value',
    hintKey: 'keyMetrics.stations.hint',
  },
  {
    icon: 'clock',
    labelKey: 'keyMetrics.frequency.label',
    valueKey: 'keyMetrics.frequency.value',
    hintKey: 'keyMetrics.frequency.hint',
  },
  {
    icon: 'chart',
    labelKey: 'keyMetrics.measurementsToday.label',
    valueKey: 'keyMetrics.measurementsToday.value',
    hintKey: 'keyMetrics.measurementsToday.hint',
  },
  {
    icon: 'signal',
    labelKey: 'keyMetrics.lastSync.label',
    valueKey: 'keyMetrics.lastSync.value',
    hintKey: 'keyMetrics.lastSync.hint',
  },
];
</script>

<template>
  <section class="o-key-metrics-section" aria-labelledby="key-metrics-title">
    <div class="o-key-metrics-section__inner">
      <MSectionHeader
        :title="t('keyMetrics.title')"
        :subtitle="t('keyMetrics.subtitle')"
        tone="light"
      />

      <div class="o-key-metrics-section__grid">
        <MStatCard
          v-for="metric in metrics"
          :key="metric.icon"
          :icon="metric.icon"
          :label="t(metric.labelKey)"
          :value="t(metric.valueKey)"
          :hint="t(metric.hintKey)"
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
