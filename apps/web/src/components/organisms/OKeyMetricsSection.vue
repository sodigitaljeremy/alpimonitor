<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import MSectionHeader from '@/components/molecules/MSectionHeader.vue';
import MStatCard from '@/components/molecules/MStatCard.vue';
import { useStationsStore } from '@/stores/stations';
import { useStatusStore } from '@/stores/status';
import { formatMinutesAgo } from '@/utils/relativeTime';

const { t } = useI18n();

// Both stores are already instantiated and fetched by OHeroSection (status)
// and OMapSection (stations), which mount earlier in the page. Re-using the
// Pinia singletons here is free — no duplicate network calls — and the
// computeds below react to the same refs.
const statusStore = useStatusStore();
const stationsStore = useStationsStore();

const { hasLoadedOnce: statusLoaded, today, minutesSinceLastSuccess } = storeToRefs(statusStore);
const { hasLoadedOnce: stationsLoaded, stations } = storeToRefs(stationsStore);

const placeholder = computed(() => t('keyMetrics.placeholder'));

// Gate every value on its owning store's hasLoadedOnce so the card never
// flashes a misleading zero before the first fetch lands. Once loaded, 0
// is a legitimate value (e.g. ingestion cron hasn't ticked yet after
// midnight UTC) and is displayed as-is.
const stationsLiveValue = computed<string>(() => {
  if (!stationsLoaded.value) return placeholder.value;
  return String(stations.value.filter((s) => s.dataSource === 'LIVE').length);
});

const stationsResearchValue = computed<string>(() => {
  if (!stationsLoaded.value) return placeholder.value;
  return String(stations.value.filter((s) => s.dataSource === 'RESEARCH').length);
});

const measurementsTodayValue = computed<string>(() => {
  if (!statusLoaded.value) return placeholder.value;
  return String(today.value.measurementsCreatedSum);
});

const lastSyncValue = computed<string>(() => {
  if (!statusLoaded.value) return placeholder.value;
  return formatMinutesAgo(minutesSinceLastSuccess.value, t);
});

const metrics = computed(() => [
  {
    icon: 'station' as const,
    label: t('keyMetrics.cards.stationsMonitored.label'),
    value: stationsLiveValue.value,
    hint: t('keyMetrics.cards.stationsMonitored.hint'),
  },
  {
    icon: 'chart' as const,
    label: t('keyMetrics.cards.measurementsToday.label'),
    value: measurementsTodayValue.value,
    hint: t('keyMetrics.cards.measurementsToday.hint'),
  },
  {
    icon: 'clock' as const,
    label: t('keyMetrics.cards.lastSync.label'),
    value: lastSyncValue.value,
    hint: t('keyMetrics.cards.lastSync.hint'),
  },
  {
    icon: 'signal' as const,
    label: t('keyMetrics.cards.researchZones.label'),
    value: stationsResearchValue.value,
    hint: t('keyMetrics.cards.researchZones.hint'),
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
