<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import MSectionHeader from '@/components/molecules/MSectionHeader.vue';
import MStationCard from '@/components/molecules/MStationCard.vue';
import { useI18nList } from '@/composables/useI18nList';

const { t } = useI18n();

type ResearchStation = {
  name: string;
  river: string;
  context: string;
  sourcingStatus: 'CONFIRMED' | 'ILLUSTRATIVE';
};

const paragraphs = useI18nList<string>('researchZones.paragraphs');
const stations = useI18nList<ResearchStation>('researchZones.stations');
</script>

<template>
  <section class="o-research-zones-section" aria-labelledby="research-zones-title">
    <div class="o-research-zones-section__inner">
      <MSectionHeader
        heading-id="research-zones-title"
        eyebrow="Val d'Hérens"
        :title="t('researchZones.title')"
        :subtitle="t('researchZones.leadIn')"
        tone="dark"
      />

      <div class="o-research-zones-section__prose">
        <p v-for="(paragraph, index) in paragraphs" :key="index">{{ paragraph }}</p>
      </div>

      <div class="o-research-zones-section__stations">
        <h3 class="o-research-zones-section__stations-title">
          {{ t('researchZones.stationsTitle') }}
        </h3>
        <div class="o-research-zones-section__grid">
          <MStationCard
            v-for="station in stations"
            :key="station.name"
            :name="station.name"
            :river="station.river"
            :context="station.context"
            :sourcing-status="station.sourcingStatus"
            kind="research"
            theme="dark"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.o-research-zones-section {
  @apply bg-graphite py-24 text-glacier;
}

.o-research-zones-section__inner {
  @apply mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 md:px-10;
}

.o-research-zones-section__prose {
  @apply flex max-w-3xl flex-col gap-4 text-base leading-relaxed text-glacier/85;
}

.o-research-zones-section__stations {
  @apply mt-4 flex flex-col gap-5;
}

.o-research-zones-section__stations-title {
  @apply font-mono text-xs font-medium uppercase tracking-[0.2em] text-alpine;
}

.o-research-zones-section__grid {
  @apply grid gap-4 md:grid-cols-3;
}
</style>
